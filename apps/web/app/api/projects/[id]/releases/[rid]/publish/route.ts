import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { publishRelease, getRelease, GitHubRepoFileClient } from "@/lib/git-storage";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, rid: releaseId } = await params;

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, repo_full, github_token, default_branch")
    .eq("id", projectId)
    .eq("user_id", session.user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 403 });
  }

  if (!project.github_token) {
    return NextResponse.json({ error: "Project has no GitHub token" }, { status: 400 });
  }

  try {
    await publishRelease(
      {
        repoFull: project.repo_full,
        token: project.github_token,
        branch: project.default_branch,
      },
      releaseId
    );

    // Fetch the release details to use in GitHub API call
    const [owner, repo] = project.repo_full.split("/");
    const client = new GitHubRepoFileClient({
      owner, repo, token: project.github_token, branch: project.default_branch,
    });
    const releaseData = await getRelease(client, releaseId).catch(() => null);

    if (releaseData?.version) {
      const body = [
        releaseData.summary ?? "",
        releaseData.entries?.length
          ? "\n## Changes\n" + releaseData.entries.map(e => `- **${e.category}:** ${e.content}`).join("\n")
          : "",
      ].filter(Boolean).join("\n").trim();

      await fetch(`https://api.github.com/repos/${project.repo_full}/releases`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${project.github_token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tag_name: releaseData.version,
          name: releaseData.title ?? releaseData.version,
          body: body || undefined,
          draft: false,
          prerelease: false,
        }),
      }).catch(() => {}); // non-fatal: file-based publish already succeeded
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to publish release";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
