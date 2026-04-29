import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"
import { loadRepomindContext } from "@/lib/repomind-config"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message, history = [] } = await req.json()
  if (!message) return NextResponse.json({ error: "No message" }, { status: 400 })

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("repo_full, github_token, default_branch, config_cache")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single()

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const token = project.github_token as string | null
  const branch = (project.default_branch as string) || "main"

  let moduleContext = ""
  let techContext = ""
  let configContext = ""

  if (token) {
    try {
      const ctx = await loadRepomindContext(project.repo_full, token, branch)
      if (ctx) {
        configContext = `Project: "${ctx.config.project.name}" (slug: ${ctx.config.project.slug})
Tone: ${ctx.config.ai.tone}, Audience: ${ctx.config.ai.audience}`

        if (ctx.moduleGraph) {
          const mg = ctx.moduleGraph as any
          const modules = mg.modules?.slice(0, 30) ?? []
          moduleContext = `Module Graph (${modules.length} modules):\n` +
            modules.map((m: any) => `- ${m.id}: ${m.name} (${m.path})${m.summary ? ' — ' + m.summary : ''}`).join("\n")
        }
        if (ctx.techStack) {
          const ts = ctx.techStack as any
          techContext = `Tech Stack: Languages: ${ts.languages?.join(", ") || "unknown"}, Frameworks: ${ts.frameworks?.join(", ") || "unknown"}`
        }
      }
    } catch {
      // fall through with no context
    }
  }

  const systemPrompt = `You are LYRA, the Librarian — a sharp, helpful AI agent embedded in RepoMind. You answer questions about this codebase with precision.

${configContext}
${techContext}
${moduleContext}

Rules:
- Reference specific file paths and module names when relevant.
- If you don't know, say so — don't guess.
- Keep answers concise but complete.
- Format code in markdown code blocks.`

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 })

  const contents = [
    ...history.map((h: { role: string; content: string }) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ]

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.3 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `Gemini error: ${res.status} ${err}` }, { status: 500 })
  }

  const data = await res.json()
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "I couldn't generate a response."

  return NextResponse.json({ reply })
}
