import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
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

import { callGemini } from "@/lib/ai/gemini";

async function buildModuleGraph(sourcePaths: string[], apiKey: string) {
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

  const resText = await callGemini({
    apiKey,
    prompt,
    systemPrompt: "You are an expert software architect. Return only valid JSON, no markdown.",
    responseMimeType: "application/json",
    temperature: 0.1,
  });

  const cleaned = resText.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  try {
    const branch = (project.default_branch as string) || "main";
    const allPaths = await fetchRepoFilePaths(project.repo_full, token, branch);
    const sourcePaths = allPaths.filter(p => SOURCE_EXTS.test(p));

    let moduleGraph;
    let techStack = detectTechStack(allPaths);

    try {
      moduleGraph = await buildModuleGraph(sourcePaths, apiKey);
    } catch (aiErr: any) {
      // STATIC FALLBACK: Build a basic graph without AI
      moduleGraph = {
        modules: sourcePaths.slice(0, 50).map(p => {
          const id = p.split("/").pop()?.split(".")[0] || p;
          return {
            id,
            name: id.toUpperCase(),
            path: p,
            summary: "Source module detected via static scan.",
            dependencies: []
          };
        }),
        generated_at: new Date().toISOString(),
        is_static: true
      };
    }

    const configCache = {
      ...((project.config_cache as object) || {}),
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

    return NextResponse.json({
      success: true,
      moduleCount: moduleGraph.modules?.length ?? 0,
      fileCount: allPaths.length,
      techStack,
      isPartial: sourcePaths.length > 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scan failed";
    console.error("[scan]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
