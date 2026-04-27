import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { publishRelease } from "@/lib/git-storage";

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
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to publish release";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
