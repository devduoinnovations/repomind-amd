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

  const { messages } = await req.json()
  if (!messages || messages.length === 0) return NextResponse.json({ error: "No messages" }, { status: 400 })

  const currentMessage = messages[messages.length - 1].content
  const history = messages.slice(0, -1)

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

  let ctx: any = null
  if (token) {
    try {
      ctx = await loadRepomindContext(project.repo_full, token, branch)
      if (ctx) {
        configContext = `Project: "${ctx.config.project.name}" (slug: ${ctx.config.project.slug})
Tone: ${ctx.config.ai.tone}, Audience: ${ctx.config.ai.audience}`

        if (ctx.techStack) {
          const ts = ctx.techStack as any
          techContext = `Tech Stack: Languages: ${ts.languages?.join(", ") || "unknown"}, Frameworks: ${ts.frameworks?.join(", ") || "unknown"}`
        }
      }
    } catch {
      // fall through with no context
    }
  }

  try {
    const { searchModules } = await import('@/lib/ai/embeddings')
    const topModules = await searchModules(id, currentMessage, 5)
    if (topModules.length > 0) {
      moduleContext = `Relevant modules (semantic search):\n` +
        topModules.map(m =>
          `- ${m.path} (${Math.round(m.score * 100)}% match): ${m.summary}`
        ).join('\n')
    }
  } catch {
    // Fallback to static first-30 if embeddings not available
    if (ctx?.moduleGraph) {
      const mg = ctx.moduleGraph as any
      const mods = mg.modules?.slice(0, 30) ?? []
      moduleContext = `Module Graph (${mods.length} of ${mg.modules?.length ?? 0} modules):\n` +
        mods.map((m: any) => `- ${m.id}: ${m.name} (${m.path})`).join('\n')
    }
  }

  const systemPrompt = `${LYRA_SYSTEM_PROMPT}

Project context:
${configContext}
${techContext}
${moduleContext}`

  const { callAgentStream } = await import("@/lib/ai/provider")

  try {
    const stream = await callAgentStream("LYRA", {
      prompt: currentMessage,
      systemPrompt,
      // Cap at last 20 messages to stay within context window
      history: history.slice(-20).map((h: { role: string; content: string }) => ({
        role: h.role,
        content: h.content,
      })),
    })
    return stream
  } catch (err: any) {
    console.error("[Chat] AI stream failed:", err.message)
    return NextResponse.json({ error: err.message || "Failed to generate response stream" }, { status: 500 })
  }
}
