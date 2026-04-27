import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  GitHubRepoFileClient, getTicketIndex, rebuildTicketIndex,
  writeTicketMarkdown, ticketFilePath, getNextTicketId, updateTicketIndexEntries,
} from "@/lib/git-storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const [owner, name] = project.repo_full.split("/");
  const client = new GitHubRepoFileClient({
    owner,
    repo: name,
    token: project.github_token,
    branch: project.default_branch || "main",
  });

  try {
    let index = await getTicketIndex(client);

    if (!index) {
      index = await rebuildTicketIndex(client);
    }

    return NextResponse.json({
      tickets: index.tickets,
      indexedAt: index.updated_at,
    });
  } catch (err) {
    console.error("Failed to fetch tickets:", err);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects").select("*").eq("id", id).eq("user_id", session.user.id).single();
  if (projectError || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json();
  const { title, description = "", status = "backlog", priority = "medium", complexity = "M", epic, tags = [] } = body;
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const [owner, name] = project.repo_full.split("/");
  const client = new GitHubRepoFileClient({
    owner, repo: name, token: project.github_token, branch: project.default_branch || "main",
  });

  const now = new Date().toISOString();
  const ticketId = await getNextTicketId(client);

  const ticket = {
    id: ticketId, title, description, status, priority, complexity,
    epic: epic || undefined, acceptance_criteria: [], linked_modules: tags, created_at: now, updated_at: now,
  };

  const markdown = writeTicketMarkdown(ticket);
  const path = ticketFilePath(ticket);

  try {
    await client.writeFile({ path, content: markdown, message: `feat: add ticket ${ticketId} - ${title}` });
    await updateTicketIndexEntries(client, [path]);
    return NextResponse.json({ ticket: { ...ticket, path } });
  } catch (err: any) {
    console.error("Failed to create ticket:", err);
    return NextResponse.json({ error: err.message || "Failed to create ticket" }, { status: 500 });
  }
}
