import { getServerSession } from 'next-auth/next'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { callAgent } from '@/lib/ai/provider'
import { SCOUT_SYSTEM_PROMPT } from '@/lib/ai/prompts'

const SENSITIVE_PATTERNS = [
  /middleware\.(ts|js)$/,
  /auth/i, /login/i, /session/i, /jwt/i, /token/i,
  /\.env/, /api\/.*\/route\.ts$/,
  /prisma/, /supabase/, /db\./,
  /admin/i, /secret/i, /password/i, /key\./i, /crypto/i,
]

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('repo_full, github_token, default_branch, config_cache')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const token = project.github_token as string | null
  if (!token) return NextResponse.json({ error: 'No GitHub token' }, { status: 400 })

  const moduleGraph = (project.config_cache as any)?.codebase?.module_graph
  if (!moduleGraph?.modules?.length) {
    return NextResponse.json({ error: 'Run a codebase scan first' }, { status: 400 })
  }

  const allPaths: string[] = moduleGraph.modules.map((m: any) => m.path)
  const sensitivePaths = allPaths
    .filter(p => SENSITIVE_PATTERNS.some(re => re.test(p)))
    .slice(0, 15)

  if (sensitivePaths.length === 0) {
    return NextResponse.json({ success: true, findingCount: 0 })
  }

  const [owner, repo] = (project.repo_full as string).split('/')
  const branch = (project.default_branch as string) || 'main'
  const fileContents: { path: string; content: string }[] = []

  for (const path of sensitivePaths) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
        { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.raw+json' } }
      )
      if (res.ok) {
        const content = await res.text()
        fileContents.push({ path, content: content.slice(0, 3000) })
      }
    } catch { /* skip unreadable files */ }
  }

  if (fileContents.length === 0) {
    return NextResponse.json({ success: true, findingCount: 0 })
  }

  const prompt = fileContents
    .map(f => `=== FILE: ${f.path} ===\n${f.content}`)
    .join('\n\n')

  const raw = await callAgent('SCOUT', {
    prompt,
    systemPrompt: SCOUT_SYSTEM_PROMPT,
    responseMimeType: 'application/json',
  })

  let findings: any[] = []
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
    findings = JSON.parse(cleaned)
    if (!Array.isArray(findings)) findings = []
  } catch { findings = [] }

  await supabaseAdmin
    .from('scout_findings')
    .delete()
    .eq('project_id', id)
    .eq('resolved', false)

  if (findings.length > 0) {
    await supabaseAdmin.from('scout_findings').insert(
      findings.map(f => ({
        severity: f.severity,
        title: f.title,
        file: f.file ?? null,
        line: f.line ?? null,
        description: f.description ?? null,
        remediation: f.remediation ?? null,
        project_id: id,
      }))
    )
  }

  return NextResponse.json({
    success: true,
    findingCount: findings.length,
    critical: findings.filter(f => f.severity === 'CRITICAL').length,
    high: findings.filter(f => f.severity === 'HIGH').length,
  })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: findings } = await supabaseAdmin
    .from('scout_findings')
    .select('*')
    .eq('project_id', id)
    .eq('resolved', false)
    .order('created_at', { ascending: false })

  return NextResponse.json({ findings: findings ?? [] })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { findingId } = await req.json()
  if (!findingId) return NextResponse.json({ error: 'findingId required' }, { status: 400 })

  await supabaseAdmin
    .from('scout_findings')
    .update({ resolved: true })
    .eq('id', findingId)
    .eq('project_id', id)

  return NextResponse.json({ success: true })
}
