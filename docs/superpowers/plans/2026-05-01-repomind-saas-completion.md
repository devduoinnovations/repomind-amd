# RepoMind SaaS Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete RepoMind from a working prototype into a production-ready SaaS product with PATCH suggestions loop, NOVA release drafts, team support, email notifications, rate limiting, and a professional UI with left-sidebar navigation and dynamic agent system.

**Architecture:** Flow-first — Phase 1 completes the core PATCH value loop, Phases 2–6 add SaaS infrastructure, Phase 7 is a full UI overhaul with left-sidebar navigation, per-section agent welcomes, and user-configurable agent personas.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres), NextAuth (GitHub OAuth), Google Gemini (`callGemini` in `lib/ai/gemini.ts`), Resend (email), Upstash Redis (rate limiting), Lemon Squeezy (billing stubs), inline CSS with CSS variables (no Tailwind).

---

## PHASE 1 — PATCH Suggestions Loop

> **Epic goal:** Every GitHub push triggers AI ticket matching. Suggestions appear in the dashboard. Users can approve or reject them.

---

### Task 1: Fix `matchCommitToTickets` to use `callGemini`

**Why:** `lib/ai/matching.ts` uses a raw `fetch` call with the wrong model name (`gemini-flash-latest` — does not exist). It must use the shared `callGemini` utility which has retry logic and correct endpoints.

**Files:**
- Modify: `apps/web/lib/ai/matching.ts`

- [ ] **Step 1: Replace the raw fetch with `callGemini`**

Replace the entire contents of `apps/web/lib/ai/matching.ts` with:

```typescript
import { callGemini } from "./gemini";

export interface TicketMatch {
  ticketId: string;
  confidence: number;
  reasoning: string;
  suggestedStatus?: string;
}

export interface CommitInfo {
  hash: string;
  message: string;
  diff: string;
  author: string;
}

export interface CandidateTicket {
  id: string;
  title: string;
  description: string;
  status: string;
}

export async function matchCommitToTickets(
  commit: CommitInfo,
  candidates: CandidateTicket[]
): Promise<TicketMatch[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  if (candidates.length === 0) return [];

  const prompt = `You are a RepoMind Intelligence Engine. Match the following Git commit to the most relevant engineering tickets.

COMMIT:
Hash: ${commit.hash}
Author: ${commit.author}
Message: ${commit.message}
Diff Summary:
${commit.diff.slice(0, 2000)}

CANDIDATE TICKETS:
${candidates.map(t => `[${t.id}] ${t.title}: ${t.description.slice(0, 200)}`).join("\n---\n")}

Return a JSON array of matches with confidence > 0.5 only:
[
  {
    "ticketId": "T-001",
    "confidence": 0.95,
    "reasoning": "Commit message directly references this ticket's scope.",
    "suggestedStatus": "in_progress"
  }
]
Respond with JSON only. Empty array if no strong matches.`;

  const raw = await callGemini({
    apiKey,
    prompt,
    systemPrompt: "You are an expert code reviewer. Return only valid JSON array, no markdown.",
    responseMimeType: "application/json",
    temperature: 0.1,
  });

  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/ai/matching.ts
git commit -m "fix: matchCommitToTickets uses callGemini with retry logic"
```

---

### Task 2: Create `lib/suggestions.ts` — write matches to Supabase

**Files:**
- Create: `apps/web/lib/suggestions.ts`

- [ ] **Step 1: Create the helper**

```typescript
// apps/web/lib/suggestions.ts
import { supabaseAdmin } from "@/lib/supabase";
import type { TicketMatch } from "@/lib/ai/matching";

export async function saveSuggestions(
  projectId: string,
  commitSha: string,
  commitMessage: string,
  matches: TicketMatch[],
  ticketPaths: Record<string, string>
): Promise<void> {
  if (matches.length === 0) return;

  const rows = matches.map((m) => ({
    project_id: projectId,
    ticket_id: m.ticketId,
    ticket_path: ticketPaths[m.ticketId] ?? "",
    commit_sha: commitSha,
    commit_message: commitMessage,
    suggested_status: m.suggestedStatus ?? "in_progress",
    confidence: Math.round(m.confidence * 100),
    reasoning: m.reasoning,
    status: "pending",
  }));

  const { error } = await supabaseAdmin.from("ai_suggestions").insert(rows);
  if (error) console.error("[suggestions] Failed to save:", error.message);
}
```

- [ ] **Step 2: Ensure `ai_suggestions` table has `reasoning` column**

Run this in Supabase SQL editor:
```sql
ALTER TABLE ai_suggestions ADD COLUMN IF NOT EXISTS reasoning text;
ALTER TABLE ai_suggestions ADD COLUMN IF NOT EXISTS confidence integer DEFAULT 0;
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/suggestions.ts
git commit -m "feat: saveSuggestions helper writes PATCH matches to Supabase"
```

---

### Task 3: Wire PATCH matching into the GitHub webhook push handler

**Files:**
- Modify: `apps/web/app/api/webhooks/github/route.ts`

- [ ] **Step 1: Add PATCH matching after ticket sync**

The webhook already imports `syncTicketIndex`. Add PATCH matching below it. Replace the push event block:

```typescript
// apps/web/app/api/webhooks/github/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyGithubWebhook } from "@/lib/github";
import { supabaseAdmin } from "@/lib/supabase";
import { matchCommitToTickets } from "@/lib/ai/matching";
import { saveSuggestions } from "@/lib/suggestions";

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";
  const event = req.headers.get("x-github-event") || "";

  let body: any;
  try { body = JSON.parse(payload); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repoFull = body.repository?.full_name;
  if (!repoFull) return NextResponse.json({ error: "Missing repository" }, { status: 400 });

  const { data: project } = await supabaseAdmin
    .from("projects").select("*").eq("repo_full", repoFull).single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    const isValid = await verifyGithubWebhook(payload, signature, secret);
    if (!isValid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event === "push" && project.github_token) {
    const branch = body.ref?.replace("refs/heads/", "") || project.default_branch || "main";
    const commits: any[] = body.commits ?? [];

    // Log event
    await supabaseAdmin.from("webhook_events").insert({
      project_id: project.id, event_type: event, payload: body, status: "pending",
    }).catch(() => {});

    // Run in background (fire and forget)
    runPatchMatching(project, branch, commits).catch(err =>
      console.error("[webhook/push] PATCH matching failed:", err.message)
    );

    return NextResponse.json({ message: "Push received" });
  }

  if (event === "pull_request" && body.action === "closed" && body.pull_request?.merged) {
    await supabaseAdmin.from("webhook_events").insert({
      project_id: project.id, event_type: "pr_merged", payload: body, status: "pending",
    }).catch(() => {});

    runChangelogGeneration(project, body.pull_request).catch(err =>
      console.error("[webhook/pr] Changelog generation failed:", err.message)
    );

    return NextResponse.json({ message: "PR merge received" });
  }

  return NextResponse.json({ message: "Event ignored" });
}

async function runPatchMatching(project: any, branch: string, commits: any[]) {
  const { GitHubRepoFileClient, getTicketIndex, rebuildTicketIndex } = await import("@/lib/git-storage");
  const [owner, repo] = project.repo_full.split("/");
  const client = new GitHubRepoFileClient({
    owner, repo, token: project.github_token, branch,
  });

  let index = await getTicketIndex(client);
  if (!index) index = await rebuildTicketIndex(client);

  const openTickets = (index?.tickets ?? []).filter(
    (t: any) => !["done", "DONE"].includes(t.status)
  );
  if (openTickets.length === 0) return;

  const ticketPaths: Record<string, string> = {};
  openTickets.forEach((t: any) => { if (t.path) ticketPaths[t.id] = t.path; });

  for (const commit of commits.slice(0, 5)) {
    const matches = await matchCommitToTickets(
      {
        hash: commit.id,
        message: commit.message,
        diff: (commit.added ?? []).concat(commit.modified ?? []).join("\n"),
        author: commit.author?.name ?? "unknown",
      },
      openTickets.map((t: any) => ({
        id: t.id, title: t.title,
        description: t.description ?? "", status: t.status,
      }))
    );
    await saveSuggestions(project.id, commit.id, commit.message, matches, ticketPaths);
  }
}

async function runChangelogGeneration(project: any, pr: any) {
  // Implemented in Task 6 (Phase 2)
  console.log("[webhook/pr] Changelog generation queued for PR:", pr.number);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/webhooks/github/route.ts
git commit -m "feat: webhook triggers PATCH matching on push, queues changelog on PR merge"
```

---

### Task 4: Add manual "Trigger PATCH" API endpoint

**Files:**
- Create: `apps/web/app/api/projects/[id]/repomind/suggestions/generate/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { GitHubRepoFileClient, getTicketIndex, rebuildTicketIndex } from "@/lib/git-storage";
import { matchCommitToTickets } from "@/lib/ai/matching";
import { saveSuggestions } from "@/lib/suggestions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabaseAdmin
    .from("projects").select("*").eq("id", id).eq("user_id", session.user.id).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.github_token) return NextResponse.json({ error: "No GitHub token" }, { status: 400 });

  const branch = project.default_branch || "main";
  const [owner, repo] = project.repo_full.split("/");
  const client = new GitHubRepoFileClient({ owner, repo, token: project.github_token, branch });

  let index = await getTicketIndex(client);
  if (!index) index = await rebuildTicketIndex(client);

  const openTickets = (index?.tickets ?? []).filter(
    (t: any) => !["done", "DONE"].includes(t.status)
  );

  if (openTickets.length === 0) {
    return NextResponse.json({ message: "No open tickets to match", generated: 0 });
  }

  // Use last 3 commits from GitHub
  const commitsRes = await fetch(
    `https://api.github.com/repos/${project.repo_full}/commits?sha=${branch}&per_page=3`,
    { headers: { Authorization: `Bearer ${project.github_token}`, Accept: "application/vnd.github+json" } }
  );
  const commits = commitsRes.ok ? await commitsRes.json() : [];

  const ticketPaths: Record<string, string> = {};
  openTickets.forEach((t: any) => { if (t.path) ticketPaths[t.id] = t.path; });

  let totalGenerated = 0;
  for (const commit of commits.slice(0, 3)) {
    const matches = await matchCommitToTickets(
      {
        hash: commit.sha,
        message: commit.commit?.message ?? "",
        diff: "",
        author: commit.commit?.author?.name ?? "unknown",
      },
      openTickets.map((t: any) => ({ id: t.id, title: t.title, description: t.description ?? "", status: t.status }))
    );
    await saveSuggestions(project.id, commit.sha, commit.commit?.message ?? "", matches, ticketPaths);
    totalGenerated += matches.length;
  }

  return NextResponse.json({ message: "PATCH scan complete", generated: totalGenerated });
}
```

- [ ] **Step 2: Add "Run PATCH" button to SuggestionsPanel**

In `apps/web/components/SuggestionsPanel.tsx`, add to the header section after the REFRESH button:

```typescript
const handleRunPatch = async () => {
  if (!projectId || loading) return;
  setLoading(true);
  try {
    await fetch(`/api/projects/${projectId}/repomind/suggestions/generate`, { method: 'POST' });
    loadSuggestions();
  } catch {
    setError('PATCH scan failed');
    setLoading(false);
  }
};
```

Add button in JSX next to REFRESH:
```tsx
<button
  onClick={handleRunPatch}
  disabled={loading}
  style={{
    fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.06em',
    background: 'rgba(20,184,166,0.2)', color: '#14b8a6',
    border: '1px solid rgba(20,184,166,0.4)', padding: '6px 12px',
    borderRadius: 6, cursor: loading ? 'default' : 'pointer', marginLeft: 8,
  }}
>
  RUN PATCH
</button>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/projects/\[id\]/repomind/suggestions/generate/route.ts apps/web/components/SuggestionsPanel.tsx
git commit -m "feat: manual PATCH scan endpoint and Run PATCH button"
```

---

## PHASE 2 — NOVA Release Auto-Draft

> **Epic goal:** Merged PRs auto-generate a changelog draft visible in the Releases panel. Users can also manually create releases.

---

### Task 5: Fetch PR commits from GitHub and generate changelog on merge

**Files:**
- Create: `apps/web/lib/releases.ts`
- Modify: `apps/web/app/api/webhooks/github/route.ts` (fill in `runChangelogGeneration`)

- [ ] **Step 1: Create `lib/releases.ts`**

```typescript
// apps/web/lib/releases.ts
import { generateChangelog } from "@/lib/ai";
import { supabaseAdmin } from "@/lib/supabase";
import { githubAtomicWrite } from "@/lib/git-storage/github";
import { buildChangelogPrompt } from "@/lib/ai/prompts";

export async function createReleaseFromPR(
  project: { id: string; repo_full: string; github_token: string; default_branch: string },
  pr: { number: number; title: string; body: string | null; head: { sha: string }; base: { ref: string } }
): Promise<void> {
  // Fetch commits from PR
  const commitsRes = await fetch(
    `https://api.github.com/repos/${project.repo_full}/pulls/${pr.number}/commits?per_page=50`,
    { headers: { Authorization: `Bearer ${project.github_token}`, Accept: "application/vnd.github+json" } }
  );
  if (!commitsRes.ok) throw new Error(`Failed to fetch PR commits: ${commitsRes.status}`);
  const commits = await commitsRes.json();

  const prompt = buildChangelogPrompt({
    prTitle: pr.title,
    prBody: pr.body,
    commits: commits.map((c: any) => ({ message: c.commit.message, sha: c.sha })),
  });

  const changelog = await generateChangelog(prompt);

  const version = changelog.version ?? `pr-${pr.number}`;
  const now = new Date().toISOString();
  const releaseId = `release-${Date.now()}`;

  // Save to Supabase
  await supabaseAdmin.from("releases").insert({
    id: releaseId,
    project_id: project.id,
    version,
    title: changelog.title ?? pr.title,
    summary: changelog.summary ?? "",
    entries: changelog.entries,
    status: "draft",
    pr_number: pr.number,
    created_at: now,
  }).catch(err => console.error("[releases] Supabase insert failed:", err.message));

  // Write to .repomind/releases/
  const branch = project.default_branch || "main";
  const slug = version.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const content = [
    `---`,
    `id: ${releaseId}`,
    `version: "${version}"`,
    `title: "${changelog.title ?? pr.title}"`,
    `status: draft`,
    `pr_number: ${pr.number}`,
    `created_at: "${now}"`,
    `---`,
    ``,
    `## ${changelog.title ?? pr.title}`,
    ``,
    changelog.summary ?? "",
    ``,
    ...changelog.entries.map(e => `- **[${e.category}]** ${e.content}`),
  ].join("\n");

  await githubAtomicWrite(
    { repoFull: project.repo_full, token: project.github_token, branch },
    { [`.repomind/releases/${slug}.md`]: content },
    `chore(repomind): draft release notes for PR #${pr.number}`
  ).catch(err => console.error("[releases] GitHub write failed:", err.message));
}
```

- [ ] **Step 2: Ensure `releases` table exists in Supabase**

```sql
CREATE TABLE IF NOT EXISTS releases (
  id text PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  version text NOT NULL,
  title text,
  summary text,
  entries jsonb DEFAULT '[]',
  status text DEFAULT 'draft',
  pr_number integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own project releases" ON releases
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
```

- [ ] **Step 3: Fill in `runChangelogGeneration` in webhook route**

Replace the stub in `apps/web/app/api/webhooks/github/route.ts`:

```typescript
async function runChangelogGeneration(project: any, pr: any) {
  const { createReleaseFromPR } = await import("@/lib/releases");
  await createReleaseFromPR(
    {
      id: project.id,
      repo_full: project.repo_full,
      github_token: project.github_token,
      default_branch: project.default_branch || "main",
    },
    pr
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/releases.ts apps/web/app/api/webhooks/github/route.ts
git commit -m "feat: NOVA auto-drafts changelog from merged PR via Gemini"
```

---

### Task 6: Manual release creation endpoint + NOVA panel form

**Files:**
- Modify: `apps/web/app/api/projects/[id]/releases/route.ts`
- Modify: `apps/web/components/ReleasesPanel.tsx`

- [ ] **Step 1: Add POST to releases route**

Add to `apps/web/app/api/projects/[id]/releases/route.ts`:

```typescript
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const { version, title, summary, entries = [] } = await req.json();
  if (!version || !title) return NextResponse.json({ error: "version and title required" }, { status: 400 });

  const { data: project } = await supabaseAdmin
    .from("projects").select("*").eq("id", projectId).eq("user_id", session.user.id).single();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();
  const releaseId = `release-${Date.now()}`;
  const slug = version.replace(/[^a-z0-9]/gi, "-").toLowerCase();

  await supabaseAdmin.from("releases").insert({
    id: releaseId, project_id: projectId, version, title, summary, entries, status: "draft", created_at: now,
  });

  const content = [
    `---\nid: ${releaseId}\nversion: "${version}"\ntitle: "${title}"\nstatus: draft\ncreated_at: "${now}"\n---`,
    `\n## ${title}\n\n${summary}\n`,
    ...entries.map((e: any) => `- **[${e.category}]** ${e.content}`),
  ].join("\n");

  if (project.github_token) {
    const { githubAtomicWrite } = await import("@/lib/git-storage/github");
    await githubAtomicWrite(
      { repoFull: project.repo_full, token: project.github_token, branch: project.default_branch || "main" },
      { [`.repomind/releases/${slug}.md`]: content },
      `chore(repomind): add release ${version}`
    ).catch(() => {});
  }

  return NextResponse.json({ id: releaseId, version, title, status: "draft" });
}
```

- [ ] **Step 2: Add "New Release" button + form to ReleasesPanel**

In `apps/web/components/ReleasesPanel.tsx`, add state and form:

```typescript
const [showForm, setShowForm] = useState(false);
const [form, setForm] = useState({ version: '', title: '', summary: '' });

const handleCreate = async () => {
  if (!projectId || !form.version || !form.title) return;
  const res = await fetch(`/api/projects/${projectId}/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  if (res.ok) {
    const r = await res.json();
    setReleases(prev => [r, ...prev]);
    setShowForm(false);
    setForm({ version: '', title: '', summary: '' });
  }
};
```

Add a "+ New Release" button in the panel header that toggles a simple form overlay.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/projects/\[id\]/releases/route.ts apps/web/components/ReleasesPanel.tsx
git commit -m "feat: manual release creation from NOVA panel"
```

---

## PHASE 3 — Settings & Project Management

> **Epic goal:** Users can manage their account, per-project settings, and team members from a /settings page.

---

### Task 7: Create `/settings` page with user profile

**Files:**
- Create: `apps/web/app/settings/page.tsx`
- Create: `apps/web/app/api/user/route.ts`
- Modify: `apps/web/components/Topbar.tsx`

- [ ] **Step 1: Create user API route**

```typescript
// apps/web/app/api/user/route.ts
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin.from("users").select("*").eq("id", session.user.id).single();
  return NextResponse.json(data ?? session.user);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await req.json();
  const { data, error } = await supabaseAdmin
    .from("users").update({ name }).eq("id", session.user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await supabaseAdmin.from("users").delete().eq("id", session.user.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create settings page**

```typescript
// apps/web/app/settings/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name)
  }, [session])

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Delete your account? This cannot be undone.')) return
    await fetch('/api/user', { method: 'DELETE' })
    signOut({ callbackUrl: '/login' })
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 24px', fontFamily: 'var(--font-mono)' }}>
      <h1 style={{ fontSize: 20, color: 'var(--text-primary)', marginBottom: 32, letterSpacing: '0.04em' }}>
        SETTINGS
      </h1>

      {/* Profile */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 16 }}>PROFILE</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Display Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13,
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>GitHub Account</label>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
              {session?.user?.email ?? '—'}
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              alignSelf: 'flex-start', padding: '8px 20px', background: 'rgba(96,165,250,0.2)',
              color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)',
              borderRadius: 6, cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em',
            }}
          >
            {saved ? 'SAVED ✓' : saving ? 'SAVING…' : 'SAVE CHANGES'}
          </button>
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <h2 style={{ fontSize: 12, color: '#ef4444', letterSpacing: '0.08em', marginBottom: 16 }}>DANGER ZONE</h2>
        <button
          onClick={handleDeleteAccount}
          style={{
            padding: '8px 20px', background: 'rgba(239,68,68,0.1)',
            color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6, cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em',
          }}
        >
          DELETE ACCOUNT
        </button>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Add Settings link to Topbar**

In `apps/web/components/Topbar.tsx`, add after the project selector area:

```tsx
import { useRouter } from 'next/navigation'
// Inside component:
const router = useRouter()

// In JSX, add gear icon button:
<button
  onClick={() => router.push('/settings')}
  title="Settings"
  style={{
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', fontSize: 16, padding: '4px 8px',
  }}
>
  ⚙
</button>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/settings/page.tsx apps/web/app/api/user/route.ts apps/web/components/Topbar.tsx
git commit -m "feat: /settings page with user profile and account management"
```

---

### Task 8: Project settings (rename, branch, rescan, delete)

**Files:**
- Create: `apps/web/components/ProjectSettingsModal.tsx`
- Modify: `apps/web/app/api/projects/[id]/route.ts`
- Modify: `apps/web/components/Topbar.tsx`

- [ ] **Step 1: Add PATCH and DELETE to project route**

Replace `apps/web/app/api/projects/[id]/route.ts`:

```typescript
import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin.from("projects").select("*").eq("id", id).eq("user_id", session.user.id).single();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const allowed = ["name", "default_branch"];
  const updates: Record<string, any> = {};
  for (const key of allowed) { if (body[key] !== undefined) updates[key] = body[key]; }
  const { data, error } = await supabaseAdmin
    .from("projects").update(updates).eq("id", id).eq("user_id", session.user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await supabaseAdmin.from("projects").delete().eq("id", id).eq("user_id", session.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create ProjectSettingsModal**

```typescript
// apps/web/components/ProjectSettingsModal.tsx
'use client'
import { useState } from 'react'

interface Project { id: string; name: string; repo_full: string; default_branch?: string | null }
interface Props {
  project: Project
  onClose: () => void
  onUpdated: (p: Project) => void
  onDeleted: () => void
}

export function ProjectSettingsModal({ project, onClose, onUpdated, onDeleted }: Props) {
  const [name, setName] = useState(project.name)
  const [branch, setBranch] = useState(project.default_branch ?? 'main')
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, default_branch: branch }),
    })
    if (res.ok) { const data = await res.json(); onUpdated(data); onClose(); }
    setSaving(false)
  }

  const rescan = async () => {
    setScanning(true)
    await fetch(`/api/projects/${project.id}/scan`, { method: 'POST' })
    setScanning(false)
    onClose()
  }

  const deleteProject = async () => {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    onDeleted()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 28, width: 420, fontFamily: 'var(--font-mono)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 14, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>PROJECT SETTINGS</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PROJECT NAME</label>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>DEFAULT BRANCH</label>
            <input value={branch} onChange={e => setBranch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13 }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>REPO: {project.repo_full}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '8px', background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)', borderRadius: 6, cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em' }}>
            {saving ? 'SAVING…' : 'SAVE'}
          </button>
          <button onClick={rescan} disabled={scanning} style={{ flex: 1, padding: '8px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em' }}>
            {scanning ? 'SCANNING…' : 'RE-SCAN'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button onClick={deleteProject} disabled={deleting} style={{ width: '100%', padding: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em' }}>
            {deleting ? 'DELETING…' : 'DELETE PROJECT'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire modal into Topbar or page.tsx**

In `apps/web/app/page.tsx`, add state and pass handler to Topbar:

```typescript
const [projectSettingsOpen, setProjectSettingsOpen] = useState(false)

// Add to JSX after newProjectOpen modal:
{projectSettingsOpen && selectedProject && (
  <ProjectSettingsModal
    project={selectedProject}
    onClose={() => setProjectSettingsOpen(false)}
    onUpdated={(p) => {
      setProjects(ps => ps.map(x => x.id === p.id ? p : x))
      setSelectedProject(p)
    }}
    onDeleted={() => {
      setProjects(ps => ps.filter(x => x.id !== selectedProject.id))
      setSelectedProject(null)
    }}
  />
)}
```

In Topbar, add a ⚙ icon that calls `onProjectSettings` prop.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ProjectSettingsModal.tsx apps/web/app/api/projects/\[id\]/route.ts apps/web/app/page.tsx
git commit -m "feat: project settings modal (rename, branch, rescan, delete)"
```

---

## PHASE 4 — Team / Multi-user

> **Epic goal:** Project owners can invite teammates by email. Invited users can join and see the same project board.

---

### Task 9: Supabase schema for teams

- [ ] **Step 1: Run migrations in Supabase SQL editor**

```sql
-- Team members
CREATE TABLE IF NOT EXISTS project_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see their memberships" ON project_members
  USING (user_id = auth.uid() OR project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Invites
CREATE TABLE IF NOT EXISTS project_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);
ALTER TABLE project_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project owners manage invites" ON project_invites
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
```

- [ ] **Step 2: Update GET /api/projects to include shared projects**

In `apps/web/app/api/projects/route.ts`, replace the GET query:

```typescript
// Fetch owned projects + projects where user is a member
const [{ data: owned }, { data: memberships }] = await Promise.all([
  supabaseAdmin.from("projects").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }),
  supabaseAdmin.from("project_members").select("project_id").eq("user_id", session.user.id),
]);

const memberProjectIds = (memberships ?? []).map(m => m.project_id);
let sharedProjects: any[] = [];
if (memberProjectIds.length > 0) {
  const { data } = await supabaseAdmin.from("projects").select("*").in("id", memberProjectIds);
  sharedProjects = data ?? [];
}

const seen = new Set<string>();
const projects = [...(owned ?? []), ...sharedProjects].filter(p => {
  if (seen.has(p.id)) return false;
  seen.add(p.id); return true;
});
return NextResponse.json(projects);
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: project_members + project_invites schema, GET projects includes shared"
```

---

### Task 10: Team member API routes

**Files:**
- Create: `apps/web/app/api/projects/[id]/members/route.ts`
- Create: `apps/web/app/api/invites/[token]/route.ts`

- [ ] **Step 1: Create members route**

```typescript
// apps/web/app/api/projects/[id]/members/route.ts
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin
    .from("project_members").select("*, user:user_id(id, name, email, avatar_url)").eq("project_id", id);
  return NextResponse.json(data ?? []);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = await req.json();
  await supabaseAdmin.from("project_members").delete().eq("project_id", id).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create invite route**

```typescript
// apps/web/app/api/projects/[id]/members/invite/route.ts
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabaseAdmin
    .from("projects").select("id, name").eq("id", id).eq("user_id", session.user.id).single();
  if (!project) return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const { data: invite, error } = await supabaseAdmin.from("project_invites").insert({
    project_id: id, email, invited_by: session.user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send invite email (wired in Phase 5)
  const inviteUrl = `${process.env.APP_URL}/invites/${invite.token}`;
  console.log("[invite] Invite URL:", inviteUrl);

  return NextResponse.json({ token: invite.token, inviteUrl });
}
```

- [ ] **Step 3: Create accept-invite page + route**

```typescript
// apps/web/app/invites/[token]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`/api/invites/${params.token}`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (d.projectId) {
          setStatus('success')
          setMessage(`Joined project: ${d.projectName}`)
          setTimeout(() => router.push('/'), 2000)
        } else {
          setStatus('error')
          setMessage(d.error ?? 'Invalid invite')
        }
      })
      .catch(() => { setStatus('error'); setMessage('Failed to accept invite') })
  }, [params.token])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--font-mono)', flexDirection: 'column', gap: 12 }}>
      {status === 'loading' && <div style={{ color: 'var(--text-muted)' }}>Accepting invite…</div>}
      {status === 'success' && <div style={{ color: '#22c55e' }}>{message} — Redirecting…</div>}
      {status === 'error' && <div style={{ color: '#ef4444' }}>{message}</div>}
    </div>
  )
}
```

```typescript
// apps/web/app/api/invites/[token]/route.ts
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const { data: invite } = await supabaseAdmin
    .from("project_invites").select("*, project:project_id(id, name)")
    .eq("token", token).eq("status", "pending").single();

  if (!invite) return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "Invite expired" }, { status: 410 });

  await supabaseAdmin.from("project_members").insert({
    project_id: invite.project_id, user_id: session.user.id, role: "member",
  }).onConflict("project_id,user_id").ignore();

  await supabaseAdmin.from("project_invites").update({ status: "accepted" }).eq("id", invite.id);

  return NextResponse.json({ projectId: invite.project_id, projectName: invite.project.name });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/projects/\[id\]/members apps/web/app/api/invites apps/web/app/invites
git commit -m "feat: team invite flow — send invite, accept via token URL, join project"
```

---

### Task 11: TeamPanel component (in /settings)

**Files:**
- Create: `apps/web/components/TeamPanel.tsx`

- [ ] **Step 1: Create TeamPanel**

```typescript
// apps/web/components/TeamPanel.tsx
'use client'
import { useState, useEffect } from 'react'

interface Member { id: string; user: { id: string; name: string; email: string; avatar_url?: string }; role: string }
interface Props { projectId: string; isOwner: boolean }

export function TeamPanel({ projectId, isOwner }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/projects/${projectId}/members`).then(r => r.json()).then(setMembers)
  }, [projectId])

  const sendInvite = async () => {
    if (!inviteEmail) return
    setInviting(true); setError(''); setInviteLink('')
    const res = await fetch(`/api/projects/${projectId}/members/invite`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    const data = await res.json()
    if (res.ok) { setInviteLink(data.inviteUrl); setInviteEmail('') }
    else setError(data.error)
    setInviting(false)
  }

  const removeMember = async (userId: string) => {
    await fetch(`/api/projects/${projectId}/members`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setMembers(m => m.filter(x => x.user.id !== userId))
  }

  return (
    <div style={{ fontFamily: 'var(--font-mono)' }}>
      <h3 style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 16 }}>TEAM MEMBERS</h3>

      {members.map(m => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{m.user.name ?? m.user.email}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.user.email} · {m.role}</div>
          </div>
          {isOwner && (
            <button onClick={() => removeMember(m.user.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
              REMOVE
            </button>
          )}
        </div>
      ))}

      {isOwner && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 12 }}>INVITE</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="teammate@email.com"
              style={{ flex: 1, padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}
            />
            <button onClick={sendInvite} disabled={inviting} style={{ padding: '8px 16px', background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              {inviting ? '…' : 'INVITE'}
            </button>
          </div>
          {inviteLink && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#22c55e', wordBreak: 'break-all' }}>
              Invite link: {inviteLink}
            </div>
          )}
          {error && <div style={{ marginTop: 8, fontSize: 11, color: '#ef4444' }}>{error}</div>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add TeamPanel section to `/settings` page**

In `apps/web/app/settings/page.tsx`, add a project selector + TeamPanel section below the Profile section.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/TeamPanel.tsx apps/web/app/settings/page.tsx
git commit -m "feat: TeamPanel — view members, remove members, send invites"
```

---

## PHASE 5 — Email Notifications

> **Epic goal:** Resend sends welcome emails, suggestion digests, scan complete, and team invite emails.

---

### Task 12: Create `lib/email.ts` with Resend + templates

**Files:**
- Create: `apps/web/lib/email.ts`

- [ ] **Step 1: Install Resend SDK**

```bash
cd apps/web && npm install resend
```

- [ ] **Step 2: Create `lib/email.ts`**

```typescript
// apps/web/lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "RepoMind <no-reply@repomind.dev>";

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await resend.emails.send({
    from: FROM, to,
    subject: "Welcome to RepoMind",
    html: `
      <div style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:32px;max-width:480px">
        <h1 style="color:#60a5fa;letter-spacing:0.1em;font-size:20px">REPOMIND</h1>
        <p>Welcome, ${name}.</p>
        <p>Your AI crew is ready. Connect a GitHub repo to start scanning.</p>
        <a href="${process.env.APP_URL}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:rgba(96,165,250,0.2);color:#60a5fa;border:1px solid rgba(96,165,250,0.4);text-decoration:none;border-radius:6px;font-size:13px">
          OPEN DASHBOARD
        </a>
      </div>`,
  }).catch(err => console.error("[email/welcome]", err.message));
}

export async function sendSuggestionDigestEmail(
  to: string, projectName: string, count: number
): Promise<void> {
  await resend.emails.send({
    from: FROM, to,
    subject: `PATCH found ${count} new suggestion${count > 1 ? "s" : ""} — ${projectName}`,
    html: `
      <div style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:32px;max-width:480px">
        <h1 style="color:#14b8a6;font-size:16px;letter-spacing:0.08em">PATCH</h1>
        <p>Analyzed recent commits in <strong>${projectName}</strong> and found <strong>${count}</strong> ticket update suggestion${count > 1 ? "s" : ""}.</p>
        <a href="${process.env.APP_URL}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:rgba(20,184,166,0.2);color:#14b8a6;border:1px solid rgba(20,184,166,0.4);text-decoration:none;border-radius:6px;font-size:13px">
          REVIEW SUGGESTIONS
        </a>
      </div>`,
  }).catch(err => console.error("[email/digest]", err.message));
}

export async function sendScanCompleteEmail(
  to: string, projectName: string, moduleCount: number
): Promise<void> {
  await resend.emails.send({
    from: FROM, to,
    subject: `SCOUT scan complete — ${projectName}`,
    html: `
      <div style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:32px;max-width:480px">
        <h1 style="color:#22c55e;font-size:16px;letter-spacing:0.08em">SCOUT</h1>
        <p>Scan of <strong>${projectName}</strong> is complete. Indexed <strong>${moduleCount}</strong> modules.</p>
        <a href="${process.env.APP_URL}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:rgba(34,197,94,0.2);color:#22c55e;border:1px solid rgba(34,197,94,0.3);text-decoration:none;border-radius:6px;font-size:13px">
          VIEW ARCHITECTURE
        </a>
      </div>`,
  }).catch(err => console.error("[email/scan]", err.message));
}

export async function sendTeamInviteEmail(
  to: string, inviterName: string, projectName: string, inviteUrl: string
): Promise<void> {
  await resend.emails.send({
    from: FROM, to,
    subject: `${inviterName} invited you to ${projectName} on RepoMind`,
    html: `
      <div style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:32px;max-width:480px">
        <h1 style="color:#60a5fa;letter-spacing:0.1em;font-size:20px">REPOMIND</h1>
        <p><strong>${inviterName}</strong> invited you to join <strong>${projectName}</strong>.</p>
        <a href="${inviteUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:rgba(96,165,250,0.2);color:#60a5fa;border:1px solid rgba(96,165,250,0.4);text-decoration:none;border-radius:6px;font-size:13px">
          ACCEPT INVITE
        </a>
        <p style="font-size:11px;color:#64748b;margin-top:16px">Link expires in 7 days.</p>
      </div>`,
  }).catch(err => console.error("[email/invite]", err.message));
}
```

- [ ] **Step 3: Wire welcome email into NextAuth callback**

In `apps/web/lib/auth.ts`, add to the `signIn` callback:

```typescript
// Inside callbacks.signIn, after user is confirmed:
const isNewUser = !!(user as any).isNewUser || false; // NextAuth sets this on first login
if (isNewUser && user.email && user.name) {
  const { sendWelcomeEmail } = await import("@/lib/email");
  sendWelcomeEmail(user.email, user.name).catch(() => {});
}
```

- [ ] **Step 4: Wire digest email in `lib/suggestions.ts`**

At the end of `saveSuggestions`, after the insert succeeds, fetch the project owner's email and send digest:

```typescript
if (rows.length > 0) {
  const { data: proj } = await supabaseAdmin
    .from("projects").select("name, user_id").eq("id", projectId).single();
  if (proj) {
    const { data: owner } = await supabaseAdmin
      .from("users").select("email").eq("id", proj.user_id).single();
    if (owner?.email) {
      const { sendSuggestionDigestEmail } = await import("@/lib/email");
      sendSuggestionDigestEmail(owner.email, proj.name, rows.length).catch(() => {});
    }
  }
}
```

- [ ] **Step 5: Wire scan complete email in scan route**

At the end of `POST /api/projects/[id]/scan/route.ts`, before returning success:

```typescript
// Send scan complete email
const { data: owner } = await supabaseAdmin.from("users").select("email, name").eq("id", session.user.id).single();
if (owner?.email) {
  const { sendScanCompleteEmail } = await import("@/lib/email");
  sendScanCompleteEmail(owner.email, project.name, moduleGraph.modules?.length ?? 0).catch(() => {});
}
```

- [ ] **Step 6: Wire invite email in invite route**

In `apps/web/app/api/projects/[id]/members/invite/route.ts`, after creating the invite:

```typescript
const { sendTeamInviteEmail } = await import("@/lib/email");
sendTeamInviteEmail(
  email,
  session.user.name ?? "A teammate",
  project.name,
  inviteUrl
).catch(() => {});
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/email.ts apps/web/lib/suggestions.ts apps/web/lib/auth.ts
git add apps/web/app/api/projects/\[id\]/scan/route.ts apps/web/app/api/projects/\[id\]/members/invite/route.ts
git commit -m "feat: Resend email notifications — welcome, digest, scan complete, invite"
```

---

## PHASE 6 — Rate Limiting & Production Hardening

> **Epic goal:** AI routes are rate-limited via Upstash Redis. UI has error boundaries. Build is TypeScript clean.

---

### Task 13: Upstash Redis rate limiting

**Files:**
- Create: `apps/web/lib/rate-limit.ts`

- [ ] **Step 1: Install Upstash Ratelimit SDK**

```bash
cd apps/web && npm install @upstash/ratelimit @upstash/redis
```

- [ ] **Step 2: Create `lib/rate-limit.ts`**

```typescript
// apps/web/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
function getRedis() {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN ?? "",
    });
  }
  return _redis;
}

// 10 AI requests per user per minute
export const aiRateLimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "repomind:ai",
});

// 3 scans per user per hour
export const scanRateLimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  prefix: "repomind:scan",
});

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const result = await limiter.limit(identifier);
    if (!result.success) {
      return { allowed: false, retryAfter: Math.ceil((result.reset - Date.now()) / 1000) };
    }
    return { allowed: true };
  } catch {
    // If Redis is down, allow the request (fail open)
    return { allowed: true };
  }
}
```

- [ ] **Step 3: Add `UPSTASH_REDIS_TOKEN` to `.env.local`**

```
UPSTASH_REDIS_TOKEN=<your_upstash_redis_rest_token>
```

- [ ] **Step 4: Apply rate limiting to scan route**

At the top of the POST handler in `apps/web/app/api/projects/[id]/scan/route.ts`:

```typescript
import { scanRateLimit, checkRateLimit } from "@/lib/rate-limit";

// Inside POST, after session check:
const rateCheck = await checkRateLimit(scanRateLimit, session.user.id!);
if (!rateCheck.allowed) {
  return NextResponse.json(
    { error: `Rate limit exceeded. Try again in ${rateCheck.retryAfter}s.` },
    { status: 429 }
  );
}
```

- [ ] **Step 5: Apply rate limiting to chat and plan routes**

Add to `apps/web/app/api/projects/[id]/chat/route.ts` POST handler:

```typescript
import { aiRateLimit, checkRateLimit } from "@/lib/rate-limit";
const rateCheck = await checkRateLimit(aiRateLimit, session.user.id!);
if (!rateCheck.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
```

Add same to `apps/web/app/api/projects/[id]/repomind/plan/route.ts` POST handler.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/rate-limit.ts apps/web/app/api/projects/\[id\]/scan/route.ts
git add apps/web/app/api/projects/\[id\]/chat/route.ts apps/web/app/api/projects/\[id\]/repomind/plan/route.ts
git commit -m "feat: Upstash Redis rate limiting on scan (3/hr), chat and plan (10/min)"
```

---

### Task 14: Error boundaries + TypeScript clean build

**Files:**
- Create: `apps/web/components/ErrorBoundary.tsx`

- [ ] **Step 1: Create ErrorBoundary**

```typescript
// apps/web/components/ErrorBoundary.tsx
'use client'
import { Component, ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: 24, color: '#ef4444' }}>⚠</div>
          <div style={{ fontSize: 12 }}>Something went wrong</div>
          <div style={{ fontSize: 11, color: '#ef4444', maxWidth: 300, textAlign: 'center' }}>
            {this.state.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{ marginTop: 8, padding: '6px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}
          >
            RETRY
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 2: Wrap panels in ErrorBoundary in `page.tsx`**

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Wrap each panel:
{tab === 'Kanban' && <ErrorBoundary><KanbanBoard ... /></ErrorBoundary>}
{tab === 'Suggestions' && <ErrorBoundary><SuggestionsPanel ... /></ErrorBoundary>}
{tab === 'Architecture' && <ErrorBoundary><ArchitecturePanel ... /></ErrorBoundary>}
{tab === 'Releases' && <ErrorBoundary><ReleasesPanel ... /></ErrorBoundary>}
{tab === 'Q&A' && <ErrorBoundary><ChatPanel ... /></ErrorBoundary>}
```

- [ ] **Step 3: TypeScript clean build check**

```bash
cd apps/web && npx tsc --noEmit
```

Fix any type errors before committing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ErrorBoundary.tsx apps/web/app/page.tsx
git commit -m "feat: ErrorBoundary wraps all panels, TypeScript build clean"
```

---

## PHASE 7 — Professional UI Overhaul

> **Epic goal:** Replace top tabs with a left sidebar. Each section has a dedicated full-page layout. The related agent greets you on entry. Users can rename agents and change their persona. Kanban gets filters, stats, and polished cards.

---

### Task 15: Left sidebar navigation layout

**Files:**
- Create: `apps/web/components/Sidebar.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Create Sidebar component**

```typescript
// apps/web/components/Sidebar.tsx
'use client'
import { MascotSprite } from '@/components/mascots/MascotSprite'

export type SectionId = 'kanban' | 'suggestions' | 'architecture' | 'releases' | 'chat' | 'settings'

interface SidebarItem {
  id: SectionId
  label: string
  agent: string
  agentColor: string
  badge?: number
}

interface Props {
  active: SectionId
  onSelect: (id: SectionId) => void
  suggestionCount?: number
  agentNames?: Record<string, string>
}

const BASE_ITEMS: SidebarItem[] = [
  { id: 'kanban',       label: 'KANBAN',       agent: 'SPARKY', agentColor: '#f59e0b' },
  { id: 'suggestions',  label: 'SUGGESTIONS',  agent: 'PATCH',  agentColor: '#14b8a6' },
  { id: 'architecture', label: 'ARCHITECTURE', agent: 'SAGE',   agentColor: '#8b5cf6' },
  { id: 'releases',     label: 'RELEASES',     agent: 'NOVA',   agentColor: '#ec4899' },
  { id: 'chat',         label: 'Q&A',          agent: 'LYRA',   agentColor: '#60a5fa' },
]

export function Sidebar({ active, onSelect, suggestionCount = 0, agentNames = {} }: Props) {
  const items = BASE_ITEMS.map(i => ({
    ...i,
    displayLabel: agentNames[i.agent] ?? i.label,
    badge: i.id === 'suggestions' && suggestionCount > 0 ? suggestionCount : undefined,
  }))

  return (
    <div style={{
      width: 200, borderRight: '1px solid var(--border)', background: 'var(--panel)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%',
    }}>
      {/* Agent section nav */}
      <div style={{ flex: 1, paddingTop: 8 }}>
        {items.map(item => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: 'none', borderLeft: `2px solid ${isActive ? item.agentColor : 'transparent'}`,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <MascotSprite name={item.agent as any} state={isActive ? 'working' : 'idle'} w={24} h={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: isActive ? item.agentColor : 'var(--text-muted)', letterSpacing: '0.06em' }}>
                  {item.agent}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: 1 }}>
                  {item.displayLabel}
                </div>
              </div>
              {item.badge && (
                <span style={{ background: item.agentColor, color: '#fff', borderRadius: 999, padding: '1px 5px', fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Settings at bottom */}
      <button
        onClick={() => onSelect('settings')}
        style={{
          width: '100%', padding: '12px 14px', background: active === 'settings' ? 'rgba(255,255,255,0.05)' : 'transparent',
          border: 'none', borderTop: '1px solid var(--border)', borderLeft: `2px solid ${active === 'settings' ? '#60a5fa' : 'transparent'}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <span style={{ fontSize: 14 }}>⚙</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: active === 'settings' ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: '0.06em' }}>
          SETTINGS
        </span>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Update layout in `page.tsx` to use Sidebar**

Replace the tab bar (`<div className="tabs">`) with the Sidebar:

```tsx
import { Sidebar, SectionId } from '@/components/Sidebar'

// Replace Tab type with SectionId
const [section, setSection] = useState<SectionId>('kanban')

// Replace the left panel + tab structure:
<div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
  <CrewPanel ... />
  <Sidebar
    active={section}
    onSelect={setSection}
    suggestionCount={suggestionCount}
    agentNames={agentNames}  // from Task 17
  />
  <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    {section === 'kanban' && <AgentWelcomeBanner agent="SPARKY" ... />}
    <div style={{ flex: 1, minHeight: 0 }}>
      {section === 'kanban' && <KanbanBoard ... />}
      {section === 'suggestions' && <SuggestionsPanel ... />}
      {section === 'architecture' && <ArchitecturePanel ... />}
      {section === 'releases' && <ReleasesPanel ... />}
      {section === 'chat' && <ChatPanel ... />}
      {section === 'settings' && <SettingsView projectId={selectedProject?.id} ... />}
    </div>
  </main>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/Sidebar.tsx apps/web/app/page.tsx
git commit -m "feat: left sidebar navigation replaces top tabs"
```

---

### Task 16: Agent welcome banner per section

**Files:**
- Create: `apps/web/components/AgentWelcomeBanner.tsx`

- [ ] **Step 1: Create the banner component**

```typescript
// apps/web/components/AgentWelcomeBanner.tsx
'use client'
import { useEffect, useState } from 'react'
import { MascotSprite } from '@/components/mascots/MascotSprite'

const WELCOME_LINES: Record<string, (ctx: WelcomeContext) => string> = {
  SPARKY: (ctx) => ctx.ticketCount > 0
    ? `${ctx.ticketCount} tickets loaded. Ready to decompose your next plan.`
    : `No tickets yet. Drop a plan and I'll break it down.`,
  PATCH:  (ctx) => ctx.suggestionCount > 0
    ? `${ctx.suggestionCount} commit${ctx.suggestionCount > 1 ? 's' : ''} matched to open tickets. Your review is needed.`
    : `All clear. Watching commits for ticket matches.`,
  SAGE:   (ctx) => ctx.moduleCount > 0
    ? `${ctx.moduleCount} modules mapped. The architecture is ready.`
    : `Scan the repo and I'll draw the map.`,
  NOVA:   (ctx) => ctx.releaseCount > 0
    ? `${ctx.releaseCount} release draft${ctx.releaseCount > 1 ? 's' : ''} waiting. Ready to ship?`
    : `No releases yet. Merge a PR and I'll draft the changelog.`,
  LYRA:   (ctx) => ctx.projectName
    ? `Ask me anything about ${ctx.projectName}. I've read every file.`
    : `Select a project and I'll have answers ready.`,
}

export interface WelcomeContext {
  ticketCount?: number
  suggestionCount?: number
  moduleCount?: number
  releaseCount?: number
  projectName?: string
}

interface Props {
  agent: 'SPARKY' | 'PATCH' | 'SAGE' | 'NOVA' | 'LYRA'
  agentColor: string
  displayName?: string
  context: WelcomeContext
}

const AGENT_COLORS: Record<string, string> = {
  SPARKY: '#f59e0b', PATCH: '#14b8a6', SAGE: '#8b5cf6', NOVA: '#ec4899', LYRA: '#60a5fa',
}

export function AgentWelcomeBanner({ agent, displayName, context }: Props) {
  const [visible, setVisible] = useState(false)
  const color = AGENT_COLORS[agent]
  const name = displayName ?? agent
  const line = WELCOME_LINES[agent]?.(context) ?? ''

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [agent])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
      borderBottom: '1px solid var(--border)', background: `rgba(${hexToRgb(color)},0.04)`,
      flexShrink: 0, transition: 'opacity 0.2s', opacity: visible ? 1 : 0,
    }}>
      <MascotSprite name={agent} state="idle" w={32} h={48} />
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color, letterSpacing: '0.06em' }}>
          {name}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {line}
        </div>
      </div>
    </div>
  )
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `${r},${g},${b}`
}
```

- [ ] **Step 2: Wire banner into `page.tsx` above each section panel**

```tsx
import { AgentWelcomeBanner } from '@/components/AgentWelcomeBanner'

const SECTION_AGENTS: Record<SectionId, 'SPARKY'|'PATCH'|'SAGE'|'NOVA'|'LYRA'|null> = {
  kanban: 'SPARKY', suggestions: 'PATCH', architecture: 'SAGE',
  releases: 'NOVA', chat: 'LYRA', settings: null,
}

// In JSX, above the panel area:
{SECTION_AGENTS[section] && (
  <AgentWelcomeBanner
    agent={SECTION_AGENTS[section]!}
    displayName={agentNames[SECTION_AGENTS[section]!]}
    context={{
      ticketCount: tickets.length,
      suggestionCount,
      moduleCount: selectedProject ? (configCache?.codebase?.module_graph?.modules?.length ?? 0) : 0,
      releaseCount: 0,
      projectName: selectedProject?.name,
    }}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/AgentWelcomeBanner.tsx apps/web/app/page.tsx
git commit -m "feat: agent welcome banner on section entry with contextual message"
```

---

### Task 17: Dynamic agent customization (rename + persona)

**Files:**
- Create: `apps/web/components/AgentCustomizeModal.tsx`
- Create: `apps/web/app/api/user/agents/route.ts`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Create agent config API**

```typescript
// apps/web/app/api/user/agents/route.ts
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// agent_configs stored as JSONB column on users table
// Run in Supabase: ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_configs jsonb DEFAULT '{}';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin.from("users").select("agent_configs").eq("id", session.user.id).single();
  return NextResponse.json(data?.agent_configs ?? {});
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json(); // { agentName: string, displayName: string, voiceLine: string }
  const { agentName, displayName, voiceLine } = body;

  const { data: user } = await supabaseAdmin.from("users").select("agent_configs").eq("id", session.user.id).single();
  const configs = (user?.agent_configs as Record<string, any>) ?? {};
  configs[agentName] = { displayName, voiceLine };

  await supabaseAdmin.from("users").update({ agent_configs: configs }).eq("id", session.user.id);
  return NextResponse.json({ ok: true, configs });
}
```

- [ ] **Step 2: Add `agent_configs` column in Supabase**

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_configs jsonb DEFAULT '{}';
```

- [ ] **Step 3: Create AgentCustomizeModal**

```typescript
// apps/web/components/AgentCustomizeModal.tsx
'use client'
import { useState } from 'react'
import { MascotSprite } from '@/components/mascots/MascotSprite'

const AGENTS = ['SPARKY','PATCH','SAGE','NOVA','LYRA','SCOUT'] as const
type AgentName = typeof AGENTS[number]

const AGENT_COLORS: Record<AgentName, string> = {
  SPARKY:'#f59e0b', PATCH:'#14b8a6', SAGE:'#8b5cf6',
  NOVA:'#ec4899', LYRA:'#60a5fa', SCOUT:'#22c55e',
}

const DEFAULT_VOICE_LINES: Record<AgentName, string> = {
  SPARKY: 'Plans become tickets become commits become history.',
  PATCH:  "I didn't ask. I just knew.",
  SAGE:   'Every codebase is a city. I draw the map.',
  NOVA:   'Ship something. I will tell the world.',
  LYRA:   'Ask anything. The answer is in the source.',
  SCOUT:  'A new CVE dropped. We are unaffected.',
}

interface Props {
  configs: Record<string, { displayName: string; voiceLine: string }>
  onClose: () => void
  onSaved: (configs: Record<string, any>) => void
}

export function AgentCustomizeModal({ configs, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<AgentName>('SPARKY')
  const [displayName, setDisplayName] = useState(configs[selected]?.displayName ?? selected)
  const [voiceLine, setVoiceLine] = useState(configs[selected]?.voiceLine ?? DEFAULT_VOICE_LINES[selected])
  const [saving, setSaving] = useState(false)

  const switchAgent = (name: AgentName) => {
    setSelected(name)
    setDisplayName(configs[name]?.displayName ?? name)
    setVoiceLine(configs[name]?.voiceLine ?? DEFAULT_VOICE_LINES[name])
  }

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/user/agents', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName: selected, displayName, voiceLine }),
    })
    const data = await res.json()
    if (res.ok) onSaved(data.configs)
    setSaving(false)
  }

  const color = AGENT_COLORS[selected]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, padding:28, width:500, fontFamily:'var(--font-mono)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontSize:14, color:'var(--text-primary)', letterSpacing:'0.04em' }}>CUSTOMIZE AGENTS</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:18 }}>×</button>
        </div>

        {/* Agent picker */}
        <div style={{ display:'flex', gap:8, marginBottom:20 }}>
          {AGENTS.map(a => (
            <button key={a} onClick={() => switchAgent(a)} style={{
              flex:1, padding:'8px 4px', background: selected===a ? `rgba(${hexToRgb(AGENT_COLORS[a])},0.15)` : 'transparent',
              border:`1px solid ${selected===a ? AGENT_COLORS[a] : 'var(--border)'}`,
              borderRadius:6, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            }}>
              <MascotSprite name={a} state="idle" w={20} h={30} />
              <span style={{ fontSize:9, color: selected===a ? AGENT_COLORS[a] : 'var(--text-muted)', letterSpacing:'0.04em' }}>{a}</span>
            </button>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>DISPLAY NAME</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)}
              style={{ width:'100%', padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:13 }} />
          </div>
          <div>
            <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>VOICE LINE</label>
            <input value={voiceLine} onChange={e => setVoiceLine(e.target.value)}
              style={{ width:'100%', padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:13 }} />
          </div>

          <div style={{ padding:'10px 12px', background:'rgba(0,0,0,0.2)', borderRadius:6, display:'flex', alignItems:'center', gap:10 }}>
            <MascotSprite name={selected} state="idle" w={28} h={42} />
            <div>
              <div style={{ fontSize:13, color, letterSpacing:'0.06em' }}>{displayName || selected}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, fontStyle:'italic' }}>{voiceLine}</div>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, marginTop:20 }}>
          <button onClick={save} disabled={saving} style={{ flex:1, padding:'9px', background:`rgba(${hexToRgb(color)},0.2)`, color, border:`1px solid rgba(${hexToRgb(color)},0.4)`, borderRadius:6, cursor:'pointer', fontSize:12, letterSpacing:'0.06em' }}>
            {saving ? 'SAVING…' : 'SAVE CHANGES'}
          </button>
          <button onClick={() => { setDisplayName(selected); setVoiceLine(DEFAULT_VOICE_LINES[selected]) }} style={{ padding:'9px 16px', background:'transparent', color:'var(--text-muted)', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', fontSize:12 }}>
            RESET
          </button>
        </div>
      </div>
    </div>
  )
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `${r},${g},${b}`
}
```

- [ ] **Step 4: Load agent configs on mount in `page.tsx` and wire modal**

```typescript
const [agentNames, setAgentNames] = useState<Record<string, string>>({})
const [agentCustomizeOpen, setAgentCustomizeOpen] = useState(false)
const [agentConfigs, setAgentConfigs] = useState<Record<string, any>>({})

// Load on mount:
useEffect(() => {
  fetch('/api/user/agents').then(r => r.json()).then(configs => {
    setAgentConfigs(configs)
    const names: Record<string, string> = {}
    for (const [k, v] of Object.entries(configs as any)) {
      names[k] = (v as any).displayName ?? k
    }
    setAgentNames(names)
  }).catch(() => {})
}, [])
```

Add "CUSTOMIZE AGENTS" button to the Topbar or CrewPanel header that opens `AgentCustomizeModal`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/AgentCustomizeModal.tsx apps/web/app/api/user/agents/route.ts apps/web/app/page.tsx
git commit -m "feat: agent customization — rename agents and change voice lines"
```

---

### Task 18: Professional Kanban redesign

**Files:**
- Modify: `apps/web/components/KanbanBoard.tsx`
- Modify: `apps/web/components/TicketCard.tsx`

- [ ] **Step 1: Add filters + column stats to KanbanBoard**

Add filter controls above the board in `KanbanBoard.tsx`:

```typescript
// Add to KanbanBoard props:
interface KanbanBoardProps {
  tickets: Ticket[]
  flashId: string | null
  onStatusChange: (id: string, status: string, path?: string) => void
  onTicketClick: (ticket: Ticket) => void
}

// Add filter state inside component:
const [filterPriority, setFilterPriority] = useState<string>('ALL')
const [filterComplexity, setFilterComplexity] = useState<string>('ALL')

const filtered = tickets.filter(t => {
  if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false
  if (filterComplexity !== 'ALL' && t.complexity !== filterComplexity) return false
  return true
})

// Filter bar JSX (add above the columns):
<div style={{ padding:'8px 12px', display:'flex', gap:8, alignItems:'center', borderBottom:'1px solid var(--border)', flexShrink:0, background:'var(--panel)' }}>
  <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>FILTER:</span>
  {['ALL','HIGH','MED','LOW'].map(p => (
    <button key={p} onClick={() => setFilterPriority(p)} style={{
      fontSize:10, padding:'3px 8px', borderRadius:4, fontFamily:'var(--font-mono)',
      background: filterPriority===p ? 'rgba(96,165,250,0.2)' : 'transparent',
      color: filterPriority===p ? '#60a5fa' : 'var(--text-muted)',
      border: `1px solid ${filterPriority===p ? 'rgba(96,165,250,0.4)' : 'var(--border)'}`,
      cursor:'pointer',
    }}>{p}</button>
  ))}
  <span style={{ marginLeft:8, fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>SIZE:</span>
  {['ALL','S','M','L','XL'].map(c => (
    <button key={c} onClick={() => setFilterComplexity(c)} style={{
      fontSize:10, padding:'3px 8px', borderRadius:4, fontFamily:'var(--font-mono)',
      background: filterComplexity===c ? 'rgba(139,92,246,0.2)' : 'transparent',
      color: filterComplexity===c ? '#8b5cf6' : 'var(--text-muted)',
      border: `1px solid ${filterComplexity===c ? 'rgba(139,92,246,0.4)' : 'var(--border)'}`,
      cursor:'pointer',
    }}>{c}</button>
  ))}
  <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
    {filtered.length} / {tickets.length} tickets
  </span>
</div>
```

- [ ] **Step 2: Add ticket count header to each column**

In the column header of KanbanBoard:

```tsx
// Column header with count badge:
<div style={{ padding:'10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
    <div style={{ width:6, height:6, borderRadius:'50%', background:COL_COLORS[col] }} />
    <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-display)', letterSpacing:'0.08em' }}>
      {col.replace('_', ' ')}
    </span>
  </div>
  <span style={{ fontSize:10, background:'rgba(255,255,255,0.06)', color:'var(--text-muted)', borderRadius:10, padding:'1px 6px', fontFamily:'var(--font-mono)' }}>
    {colTickets.length}
  </span>
</div>
```

- [ ] **Step 3: Upgrade TicketCard visual design**

Replace `TicketCard.tsx` with an improved version showing priority color strip, complexity badge, and ticket ID:

```typescript
// apps/web/components/TicketCard.tsx
'use client'
import type { Ticket } from '@/lib/types'

const PRIORITY_COLORS = { HIGH:'#ef4444', MED:'#f59e0b', LOW:'#22c55e' }
const COMPLEXITY_BG   = { S:'rgba(34,197,94,0.15)', M:'rgba(96,165,250,0.15)', L:'rgba(245,158,11,0.15)', XL:'rgba(239,68,68,0.15)' }
const COMPLEXITY_COLOR = { S:'#22c55e', M:'#60a5fa', L:'#f59e0b', XL:'#ef4444' }

interface Props {
  ticket: Ticket
  flash: boolean
  onClick: () => void
}

export function TicketCard({ ticket, flash, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        background: flash ? 'rgba(96,165,250,0.08)' : 'var(--surface)',
        border: `1px solid ${flash ? 'rgba(96,165,250,0.3)' : 'var(--border)'}`,
        borderLeft: `3px solid ${PRIORITY_COLORS[ticket.priority] ?? '#64748b'}`,
        borderRadius: 6, padding:'10px 12px', cursor:'pointer',
        transition:'all 0.15s', marginBottom: 6,
      }}
    >
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6, marginBottom:6 }}>
        <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', flexShrink:0 }}>
          {ticket.id}
        </span>
        <span style={{
          fontSize:9, padding:'1px 5px', borderRadius:3, fontFamily:'var(--font-mono)',
          background: COMPLEXITY_BG[ticket.complexity] ?? 'transparent',
          color: COMPLEXITY_COLOR[ticket.complexity] ?? 'var(--text-muted)',
        }}>
          {ticket.complexity}
        </span>
      </div>
      <div style={{ fontSize:12, color:'var(--text-primary)', fontFamily:'var(--font-mono)', lineHeight:1.4 }}>
        {ticket.title}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
        <span style={{
          fontSize:9, padding:'1px 5px', borderRadius:3, fontFamily:'var(--font-mono)',
          background:`rgba(${priorityRgb(ticket.priority)},0.12)`,
          color: PRIORITY_COLORS[ticket.priority] ?? 'var(--text-muted)',
        }}>
          {ticket.priority}
        </span>
        <span style={{ marginLeft:'auto', fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
          {ticket.age}
        </span>
      </div>
    </div>
  )
}

function priorityRgb(p: string): string {
  if (p === 'HIGH') return '239,68,68'
  if (p === 'MED')  return '245,158,11'
  return '34,197,94'
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/KanbanBoard.tsx apps/web/components/TicketCard.tsx
git commit -m "feat: professional Kanban — priority/size filters, ticket counts, polished cards"
```

---

### Task 19: Toast notification system

**Files:**
- Create: `apps/web/components/Toast.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Create Toast component**

```typescript
// apps/web/components/Toast.tsx
'use client'
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'

interface ToastItem { id: string; message: string; type: 'success' | 'error' | 'info' }

const ToastContext = createContext<{ toast: (msg: string, type?: ToastItem['type']) => void }>({
  toast: () => {},
})

export function useToast() { return useContext(ToastContext) }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  const COLORS = { success: '#22c55e', error: '#ef4444', info: '#60a5fa' }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position:'fixed', bottom:20, right:20, display:'flex', flexDirection:'column', gap:8, zIndex:9999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding:'10px 16px', background:'var(--panel)', border:`1px solid ${COLORS[t.type]}`,
            borderRadius:8, fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-primary)',
            maxWidth:320, display:'flex', alignItems:'center', gap:8,
            animation:'slideIn 0.2s ease',
          }}>
            <span style={{ color:COLORS[t.type], fontSize:14 }}>
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '●'}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
```

- [ ] **Step 2: Add `@keyframes slideIn` to `globals.css`**

```css
@keyframes slideIn {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

- [ ] **Step 3: Wrap app in ToastProvider and replace inline error strings with `toast()`**

In `apps/web/app/layout.tsx`, wrap with `<ToastProvider>`.

In `page.tsx` replace:
```typescript
// Before:
setFeed(f => [{ color: '#ef4444', text: `SPARKY error: ${err.message}`, ago: 'now' }, ...f])
// After:
toast(err.message, 'error')
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/Toast.tsx apps/web/app/layout.tsx apps/web/app/page.tsx apps/web/app/globals.css
git commit -m "feat: toast notification system replaces inline error messages"
```

---

### Task 20: Final integration pass + build verification

- [ ] **Step 1: Full TypeScript build check**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```

Fix all errors. Common ones:
- Missing `agentNames` prop on components — add with default `{}`
- `SectionId` import missing — check all files import from `@/components/Sidebar`
- `configCache` not typed on project — cast to `any` or add to project interface

- [ ] **Step 2: Run dev server and manually verify each section**

```bash
cd apps/web && npm run dev
```

Checklist:
- [ ] Login with GitHub works
- [ ] Create a project → SCOUT auto-scans
- [ ] Left sidebar shows all 5 sections + settings
- [ ] Each section shows agent welcome banner with correct name
- [ ] Kanban loads tickets, drag-and-drop works, filters work
- [ ] PATCH "Run PATCH" button generates suggestions
- [ ] Settings page loads, name can be saved
- [ ] Project settings modal opens, rename works
- [ ] Agent customize modal opens, rename saves and reflects everywhere
- [ ] Invite teammate flow generates an invite link

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: final integration pass — all sections verified working"
```

---

## Summary: 20 Tasks Across 7 Phases

| Phase | Tasks | Delivers |
|---|---|---|
| 1 — PATCH Loop | 1–4 | Suggestions tab fully live from real commits |
| 2 — NOVA Releases | 5–6 | Auto-drafted changelogs from merged PRs |
| 3 — Settings | 7–8 | User profile + project management |
| 4 — Teams | 9–11 | Multi-user invite and access control |
| 5 — Email | 12 | Welcome, digest, scan, invite emails |
| 6 — Hardening | 13–14 | Rate limiting, error boundaries, clean build |
| 7 — UI Overhaul | 15–20 | Left sidebar, agent welcome, customize, pro Kanban, toasts |

**Execute in order.** Each phase builds on the previous. Phases 1–2 are independent enough to be done in parallel with Phases 3–4 if needed.
