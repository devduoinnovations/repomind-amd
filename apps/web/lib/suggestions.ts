/**
 * Suggestions module for saving AI-generated ticket matches to Supabase
 *
 * NOTE: Ensure the ai_suggestions table has the following columns:
 * ALTER TABLE ai_suggestions ADD COLUMN IF NOT EXISTS reasoning text;
 * ALTER TABLE ai_suggestions ADD COLUMN IF NOT EXISTS confidence integer DEFAULT 0;
 */

import { supabaseAdmin } from "@/lib/supabase";
import type { TicketMatch } from "@/lib/ai/matching";

export async function saveSuggestions(
  projectId: string,
  commitSha: string,
  commitMessage: string,
  matches: TicketMatch[],
  ticketPaths: Record<string, string>
): Promise<void> {
  if (matches.length === 0) return;

  const rows = matches.map((m) => ({
    project_id: projectId,
    ticket_id: m.ticketId,
    ticket_path: ticketPaths[m.ticketId] ?? "",
    commit_sha: commitSha,
    commit_message: commitMessage,
    suggested_status: m.suggestedStatus ?? "in_progress",
    confidence: Math.round(m.confidence * 100),
    reasoning: m.reasoning,
    status: "pending",
  }));

  const { error } = await supabaseAdmin.from("ai_suggestions").insert(rows);
  if (error) console.error("[suggestions] Failed to save:", error.message);

  if (rows.length > 0) {
    const { data: proj } = await supabaseAdmin
      .from("projects").select("name, user_id").eq("id", projectId).single();
    if (proj) {
      const { data: owner } = await supabaseAdmin
        .from("users").select("email").eq("id", proj.user_id).single();
      if (owner?.email) {
        const { sendSuggestionDigestEmail } = await import("@/lib/email");
        sendSuggestionDigestEmail(owner.email, proj.name, rows.length).catch(() => {});
      }
    }
  }
}
