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

/** Strip markdown code fences from LLM JSON responses */
export function extractJSON(raw: string): string {
  return raw.replace(/```(?:json)?\n?|\n?```/g, '').trim()
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

  return changelogOutputSchema.parse(JSON.parse(extractJSON(resText)));
}

export async function generateEmbeddings(
  texts: string[],
  options: GeminiEmbeddingOptions = {}
): Promise<number[][]> {
  if (texts.length === 0) return []

  // Route to AMD vLLM if configured
  const amdUrl = process.env.AMD_VLLM_BASE_URL
  if (amdUrl) {
    try {
      return await generateEmbeddingsAMD(texts, amdUrl)
    } catch (err) {
      console.warn('[embeddings] AMD embedding failed, falling back to Gemini:', err)
    }
  }

  return generateEmbeddingsGemini(texts, options)
}

async function generateEmbeddingsAMD(texts: string[], baseUrl: string): Promise<number[][]> {
  const apiKey = process.env.AMD_VLLM_API_KEY ?? 'EMPTY'
  const model = process.env.AMD_EMBEDDING_MODEL ?? process.env.AMD_VLLM_MODEL ?? 'Qwen2.5-72B-Instruct'
  const batchSize = 20
  const all: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: batch, encoding_format: 'float' }),
    })
    if (!res.ok) throw new Error(`AMD embeddings failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    all.push(...data.data.map((d: { embedding: number[] }) => d.embedding))
  }
  return all
}

async function generateEmbeddingsGemini(texts: string[], options: GeminiEmbeddingOptions = {}): Promise<number[][]> {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('No embedding provider configured. Set AMD_VLLM_BASE_URL or GEMINI_API_KEY.')

  const model = options.model ?? 'gemini-embedding-001'
  const batchSize = options.batchSize ?? 50
  const embeddings: number[][] = []

  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
          })),
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini embeddings returned status ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    embeddings.push(
      ...(data.embeddings ?? []).map((embedding: { values: number[] }) =>
        embedding.values.slice(0, 768)
      )
    )
  }
  return embeddings
}
