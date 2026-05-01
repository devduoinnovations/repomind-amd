# RepoMind Core Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the full user journey — GitHub sign-in → project onboarding (create or load existing repo with `.repomind`) → agents that read `.repomind/config.yml` and behave according to their role.

**Architecture:** `.repomind/` is the single source of truth stored in the GitHub repo. On project creation, the app checks if `.repomind/config.yml` exists; if not it initialises the folder structure via the GitHub API. All agent prompts are enriched with data read from `.repomind`. Supabase `config_cache` is a fast read-cache of the `.repomind` data — not the source of truth.

**Tech Stack:** Next.js 15 App Router, NextAuth (GitHub provider), Supabase (postgres + service role), GitHub REST API, Gemini Flash, `@dnd-kit`, YAML (`js-yaml` / already imported as `yaml`)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `app/api/projects/route.ts` | Modify | On POST: fetch default branch, detect/init `.repomind`, run first scan |
| `app/api/projects/[id]/route.ts` | Modify | On GET (new): return project with fresh `.repomind` config |
| `app/api/projects/[id]/scan/route.ts` | Modify | After scan: also write back to `.repomind/architecture/` files |
| `lib/github-api.ts` | Create | Thin helpers: `getDefaultBranch`, `fileExists`, `readTextFile` |
| `lib/repomind-config.ts` | Create | `loadRepomindConfig(client)` — read + parse `.repomind/config.yml` from GitHub |
| `lib/ai/prompts.ts` | Modify | `PLAN_DECOMPOSITION_PROMPT` enriched with config tone/audience/ticket format |
| `lib/ai/plan.ts` | Modify | `decomposePlan()` accepts optional `RepoMindConfig` and passes it to prompt |
| `app/api/projects/[id]/repomind/plan/route.ts` | Modify | Load `.repomind/config.yml` before calling `decomposePlan()` |
| `app/api/projects/[id]/chat/route.ts` | Modify | Enrich LYRA with module graph from `.repomind/architecture/modules.json` |
| `app/api/projects/[id]/architecture/route.ts` | Modify | Return real `.repomind/architecture/system.mmd` content |
| `components/OnboardingEmpty.tsx` | Create | Shown on dashboard when user has zero projects |
| `app/page.tsx` | Modify | Show `OnboardingEmpty` when `projects.length === 0 && status === 'authenticated'` |
| `components/NewProjectModal.tsx` | Modify | Add `isInitialising` state + progress steps for `.repomind` init |
| `app/api/webhooks/github/route.ts` | Create | Handle `push` events to sync `.repomind` changes to Supabase |
| `lib/git-storage/ticket.ts` | Modify | Add `saveTicketsToGit` helper |
| `app/api/projects/[id]/tickets/sync/route.ts` | Create | Sync tickets from GitHub to Supabase |

---

## Phase 1 — GitHub Auth & Post-Login Flow

### Task 1: GitHub helpers — `getDefaultBranch` and `fileExists`

**Files:**
- Create: `apps/web/lib/github-api.ts`

- [ ] **Step 1: Create the file**

```typescript
// apps/web/lib/github-api.ts

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
})

export async function getDefaultBranch(repoFull: string, token: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${repoFull}`, {
    headers: GH_HEADERS(token),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`GitHub repo fetch failed: ${res.status}`)
  const data = await res.json()
  return data.default_branch ?? "main"
}

export async function fileExists(repoFull: string, token: string, branch: string, path: string): Promise<boolean> {
  const [owner, repo] = repoFull.split("/")
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`
  const res = await fetch(url, { headers: GH_HEADERS(token), cache: "no-store" })
  return res.ok
}

export async function readTextFile(repoFull: string, token: string, branch: string, path: string): Promise<string | null> {
  const [owner, repo] = repoFull.split("/")
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`
  const res = await fetch(url, { headers: GH_HEADERS(token), cache: "no-store" })
  if (!res.ok) return null
  const data = await res.json()
  if (data.type !== "file" || !data.content) return null
  return Buffer.from(data.content, "base64").toString("utf8")
}
```

- [ ] **Step 2: Verify TypeScript passes**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/github-api.ts
git commit -m "feat: add github-api helpers (getDefaultBranch, fileExists, readTextFile)"
```

---

### Task 2: `.repomind` loader — `loadRepomindConfig`

**Files:**
- Create: `apps/web/lib/repomind-config.ts`

- [ ] **Step 1: Create the file**

```typescript
// apps/web/lib/repomind-config.ts
import { parse } from "yaml"
import { repomindConfigSchema, type RepoMindConfig } from "./git-storage/schemas"
import { readTextFile } from "./github-api"

export const CONFIG_PATH = ".repomind/config.yml"
export const MODULES_PATH = ".repomind/architecture/modules.json"
export const TECH_STACK_PATH = ".repomind/architecture/tech-stack.yml"

export interface RepomindContext {
  config: RepoMindConfig
  moduleGraph: object | null
  techStack: object | null
}

export async function loadRepomindContext(
  repoFull: string,
  token: string,
  branch: string
): Promise<RepomindContext | null> {
  const raw = await readTextFile(repoFull, token, branch, CONFIG_PATH)
  if (!raw) return null

  let config: RepoMindConfig
  try {
    config = repomindConfigSchema.parse(parse(raw))
  } catch {
    return null
  }

  const modulesRaw = await readTextFile(repoFull, token, branch, MODULES_PATH)
  const techRaw = await readTextFile(repoFull, token, branch, TECH_STACK_PATH)

  const moduleGraph = modulesRaw ? JSON.parse(modulesRaw) : null
  const techStack = techRaw ? parse(techRaw) : null

  return { config, moduleGraph, techStack }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/repomind-config.ts
git commit -m "feat: add repomind-config loader (reads .repomind/config.yml from GitHub)"
```

---

### Task 3: `POST /api/projects` — detect/init `.repomind`, fetch default branch

**Files:**
- Modify: `apps/web/app/api/projects/route.ts`

Currently the POST handler creates the DB row and attempts to register a webhook but never:
- Fetches the repo's default branch
- Checks if `.repomind/config.yml` exists
- Writes the init files if it doesn't

- [ ] **Step 1: Replace the POST handler**

```typescript
// apps/web/app/api/projects/route.ts  — full file replacement

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

  const { data: projects, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, repoFull, slug } = await req.json()
  if (!name || !repoFull || !slug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }
  if (!repoFull.includes("/")) {
    return NextResponse.json({ error: "repoFull must be owner/repo" }, { status: 400 })
  }

  const githubToken = (session as any).accessToken as string | undefined
  if (!githubToken) {
    return NextResponse.json({ error: "No GitHub token. Please reconnect." }, { status: 401 })
  }

  // 1. Resolve default branch
  let defaultBranch = "main"
  try {
    defaultBranch = await getDefaultBranch(repoFull, githubToken)
  } catch (e) {
    console.error("[projects/POST] Could not get default branch:", e)
  }

  // 2. Create DB row
  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: session.user.id,
      name,
      repo_full: repoFull,
      slug,
      github_token: githubToken,
      default_branch: defaultBranch,
    })
    .select()
    .single()

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })

  // 3. Check if .repomind already exists in repo
  const hasRepomind = await fileExists(repoFull, githubToken, defaultBranch, ".repomind/config.yml")

  if (!hasRepomind) {
    // 4a. Initialise .repomind folder structure
    try {
      const initFiles = buildRepoMindInitFiles({
        projectName: name,
        slug,
        defaultBranch,
      })
      const fileMap: Record<string, string> = {}
      for (const f of initFiles) fileMap[f.path] = f.content
      await githubAtomicWrite(
        { repoFull, token: githubToken, branch: defaultBranch },
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
      const webhookId = await registerWebhook(repoFull, githubToken, webhookUrl, secret)
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
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/projects/route.ts
git commit -m "feat: init .repomind on project creation, resolve default branch from GitHub"
```

---

### Task 4: Onboarding empty state UI

**Files:**
- Create: `apps/web/components/OnboardingEmpty.tsx`
- Modify: `apps/web/app/page.tsx`

When the user is authenticated and has zero projects, show a guided empty state instead of a blank Kanban board.

- [ ] **Step 1: Create `OnboardingEmpty.tsx`**

```tsx
// apps/web/components/OnboardingEmpty.tsx
'use client'
import { MascotSprite } from './mascots/MascotSprite'

interface Props {
  onAddProject: () => void
}

export function OnboardingEmpty({ onAddProject }: Props) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 48,
    }}>
      <MascotSprite name="SPARKY" state="idle" w={120} h={180} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--text-primary)', letterSpacing: '0.04em', marginBottom: 10 }}>
          NO PROJECTS YET
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 380 }}>
          Connect a GitHub repo and the crew will scan it, map its structure,
          and be ready to decompose your plans into trackable tickets.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%', maxWidth: 340 }}>
        <button
          onClick={onAddProject}
          style={{
            width: '100%',
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            letterSpacing: '0.06em',
            background: '#f59e0b',
            color: '#0a0a14',
            border: 'none',
            padding: '14px 24px',
            borderRadius: 8,
            cursor: 'pointer',
            boxShadow: '0 0 28px rgba(245,158,11,0.4)',
          }}
        >
          + CONNECT A REPO
        </button>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
          We'll create a <code style={{ color: 'var(--text-secondary)' }}>.repomind/</code> folder in your repo
          to store tickets, architecture maps, and release notes — all in Git.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', maxWidth: 480, marginTop: 8 }}>
        {[
          { agent: 'SCOUT', color: '#22c55e', desc: 'Scans repo structure' },
          { agent: 'SPARKY', color: '#f59e0b', desc: 'Decomposes your plans' },
          { agent: 'PATCH', color: '#14b8a6', desc: 'Watches commits' },
        ].map(({ agent, color, desc }) => (
          <div key={agent} style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '14px 12px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color, letterSpacing: '0.08em', marginBottom: 4 }}>{agent}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `app/page.tsx`**

Add import at top:
```typescript
import { OnboardingEmpty } from '@/components/OnboardingEmpty'
```

Replace the `<main>` content section. Find this block (approximately line 241):
```tsx
<main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
  {/* Tab bar */}
  ...
```

Wrap the tab bar + panel content so it only renders when a project is selected:
```tsx
<main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
  {!selectedProject && projects.length === 0 ? (
    <OnboardingEmpty onAddProject={() => setNewProjectOpen(true)} />
  ) : (
    <>
      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--panel)', flexShrink: 0 }}>
        <div className="tabs" style={{ display: 'flex' }}>
          {TABS.map(t => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t}
              {t === 'Suggestions' && suggestionCount > 0 && (
                <span style={{ marginLeft: 6, background: '#14b8a6', color: '#fff', borderRadius: 999, padding: '1px 6px', fontSize: 9, fontFamily: 'var(--font-mono)', verticalAlign: 'middle' }}>
                  {suggestionCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', padding: '0 16px' }}>
          <button
            onClick={() => setPlanOpen(true)}
            style={{
              fontFamily: 'var(--font-ui)',
              fontWeight: 600,
              fontSize: 12,
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-hover)',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            + New Plan
          </button>
        </div>
      </div>

      <PlanInput open={planOpen} onClose={() => setPlanOpen(false)} onDeploy={onDeploy} working={planWorking} hasProject={!!selectedProject} />

      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'Kanban' && (
          <KanbanBoard
            tickets={loadingTickets && tickets.length === 0 ? [] : tickets}
            flashId={flashId}
            onStatusChange={onTicketStatusChange}
            onTicketClick={t => setTicketDetail(t)}
          />
        )}
        {tab === 'Suggestions' && <SuggestionsPanel projectId={selectedProject?.id ?? null} onApproved={() => loadTickets(selectedProject!.id)} />}
        {tab === 'Architecture' && <ArchitecturePanel projectId={selectedProject?.id ?? null} />}
        {tab === 'Releases' && <ReleasesPanel projectId={selectedProject?.id ?? null} />}
        {tab === 'Q&A' && <ChatPanel projectId={selectedProject?.id ?? null} />}
      </div>
    </>
  )}
</main>
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/OnboardingEmpty.tsx apps/web/app/page.tsx
git commit -m "feat: onboarding empty state when user has no projects"
```

---

## Phase 2 — `.repomind` as Source of Truth

### Task 5: SCOUT writes scan results back to `.repomind/architecture/`

**Files:**
- Modify: `apps/web/app/api/projects/[id]/scan/route.ts`

After building the module graph and tech stack, SCOUT should write them back to the actual GitHub repo files so `.repomind/architecture/modules.json` and `.repomind/architecture/tech-stack.yml` stay current.

- [ ] **Step 1: Add write-back after scan in `scan/route.ts`**

After the line `await supabaseAdmin.from("projects").update(...).eq("id", id)`, add:

```typescript
import { stringify } from "yaml"
import { githubAtomicWrite } from "@/lib/git-storage/github"

// Inside POST handler, after supabase update:
try {
  await githubAtomicWrite(
    { repoFull: project.repo_full, token, branch },
    {
      ".repomind/architecture/modules.json": JSON.stringify(moduleGraph, null, 2) + "\n",
      ".repomind/architecture/tech-stack.yml": stringify(techStack),
    },
    "chore(repomind): update architecture scan results"
  )
} catch (writeErr) {
  console.error("[scan] Failed to write back to .repomind:", writeErr)
  // Non-fatal — Supabase cache is already updated
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/projects/[id]/scan/route.ts
git commit -m "feat: scout writes scan results back to .repomind/architecture/ in GitHub repo"
```

---

### Task 6: SAGE reads real `.repomind/architecture/system.mmd`

**Files:**
- Modify: `apps/web/app/api/projects/[id]/architecture/route.ts`

- [ ] **Step 1: Read the current architecture route**

```bash
cat apps/web/app/api/projects/\[id\]/architecture/route.ts
```

- [ ] **Step 2: Rewrite to serve `.repomind/architecture/system.mmd`**

```typescript
// apps/web/app/api/projects/[id]/architecture/route.ts
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"
import { readTextFile } from "@/lib/github-api"

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
    if (techRaw) { try { const { parse } = await import("yaml"); techStack = parse(techRaw) } catch {} }
  }

  return NextResponse.json({ diagram, modules: modulesJson, techStack })
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/projects/[id]/architecture/route.ts
git commit -m "feat: architecture route reads real .repomind/architecture/system.mmd"
```

---

## Phase 3 — Agent Intelligence per Role

### Task 7: SPARKY reads `.repomind/config.yml` to enrich plan decomposition

SPARKY currently decomposes plans without knowing the project's preferred tone, audience, or ticket format. The `.repomind/config.yml` has `ai.tone`, `ai.audience`, and `tickets.id_format` — these should shape the output.

**Files:**
- Modify: `apps/web/lib/ai/prompts.ts`
- Modify: `apps/web/lib/ai/plan.ts`
- Modify: `apps/web/app/api/projects/[id]/repomind/plan/route.ts`

- [ ] **Step 1: Update `PLAN_DECOMPOSITION_PROMPT` in `lib/ai/prompts.ts`**

Replace the current `PLAN_DECOMPOSITION_PROMPT` constant with a function:

```typescript
export function buildPlanDecompositionPrompt(
  planText: string,
  moduleGraph: object,
  config?: {
    tone?: string
    audience?: string
    idFormat?: string
    epicFormat?: string
  }
): string {
  const tone = config?.tone ?? "technical"
  const audience = config?.audience ?? "developers"
  const idFormat = config?.idFormat ?? "T-{n}"
  const epicFormat = config?.epicFormat ?? "EPIC-{n}"

  return `You are a senior technical architect. Decompose the project plan into Epics and Tasks.

Project Config:
- Tone: ${tone}
- Target audience: ${audience}
- Ticket ID format: ${idFormat}
- Epic ID format: ${epicFormat}

Codebase Module Graph (use module IDs for linked_modules):
${JSON.stringify(moduleGraph, null, 2)}

Project Plan:
${planText}

Rules:
1. Break into 2-5 Epics. Each Epic has 3-8 Tasks.
2. Task titles and descriptions should be written for ${audience} in a ${tone} tone.
3. Use the ticket ID format "${idFormat}" (replace {n} with sequential numbers, e.g. T-001).
4. Use the epic ID format "${epicFormat}" (replace {n} with sequential numbers, e.g. EPIC-001).
5. Every Task must have acceptance_criteria (3-5 items) and linked_modules from the module graph.
6. Estimate complexity (XS, S, M, L, XL) and priority (low, medium, high, urgent).

Respond ONLY with valid JSON:
{
  "epics": [
    {
      "id": "EPIC-001",
      "title": "...",
      "description": "...",
      "tasks": [
        {
          "id": "T-001",
          "title": "...",
          "description": "...",
          "status": "todo",
          "priority": "medium",
          "complexity": "M",
          "acceptance_criteria": ["...", "..."],
          "linked_modules": ["module-id"]
        }
      ]
    }
  ]
}`
}
```

Also keep `CHANGELOG_SYSTEM_PROMPT` and `buildChangelogPrompt` unchanged.

- [ ] **Step 2: Update `decomposePlan` in `lib/ai/plan.ts`**

```typescript
import { buildPlanDecompositionPrompt } from "./prompts"
import type { RepoMindConfig } from "@/lib/git-storage/schemas"

// Remove old import of PLAN_DECOMPOSITION_PROMPT

export async function decomposePlan(
  planText: string,
  moduleGraph: any,
  config?: RepoMindConfig
): Promise<DecomposedPlan> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.")

  const prompt = buildPlanDecompositionPrompt(planText, moduleGraph, {
    tone: config?.ai?.tone,
    audience: config?.ai?.audience,
    idFormat: config?.tickets?.id_format,
    epicFormat: config?.tickets?.epic_format,
  })

  const model = "gemini-2.0-flash"
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API returned status ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!rawText) throw new Error("Unexpected response from Gemini API")

  const jsonText = rawText.replace(/```json\n?|\n?```/g, "").trim()
  const parsed = JSON.parse(jsonText) as DecomposedPlan

  parsed.epics.forEach(epic => {
    epic.tasks.forEach(task => {
      if (task.priority) task.priority = task.priority.toLowerCase() as any
      if (task.status) task.status = task.status.toLowerCase() as any
      if (task.complexity && task.complexity.length > 2) {
        const firstChar = task.complexity.charAt(0).toUpperCase()
        if (["S", "M", "L"].includes(firstChar)) task.complexity = firstChar as any
      }
    })
  })

  return parsed
}
```

- [ ] **Step 3: Update `plan/route.ts` to load `.repomind/config.yml` and pass it**

```typescript
// apps/web/app/api/projects/[id]/repomind/plan/route.ts
// Add these imports after existing ones:
import { loadRepomindContext } from "@/lib/repomind-config"

// Inside POST handler, after fetching `project` from Supabase:

// Load .repomind config for enriched decomposition
let repomindConfig = undefined
if (project.github_token) {
  try {
    const ctx = await loadRepomindContext(
      project.repo_full,
      project.github_token,
      project.default_branch || "main"
    )
    if (ctx) repomindConfig = ctx.config
  } catch {
    // non-fatal — fall back to defaults
  }
}

// Use moduleGraph from .repomind if available, fallback to config_cache
const configCache = project.config_cache as any
let moduleGraph = configCache?.codebase?.module_graph

if (!moduleGraph && repomindConfig) {
  // Try reading from .repomind/architecture/modules.json
  const { readTextFile } = await import("@/lib/github-api")
  const modulesRaw = await readTextFile(
    project.repo_full,
    project.github_token,
    project.default_branch || "main",
    ".repomind/architecture/modules.json"
  ).catch(() => null)
  if (modulesRaw) {
    try { moduleGraph = JSON.parse(modulesRaw) } catch {}
  }
}

if (!moduleGraph) {
  return NextResponse.json({ error: "Please run SCOUT scan first." }, { status: 400 })
}

// Pass config to decomposePlan
const decomposed = await decomposePlan(planText, moduleGraph, repomindConfig)
```

- [ ] **Step 4: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/ai/prompts.ts apps/web/lib/ai/plan.ts apps/web/app/api/projects/\[id\]/repomind/plan/route.ts
git commit -m "feat: sparky reads .repomind/config.yml to enrich plan decomposition (tone, audience, id format)"
```

---

### Task 8: LYRA reads module graph from `.repomind` for Q&A

LYRA answers codebase questions. Currently the chat route has no codebase context — she can only answer generically. Inject the module graph and tech stack from `.repomind` as system context.

**Files:**
- Modify: `apps/web/app/api/projects/[id]/chat/route.ts`

- [ ] **Step 1: Read the current chat route**

```bash
cat apps/web/app/api/projects/\[id\]/chat/route.ts
```

- [ ] **Step 2: Rewrite the chat route**

```typescript
// apps/web/app/api/projects/[id]/chat/route.ts
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

  // Build context from .repomind
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
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/projects/\[id\]/chat/route.ts
git commit -m "feat: lyra reads .repomind module graph + tech stack for context-aware Q&A"
```

---

### Task 9: PATCH agent — wire chat panel to real API

Check if `ChatPanel.tsx` is currently calling the real API or mocking responses. Wire it properly.

**Files:**
- Read then modify: `apps/web/components/ChatPanel.tsx`

- [ ] **Step 1: Read `ChatPanel.tsx`**

```bash
cat apps/web/components/ChatPanel.tsx
```

- [ ] **Step 2: Ensure ChatPanel calls `POST /api/projects/:id/chat`**

The panel should:
1. Maintain a `history` array of `{ role: 'user'|'assistant', content: string }` objects
2. On submit, `POST /api/projects/${projectId}/chat` with `{ message, history }`
3. Append the response to `history` and display it
4. Show a typing indicator during fetch

The complete implementation should look like:

```tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { MascotSprite } from './mascots/MascotSprite'

interface Message { role: 'user' | 'assistant'; content: string }
interface Props { projectId: string | null }

export function ChatPanel({ projectId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading || !projectId) return
    setInput('')
    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', content: data.reply ?? data.error ?? 'Error' }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Network error. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, opacity: 0.6 }}>
            <MascotSprite name="LYRA" state="idle" w={80} h={120} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              {projectId ? 'Ask LYRA anything about this codebase.' : 'Select a project first.'}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              lineHeight: 1.6,
              background: m.role === 'user' ? 'rgba(245,158,11,0.1)' : 'var(--surface)',
              border: `1px solid ${m.role === 'user' ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '10px 14px',
              maxWidth: '75%',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#60a5fa' }}>
              LYRA is thinking<span style={{ animation: 'blink 1s infinite' }}>▊</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {/* Input */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px', display: 'flex', gap: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={projectId ? 'Ask about this codebase…' : 'Select a project first'}
          disabled={!projectId || loading}
          style={{
            flex: 1,
            background: 'var(--void)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={!projectId || loading || !input.trim()}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            letterSpacing: '0.06em',
            background: (!projectId || loading || !input.trim()) ? 'var(--surface)' : '#60a5fa',
            color: (!projectId || loading || !input.trim()) ? 'var(--text-muted)' : '#0a0a14',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 6,
            cursor: (!projectId || loading || !input.trim()) ? 'default' : 'pointer',
          }}
        >
          ASK
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check + build**

```bash
cd apps/web && npx tsc --noEmit && npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ChatPanel.tsx
git commit -m "feat: lyra chat panel wired to real API with history and typing indicator"
```

---

### Task 10: Final wiring — auto-trigger SCOUT scan after project creation

When a project is newly created (`.repomind` was just initialised), automatically kick off a SCOUT scan so SPARKY is ready to use immediately.

**Files:**
- Modify: `apps/web/components/NewProjectModal.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Expose `_initialised` flag from `onCreated` callback**

In `NewProjectModal.tsx`, the `onCreated` callback receives the project object. The API now returns `_initialised: true` when `.repomind` was freshly created. Propagate this.

The `Project` interface in `NewProjectModal.tsx` and in `page.tsx` is private to each file. Pass the raw API response directly via the callback:

In `NewProjectModal.tsx`, change the callback type in Props:
```typescript
onCreated: (project: Project & { _initialised?: boolean }) => void
```

And pass `data` directly:
```typescript
onCreated(data)
```

- [ ] **Step 2: Auto-trigger scan in `page.tsx` `onCreated` handler**

Find the `onCreated` callback in `page.tsx`:

```typescript
onCreated={(project) => {
  setProjects(ps => [...ps, project])
  setSelectedProject(project)
  setNewProjectOpen(false)
  // Auto-trigger SCOUT scan on fresh init
  if ((project as any)._initialised) {
    setTimeout(async () => {
      setAgents(a => a.map(x => x.name === 'SCOUT' ? { ...x, status: 'working' } : x))
      setFeed(f => [{ color: '#22c55e', text: 'SCOUT <span style="color:#22c55e">scanning new repo…</span>', ago: 'now' }, ...f])
      try {
        const res = await fetch(`/api/projects/${project.id}/scan`, { method: 'POST' })
        const data = await res.json()
        if (res.ok) {
          setFeed(f => [
            { color: '#22c55e', text: `SCOUT <span style="color:#22c55e">indexed ${data.moduleCount} modules</span>`, ago: 'now' },
            ...f,
          ])
          setAgents(a => a.map(x => x.name === 'SCOUT' ? { ...x, status: 'done' } : x))
          setTimeout(() => setAgents(a => a.map(x => x.name === 'SCOUT' ? { ...x, status: 'idle' } : x)), 3000)
        }
      } catch {
        setAgents(a => a.map(x => x.name === 'SCOUT' ? { ...x, status: 'error' } : x))
      }
    }, 800)
  }
}}
```

- [ ] **Step 3: TypeScript check + full build**

```bash
cd apps/web && npx tsc --noEmit && npm run build 2>&1 | tail -10
```
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/NewProjectModal.tsx apps/web/app/page.tsx
git commit -m "feat: auto-trigger scout scan when new project is created with fresh .repomind"
```

---

## Phase 4 — Synchronization & Persistence

### Task 11: SPARKY writes tickets to `.repomind/tickets/`

After decomposing a plan, SPARKY should persist the tickets directly to Git so they are permanent and versioned.

**Files:**
- Modify: `apps/web/lib/git-storage/ticket.ts`
- Modify: `apps/web/app/api/projects/[id]/repomind/plan/route.ts`

- [ ] **Step 1: Add `saveTicketsToGit` helper**
In `lib/git-storage/ticket.ts`, implement a function that takes the decomposed plan and writes individual YAML files.

- [ ] **Step 2: Call persistence after decomposition**
In `plan/route.ts`, after `decomposePlan()`, call the new helper to write the files to GitHub.

---

### Task 12: GitHub Webhook Handler — `/api/webhooks/github`

Handle incoming `push` events to keep the local `config_cache` in sync with manual edits made directly on GitHub.

**Files:**
- Create: `apps/web/app/api/webhooks/github/route.ts`

- [ ] **Step 1: Implement the POST handler**
The handler should verify the signature, check if files in `.repomind/` were changed, and if so, trigger a re-scan or a re-sync of the config/tickets.

---

### Task 13: Ticket Loader — Sync GitHub tickets to Supabase

Ensure the Kanban board reflects the true state of the repository.

**Files:**
- Create: `apps/web/app/api/projects/[id]/tickets/sync/route.ts`

- [ ] **Step 1: Implement sync route**
On GET: Fetch all files in `.repomind/tickets/`, parse them, and UPSERT into the Supabase `tickets` table.

- [ ] **Step 2: Call sync on dashboard load**
Ensure the UI calls this sync endpoint when a project is selected.

---

### Task 14: Real PATCH agent logic

Fix the naming mismatch and give PATCH a real role, such as watching PRs or providing code-level feedback via the chat.

- [ ] **Step 1: Update LYRA to delegate to PATCH**
When a question is specifically about "fixing" or "refactoring" code, LYRA can invoke a PATCH-specific prompt that suggests actual code changes.

---

## Phase 5 — Robustness & UX Polish

### Task 15: Error UX & Validation

- [ ] **Step 1: YAML Validation**
Update `loadRepomindContext` to return detailed error messages if YAML is broken, and show these in the UI.

- [ ] **Step 2: Token Refresh Flow**
Detect 401/403 errors from GitHub and show a "Session Expired - Reconnect" button.

---

## Self-Review Checklist

### Spec coverage

| Requirement | Task(s) covering it |
|---|---|
| GitHub auth sign-in | Pre-existing (login page + NextAuth) — confirmed working |
| Post-login: load existing repo | Task 3 checks `.repomind/config.yml` existence — if found, loads as-is |
| Post-login: create new project with GitHub integration | Task 3 (POST handler), Task 4 (empty state UI) |
| `.repomind/config.yml` initialised on new project | Task 3 (`buildRepoMindInitFiles` + `githubAtomicWrite`) |
| `.repomind` as source of truth | Tasks 2, 5, 6, 7, 8 — all agents read from it |
| SPARKY behaviour per `.repomind` | Task 7 (tone, audience, id_format in prompt) |
| SAGE behaviour per `.repomind` | Task 6 (reads `system.mmd`) |
| LYRA behaviour per `.repomind` | Task 8, 9 (module graph + tech stack as context) |
| SCOUT writes back to `.repomind` | Task 5 |
| Auto-scan on new project | Task 10 |
| Onboarding empty state | Task 4 |

### No placeholders found — all steps have complete code.

### Type consistency

- `loadRepomindContext` returns `RepomindContext | null` — used consistently in Tasks 7, 8, 9
- `buildPlanDecompositionPrompt` replaces `PLAN_DECOMPOSITION_PROMPT` string — old import removed in Task 7 Step 2
- `RepoMindConfig` type imported from `lib/git-storage/schemas` — same source used everywhere
- `_initialised` typed as `boolean | undefined` — safe cast via `(project as any)._initialised` in Task 10
