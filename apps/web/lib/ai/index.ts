import { z } from "zod";
export * from "./plan";
export * from "./matching";
import { NOVA_SYSTEM_PROMPT } from "./prompts";
import { callAgent } from "./provider";

export const changelogOutputSchema = z.object({
  version: z.string().nullable(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  entries: z.array(
    z.object({
      category: z.enum(["feature", "fix", "improvement", "breaking"]),
      content: z.string(),
    })
  ),
});

export type ChangelogOutput = z.output<typeof changelogOutputSchema>;

export interface GeminiClientOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

export interface GeminiEmbeddingOptions {
  apiKey?: string;
  model?: string;
  batchSize?: number;
}

export async function generateChangelog(
  userPrompt: string,
  options: GeminiClientOptions & { language?: string } = {}
): Promise<ChangelogOutput> {
  const systemPrompt = options.systemPrompt ?? NOVA_SYSTEM_PROMPT;

  const resText = await callAgent("NOVA", {
    prompt: userPrompt,
    systemPrompt,
    responseMimeType: "application/json",
  });

  const jsonText = resText.replace(/```json\n?|\n?```/g, "").trim();
  return changelogOutputSchema.parse(JSON.parse(jsonText));
}

export async function generateEmbeddings(
  texts: string[],
  options: GeminiEmbeddingOptions = {}
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Get a free one from Google AI Studio.");
  }

  const model = options.model ?? "gemini-embedding-001";
  const batchSize = options.batchSize ?? 50;
  const embeddings: number[][] = [];

  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${model}`,
            content: {
              parts: [{ text }],
            },
          })),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini embeddings returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    embeddings.push(
      ...(data.embeddings ?? []).map((embedding: { values: number[] }) => 
        embedding.values.slice(0, 768)
      )
    );
  }

  return embeddings;
}
