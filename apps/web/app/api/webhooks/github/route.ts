import { NextRequest, NextResponse } from "next/server";
import { verifyGithubWebhook } from "@/lib/github";
import { supabaseAdmin } from "@/lib/supabase";
import { matchCommitToTickets } from "@/lib/ai/matching";
import { saveSuggestions } from "@/lib/suggestions";

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";
  const event = req.headers.get("x-github-event") || "";

  let body: any;
  try { body = JSON.parse(payload); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repoFull = body.repository?.full_name;
  if (!repoFull) return NextResponse.json({ error: "Missing repository" }, { status: 400 });

  const { data: project } = await supabaseAdmin
    .from("projects").select("*").eq("repo_full", repoFull).single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    const isValid = await verifyGithubWebhook(payload, signature, secret);
    if (!isValid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event === "push" && project.github_token) {
    const branch = body.ref?.replace("refs/heads/", "") || project.default_branch || "main";
    const commits: any[] = body.commits ?? [];

    // Log event
    try {
      await supabaseAdmin.from("webhook_events").insert({
        project_id: project.id, event_type: event, payload: body, status: "pending",
      });
    } catch { /* non-fatal */ }

    // Run in background (fire and forget)
    runPatchMatching(project, branch, commits).catch(err =>
      console.error("[webhook/push] PATCH matching failed:", err.message)
    );

    return NextResponse.json({ message: "Push received" });
  }

  if (event === "pull_request" && body.action === "closed" && body.pull_request?.merged) {
    try {
      await supabaseAdmin.from("webhook_events").insert({
        project_id: project.id, event_type: "pr_merged", payload: body, status: "pending",
      });
    } catch { /* non-fatal */ }

    runChangelogGeneration(project, body.pull_request).catch(err =>
      console.error("[webhook/pr] Changelog generation failed:", err.message)
    );

    return NextResponse.json({ message: "PR merge received" });
  }

  return NextResponse.json({ message: "Event ignored" });
}

async function runPatchMatching(project: any, branch: string, commits: any[]) {
  const { GitHubRepoFileClient, getTicketIndex, rebuildTicketIndex } = await import("@/lib/git-storage");
  const [owner, repo] = project.repo_full.split("/");
  const client = new GitHubRepoFileClient({
    owner, repo, token: project.github_token, branch,
  });

  let index = await getTicketIndex(client);
  if (!index) index = await rebuildTicketIndex(client);

  const openTickets = (index?.tickets ?? []).filter(
    (t: any) => !["done", "DONE"].includes(t.status)
  );
  if (openTickets.length === 0) return;

  const ticketPaths: Record<string, string> = {};
  openTickets.forEach((t: any) => { if (t.path) ticketPaths[t.id] = t.path; });

  for (const commit of commits.slice(0, 5)) {
    const matches = await matchCommitToTickets(
      {
        hash: commit.id,
        message: commit.message,
        diff: (commit.added ?? []).concat(commit.modified ?? []).join("\n"),
        author: commit.author?.name ?? "unknown",
      },
      openTickets.map((t: any) => ({
        id: t.id, title: t.title,
        description: t.description ?? "", status: t.status,
      }))
    );
    await saveSuggestions(project.id, commit.id, commit.message, matches, ticketPaths);
  }
}

async function runChangelogGeneration(project: any, pr: any) {
  const { createReleaseFromPR } = await import("@/lib/releases");
  await createReleaseFromPR(
    {
      id: project.id,
      repo_full: project.repo_full,
      github_token: project.github_token,
      default_branch: project.default_branch || "main",
    },
    pr
  );
}
