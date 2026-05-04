import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"
import { loadRepomindContext } from "@/lib/repomind-config"
import { aiRateLimit, checkRateLimit } from "@/lib/rate-limit"
import { LYRA_SYSTEM_PROMPT } from "@/lib/ai/prompts"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rateCheck = await checkRateLimit(aiRateLimit, session.user.id!)
  if (!rateCheck.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

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

  const persona = {
    name: "LYRA",
    role: "the Librarian — a sharp, helpful AI agent who explains codebase architecture and structure.",
    extraRules: [
      "- Explain high-level concepts and relationships.",
      "- Be precise and concise.",
      "- Help navigate the module graph."
    ]
  }

  const systemPrompt = `${LYRA_SYSTEM_PROMPT}

Project context:
You are ${persona.name}, ${persona.role}

${configContext}
${techContext}
${moduleContext}

Rules:
${persona.extraRules.join("\n")}
- Reference specific file paths and module names when relevant.
- If you don't know, say so — don't guess.
- Format code in markdown code blocks.`

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 })

  const { callAgent } = await import("@/lib/ai/provider")

  try {
    const reply = await callAgent("LYRA", {
      prompt: message,
      systemPrompt,
      history: history.map((h: { role: string; content: string }) => ({
        role: h.role,
        content: h.content,
      })),
    })
    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error("[Chat] Gemini call failed:", err.message)
    return NextResponse.json({ error: err.message || "Failed to generate response" }, { status: 500 })
  }
}
