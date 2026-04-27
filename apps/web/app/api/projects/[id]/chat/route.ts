import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateEmbeddings } from "@/lib/ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1]?.content;

  if (!lastMessage) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }

  try {
    const [queryEmbedding] = await generateEmbeddings([lastMessage]);

    const { data: chunks, error: searchError } = await supabaseAdmin.rpc("match_embeddings", {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
      p_project_id: projectId,
    });

    if (searchError) throw searchError;

    const context = (chunks || [])
      .map((c: any) => `File: ${c.file_path}\nSymbol: ${c.symbol_name || "N/A"}\nContent:\n${c.content}`)
      .join("\n\n---\n\n");

    const systemPrompt = `You are RepoMind AI, an expert software engineer.
Answer the user's question about their codebase using the provided code snippets.
If the snippets don't contain the answer, say you don't know based on the indexed context.
Be concise, technical, and accurate.

Code Context:
${context}`;

    const apiKey = process.env.GEMINI_API_KEY;
    const model = "gemini-1.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map((m: any) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
          })),
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini Error: ${err}`);
    }

    const aiData = await response.json();
    const answer = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    return NextResponse.json({ role: "assistant", content: answer });
  } catch (err: any) {
    console.error("Chat API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
