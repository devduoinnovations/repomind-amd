import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { GitHubRepoFileClient, getTicketIndex, rebuildTicketIndex } from "@/lib/git-storage";
import { matchCommitToTickets } from "@/lib/ai/matching";
import { saveSuggestions } from "@/lib/suggestions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabaseAdmin
    .from("projects").select("*").eq("id", id).eq("user_id", session.user.id).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.github_token) return NextResponse.json({ error: "No GitHub token" }, { status: 400 });

  const branch = project.default_branch || "main";
  const [owner, repo] = project.repo_full.split("/");
  const client = new GitHubRepoFileClient({ owner, repo, token: project.github_token, branch });

  let index = await getTicketIndex(client);
  if (!index) index = await rebuildTicketIndex(client);

  const openTickets = (index?.tickets ?? []).filter(
    (t: any) => !["done", "DONE"].includes(t.status)
  );

  if (openTickets.length === 0) {
    return NextResponse.json({ message: "No open tickets to match", generated: 0 });
  }

  // Use last 3 commits from GitHub
  const commitsRes = await fetch(
    `https://api.github.com/repos/${project.repo_full}/commits?sha=${branch}&per_page=3`,
    { headers: { Authorization: `Bearer ${project.github_token}`, Accept: "application/vnd.github+json" } }
  );
  const commits = commitsRes.ok ? await commitsRes.json() : [];

  const ticketPaths: Record<string, string> = {};
  openTickets.forEach((t: any) => { if (t.path) ticketPaths[t.id] = t.path; });

  let totalGenerated = 0;
  for (const commit of commits.slice(0, 3)) {
    const matches = await matchCommitToTickets(
      {
        hash: commit.sha,
        message: commit.commit?.message ?? "",
        diff: "",
        author: commit.commit?.author?.name ?? "unknown",
      },
      openTickets.map((t: any) => ({ id: t.id, title: t.title, description: t.description ?? "", status: t.status }))
    );
    await saveSuggestions(project.id, commit.sha, commit.commit?.message ?? "", matches, ticketPaths);
    totalGenerated += matches.length;
  }

  return NextResponse.json({ message: "PATCH scan complete", generated: totalGenerated });
}
