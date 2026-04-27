import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  githubBatchWrite, parseMarkdownWithFrontmatter, writeTicketMarkdown,
  GitHubRepoFileClient, updateTicketIndexEntries,
} from "@/lib/git-storage";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const { id, sid } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: suggestion, error: suggestionError } = await supabaseAdmin
    .from("ai_suggestions")
    .select("*")
    .eq("id", sid)
    .single();

  if (suggestionError || !suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
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

  try {
    const [owner, name] = project.repo_full.split("/");
    const client = new GitHubRepoFileClient({
      owner,
      repo: name,
      token: project.github_token,
      branch: project.default_branch || "main",
    });

    const content = await client.readFile(suggestion.ticket_path);
    if (!content) throw new Error("Ticket file not found in repository");

    const { data: fm, content: bodyContent } = parseMarkdownWithFrontmatter(content.content);

    const updatedContent = writeTicketMarkdown({
      id: fm.id,
      epic: fm.epic,
      title: fm.title,
      description: bodyContent.split("\n## Acceptance Criteria")[0]
        .replace("# " + fm.title, "").trim()
        .replace("\n## Description", "").trim(),
      status: suggestion.suggested_status,
      priority: fm.priority,
      complexity: fm.complexity,
      acceptance_criteria: bodyContent.includes("## Acceptance Criteria")
        ? bodyContent.split("## Acceptance Criteria")[1].split("##")[0].trim()
            .split("\n").map((l: string) => l.replace("- [ ] ", "").replace("- [x] ", "").trim())
        : [],
      linked_modules: fm.tags || [],
      created_at: fm.created_at,
      updated_at: new Date().toISOString(),
    });

    const finalContent = updatedContent +
      `\n\n## Linked Commits\n- \`${suggestion.commit_sha}\` — ${suggestion.commit_message} (Confidence: ${suggestion.confidence}%)`;

    await githubBatchWrite(
      {
        repoFull: project.repo_full,
        token: project.github_token,
        branch: project.default_branch || "main",
      },
      { [suggestion.ticket_path]: finalContent },
      `repomind: approved AI suggestion for ${suggestion.ticket_id}`
    );

    await supabaseAdmin.from("ai_suggestions").update({ status: "approved" }).eq("id", sid);

    updateTicketIndexEntries(client, [suggestion.ticket_path]).catch(err =>
      console.error("Failed to update index:", err)
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to apply suggestion:", err);
    return NextResponse.json({ error: err.message || "Failed to apply" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const { sid } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("ai_suggestions")
    .update({ status: "rejected" })
    .eq("id", sid);

  if (error) {
    return NextResponse.json({ error: "Failed to reject suggestion" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
