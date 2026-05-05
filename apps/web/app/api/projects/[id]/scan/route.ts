import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { stringify } from "yaml";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { githubAtomicWrite } from "@/lib/git-storage/github";
import { scanRateLimit, checkRateLimit } from "@/lib/rate-limit";

const SOURCE_EXTS = /\.(ts|tsx|js|jsx|mjs|py|go|rs|rb|java|kt|swift|cs|cpp|c|h|vue|svelte)$/;
const IGNORE_PATHS = /node_modules|\.next|dist|build|\.git|coverage|__pycache__|\.cache/;

import { fetchRepoFilePaths } from "@/lib/github-api";

function detectTechStack(paths: string[]) {
  const all = paths.join(" ");
  const languages: string[] = [];
  const frameworks: string[] = [];
  const databases: string[] = [];
  const services: string[] = [];

  if (paths.some(p => /\.(ts|tsx)$/.test(p))) languages.push("TypeScript");
  if (paths.some(p => /\.(js|jsx|mjs)$/.test(p)) && !languages.includes("TypeScript")) languages.push("JavaScript");
  if (paths.some(p => /\.py$/.test(p))) languages.push("Python");
  if (paths.some(p => /\.go$/.test(p))) languages.push("Go");
  if (paths.some(p => /\.rs$/.test(p))) languages.push("Rust");

  if (paths.some(p => p.includes("next.config"))) frameworks.push("Next.js");
  if (all.includes("react") || paths.some(p => /\.(tsx|jsx)$/.test(p))) frameworks.push("React");
  if (paths.some(p => p.includes("svelte"))) frameworks.push("Svelte");
  if (paths.some(p => p.includes("vue"))) frameworks.push("Vue");
  if (paths.some(p => p.includes("fastapi") || p.includes("main.py"))) frameworks.push("FastAPI");

  if (all.includes("supabase")) databases.push("Supabase");
  if (all.includes("prisma")) databases.push("PostgreSQL/Prisma");
  if (all.includes("mongo")) databases.push("MongoDB");
  if (all.includes("redis")) databases.push("Redis");

  if (all.includes("vercel")) services.push("Vercel");
  if (all.includes("stripe")) services.push("Stripe");
  if (all.includes("openai")) services.push("OpenAI");
  if (all.includes("gemini")) services.push("Google Gemini");

  return { languages, frameworks, databases, services, generated_at: new Date().toISOString() };
}

import { callAgent } from "@/lib/ai/provider";
import { SAGE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { extractJSON } from "@/lib/ai";

async function buildModuleGraph(sourcePaths: string[]) {
  const capped = sourcePaths.slice(0, 200);

  const prompt = `You are analyzing a software repository. Given these source file paths, generate a module dependency graph.
Source files:
${capped.map(p => `- ${p}`).join("\n")}

Return JSON with this exact shape:
{
  "modules": [
    {
      "id": "<id>", "name": "<name>", "path": "<path>", "summary": "...", "dependencies": []
    }
  ],
  "generated_at": "${new Date().toISOString()}"
}`;

  const resText = await callAgent("SAGE", {
    prompt,
    systemPrompt: SAGE_SYSTEM_PROMPT,
    responseMimeType: "application/json",
  });

  return JSON.parse(extractJSON(resText));
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateCheck = await checkRateLimit(scanRateLimit, session.user.id!);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateCheck.retryAfter}s.` },
      { status: 429 }
    );
  }

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: error?.message ?? "Project not found" }, { status: 404 });
  }

  const token = project.github_token as string | null;
  if (!token) {
    return NextResponse.json({ error: "No GitHub token. Please reconnect your account." }, { status: 400 });
  }

  try {
    // Set status to scanning
    const initialCache = {
      ...((project.config_cache as object) || {}),
      scan_status: "scanning"
    };
    
    await supabaseAdmin
      .from("projects")
      .update({ config_cache: initialCache })
      .eq("id", id);

    // Run heavy work in background
    after(async () => {
      try {
        const branch = (project.default_branch as string) || "main";
        const allPaths = await fetchRepoFilePaths(project.repo_full, token, branch);
        const sourcePaths = allPaths.filter(p => SOURCE_EXTS.test(p));

        let moduleGraph;
        let techStack = detectTechStack(allPaths);

        try {
          moduleGraph = await buildModuleGraph(sourcePaths);
        } catch (aiErr: any) {
          // STATIC FALLBACK: Build a basic graph without AI
          moduleGraph = {
            modules: sourcePaths.slice(0, 50).map(p => {
              const fileId = p.split("/").pop()?.split(".")[0] || p;
              return {
                id: fileId,
                name: fileId.toUpperCase(),
                path: p,
                summary: "Source module detected via static scan.",
                dependencies: []
              };
            }),
            generated_at: new Date().toISOString(),
            is_static: true
          };
        }

        // Re-fetch project to ensure we don't overwrite other config_cache updates
        const { data: latestProject } = await supabaseAdmin
          .from("projects")
          .select("config_cache")
          .eq("id", id)
          .single();

        const configCache = {
          ...((latestProject?.config_cache as object) || {}),
          scan_status: "idle",
          codebase: {
            module_graph: moduleGraph,
            tech_stack: techStack,
            file_count: allPaths.length,
            source_file_count: sourcePaths.length,
            scanned_at: new Date().toISOString(),
          },
        };

        await supabaseAdmin
          .from("projects")
          .update({ config_cache: configCache, last_scan_at: new Date().toISOString() })
          .eq("id", id);

        // Fire-and-forget: upsert module embeddings for RAG search
        if (moduleGraph?.modules?.length > 0) {
          import('@/lib/ai/embeddings').then(({ upsertModuleEmbeddings }) =>
            upsertModuleEmbeddings(
              id,
              moduleGraph.modules.map((m: any) => ({
                id: m.id,
                path: m.path,
                summary: m.summary ?? m.name ?? m.path,
              }))
            )
          ).catch(err => console.error('[scan] embeddings upsert failed:', err))
        }

        // Write scan results back to .repomind/architecture/ (non-fatal)
        if (token && moduleGraph && techStack) {
          try {
            await githubAtomicWrite(
              { repoFull: project.repo_full, token, branch },
              {
                ".repomind/architecture/modules.json": JSON.stringify(moduleGraph, null, 2) + "\n",
                ".repomind/architecture/tech-stack.yml": stringify(techStack),
              },
              "chore(repomind): update architecture scan results"
            );
          } catch (writeErr) {
            console.error("[scan] Failed to write back to .repomind:", writeErr);
          }
        }

        const { data: owner } = await supabaseAdmin.from("users").select("email, name").eq("id", session.user.id).single();
        if (owner?.email) {
          const { sendScanCompleteEmail } = await import("@/lib/email");
          sendScanCompleteEmail(owner.email, project.name, moduleGraph.modules?.length ?? 0).catch(() => {});
        }
      } catch (err) {
        console.error("[scan] Background job failed", err);
        // Set back to error state
        const { data: errProject } = await supabaseAdmin.from("projects").select("config_cache").eq("id", id).single();
        if (errProject) {
          await supabaseAdmin.from("projects").update({
            config_cache: { ...((errProject.config_cache as object) || {}), scan_status: "error" }
          }).eq("id", id);
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: "Scan started in background",
      status: "scanning"
    }, { status: 202 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scan failed";
    console.error("[scan]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
