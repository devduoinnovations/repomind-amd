import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"
import { readTextFile } from "@/lib/github-api"
import { parse } from "yaml"

const DEFAULT_DIAGRAM = `flowchart TD
  Repo[Repository] --> RepoMind[RepoMind]
  RepoMind --> Tickets[Tickets]
  RepoMind --> Releases[Releases]
`

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("repo_full, github_token, default_branch")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single()

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const token = project.github_token as string | null
  const branch = (project.default_branch as string) || "main"

  let diagram = DEFAULT_DIAGRAM
  let modulesJson: object | null = null
  let techStack: object | null = null

  if (token) {
    const [mmd, modulesRaw, techRaw] = await Promise.all([
      readTextFile(project.repo_full, token, branch, ".repomind/architecture/system.mmd"),
      readTextFile(project.repo_full, token, branch, ".repomind/architecture/modules.json"),
      readTextFile(project.repo_full, token, branch, ".repomind/architecture/tech-stack.yml"),
    ])
    if (mmd) diagram = mmd
    if (modulesRaw) { try { modulesJson = JSON.parse(modulesRaw) } catch {} }
    if (techRaw) { try { techStack = parse(techRaw) } catch {} }
  }

  return NextResponse.json({ diagram, modules: modulesJson, techStack })
}
