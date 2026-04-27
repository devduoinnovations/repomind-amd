import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { GitHubRepoFileClient, listReleases } from "@/lib/git-storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, repo_full, github_token, default_branch")
    .eq("id", projectId)
    .eq("user_id", session.user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.github_token) {
    return NextResponse.json([]);
  }

  try {
    const [owner, repo] = project.repo_full.split("/");
    const client = new GitHubRepoFileClient({
      owner,
      repo,
      token: project.github_token,
      branch: project.default_branch,
    });

    const releases = await listReleases(client);
    return NextResponse.json(releases);
  } catch (err) {
    console.error("Failed to list releases from git:", err);
    return NextResponse.json({ error: "Failed to read releases" }, { status: 500 });
  }
}
