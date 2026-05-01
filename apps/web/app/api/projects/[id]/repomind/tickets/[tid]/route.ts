import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  githubBatchWrite, readMarkdownWithFrontmatter, writeMarkdownWithFrontmatter,
  GitHubRepoFileClient, updateTicketIndexEntries,
} from "@/lib/git-storage";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; tid: string }> }
) {
  const { id, tid } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { status, priority, complexity, path: ticketPathFromClient } = body;

  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const [owner, repoName] = project.repo_full.split("/");
    const client = new GitHubRepoFileClient({
      owner,
      repo: repoName,
      token: project.github_token,
      branch: project.default_branch || "main",
    });

    let ticketPath = ticketPathFromClient as string | undefined;

    if (!ticketPath) {
      const ticketsDir = await client.listDirectory(".repomind/tickets");
      for (const item of ticketsDir) {
        if (item.type === "dir") {
          const subDir = await client.listDirectory(item.path);
          const match = subDir.find(f => f.name.startsWith(`${tid}-`));
          if (match) {
            ticketPath = match.path;
            break;
          }
        } else if (item.name.startsWith(`${tid}-`)) {
          ticketPath = item.path;
          break;
        }
      }
    }

    if (!ticketPath) {
      return NextResponse.json({ error: `Ticket file not found for ${tid}` }, { status: 404 });
    }

    const fileContent = await client.readFile(ticketPath);
    if (!fileContent) throw new Error("Ticket file content not found in repository");

    const { frontmatter, body: markdownBody } = readMarkdownWithFrontmatter(fileContent.content);

    const updatedFrontmatter = {
      ...frontmatter,
      status: status ?? frontmatter.status,
      priority: priority ?? frontmatter.priority,
      complexity: complexity ?? frontmatter.complexity,
      updated_at: new Date().toISOString(),
    };

    // Preserve the existing body completely to avoid wiping out manual additions
    const updatedContent = writeMarkdownWithFrontmatter(updatedFrontmatter, markdownBody);

    await githubBatchWrite(
      {
        repoFull: project.repo_full,
        token: project.github_token,
        branch: project.default_branch || "main",
      },
      { [ticketPath]: updatedContent },
      `repomind: updated ticket ${tid} status to ${status}`
    );

    updateTicketIndexEntries(client, [ticketPath]).catch(err =>
      console.error("[TicketPATCH] Failed to update ticket index:", err)
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[TicketPATCH] Failed to update ticket:", err.message);
    return NextResponse.json({ error: err.message || "Failed to update ticket" }, { status: 500 });
  }
}
