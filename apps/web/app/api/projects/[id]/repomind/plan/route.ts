import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { decomposePlan } from "@/lib/ai";
import { githubBatchWrite, ticketFilePath, writeTicketMarkdown, GitHubRepoFileClient, rebuildTicketIndex } from "@/lib/git-storage";
import { loadRepomindContext } from "@/lib/repomind-config";
import { aiRateLimit, checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateCheck = await checkRateLimit(aiRateLimit, session.user.id!);
  if (!rateCheck.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const { planText } = await req.json();

  if (!planText) {
    return NextResponse.json({ error: "No plan text provided" }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const configCache = project.config_cache as any;
  const moduleGraph = configCache?.codebase?.module_graph;

  if (!moduleGraph) {
    return NextResponse.json({ error: "Please scan your codebase first." }, { status: 400 });
  }

  let repomindConfig = undefined
  if (project.github_token) {
    try {
      const ctx = await loadRepomindContext(
        project.repo_full,
        project.github_token,
        project.default_branch || "main"
      )
      if (ctx) repomindConfig = ctx.config
    } catch {
      // non-fatal
    }
  }

  try {
    const decomposed = await decomposePlan(planText, moduleGraph, repomindConfig);

    const files: Record<string, string> = {};
    const now = new Date().toISOString();

    for (const epic of decomposed.epics) {
      for (const task of epic.tasks) {
        const ticketInput = { ...task, epic: epic.id, created_at: now };
        const path = ticketFilePath(ticketInput);
        const content = writeTicketMarkdown(ticketInput);
        files[path] = content;
      }
    }

    if (Object.keys(files).length > 0) {
      await githubBatchWrite(
        {
          repoFull: project.repo_full,
          token: project.github_token,
          branch: project.default_branch || "main",
        },
        files,
        `repomind: decomposed plan into ${Object.keys(files).length} tickets`
      );

      try {
        const [owner, repoName] = project.repo_full.split("/");
        const client = new GitHubRepoFileClient({
          owner,
          repo: repoName,
          token: project.github_token,
          branch: project.default_branch || "main",
        });
        await rebuildTicketIndex(client);
      } catch (indexErr) {
        console.error("Failed to rebuild ticket index:", indexErr);
      }
    }

    return NextResponse.json({ success: true, ticketCount: Object.keys(files).length });
  } catch (err: any) {
    console.error("Plan decomposition failed:", err);
    return NextResponse.json({
      error: `Failed to decompose plan: ${err.message || "Unknown error"}`,
    }, { status: 500 });
  }
}
