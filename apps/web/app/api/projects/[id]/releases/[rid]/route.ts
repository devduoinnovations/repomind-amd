import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import {
  GitHubRepoFileClient, getRelease, updateReleaseInGit, deleteReleaseFromGit,
} from "@/lib/git-storage";

type Params = { params: Promise<{ id: string; rid: string }> };

async function getProjectClient(projectId: string, userId: string) {
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, repo_full, github_token, default_branch")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (!project || !project.github_token) return null;

  const [owner, repo] = project.repo_full.split("/");
  return {
    project,
    client: new GitHubRepoFileClient({
      owner, repo, token: project.github_token, branch: project.default_branch,
    }),
    repo: {
      repoFull: project.repo_full,
      token: project.github_token,
      branch: project.default_branch,
    },
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, rid: releaseId } = await params;
  const ctx = await getProjectClient(projectId, session.user.id);
  if (!ctx) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    const release = await getRelease(ctx.client, releaseId);
    if (!release) return NextResponse.json({ error: "Release not found" }, { status: 404 });
    return NextResponse.json(release);
  } catch (err) {
    return NextResponse.json({ error: "Failed to read release" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, rid: releaseId } = await params;
  const ctx = await getProjectClient(projectId, session.user.id);
  if (!ctx) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.summary !== undefined) updates.summary = body.summary;
  if (body.version !== undefined) updates.version = body.version;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    await updateReleaseInGit(ctx.repo, releaseId, updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update release";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, rid: releaseId } = await params;
  const ctx = await getProjectClient(projectId, session.user.id);
  if (!ctx) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    await deleteReleaseFromGit(ctx.repo, releaseId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete release";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
