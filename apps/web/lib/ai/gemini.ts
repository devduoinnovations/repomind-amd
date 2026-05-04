/**
 * Centralized Gemini API utility with retry logic.
 */

export async function callGemini(params: {
  apiKey: string;
  model?: string;
  prompt: string;
  systemPrompt?: string;
  history?: { role: 'user' | 'model'; parts: { text: string }[] }[];
  responseMimeType?: string;
  temperature?: number;
  thinkingBudget?: number;
}) {
  const { apiKey, model = 'gemini-2.5-flash', prompt, systemPrompt, history = [], responseMimeType, temperature = 0.3, thinkingBudget } = params;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const body: any = {
    contents: [...history, { role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      ...(responseMimeType ? { responseMimeType } : {}),
    },
  };

  if (thinkingBudget !== undefined) {
    body.generationConfig.thinkingConfig = { thinkingBudget };
  }

  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  let lastError: Error | null = null;
  const maxRetries = 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        const retryAfter = 60000; // Default 1 min for free tier
        await new Promise(r => setTimeout(r, retryAfter));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini failed: ${res.status} ${errText}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Gemini");

      return text;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error("Failed to call Gemini after multiple attempts");
}
