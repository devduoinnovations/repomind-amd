import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"
import { registerWebhook } from "@/lib/github"
import { getDefaultBranch, fileExists } from "@/lib/github-api"
import { buildRepoMindInitFiles } from "@/lib/git-storage"
import { githubAtomicWrite } from "@/lib/git-storage/github"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch owned projects + projects where user is a member
  const [{ data: owned }, { data: memberships }] = await Promise.all([
    supabaseAdmin.from("projects").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }),
    supabaseAdmin.from("project_members").select("project_id").eq("user_id", session.user.id),
  ])

  const memberProjectIds = (memberships ?? []).map((m: any) => m.project_id)
  let sharedProjects: any[] = []
  if (memberProjectIds.length > 0) {
    const { data } = await supabaseAdmin.from("projects").select("*").in("id", memberProjectIds)
    sharedProjects = data ?? []
  }

  const seen = new Set<string>()
  const projects = [...(owned ?? []), ...sharedProjects].filter(p => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, repoFull, slug, createNewRepo, isPrivate = true } = await req.json()
  if (!name || !slug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }
  if (!createNewRepo && (!repoFull || !repoFull.includes("/"))) {
    return NextResponse.json({ error: "repoFull must be owner/repo" }, { status: 400 })
  }

  const githubToken = (session as any).accessToken as string | undefined
  if (!githubToken) {
    return NextResponse.json({ error: "No GitHub token. Please reconnect." }, { status: 401 })
  }

  let resolvedRepoFull = repoFull

  if (createNewRepo) {
    // Determine the repo name to create (the user might have passed just "my-app" or "owner/my-app")
    const repoNameToCreate = repoFull.includes("/") ? repoFull.split("/")[1] : repoFull

    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: repoNameToCreate,
        private: isPrivate,
        auto_init: true, // creates an initial commit so we can push .repomind files to it
      }),
    })

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: errData.message || "Failed to create repository on GitHub" },
        { status: 400 }
      )
    }

    const createdRepo = await createRes.json()
    resolvedRepoFull = createdRepo.full_name
  } else {
    // Validate existing repo is accessible
    const repoCheckRes = await fetch(
      `https://api.github.com/repos/${resolvedRepoFull}`,
      { headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json" } }
    )
    if (!repoCheckRes.ok) {
      return NextResponse.json(
        { error: repoCheckRes.status === 404 ? "Repository not found or not accessible" : "Could not access repository" },
        { status: 400 }
      )
    }
  }

  // 1. Resolve default branch
  let defaultBranch = "main"
  try {
    defaultBranch = await getDefaultBranch(resolvedRepoFull, githubToken)
  } catch (e) {
    console.error("[projects/POST] Could not get default branch:", e)
  }

  // 2. Create DB row
  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: session.user.id,
      name,
      repo_full: resolvedRepoFull,
      slug,
      github_token: githubToken,
      default_branch: defaultBranch,
    })
    .select()
    .single()

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })

  // 3. Check if .repomind already exists in repo
  const hasRepomind = await fileExists(resolvedRepoFull, githubToken, defaultBranch, ".repomind/config.yml")

  if (!hasRepomind) {
    // 4a. Initialise .repomind folder structure
    try {
      const initFiles = buildRepoMindInitFiles({
        projectName: name,
        slug,
        defaultBranch,
      })
      // githubAtomicWrite expects Record<string, string> — extract path/content from each WriteRepoFileInput
      const fileMap: Record<string, string> = {}
      for (const f of initFiles) fileMap[f.path] = f.content
      await githubAtomicWrite(
        { repoFull: resolvedRepoFull, token: githubToken, branch: defaultBranch },
        fileMap,
        "chore(repomind): initialize .repomind"
      )
    } catch (err) {
      console.error("[projects/POST] .repomind init failed:", err)
      // Non-fatal — project still created
    }
  }

  // 5. Register webhook (non-fatal)
  if (process.env.APP_URL) {
    try {
      const webhookUrl = `${process.env.APP_URL}/api/webhooks/github`
      const secret = process.env.GITHUB_WEBHOOK_SECRET || "dummy_secret"
      const webhookId = await registerWebhook(resolvedRepoFull, githubToken, webhookUrl, secret)
      await supabaseAdmin
        .from("projects")
        .update({ webhook_id: webhookId.toString() })
        .eq("id", project.id)
    } catch (err: any) {
      console.error("[projects/POST] Webhook registration failed:", err.message)
    }
  }

  return NextResponse.json({ ...project, default_branch: defaultBranch, _initialised: !hasRepomind })
}
