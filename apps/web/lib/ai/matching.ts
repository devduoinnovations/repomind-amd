import { generateChangelog } from "./index";

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

  const prompt = `
You are a RepoMind Intelligence Engine. Match the following Git commit to the most relevant engineering tickets.

COMMIT:
Hash: ${commit.hash}
Author: ${commit.author}
Message: ${commit.message}
Diff Summary:
${commit.diff.slice(0, 2000)}

CANDIDATE TICKETS:
${candidates.map(t => `[${t.id}] ${t.title}: ${t.description.slice(0, 200)}`).join("\n---\n")}

INSTRUCTIONS:
1. Identify if this commit implements, fixes, or relates to any of the candidate tickets.
2. For each match, provide a confidence score from 0.0 to 1.0.
3. Suggest a status update based on the level of completion:
   - If work has started or is ongoing, suggest 'in_progress'.
   - If a significant part of the task is done but might need testing, suggest 'review'.
   - If the commit message or diff indicates the task is fully implemented or fixed, suggest 'done'.
4. Return a JSON array of matches.

RESPONSE FORMAT (JSON ONLY):
[
  {
    "ticketId": "T-001",
    "confidence": 0.95,
    "reasoning": "Explicitly mentions JWT rotation which is the main task of T-001.",
    "suggestedStatus": "in_progress"
  }
]
`;

  const model = "gemini-flash-latest";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini Matching API failed: ${error}`);
  }

  const data = await response.json();
  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) return [];

  try {
    return JSON.parse(rawJson);
  } catch (e) {
    console.error("Failed to parse matching JSON", e);
    return [];
  }
}
