# RepoMind AMD — AI Implementation Plan v2 (Mature)

> Grounded in the actual codebase. All file paths, function names, and API values verified.
> Priority: AMD vLLM integration + Gemini free-tier fallback.

---

## Current Codebase Reality

| File | Current State | What Needs to Change |
|------|--------------|----------------------|
| `lib/ai/gemini.ts` | Hardcoded `gemini-2.0-flash` in URL | Add `model` param, default to `gemini-2.5-flash` |
| `lib/ai/index.ts` | `gemini-embedding-001` ✓ correct | No change needed |
| `lib/ai/plan.ts` | Basic prompt, no arch awareness | Extend schema + upgrade prompt |
| `lib/ai/matching.ts` | Sends ALL tickets per commit | Rewrite with embed-first ranking |
| `lib/ai/prompts.ts` | Generic prompts only | Add SPARKY, PATCH, LYRA, SAGE, NOVA, SCOUT system prompts |
| `lib/fake-data.ts` | Wrong model names (`mistral-7b`, `opus-4-6`) | Update to real agent model strings |
| `components/AmdMetricsPanel.tsx` | Renders mock data from props | Wire to `/api/system/metrics` endpoint |
| `lib/ai/provider.ts` | Does not exist | **Create** — central AI router |
| `lib/ai/embeddings.ts` | Does not exist | **Create** — pgvector search |
| `app/api/projects/[id]/repomind/scout/route.ts` | Does not exist | **Create** — SCOUT agent |
| `app/api/system/metrics/route.ts` | Does not exist | **Create** — real GPU metrics |
| `components/ScoutPanel.tsx` | Does not exist | **Create** — SCOUT UI |
| Supabase migrations | No `module_embeddings` or `scout_findings` | **Create** 2 new migrations |

---

## Verified Technical Values

| Item | Correct Value | Source |
|------|--------------|--------|
| Gemini Flash model ID | `gemini-2.5-flash` | Google AI Dev API |
| Gemini Flash Lite model ID | `gemini-2.5-flash-lite` | Google AI Dev API |
| Embedding model ID | `gemini-embedding-001` | Already used in `index.ts` ✓ |
| Embedding dimensions | 3072 default, or 768 via `output_dimensionality` | MRL-based, truncation valid |
| Flash free RPM / RPD | 10 RPM / 250 RPD | Google rate limit docs |
| Flash Lite free RPM / RPD | 15 RPM / 1,000 RPD | Google rate limit docs |
| vLLM chat endpoint | `POST {baseUrl}/chat/completions` | vLLM OpenAI-compat docs |
| vLLM auth header | `Authorization: Bearer <token>` | vLLM OpenAI-compat docs |
| AMD ROCm Docker image | `vllm/vllm-openai-rocm:latest` | AMD developer docs (NOT `rocm/vllm` — deprecated) |
| AMD device flags | `--device /dev/kfd --device /dev/dri` | Same for MI300X and consumer AMD |

---

## Execution Order

```
Phase 1 — Gemini upgrade + provider layer     (1h, do first — unblocks everything)
Phase 2 — Architecture-aware SPARKY           (2h)
Phase 3 — RAG pipeline for LYRA              (2h)
Phase 4 — Smarter PATCH (embed-first)        (1h)
Phase 5 — SCOUT security agent               (2h)
Phase 6 — AMD vLLM integration               (1h setup + when credits available)
```

---

## Phase 1 — Gemini Upgrade + Provider Layer

### 1A. Fix `lib/ai/gemini.ts`

**Problem:** URL has `gemini-2.0-flash` hardcoded. `gemini-2.0-flash` is deprecated June 2026.

**Change:** Add `model` parameter with default `gemini-2.5-flash`.

```ts
// lib/ai/gemini.ts
export async function callGemini(params: {
  apiKey: string
  model?: string          // NEW — defaults to gemini-2.5-flash
  prompt: string
  systemPrompt?: string
  history?: { role: 'user' | 'model'; parts: { text: string }[] }[]
  responseMimeType?: string
  temperature?: number
  thinkingBudget?: number // NEW — for large SPARKY plans
}) {
  const {
    apiKey, prompt, systemPrompt, history = [],
    responseMimeType, temperature = 0.3,
    model = 'gemini-2.5-flash',   // default changed
    thinkingBudget,
  } = params

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const generationConfig: any = { temperature }
  if (responseMimeType) generationConfig.responseMimeType = responseMimeType
  if (thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = { thinkingBudget }
  }

  // rest of function unchanged (retry logic, etc.)
}
```

### 1B. Update `lib/fake-data.ts` model names

Current values are wrong (using Claude model IDs). Replace with real agent model strings:

```ts
// lib/fake-data.ts — INITIAL_AGENTS model field updates
SPARKY: model → 'gemini-2.5-flash'
PATCH:  model → 'gemini-2.5-flash-lite'   (AMD: 'Qwen2.5-Coder-7B')
SAGE:   model → 'gemini-2.5-flash'         (AMD: 'Qwen2.5-Coder-32B')
NOVA:   model → 'gemini-2.5-flash-lite'
LYRA:   model → 'gemini-2.5-flash'         (AMD: 'Qwen2.5-32B')
SCOUT:  model → 'gemini-2.5-flash'         (AMD: 'DeepSeek-Coder-V2-Lite')
```

### 1C. Create `lib/ai/provider.ts` — Central AI Router

This is the core of the AMD integration. All agent calls go through here.

```ts
// lib/ai/provider.ts

type Provider = 'gemini' | 'openai-compat'  // openai-compat = AMD vLLM

interface AgentConfig {
  provider: Provider
  model: string
  baseUrl?: string      // AMD vLLM endpoint
  apiKey?: string       // AMD key (often 'EMPTY' for local)
  temperature: number
  maxTokens?: number
}

export function getAgentConfig(agent: string): AgentConfig {
  const amdUrl = process.env.AMD_VLLM_BASE_URL
  const amdKey = process.env.AMD_VLLM_API_KEY ?? 'EMPTY'

  const configs: Record<string, AgentConfig> = {
    SPARKY: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      temperature: 0.2,
    },
    PATCH: {
      provider: amdUrl ? 'openai-compat' : 'gemini',
      model:    amdUrl ? 'Qwen2.5-Coder-7B-Instruct' : 'gemini-2.5-flash-lite',
      baseUrl:  amdUrl,
      apiKey:   amdUrl ? amdKey : undefined,
      temperature: 0.1,
    },
    SAGE: {
      provider: amdUrl ? 'openai-compat' : 'gemini',
      model:    amdUrl ? 'Qwen2.5-Coder-32B-Instruct' : 'gemini-2.5-flash',
      baseUrl:  amdUrl,
      apiKey:   amdUrl ? amdKey : undefined,
      temperature: 0.1,
    },
    NOVA: {
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      temperature: 0.3,
    },
    LYRA: {
      provider: 'gemini',   // AMD optional: Qwen2.5-32B-Instruct
      model: 'gemini-2.5-flash',
      temperature: 0.4,
    },
    SCOUT: {
      provider: amdUrl ? 'openai-compat' : 'gemini',
      model:    amdUrl ? 'deepseek-coder-v2-lite-instruct' : 'gemini-2.5-flash',
      baseUrl:  amdUrl,
      apiKey:   amdUrl ? amdKey : undefined,
      temperature: 0.1,
    },
  }

  return configs[agent] ?? configs['LYRA']
}

// Universal call function — replaces all direct callGemini() calls
export async function callAgent(
  agent: string,
  params: {
    prompt: string
    systemPrompt: string
    history?: { role: string; content: string }[]
    responseMimeType?: string
    thinkingBudget?: number
  }
): Promise<string> {
  const cfg = getAgentConfig(agent)

  if (cfg.provider === 'openai-compat') {
    return callOpenAICompat(cfg, params)
  }
  return callGeminiAgent(cfg, params)
}

async function callGeminiAgent(
  cfg: AgentConfig,
  params: Parameters<typeof callAgent>[1]
): Promise<string> {
  const { callGemini } = await import('./gemini')
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  // Convert history to Gemini format
  const history = (params.history ?? []).map(h => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }],
  }))

  return callGemini({
    apiKey,
    model: cfg.model,
    prompt: params.prompt,
    systemPrompt: params.systemPrompt,
    history,
    responseMimeType: params.responseMimeType,
    temperature: cfg.temperature,
    thinkingBudget: params.thinkingBudget,
  })
}

async function callOpenAICompat(
  cfg: AgentConfig,
  params: Parameters<typeof callAgent>[1]
): Promise<string> {
  if (!cfg.baseUrl) throw new Error('AMD_VLLM_BASE_URL not configured')

  const messages: { role: string; content: string }[] = []

  if (params.systemPrompt) {
    messages.push({ role: 'system', content: params.systemPrompt })
  }
  for (const h of params.history ?? []) {
    messages.push({ role: h.role, content: h.content })
  }
  messages.push({ role: 'user', content: params.prompt })

  const body: any = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature,
  }

  // vLLM supports response_format for JSON mode
  if (params.responseMimeType === 'application/json') {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey ?? 'EMPTY'}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`AMD vLLM failed: ${res.status} ${errText}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response from vLLM')
  return text
}
```

### 1D. Migrate all callGemini() callers to callAgent()

| File | Current call | Replacement |
|------|-------------|-------------|
| `lib/ai/matching.ts` | `callGemini({ apiKey, prompt, ... })` | `callAgent('PATCH', { prompt, systemPrompt, ... })` |
| `lib/ai/plan.ts` | `callGemini({ apiKey, prompt, ... })` | `callAgent('SPARKY', { prompt, systemPrompt, ... })` |
| `app/api/projects/[id]/scan/route.ts` | `callGemini({ apiKey, prompt, ... })` | `callAgent('SAGE', { prompt, systemPrompt, ... })` |
| `app/api/projects/[id]/chat/route.ts` | `callGemini({ apiKey, prompt, ... })` | `callAgent('LYRA', { prompt, systemPrompt, history, ... })` |
| `lib/ai/index.ts` (generateChangelog) | `callGemini(...)` | `callAgent('NOVA', ...)` |

Each callsite: remove `apiKey` argument (provider.ts reads from env), remove model selection (provider.ts owns it).

---

## Phase 2 — Architecture-Aware SPARKY

### 2A. Extend `DecomposedTask` in `lib/ai/plan.ts`

```ts
export interface DecomposedTask {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  complexity: 'XS' | 'S' | 'M' | 'L' | 'XL'
  acceptance_criteria: string[]
  linked_modules: string[]

  // New architectural metadata
  arch_layer: 'data' | 'service' | 'api' | 'ui' | 'infra' | 'cross-cutting'
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  risk_reason?: string
  depends_on: string[]        // task IDs — topological ordering
  blocks: string[]            // task IDs this unblocks
  requires_migration: boolean
  requires_env_var?: string[]
  test_strategy: 'unit' | 'integration' | 'e2e' | 'manual'
  estimated_hours?: number
  adr_ref?: string
}

export interface ArchitectureDecisionRecord {
  id: string               // 'ADR-001'
  title: string
  status: 'proposed' | 'accepted' | 'superseded'
  context: string
  decision: string
  consequences: string[]
  related_tasks: string[]
}

export interface DecomposedPlan {
  epics: DecomposedEpic[]
  adrs: ArchitectureDecisionRecord[]       // new
  dependency_graph: { from: string; to: string }[]  // new
  execution_order: string[][]              // new — batches of parallel tasks
}
```

### 2B. Upgrade `lib/ai/prompts.ts` — SPARKY system prompt + prompt builder

**New SPARKY system prompt:**
```
You are SPARKY, a Principal Software Architect with 20 years of experience.
Decompose high-level plans into precise, executable engineering tasks.

Architectural layers:
- DATA: databases, schemas, migrations, ORM models
- SERVICE: business logic, AI clients, utility libs
- API: HTTP routes, middleware, auth, validation
- UI: components, pages, state management
- INFRA: deployment, env vars, CI/CD
- CROSS-CUTTING: auth, logging, error handling, rate limiting

For every task:
1. Name the EXACT file(s) to create or modify (not "add auth" — say "add POST handler in app/api/auth/session/route.ts")
2. Assign ARCHITECTURAL LAYER
3. Assess RISK:
   - CRITICAL = touches auth, payments, security middleware
   - HIGH = shared module used by 5+ files, or requires DB migration
   - MEDIUM = new API endpoint, new stateful component
   - LOW = UI-only, docs, config
4. Determine DEPENDS_ON: data layer tasks before api layer tasks
5. Set REQUIRES_MIGRATION = true if DB schema changes
6. Write ACCEPTANCE_CRITERIA a QA engineer can verify without reading code
7. Set TEST_STRATEGY: unit (isolated), integration (API+DB), e2e (user flow), manual

Complexity rules:
- XS = 1 file, no new deps, no API change
- S  = 2-3 files, same layer
- M  = 3-5 files, one layer boundary
- L  = 5-10 files, multi-layer, needs testing
- XL = system-wide, migration required, high risk

execution_order: tasks in the same array can run in parallel.
Always order: data → service → api → ui.
Create ADRs for decisions about auth strategy, DB schema, state management.

Output ONLY valid JSON matching the schema. No prose.
```

**Upgrade `buildPlanDecompositionPrompt()` signature:**
```ts
export function buildPlanDecompositionPrompt(
  planText: string,
  moduleGraph: object,
  techStack: object | null,
  existingTickets: { id: string; title: string; status: string }[],
  config?: { tone?: string; audience?: string; idFormat?: string; epicFormat?: string }
): string
```

**New context injected:**
1. Detect shared modules (depCounts ≥ 3 in dependency lists) → inject as HIGH RISK warning
2. Serialize tech stack from `config_cache.codebase.tech_stack` (already stored by scan)
3. List existing tickets → "do NOT duplicate these"
4. JSON schema in prompt must match the new extended `DecomposedTask` shape

### 2C. Upgrade `plan/route.ts`

```ts
// 1. Load existing tickets for deduplication
const { data: existingTicketsRaw } = await supabaseAdmin
  .from('tickets')
  .select('id, title, status')
  .eq('project_id', id)

// 2. Get tech stack from config_cache (already stored by scan/route.ts)
const techStack = (project.config_cache as any)?.codebase?.tech_stack ?? null

// 3. Auto-select SPARKY model based on plan size
const thinkingBudget = planText.length > 2000 ? 8192 : undefined

// 4. Pass to decomposePlan
const decomposed = await decomposePlan(
  planText, moduleGraph, techStack,
  existingTicketsRaw ?? [],
  repomindConfig,
  { thinkingBudget }
)

// 5. Write ADR files to GitHub alongside tickets
for (const adr of decomposed.adrs ?? []) {
  const adrContent = writeADRMarkdown(adr)
  files[`.repomind/adrs/${adr.id.toLowerCase()}.md`] = adrContent
}

// 6. Return execution order to frontend
return NextResponse.json({
  success: true,
  ticketCount: taskCount,
  executionOrder: decomposed.execution_order ?? [],
  adrCount: decomposed.adrs?.length ?? 0,
})
```

**Add `writeADRMarkdown()` to `lib/git-storage/`:**
```ts
export function writeADRMarkdown(adr: ArchitectureDecisionRecord): string {
  return `# ${adr.id}: ${adr.title}\n\nStatus: ${adr.status}\n\n## Context\n${adr.context}\n\n## Decision\n${adr.decision}\n\n## Consequences\n${adr.consequences.map(c => `- ${c}`).join('\n')}\n\nRelated tasks: ${adr.related_tasks.join(', ')}\n`
}
```

### 2D. Extend ticket frontmatter schema in `schemas.ts`

```ts
export const ticketFrontmatterSchema = z.object({
  // ... existing fields ...
  arch_layer: z.enum(['data','service','api','ui','infra','cross-cutting']).optional(),
  risk_level: z.enum(['low','medium','high','critical']).optional(),
  risk_reason: z.string().optional(),
  requires_migration: z.boolean().default(false),
  requires_env_var: z.array(z.string()).default([]),
  test_strategy: z.enum(['unit','integration','e2e','manual']).optional(),
  estimated_hours: z.number().positive().optional(),
  adr_ref: z.string().optional(),
  depends_on: z.array(z.string()).default([]),
  blocks: z.array(z.string()).default([]),
})
```

---

## Phase 3 — RAG Pipeline for LYRA

### 3A. Supabase migration: `module_embeddings` table

**New file: `supabase/migrations/20260503_module_embeddings.sql`**

```sql
create extension if not exists vector;

create table if not exists module_embeddings (
  id          text,
  project_id  uuid references projects(id) on delete cascade,
  text        text,
  embedding   vector(768),
  created_at  timestamptz default now(),
  primary key (project_id, id)
);

create index on module_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

> **Note on dimensions:** `gemini-embedding-001` defaults to 3072 dims. We set `output_dimensionality: 768` in the API call to truncate. 768 is safe — MRL ensures quality is maintained at truncated dimensions. This keeps pgvector index compact and matching fast.

### 3B. Create `lib/ai/embeddings.ts`

```ts
// lib/ai/embeddings.ts
import { supabaseAdmin } from '@/lib/supabase'

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
        outputDimensionality: 768,
        taskType: 'SEMANTIC_SIMILARITY',
      }),
    }
  )
  if (!res.ok) throw new Error(`Embed failed: ${res.status}`)
  const data = await res.json()
  return data.embedding.values as number[]
}

export async function upsertModuleEmbeddings(
  projectId: string,
  modules: { id: string; path: string; summary: string }[]
): Promise<void> {
  // Batch embed in groups of 50 (API limit per batchEmbedContents call)
  const BATCH = 50
  for (let i = 0; i < modules.length; i += BATCH) {
    const batch = modules.slice(i, i + BATCH)
    const texts = batch.map(m => `${m.path}: ${m.summary}`)

    const { generateEmbeddings } = await import('@/lib/ai')
    // generateEmbeddings already handles batching + outputDimensionality
    const vecs = await generateEmbeddings(texts, { model: 'gemini-embedding-001' })

    const rows = batch.map((m, idx) => ({
      id: m.id,
      project_id: projectId,
      text: texts[idx],
      embedding: JSON.stringify(vecs[idx]),
    }))

    await supabaseAdmin
      .from('module_embeddings')
      .upsert(rows, { onConflict: 'project_id,id' })
  }
}

export async function searchModules(
  projectId: string,
  queryText: string,
  topK = 5
): Promise<{ id: string; path: string; summary: string; score: number }[]> {
  const queryVec = await embedText(queryText)

  const { data, error } = await supabaseAdmin.rpc('match_modules', {
    query_embedding: queryVec,
    match_project_id: projectId,
    match_count: topK,
  })

  if (error) throw new Error(`pgvector search failed: ${error.message}`)
  return data ?? []
}
```

**Supabase RPC function (add to migration file):**
```sql
create or replace function match_modules(
  query_embedding vector(768),
  match_project_id uuid,
  match_count int default 5
)
returns table (id text, path text, summary text, score float)
language sql stable as $$
  select
    id,
    (text::jsonb->>'path')::text as path,
    (text::jsonb->>'summary')::text as summary,
    1 - (embedding <=> query_embedding) as score
  from module_embeddings
  where project_id = match_project_id
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

> **Simpler approach** if RPC is overkill: store path/summary in separate columns instead of JSON-encoded text field, or just return the `text` column and parse on the JS side.

### 3C. Modify `app/api/projects/[id]/scan/route.ts`

After `moduleGraph` is built and saved, call:

```ts
// After supabaseAdmin.update({ config_cache: ... })
if (moduleGraph?.modules?.length > 0) {
  const { upsertModuleEmbeddings } = await import('@/lib/ai/embeddings')
  // Fire and forget — don't block the scan response
  upsertModuleEmbeddings(
    id,
    moduleGraph.modules.map((m: any) => ({
      id: m.id,
      path: m.path,
      summary: m.summary ?? m.name,
    }))
  ).catch(err => console.error('[scan] embeddings upsert failed:', err))
}
```

### 3D. Modify `app/api/projects/[id]/chat/route.ts`

```ts
// Replace: modules.slice(0, 30) context
// With: vector search

let moduleContext = ''
try {
  const { searchModules } = await import('@/lib/ai/embeddings')
  const topModules = await searchModules(id, message, 5)
  if (topModules.length > 0) {
    moduleContext = `Top relevant modules (semantic search):\n` +
      topModules.map(m => `- ${m.path} (${Math.round(m.score * 100)}% match): ${m.summary}`).join('\n')
  }
} catch {
  // fallback: static first-30
  if (ctx?.moduleGraph) {
    const mg = ctx.moduleGraph as any
    const modules = mg.modules?.slice(0, 30) ?? []
    moduleContext = `Module Graph (${modules.length} of ${mg.modules?.length ?? 0} modules):\n` +
      modules.map((m: any) => `- ${m.id}: ${m.name} (${m.path})`).join('\n')
  }
}
```

---

## Phase 4 — Smarter PATCH (Embed-First Matching)

### Rewrite `lib/ai/matching.ts`

```ts
import { callAgent } from './provider'
import { embedText } from './embeddings'

const PATCH_SYSTEM_PROMPT = `You are PATCH, an automated code review intelligence engine.
Given a Git commit, identify which open engineering ticket it relates to.

Rules:
- Only return matches with confidence > 0.6.
- confidence = 1.0: commit message explicitly references the ticket scope.
- confidence = 0.7: changed files/functions match the ticket's module.
- suggestedStatus must be one of: in_progress | in_review | done.
- reasoning: one sentence citing specific evidence (file name, function, keyword).
- Return [] if no strong match. Do NOT force a match.
Output ONLY a valid JSON array.`

export async function matchCommitToTickets(
  commit: CommitInfo,
  candidates: CandidateTicket[]
): Promise<TicketMatch[]> {
  if (candidates.length === 0) return []

  // Step 1: embed commit message + diff preview
  const commitText = `${commit.message} ${commit.diff.slice(0, 500)}`
  let commitVec: number[]
  try {
    commitVec = await embedText(commitText)
  } catch {
    // Embedding unavailable — fall back to sending all tickets
    return matchWithoutEmbedding(commit, candidates)
  }

  // Step 2: embed candidate tickets (in-memory cosine for <200 tickets)
  const ticketTexts = candidates.map(t => `${t.title}: ${t.description.slice(0, 200)}`)
  let ticketVecs: number[][]
  try {
    const { generateEmbeddings } = await import('@/lib/ai')
    ticketVecs = await generateEmbeddings(ticketTexts)
  } catch {
    return matchWithoutEmbedding(commit, candidates)
  }

  // Step 3: cosine similarity in-memory — filter to top-5 candidates
  const ranked = candidates
    .map((t, i) => ({ ...t, score: cosineSim(commitVec, ticketVecs[i]) }))
    .filter(t => t.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  if (ranked.length === 0) return []

  // Step 4: ask PATCH agent to reason on only the top-5
  const prompt = buildMatchPrompt(commit, ranked)
  const raw = await callAgent('PATCH', {
    prompt,
    systemPrompt: PATCH_SYSTEM_PROMPT,
    responseMimeType: 'application/json',
  })

  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function buildMatchPrompt(commit: CommitInfo, tickets: (CandidateTicket & { score: number })[]): string {
  return `COMMIT:
Hash: ${commit.hash}
Author: ${commit.author}
Message: ${commit.message}
Diff:
${commit.diff.slice(0, 1500)}

CANDIDATE TICKETS (pre-filtered by semantic similarity):
${tickets.map(t => `[${t.id}] ${t.title}: ${t.description.slice(0, 200)} (similarity: ${Math.round(t.score * 100)}%)`).join('\n---\n')}

Return JSON array of matches with confidence > 0.6.`
}

async function matchWithoutEmbedding(commit: CommitInfo, candidates: CandidateTicket[]): Promise<TicketMatch[]> {
  // Original approach as fallback — send top 15 candidates
  const top15 = candidates.slice(0, 15)
  const prompt = buildMatchPrompt(commit, top15.map(t => ({ ...t, score: 0 })))
  const raw = await callAgent('PATCH', { prompt, systemPrompt: PATCH_SYSTEM_PROMPT, responseMimeType: 'application/json' })
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}
```

---

## Phase 5 — SCOUT Security Agent

### 5A. Supabase migration: `scout_findings` table

**New file: `supabase/migrations/20260503_scout_findings.sql`**

```sql
create table scout_findings (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  severity    text check (severity in ('CRITICAL','HIGH','MEDIUM','LOW')),
  title       text not null,
  file        text,
  line        int,
  description text,
  remediation text,
  resolved    boolean default false,
  created_at  timestamptz default now()
);

create index on scout_findings (project_id, severity, resolved);
```

### 5B. Create `app/api/projects/[id]/repomind/scout/route.ts`

```ts
// POST — trigger SCOUT security scan
import { getServerSession } from 'next-auth/next'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { callAgent } from '@/lib/ai/provider'

const SCOUT_SYSTEM_PROMPT = `You are SCOUT, a security auditor AI for software repositories.
Identify security vulnerabilities in the provided code files.

For each vulnerability:
- severity: CRITICAL | HIGH | MEDIUM | LOW
- title: short vulnerability type name (e.g. "Hardcoded API Key", "SQL Injection")
- file: file path where found
- line: approximate line number or null
- description: one sentence explaining the vulnerability and why it is dangerous
- remediation: one sentence explaining the fix

Focus on: hardcoded secrets, missing auth checks, SQL injection, XSS, insecure direct object references, exposed admin routes, missing rate limiting.

CRITICAL = exploitable with no auth. HIGH = exploitable with low-privilege auth.
Do NOT flag test files, mock data, or commented-out code.
Output ONLY valid JSON array. Empty array if no findings.`

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

  // Get cached file list from last scan
  const moduleGraph = (project.config_cache as any)?.codebase?.module_graph
  if (!moduleGraph?.modules?.length) {
    return NextResponse.json({ error: 'Run a codebase scan first' }, { status: 400 })
  }

  // Filter to security-sensitive files (max 15)
  const allPaths: string[] = moduleGraph.modules.map((m: any) => m.path)
  const sensitivePaths = allPaths
    .filter(p => SENSITIVE_PATTERNS.some(re => re.test(p)))
    .slice(0, 15)

  if (sensitivePaths.length === 0) {
    return NextResponse.json({ success: true, findingCount: 0 })
  }

  // Fetch file content from GitHub raw API
  const [owner, repo] = project.repo_full.split('/')
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

  // Save to DB — clear previous unresolved findings first
  await supabaseAdmin
    .from('scout_findings')
    .delete()
    .eq('project_id', id)
    .eq('resolved', false)

  if (findings.length > 0) {
    await supabaseAdmin.from('scout_findings').insert(
      findings.map(f => ({ ...f, project_id: id }))
    )
  }

  return NextResponse.json({
    success: true,
    findingCount: findings.length,
    critical: findings.filter(f => f.severity === 'CRITICAL').length,
    high: findings.filter(f => f.severity === 'HIGH').length,
  })
}

// GET — fetch existing findings
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
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false })

  return NextResponse.json({ findings: findings ?? [] })
}
```

### 5C. Create `components/ScoutPanel.tsx`

Structure (implementation detail):
- Header: SCOUT mascot + "Security Audit" title + "Run Scan" button
- Finding count badges grouped by severity: CRITICAL (red), HIGH (orange), MEDIUM (yellow), LOW (gray)
- Finding cards: file path badge, line number, description, remediation, "Mark Resolved" button
- Empty state: "No vulnerabilities detected" with green check
- Loading state: "SCOUT is scanning security-sensitive files..."

API calls:
- `GET /api/projects/[id]/repomind/scout` on mount → load existing findings
- `POST /api/projects/[id]/repomind/scout` on "Run Scan" → triggers scan
- `PATCH /api/projects/[id]/repomind/scout/[fid]` → mark resolved (add this route)

### 5D. Add SCOUT to Sidebar

In `components/Sidebar.tsx` (or `components/CrewPanel.tsx`), add SCOUT tab conditionally:

```ts
// Show only if env var is set or if at least one finding exists
{(process.env.NEXT_PUBLIC_SCOUT_ENABLED === 'true' || hasScoutFindings) && (
  <SidebarTab label="Security" icon={<ShieldIcon />} onClick={() => setPanel('scout')} />
)}
```

---

## Phase 6 — AMD vLLM Integration

### 6A. Docker Setup (Corrected)

The original plan used `rocm/vllm:latest` which is **deprecated**. Use:

```bash
# Pull the correct AMD ROCm image
docker pull vllm/vllm-openai-rocm:latest

# Serve Qwen2.5-Coder (PATCH + SCOUT agent model)
docker run -d \
  --name vllm-patch \
  --group-add=video \
  --cap-add=SYS_PTRACE \
  --security-opt seccomp=unconfined \
  --device /dev/kfd \
  --device /dev/dri \
  --ipc=host \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  -p 8000:8000 \
  vllm/vllm-openai-rocm:latest \
  --model Qwen/Qwen2.5-Coder-7B-Instruct \
  --served-model-name Qwen2.5-Coder-7B-Instruct \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.85 \
  --api-key ${AMD_VLLM_API_KEY}

# Serve second model (SAGE — large context) on different port
docker run -d \
  --name vllm-sage \
  --group-add=video \
  --cap-add=SYS_PTRACE \
  --security-opt seccomp=unconfined \
  --device /dev/kfd \
  --device /dev/dri \
  --ipc=host \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  -p 8001:8000 \
  vllm/vllm-openai-rocm:latest \
  --model Qwen/Qwen2.5-Coder-32B-Instruct \
  --served-model-name Qwen2.5-Coder-32B-Instruct \
  --max-model-len 131072 \
  --gpu-memory-utilization 0.90 \
  --api-key ${AMD_VLLM_API_KEY}
```

> **Single endpoint option:** Run all models through one vLLM instance if memory allows, or use a lightweight proxy (nginx) to route by model name. The `provider.ts` approach above sends model name in the request body, so routing is handled by vLLM natively.

### 6B. Create `app/api/system/metrics/route.ts`

vLLM exposes Prometheus metrics at `{baseUrl_without_v1}/metrics`.

```ts
// app/api/system/metrics/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  const amdUrl = process.env.AMD_VLLM_BASE_URL
  if (!amdUrl) {
    return NextResponse.json({
      available: false,
      gpu: 0, mem: 0, tokSec: 0, embedMs: 0,
    })
  }

  // Prometheus metrics endpoint is at the base (not /v1)
  const metricsUrl = amdUrl.replace('/v1', '') + '/metrics'

  try {
    const res = await fetch(metricsUrl, {
      headers: { Authorization: `Bearer ${process.env.AMD_VLLM_API_KEY ?? 'EMPTY'}` },
      next: { revalidate: 0 },  // no cache
    })

    if (!res.ok) throw new Error(`metrics ${res.status}`)
    const text = await res.text()

    // Parse Prometheus text format
    const parse = (name: string): number => {
      const match = text.match(new RegExp(`^${name}[{\\s][^\\n]*?([\\d.]+)$`, 'm'))
      return match ? parseFloat(match[1]) : 0
    }

    const gpuCacheUsage = parse('vllm:gpu_cache_usage_perc') * 100
    const cpuCacheUsage = parse('vllm:cpu_cache_usage_perc') * 100

    // Tokens per second: diff of generation_tokens_total over time would be ideal,
    // but for point-in-time polling we use avg_generation_throughput if available
    const tokSec = parse('vllm:avg_generation_throughput_toks_per_s')

    // Time to first token (P50 from histogram summary, or sum/count estimate)
    const ttftSum = parse('vllm:time_to_first_token_seconds_sum')
    const ttftCount = parse('vllm:time_to_first_token_seconds_count')
    const embedMs = ttftCount > 0 ? Math.round((ttftSum / ttftCount) * 1000) : 0

    return NextResponse.json({
      available: true,
      gpu: Math.round(gpuCacheUsage),
      mem: Math.round(cpuCacheUsage),
      tokSec: Math.round(tokSec),
      embedMs,
      model: process.env.NEXT_PUBLIC_GPU_MODEL ?? 'AMD vLLM',
    })
  } catch (err: any) {
    return NextResponse.json({
      available: false,
      error: err.message,
      gpu: 0, mem: 0, tokSec: 0, embedMs: 0,
    })
  }
}
```

### 6C. Wire `AmdMetricsPanel.tsx` to real metrics

The component currently receives mock data from `page.tsx`. Change `page.tsx` to poll the real endpoint when AMD is configured:

```ts
// In page.tsx — replace static INITIAL_METRICS
const [amdMetrics, setAmdMetrics] = useState<AmdMetrics>(INITIAL_METRICS)

useEffect(() => {
  if (!process.env.NEXT_PUBLIC_AMD_ENABLED) return
  const poll = () =>
    fetch('/api/system/metrics')
      .then(r => r.json())
      .then(data => { if (data.available) setAmdMetrics(data) })
      .catch(() => {})

  poll()
  const interval = setInterval(poll, 5000)
  return () => clearInterval(interval)
}, [])
```

Add to `.env.local`:
```
NEXT_PUBLIC_AMD_ENABLED=true  # shows AMD panel and starts polling
```

### 6D. Updated `.env.local` variables

```bash
# Phase 1 — already required
GEMINI_API_KEY=...

# Phase 6 — AMD vLLM (all optional, enables AMD routing when set)
AMD_VLLM_BASE_URL=http://<vm-ip>:8000/v1
AMD_VLLM_API_KEY=your-secret-or-EMPTY
NEXT_PUBLIC_GPU_MODEL=Qwen2.5-Coder-7B @ MI300X ROCm
NEXT_PUBLIC_AMD_ENABLED=true

# Feature flags
NEXT_PUBLIC_SCOUT_ENABLED=true
```

---

## Rate Limit Budget (Gemini Free Tier)

| Agent | Model | Calls/Day | Priority |
|-------|-------|-----------|----------|
| LYRA (chat) | flash | ~80 | High |
| PATCH (per commit) | flash-lite | ~100 | High |
| SPARKY (plan) | flash | ~10 | High |
| SAGE (scan) | flash | ~5 | Medium |
| SCOUT (security) | flash | ~10 | Medium |
| NOVA (changelog) | flash-lite | ~5 | Low |
| Embeddings | embedding-001 | ~40 | Medium |
| **Total** | | **~250** | Matches free tier RPD |

**When AMD is configured:** PATCH, SAGE, SCOUT move to vLLM → Gemini budget freed up for SPARKY + LYRA.

---

## File Change Summary

| File | Change | Phase |
|------|--------|-------|
| `lib/ai/gemini.ts` | Add `model` param, default `gemini-2.5-flash` | 1 |
| `lib/ai/provider.ts` | **CREATE** — central router, AMD fallback | 1 |
| `lib/fake-data.ts` | Update model names to real values | 1 |
| `lib/ai/plan.ts` | Extend `DecomposedTask` + `DecomposedPlan` interfaces | 2 |
| `lib/ai/prompts.ts` | New SPARKY system prompt + upgraded prompt builder | 2 |
| `lib/ai/plan.ts` (decomposePlan) | Pass `techStack`, `existingTickets`, `thinkingBudget` | 2 |
| `app/api/projects/[id]/repomind/plan/route.ts` | Pass techStack, write ADRs, return executionOrder | 2 |
| `lib/git-storage/` | Add `writeADRMarkdown()` | 2 |
| `schemas.ts` | Add arch_layer, risk_level, depends_on etc. | 2 |
| `supabase/migrations/20260503_module_embeddings.sql` | **CREATE** | 3 |
| `lib/ai/embeddings.ts` | **CREATE** — embedText, upsertModuleEmbeddings, searchModules | 3 |
| `app/api/projects/[id]/scan/route.ts` | Upsert embeddings after scan | 3 |
| `app/api/projects/[id]/chat/route.ts` | Use vector search instead of first-30 | 3 |
| `lib/ai/matching.ts` | Rewrite with embed-first cosine ranking | 4 |
| `supabase/migrations/20260503_scout_findings.sql` | **CREATE** | 5 |
| `app/api/projects/[id]/repomind/scout/route.ts` | **CREATE** — SCOUT agent | 5 |
| `components/ScoutPanel.tsx` | **CREATE** — security findings UI | 5 |
| `components/Sidebar.tsx` | Add SCOUT tab | 5 |
| `app/api/system/metrics/route.ts` | **CREATE** — real GPU metrics | 6 |
| `apps/web/app/page.tsx` | Poll real AMD metrics instead of static data | 6 |

---

## Pre-Session Checklist

Before each work session, verify:
- [ ] `AMD_VLLM_BASE_URL` set in `.env.local` if testing AMD routing
- [ ] Local Supabase running: `cd apps/web && DOCKER_HOST=unix:///run/user/1000/podman/podman.sock supabase start`
- [ ] Run new migrations if schema changed: `cd apps/web && node scripts/run-migrations.mjs`
- [ ] `GEMINI_API_KEY` present for Gemini fallback
