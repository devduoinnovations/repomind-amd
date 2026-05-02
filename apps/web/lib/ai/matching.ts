import { callGemini } from "./gemini";

export interface TicketMatch {
  ticketId: string;
  confidence: number;
  reasoning: string;
  suggestedStatus?: string;
}

export interface CommitInfo {
  hash: string;
  message: string;
  diff: string;
  author: string;
}

export interface CandidateTicket {
  id: string;
  title: string;
  description: string;
  status: string;
}

export async function matchCommitToTickets(
  commit: CommitInfo,
  candidates: CandidateTicket[]
): Promise<TicketMatch[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  if (candidates.length === 0) return [];

  const prompt = `You are a RepoMind Intelligence Engine. Match the following Git commit to the most relevant engineering tickets.

COMMIT:
Hash: ${commit.hash}
Author: ${commit.author}
Message: ${commit.message}
Diff Summary:
${commit.diff.slice(0, 2000)}

CANDIDATE TICKETS:
${candidates.map(t => `[${t.id}] ${t.title}: ${t.description.slice(0, 200)}`).join("\n---\n")}

Return a JSON array of matches with confidence > 0.5 only:
[
  {
    "ticketId": "T-001",
    "confidence": 0.95,
    "reasoning": "Commit message directly references this ticket's scope.",
    "suggestedStatus": "in_progress"
  }
]
Respond with JSON only. Empty array if no strong matches.`;

  const raw = await callGemini({
    apiKey,
    prompt,
    systemPrompt: "You are an expert code reviewer. Return only valid JSON array, no markdown.",
    responseMimeType: "application/json",
    temperature: 0.1,
  });

  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
