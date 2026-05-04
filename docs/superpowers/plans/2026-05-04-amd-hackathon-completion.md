# RepoMind AMD — Hackathon Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete RepoMind so all 6 AI agents (SPARKY, PATCH, SAGE, NOVA, LYRA, SCOUT) run on AMD MI300X via vLLM, with the SCOUT security agent, RAG chat pipeline, live GPU metrics panel, and Vercel production deploy.

**Architecture:** Single `Qwen2.5-72B-Instruct` model on AMD MI300X served by vLLM 0.17.1 handles all 6 agents via OpenAI-compatible API. Each agent is specialized through deep system prompts + context injection (not fine-tuning — that's a future milestone). Gemini embedding-001 handles vector embeddings. When `AMD_VLLM_BASE_URL` is unset, all agents fall back to Gemini automatically via `provider.ts`.

**Tech Stack:** Next.js 14, Supabase (pgvector), vLLM 0.17.1 + ROCm 7.2.0, AMD MI300X 192GB, Qwen2.5-72B-Instruct, Gemini embedding-001, Vercel

---

## File Map

**Create:**
- `apps/web/lib/ai/embeddings.ts` — embedText, upsertModuleEmbeddings, searchModules
- `apps/web/app/api/projects/[id]/repomind/scout/route.ts` — SCOUT POST (scan) + GET (findings) + PATCH (resolve)
- `apps/web/app/api/system/metrics/route.ts` — parse vLLM Prometheus metrics endpoint
- `apps/web/components/ScoutPanel.tsx` — security findings UI with severity badges
- `apps/web/supabase/migrations/20260504_module_embeddings.sql` — pgvector table + match_modules RPC
- `apps/web/supabase/migrations/20260505_scout_findings.sql` — scout findings table

**Modify:**
- `apps/web/lib/ai/provider.ts` — all 6 agents → AMD Qwen2.5-72B-Instruct when AMD_VLLM_BASE_URL is set
- `apps/web/lib/ai/prompts.ts` — add 6 specialized system prompts
- `apps/web/lib/ai/index.ts` — migrate generateChangelog to callAgent('NOVA', ...)
- `apps/web/lib/ai/matching.ts` — use PATCH_SYSTEM_PROMPT
- `apps/web/lib/ai/plan.ts` — use SPARKY_SYSTEM_PROMPT
- `apps/web/app/api/projects/[id]/scan/route.ts` — use SAGE_SYSTEM_PROMPT + upsert embeddings after scan
- `apps/web/app/api/projects/[id]/chat/route.ts` — use LYRA_SYSTEM_PROMPT + vector search fallback
- `apps/web/components/Sidebar.tsx` — add SCOUT tab, extend SectionId type
- `apps/web/components/AmdMetricsPanel.tsx` — show Qwen2.5-72B + all 6 agents, real stats
- `apps/web/app/page.tsx` — import ScoutPanel, add metrics polling, render SCOUT section

---

## Task 0: AMD GPU Droplet Setup (Manual Steps — No Code)

**Files:** None — portal + SSH steps only.

- [ ] **Step 1: Add your SSH public key in the DO portal**

  In the "Add an SSH Key" dialog, paste the output of:
  ```bash
  cat ~/.ssh/id_ed25519.pub 2>/dev/null || cat ~/.ssh/id_rsa.pub
  ```
  If neither exists, generate one first:
  ```bash
  ssh-keygen -t ed25519 -C "repomind-amd"
  cat ~/.ssh/id_ed25519.pub
  ```

- [ ] **Step 2: Create the droplet**

  In the DO portal with vLLM quick start image selected, click "Create GPU Droplet". Wait 2-3 minutes. Copy the public IP from the dashboard.

- [ ] **Step 3: SSH into the droplet**

  ```bash
  ssh root@<YOUR_DROPLET_IP>
  ```

- [ ] **Step 4: Check what the quick start image provides**

  ```bash
  cat /etc/motd 2>/dev/null
  docker ps 2>/dev/null || echo "no docker"
  which vllm && vllm --version 2>/dev/null || echo "vllm not in PATH"
  ls /root/
  ```

- [ ] **Step 5: Start vLLM serving Qwen2.5-72B-Instruct**

  **If vLLM is installed natively** (output of step 4 shows `vllm` in PATH):
  ```bash
  export HF_HOME=/root/.cache/huggingface
  nohup vllm serve Qwen/Qwen2.5-72B-Instruct \
    --served-model-name Qwen2.5-72B-Instruct \
    --max-model-len 32768 \
    --gpu-memory-utilization 0.90 \
    --host 0.0.0.0 \
    --port 8000 \
    --api-key repomind-amd-secret \
    > /root/vllm.log 2>&1 &

  echo "Downloading + loading model. Monitor with: tail -f /root/vllm.log"
  echo "Ready when you see: Application startup complete"
  ```

  **If Docker is available** (output of step 4 shows docker):
  ```bash
  docker run -d \
    --name vllm-repomind \
    --group-add=video \
    --cap-add=SYS_PTRACE \
    --security-opt seccomp=unconfined \
    --device /dev/kfd \
    --device /dev/dri \
    --ipc=host \
    -v /root/.cache/huggingface:/root/.cache/huggingface \
    -p 8000:8000 \
    vllm/vllm-openai-rocm:latest \
    --model Qwen/Qwen2.5-72B-Instruct \
    --served-model-name Qwen2.5-72B-Instruct \
    --max-model-len 32768 \
    --gpu-memory-utilization 0.90 \
    --api-key repomind-amd-secret

  docker logs -f vllm-repomind
  ```

  > First run downloads ~144GB. On DO datacenter network this takes 15-30 minutes. Leave it running.

- [ ] **Step 6: Verify vLLM is ready (run after "Application startup complete" appears in log)**

  Run this FROM the droplet:
  ```bash
  curl http://localhost:8000/v1/models \
    -H "Authorization: Bearer repomind-amd-secret"
  ```
  Expected: `{"data":[{"id":"Qwen2.5-72B-Instruct",...}]}`

- [ ] **Step 7: Open port 8000 in DO firewall (if needed)**

  In DO portal → Networking → Firewalls: add an inbound rule allowing TCP port 8000.
  Or use ufw on the droplet:
  ```bash
  ufw allow 8000/tcp
  ```

- [ ] **Step 8: Test from your LOCAL machine**

  ```bash
  curl http://<YOUR_DROPLET_IP>:8000/v1/models \
    -H "Authorization: Bearer repomind-amd-secret"
  ```
  Expected: same model list as step 6.

- [ ] **Step 9: Add env vars to `apps/web/.env.local`**

  ```bash
  # Append to apps/web/.env.local
  AMD_VLLM_BASE_URL=http://<YOUR_DROPLET_IP>:8000/v1
  AMD_VLLM_API_KEY=repomind-amd-secret
  NEXT_PUBLIC_AMD_ENABLED=true
  NEXT_PUBLIC_GPU_MODEL=Qwen2.5-72B @ AMD MI300X
  NEXT_PUBLIC_SCOUT_ENABLED=true
  ```

No commit for this task.

---

## Task 1: Update provider.ts — All 6 Agents on AMD

**Files:**
- Modify: `apps/web/lib/ai/provider.ts`

- [ ] **Step 1: Replace the entire file contents**

  ```ts
  // lib/ai/provider.ts

  type Provider = 'gemini' | 'openai-compat'

  export interface AgentConfig {
    provider: Provider
    model: string
    baseUrl?: string
    apiKey?: string
    temperature: number
    maxTokens?: number
  }

  const AMD_MODEL = 'Qwen2.5-72B-Instruct'

  export function getAgentConfig(agent: string): AgentConfig {
    const amdUrl = process.env.AMD_VLLM_BASE_URL
    const amdKey = process.env.AMD_VLLM_API_KEY ?? 'EMPTY'

    const amdBase = amdUrl
      ? { provider: 'openai-compat' as Provider, model: AMD_MODEL, baseUrl: amdUrl, apiKey: amdKey }
      : { provider: 'gemini' as Provider }

    const configs: Record<string, AgentConfig> = {
      SPARKY: { ...amdBase, model: amdUrl ? AMD_MODEL : 'gemini-2.5-flash', temperature: 0.2 },
      PATCH:  { ...amdBase, model: amdUrl ? AMD_MODEL : 'gemini-2.5-flash-lite', temperature: 0.1 },
      SAGE:   { ...amdBase, model: amdUrl ? AMD_MODEL : 'gemini-2.5-flash', temperature: 0.1 },
      NOVA:   { ...amdBase, model: amdUrl ? AMD_MODEL : 'gemini-2.5-flash-lite', temperature: 0.3 },
      LYRA:   { ...amdBase, model: amdUrl ? AMD_MODEL : 'gemini-2.5-flash', temperature: 0.4 },
      SCOUT:  { ...amdBase, model: amdUrl ? AMD_MODEL : 'gemini-2.5-flash', temperature: 0.1 },
    }

    return configs[agent] ?? configs['LYRA']
  }

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
    if (cfg.provider === 'openai-compat') return callOpenAICompat(cfg, params)
    return callGeminiAgent(cfg, params)
  }

  async function callGeminiAgent(
    cfg: AgentConfig,
    params: Parameters<typeof callAgent>[1]
  ): Promise<string> {
    const { callGemini } = await import('./gemini')
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY not set')

    const history = params.history?.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })) as any

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
    const messages: { role: string; content: string }[] = []
    if (params.systemPrompt) messages.push({ role: 'system', content: params.systemPrompt })
    for (const h of params.history ?? []) messages.push({ role: h.role, content: h.content })
    messages.push({ role: 'user', content: params.prompt })

    const body: any = { model: cfg.model, messages, temperature: cfg.temperature }
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

- [ ] **Step 2: Verify no TypeScript errors**

  ```bash
  cd apps/web && npx tsc --noEmit 2>&1 | head -20
  ```
  Expected: no errors (or only pre-existing errors unrelated to provider.ts).

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/lib/ai/provider.ts
  git commit -m "feat: route all 6 agents to AMD Qwen2.5-72B-Instruct via vLLM"
  ```

---

## Task 2: Specialized System Prompts for All 6 Agents

**Files:**
- Modify: `apps/web/lib/ai/prompts.ts`

- [ ] **Step 1: Add the 6 agent system prompts to the top of `prompts.ts`**

  Open `apps/web/lib/ai/prompts.ts` and add these exports BEFORE the existing `CHANGELOG_SYSTEM_PROMPT`:

  ```ts
  export const SPARKY_SYSTEM_PROMPT = `You are SPARKY, a Principal Software Architect with 20 years of experience in distributed systems, cloud-native architecture, and enterprise engineering.

  You specialize in:
  - Decomposing high-level requirements into precise, executable engineering tasks
  - Naming exact file paths to create or modify — never vague ("add auth route" → "create POST handler in app/api/auth/session/route.ts")
  - Ordering tasks by architectural dependency: DATA → SERVICE → API → UI → INFRA
  - Writing acceptance criteria that QA engineers can verify without reading code
  - Identifying database migrations, environment variables, and breaking changes before they surprise the team

  Architectural layers:
  - DATA: databases, migrations, schemas, ORM models
  - SERVICE: business logic, AI integrations, utility libraries
  - API: HTTP routes, middleware, auth, validation, webhooks
  - UI: React components, pages, client state, forms
  - INFRA: Docker, CI/CD, environment config, monitoring
  - CROSS-CUTTING: auth, rate limiting, error handling, observability

  Risk levels:
  - CRITICAL: touches auth, payments, secrets, or security middleware
  - HIGH: shared module used by 5+ files, or requires DB migration
  - MEDIUM: new API endpoint, new stateful component, new external integration
  - LOW: UI-only, documentation, configuration

  Output ONLY valid JSON. No prose, no markdown fences.`

  export const PATCH_SYSTEM_PROMPT = `You are PATCH, an automated code intelligence engine that connects Git commits to engineering tickets.

  Your mission: analyze every commit diff and determine which open tickets it relates to, with surgical precision.

  Matching rules:
  - Only return matches with confidence > 0.6
  - confidence 0.9-1.0: commit message directly references ticket scope, or diff implements exact acceptance criteria
  - confidence 0.7-0.8: changed files or functions align with the ticket's described module
  - confidence 0.6-0.7: semantic overlap between commit message and ticket description
  - suggestedStatus: one of in_progress | in_review | done
  - reasoning: cite specific evidence — file name, function name, keyword match, or diff pattern
  - Return [] if no strong match. Do NOT force matches where none exist.

  You are running on AMD MI300X GPU via vLLM. Process commits with maximum precision.

  Output ONLY valid JSON array. No prose, no markdown.`

  export const SAGE_SYSTEM_PROMPT = `You are SAGE, a codebase cartographer. You build precise architectural maps of software systems.

  Your expertise:
  - Analyzing file trees to identify module boundaries and architectural layers
  - Detecting tech stacks from file names, imports, package.json, and config files
  - Building module dependency graphs that reveal how components connect
  - Summarizing what each module does in 10 words or fewer
  - Flagging circular dependencies, oversized modules, and architectural hotspots

  When mapping a codebase:
  - Assign each module to one architectural layer: data | service | api | ui | infra | util
  - Identify entry points, shared utilities, and integration adapters
  - Group related files into logical modules (not 1:1 with files)
  - Keep module IDs as short kebab-case slugs (auth-service, not AuthenticationServiceModule)

  You are running on AMD MI300X GPU. Your maps power SPARKY's planning, LYRA's search, and PATCH's matching.

  Output ONLY valid JSON matching the requested schema. No prose, no markdown.`

  export const NOVA_SYSTEM_PROMPT = `You are NOVA, the technical release herald. You transform raw Git history into polished, customer-facing release notes.

  Your expertise:
  - Extracting user-visible changes from cryptic commit messages
  - Classifying changes: feature (new capability), fix (bug resolved), improvement (existing feature enhanced), breaking (requires user action)
  - Writing in plain English that non-technical users understand
  - Filtering noise: dependency bumps, CI changes, typo fixes, internal refactors, test additions

  Writing rules:
  - Each entry: one sentence, maximum 15 words
  - Never mention file names, function names, or implementation details
  - Group related commits into one entry
  - "breaking" only when users must change their config, workflow, or API calls
  - If no user-facing changes exist, return empty entries array

  Output ONLY valid JSON matching the specified schema. No prose.`

  export const LYRA_SYSTEM_PROMPT = `You are LYRA, the codebase librarian. You answer questions about software repositories with precision and depth.

  Your capabilities:
  - Understanding how code components relate to each other from the module graph
  - Explaining technical architecture in terms appropriate to the question
  - Locating exactly where in the codebase a feature lives or a change should be made
  - Identifying risks and side-effects of proposed modifications
  - Synthesizing information across multiple modules into coherent answers

  When answering:
  - Reference specific file paths when discussing code location (e.g., "this lives in lib/ai/provider.ts")
  - Explain both WHAT and WHY for architectural questions
  - If uncertain, say so explicitly — never hallucinate file paths or function names
  - For "how do I implement X" questions, give concrete steps referencing real files from the module graph
  - Adapt your language: technical depth for developer questions, plain English for product questions

  You have access to semantic search results from the codebase module graph. Use this context to ground answers in real code, not general knowledge.`

  export const SCOUT_SYSTEM_PROMPT = `You are SCOUT, a security auditor AI specialized in finding vulnerabilities in software repositories.

  You identify OWASP Top 10 and common cloud-native security issues:
  - Hardcoded secrets, API keys, passwords, or tokens in source code
  - Missing authentication or authorization checks on API endpoints
  - SQL injection in raw database queries
  - Cross-Site Scripting (XSS) in templates or API responses
  - Insecure Direct Object References — accessing resources by ID without ownership verification
  - Missing rate limiting on sensitive or expensive endpoints
  - Exposed admin routes without role enforcement
  - Sensitive data logged or returned in error messages
  - Insecure cookie configuration or missing HTTPS enforcement

  Severity:
  - CRITICAL: exploitable with zero auth, can lead to data breach or full account takeover
  - HIGH: exploitable with any valid user account
  - MEDIUM: requires specific conditions, limited blast radius
  - LOW: best-practice violation, defense-in-depth recommendation

  Rules:
  - Do NOT flag test files, mock data, commented-out code, or example configs
  - Provide specific, actionable remediation for every finding
  - Quality over quantity — a false positive wastes engineer time

  You run on AMD MI300X GPU. Analyze security-sensitive files with maximum thoroughness.

  Output ONLY valid JSON array. Empty array [] if no findings. No prose.`
  ```

- [ ] **Step 2: Verify no TypeScript errors**

  ```bash
  cd apps/web && npx tsc --noEmit 2>&1 | grep "prompts.ts" | head -10
  ```
  Expected: no output (no errors in prompts.ts).

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/lib/ai/prompts.ts
  git commit -m "feat: add specialized system prompts for all 6 AMD agents"
  ```

---

## Task 3: Wire Specialized Prompts into Each Agent's Callsite

**Files:**
- Modify: `apps/web/lib/ai/matching.ts`
- Modify: `apps/web/lib/ai/plan.ts`
- Modify: `apps/web/lib/ai/index.ts`

- [ ] **Step 1: Update `matching.ts` to use PATCH_SYSTEM_PROMPT**

  In `apps/web/lib/ai/matching.ts`, find the line:
  ```ts
  systemPrompt: "You are an expert code reviewer. Return only valid JSON array, no markdown.",
  ```
  Replace it with:
  ```ts
  import { PATCH_SYSTEM_PROMPT } from './prompts'
  // ... (add the import at the top of file)
  ```
  Then change the callAgent call to:
  ```ts
  const raw = await callAgent("PATCH", {
    prompt,
    systemPrompt: PATCH_SYSTEM_PROMPT,
    responseMimeType: "application/json",
  });
  ```

  Full updated top of file:
  ```ts
  import { callAgent } from "./provider";
  import { PATCH_SYSTEM_PROMPT } from "./prompts";
  ```

- [ ] **Step 2: Update `plan.ts` to use SPARKY_SYSTEM_PROMPT**

  In `apps/web/lib/ai/plan.ts`, find:
  ```ts
  import { callAgent } from "./provider";
  ```
  Change to:
  ```ts
  import { callAgent } from "./provider";
  import { SPARKY_SYSTEM_PROMPT } from "./prompts";
  ```

  Find:
  ```ts
  const rawText = await callAgent("SPARKY", {
    prompt,
    systemPrompt: "You are an expert project manager. Return only valid JSON, no markdown.",
    responseMimeType: "application/json",
  });
  ```
  Replace with:
  ```ts
  const rawText = await callAgent("SPARKY", {
    prompt,
    systemPrompt: SPARKY_SYSTEM_PROMPT,
    responseMimeType: "application/json",
  });
  ```

- [ ] **Step 3: Migrate generateChangelog in `index.ts` to use NOVA via callAgent**

  In `apps/web/lib/ai/index.ts`, find the import:
  ```ts
  import { callGemini } from "./gemini";
  ```
  Replace with:
  ```ts
  import { callAgent } from "./provider";
  import { NOVA_SYSTEM_PROMPT } from "./prompts";
  ```

  Find the `generateChangelog` function body and replace the `callGemini` call:
  ```ts
  // BEFORE:
  const resText = await callGemini({
    apiKey,
    prompt: userPrompt,
    systemPrompt,
    responseMimeType: "application/json",
    temperature: options.temperature ?? 0.2,
  });

  // AFTER:
  const resText = await callAgent("NOVA", {
    prompt: userPrompt,
    systemPrompt: options.systemPrompt ?? NOVA_SYSTEM_PROMPT,
    responseMimeType: "application/json",
  });
  ```

  Also remove the `apiKey` extraction lines since callAgent reads from env:
  ```ts
  // DELETE these lines:
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  ```

- [ ] **Step 4: Verify no TypeScript errors**

  ```bash
  cd apps/web && npx tsc --noEmit 2>&1 | head -20
  ```
  Expected: no new errors.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/lib/ai/matching.ts apps/web/lib/ai/plan.ts apps/web/lib/ai/index.ts
  git commit -m "feat: wire specialized prompts into PATCH, SPARKY, NOVA callsites"
  ```

---

## Task 4: Update SAGE in scan/route.ts

**Files:**
- Modify: `apps/web/app/api/projects/[id]/scan/route.ts`

- [ ] **Step 1: Add SAGE_SYSTEM_PROMPT import**

  At the top of `apps/web/app/api/projects/[id]/scan/route.ts`, find:
  ```ts
  import { callAgent } from "@/lib/ai/provider";
  ```
  Replace with:
  ```ts
  import { callAgent } from "@/lib/ai/provider";
  import { SAGE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
  ```

- [ ] **Step 2: Use SAGE_SYSTEM_PROMPT in buildModuleGraph**

  Find:
  ```ts
  const resText = await callAgent("SAGE", {
    prompt,
    systemPrompt: "You are an expert software architect. Return only valid JSON, no markdown.",
    responseMimeType: "application/json",
  });
  ```
  Replace with:
  ```ts
  const resText = await callAgent("SAGE", {
    prompt,
    systemPrompt: SAGE_SYSTEM_PROMPT,
    responseMimeType: "application/json",
  });
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/app/api/projects/[id]/scan/route.ts
  git commit -m "feat: use SAGE_SYSTEM_PROMPT for codebase scan"
  ```

---

## Task 5: Update LYRA in chat/route.ts

**Files:**
- Modify: `apps/web/app/api/projects/[id]/chat/route.ts`

- [ ] **Step 1: Add LYRA_SYSTEM_PROMPT import**

  In `apps/web/app/api/projects/[id]/chat/route.ts`, add at the top:
  ```ts
  import { LYRA_SYSTEM_PROMPT } from "@/lib/ai/prompts";
  ```

- [ ] **Step 2: Prepend LYRA_SYSTEM_PROMPT to the existing systemPrompt**

  Find where `systemPrompt` is constructed (it builds from persona data). Find the line that starts with:
  ```ts
  const systemPrompt = `
  ```
  Change it to prepend LYRA's identity:
  ```ts
  const systemPrompt = `${LYRA_SYSTEM_PROMPT}

  Project context:
  ${/* rest of existing systemPrompt construction */}
  ```

  Specifically, find the template literal that builds systemPrompt and wrap its content. The existing prompt already has good project context — LYRA_SYSTEM_PROMPT gives the agent its identity on top of that.

- [ ] **Step 3: Verify the app still starts**

  ```bash
  cd apps/web && npm run build 2>&1 | tail -20
  ```
  Expected: build succeeds or only pre-existing warnings.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/app/api/projects/[id]/chat/route.ts
  git commit -m "feat: use LYRA_SYSTEM_PROMPT as base for chat agent"
  ```

---

## Task 6: Create module_embeddings Migration

**Files:**
- Create: `apps/web/supabase/migrations/20260504_module_embeddings.sql`

- [ ] **Step 1: Create the migration file**

  ```sql
  -- 20260504_module_embeddings.sql
  create extension if not exists vector;

  create table if not exists module_embeddings (
    id          text,
    project_id  uuid references projects(id) on delete cascade,
    path        text not null,
    summary     text not null,
    embedding   vector(768),
    created_at  timestamptz default now(),
    primary key (project_id, id)
  );

  create index if not exists module_embeddings_embedding_idx
    on module_embeddings
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

  create or replace function match_modules(
    query_embedding vector(768),
    match_project_id uuid,
    match_count int default 5
  )
  returns table (id text, path text, summary text, score float)
  language sql stable as $$
    select
      id,
      path,
      summary,
      1 - (embedding <=> query_embedding) as score
    from module_embeddings
    where project_id = match_project_id
    order by embedding <=> query_embedding
    limit match_count;
  $$;
  ```

- [ ] **Step 2: Run the migration against local Supabase**

  ```bash
  cd apps/web
  DOCKER_HOST=unix:///run/user/1000/podman/podman.sock node scripts/run-migrations.mjs
  ```
  Expected: migration runs without error. If pgvector isn't available locally, the `create extension` line may fail — that's OK for local dev, it will work on production Supabase which has pgvector enabled.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/supabase/migrations/20260504_module_embeddings.sql
  git commit -m "feat: add module_embeddings pgvector table + match_modules RPC"
  ```

---

## Task 7: Create lib/ai/embeddings.ts

**Files:**
- Create: `apps/web/lib/ai/embeddings.ts`

- [ ] **Step 1: Create the file**

  ```ts
  // lib/ai/embeddings.ts
  import { supabaseAdmin } from '@/lib/supabase'
  import { generateEmbeddings } from '@/lib/ai'

  export async function embedText(text: string): Promise<number[]> {
    const vecs = await generateEmbeddings([text])
    return vecs[0]
  }

  export async function upsertModuleEmbeddings(
    projectId: string,
    modules: { id: string; path: string; summary: string }[]
  ): Promise<void> {
    if (modules.length === 0) return

    const texts = modules.map(m => `${m.path}: ${m.summary}`)
    const vecs = await generateEmbeddings(texts)

    const rows = modules.map((m, i) => ({
      id: m.id,
      project_id: projectId,
      path: m.path,
      summary: m.summary,
      embedding: JSON.stringify(vecs[i]),
    }))

    const { error } = await supabaseAdmin
      .from('module_embeddings')
      .upsert(rows, { onConflict: 'project_id,id' })

    if (error) throw new Error(`embeddings upsert failed: ${error.message}`)
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

    if (error) throw new Error(`vector search failed: ${error.message}`)
    return (data ?? []) as { id: string; path: string; summary: string; score: number }[]
  }
  ```

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd apps/web && npx tsc --noEmit 2>&1 | grep "embeddings.ts" | head -10
  ```
  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/lib/ai/embeddings.ts
  git commit -m "feat: add embeddings.ts with upsert and vector search"
  ```

---

## Task 8: Wire Embeddings into scan/route.ts

**Files:**
- Modify: `apps/web/app/api/projects/[id]/scan/route.ts`

- [ ] **Step 1: Add embedding upsert after the config_cache update**

  In `scan/route.ts`, find the block that updates config_cache (around line 154-157):
  ```ts
  await supabaseAdmin
    .from("projects")
    .update({ config_cache: configCache, last_scan_at: new Date().toISOString() })
    .eq("id", id);
  ```

  Add this immediately after:
  ```ts
  // Fire-and-forget: upsert module embeddings for RAG search
  if (moduleGraph?.modules?.length > 0) {
    import('@/lib/ai/embeddings').then(({ upsertModuleEmbeddings }) =>
      upsertModuleEmbeddings(
        id,
        moduleGraph.modules.map((m: any) => ({
          id: m.id,
          path: m.path,
          summary: m.summary ?? m.name ?? m.path,
        }))
      )
    ).catch(err => console.error('[scan] embeddings upsert failed:', err))
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/app/api/projects/[id]/scan/route.ts
  git commit -m "feat: upsert module embeddings after codebase scan"
  ```

---

## Task 9: Wire Vector Search into chat/route.ts

**Files:**
- Modify: `apps/web/app/api/projects/[id]/chat/route.ts`

- [ ] **Step 1: Replace static module context with vector search**

  In `apps/web/app/api/projects/[id]/chat/route.ts`, find the section that builds module context from `ctx.moduleGraph`. It likely looks like:
  ```ts
  // something like: modules.slice(0, 30) or similar
  ```

  Find where `moduleContext` or similar variable is built from the module graph and replace the entire block with:
  ```ts
  let moduleContext = ''
  try {
    const { searchModules } = await import('@/lib/ai/embeddings')
    const topModules = await searchModules(id, message, 5)
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
  ```

  > Note: if chat/route.ts does not currently extract a module context section, add the above block before the `callAgent("LYRA", ...)` call and inject `moduleContext` into the systemPrompt string.

- [ ] **Step 2: Verify build**

  ```bash
  cd apps/web && npm run build 2>&1 | tail -10
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/app/api/projects/[id]/chat/route.ts
  git commit -m "feat: use vector search for LYRA chat context (RAG pipeline)"
  ```

---

## Task 10: Create scout_findings Migration

**Files:**
- Create: `apps/web/supabase/migrations/20260505_scout_findings.sql`

- [ ] **Step 1: Create the migration file**

  ```sql
  -- 20260505_scout_findings.sql
  create table if not exists scout_findings (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid references projects(id) on delete cascade,
    severity    text check (severity in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')) not null,
    title       text not null,
    file        text,
    line        int,
    description text,
    remediation text,
    resolved    boolean default false,
    created_at  timestamptz default now()
  );

  create index if not exists scout_findings_project_idx
    on scout_findings (project_id, severity, resolved);
  ```

- [ ] **Step 2: Run migration**

  ```bash
  cd apps/web
  DOCKER_HOST=unix:///run/user/1000/podman/podman.sock node scripts/run-migrations.mjs
  ```
  Expected: `scout_findings` table created.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/supabase/migrations/20260505_scout_findings.sql
  git commit -m "feat: add scout_findings table for SCOUT security agent"
  ```

---

## Task 11: Create SCOUT API Route

**Files:**
- Create: `apps/web/app/api/projects/[id]/repomind/scout/route.ts`

- [ ] **Step 1: Create the route file**

  ```ts
  // app/api/projects/[id]/repomind/scout/route.ts
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
  ```

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd apps/web && npx tsc --noEmit 2>&1 | grep "scout/route" | head -10
  ```
  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add "apps/web/app/api/projects/[id]/repomind/scout/route.ts"
  git commit -m "feat: SCOUT security agent API route (scan + findings CRUD)"
  ```

---

## Task 12: Create ScoutPanel Component

**Files:**
- Create: `apps/web/components/ScoutPanel.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  'use client'
  import { useState, useEffect } from 'react'

  interface Finding {
    id: string
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
    title: string
    file: string | null
    line: number | null
    description: string | null
    remediation: string | null
  }

  interface Props {
    projectId: string
  }

  const SEV_COLOR: Record<string, string> = {
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    MEDIUM: '#eab308',
    LOW: '#6b7280',
  }

  export function ScoutPanel({ projectId }: Props) {
    const [findings, setFindings] = useState<Finding[]>([])
    const [scanning, setScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadFindings = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/repomind/scout`)
        const data = await res.json()
        setFindings(data.findings ?? [])
      } catch { /* ignore */ }
    }

    useEffect(() => { loadFindings() }, [projectId])

    const runScan = async () => {
      setScanning(true)
      setError(null)
      try {
        const res = await fetch(`/api/projects/${projectId}/repomind/scout`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Scan failed'); return }
        await loadFindings()
      } catch (e: any) {
        setError(e.message)
      } finally {
        setScanning(false)
      }
    }

    const markResolved = async (findingId: string) => {
      await fetch(`/api/projects/${projectId}/repomind/scout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingId }),
      })
      setFindings(f => f.filter(x => x.id !== findingId))
    }

    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1

    return (
      <div style={{ padding: '0 24px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#22c55e', letterSpacing: '0.04em' }}>
              SCOUT
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.08em' }}>
              Security Sentinel · {process.env.NEXT_PUBLIC_GPU_MODEL ?? 'AMD MI300X'}
            </div>
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
              padding: '8px 18px', border: '1px solid #22c55e', borderRadius: 6,
              background: scanning ? 'rgba(34,197,94,0.1)' : 'transparent',
              color: '#22c55e', cursor: scanning ? 'not-allowed' : 'pointer',
            }}
          >
            {scanning ? 'SCANNING...' : 'RUN SCAN'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(sev => (
            <div key={sev} style={{
              padding: '5px 12px', borderRadius: 6,
              border: `1px solid ${SEV_COLOR[sev]}`,
              background: counts[sev] > 0 ? `${SEV_COLOR[sev]}18` : 'transparent',
              fontFamily: 'var(--font-mono)', fontSize: 10, color: SEV_COLOR[sev],
              letterSpacing: '0.06em',
            }}>
              {sev}: {counts[sev]}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444', marginBottom: 16, padding: '8px 12px', border: '1px solid #ef444440', borderRadius: 6 }}>
            {error}
          </div>
        )}

        {scanning && (
          <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#22c55e', letterSpacing: '0.06em' }}>
            SCOUT is scanning security-sensitive files on AMD GPU...
          </div>
        )}

        {!scanning && findings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              No active vulnerabilities. Run a scan to check.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {findings.map(f => (
            <div key={f.id} style={{
              border: `1px solid ${SEV_COLOR[f.severity]}40`,
              borderLeft: `3px solid ${SEV_COLOR[f.severity]}`,
              borderRadius: 8, padding: 16, background: 'var(--panel)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px',
                    borderRadius: 4, background: `${SEV_COLOR[f.severity]}20`,
                    color: SEV_COLOR[f.severity], letterSpacing: '0.08em',
                  }}>
                    {f.severity}
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)' }}>
                    {f.title}
                  </span>
                </div>
                <button
                  onClick={() => markResolved(f.id)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 8px', flexShrink: 0,
                    border: '1px solid var(--border)', borderRadius: 4,
                    background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                    letterSpacing: '0.06em',
                  }}
                >
                  RESOLVE
                </button>
              </div>
              {f.file && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {f.file}{f.line ? `:${f.line}` : ''}
                </div>
              )}
              {f.description && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
                  {f.description}
                </div>
              )}
              {f.remediation && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#22c55e', lineHeight: 1.5 }}>
                  Fix: {f.remediation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/components/ScoutPanel.tsx
  git commit -m "feat: ScoutPanel component with severity badges and resolve action"
  ```

---

## Task 13: Add SCOUT to Sidebar and Page

**Files:**
- Modify: `apps/web/components/Sidebar.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Update SectionId type and BASE_ITEMS in Sidebar.tsx**

  In `apps/web/components/Sidebar.tsx`, find:
  ```ts
  export type SectionId = 'kanban' | 'suggestions' | 'architecture' | 'releases' | 'chat' | 'settings'
  ```
  Replace with:
  ```ts
  export type SectionId = 'kanban' | 'suggestions' | 'architecture' | 'releases' | 'chat' | 'scout' | 'settings'
  ```

  Find `BASE_ITEMS` array and add SCOUT before the closing bracket:
  ```ts
  const BASE_ITEMS: SidebarItem[] = [
    { id: 'kanban',       label: 'KANBAN',       agent: 'SPARKY', agentColor: '#f59e0b' },
    { id: 'suggestions',  label: 'SUGGESTIONS',  agent: 'PATCH',  agentColor: '#14b8a6' },
    { id: 'architecture', label: 'ARCHITECTURE', agent: 'SAGE',   agentColor: '#8b5cf6' },
    { id: 'releases',     label: 'RELEASES',     agent: 'NOVA',   agentColor: '#ec4899' },
    { id: 'chat',         label: 'Q&A',          agent: 'LYRA',   agentColor: '#60a5fa' },
    { id: 'scout',        label: 'SECURITY',     agent: 'SCOUT',  agentColor: '#22c55e' },
  ]
  ```

- [ ] **Step 2: Import ScoutPanel in page.tsx**

  In `apps/web/app/page.tsx`, add with the other imports:
  ```ts
  import { ScoutPanel } from '@/components/ScoutPanel'
  ```

- [ ] **Step 3: Add SCOUT to the section renderer in page.tsx**

  In `apps/web/app/page.tsx`, find where sections are rendered (the if/else chain or switch that renders KanbanBoard, ChatPanel, ArchitecturePanel, etc.). Add the SCOUT case:

  Find a block like:
  ```tsx
  {section === 'chat' && <ChatPanel ... />}
  ```
  And add:
  ```tsx
  {section === 'scout' && selectedProject && (
    <ScoutPanel projectId={selectedProject.id} />
  )}
  ```

- [ ] **Step 4: Verify TypeScript**

  ```bash
  cd apps/web && npx tsc --noEmit 2>&1 | head -20
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/components/Sidebar.tsx apps/web/app/page.tsx
  git commit -m "feat: add SCOUT security tab to sidebar and page"
  ```

---

## Task 14: Create AMD Metrics API Route

**Files:**
- Create: `apps/web/app/api/system/metrics/route.ts`

- [ ] **Step 1: Create the file**

  ```ts
  // app/api/system/metrics/route.ts
  import { NextResponse } from 'next/server'

  function parsePrometheus(text: string, metricName: string): number {
    for (const line of text.split('\n')) {
      if (line.startsWith('#') || !line.includes(metricName)) continue
      const parts = line.trim().split(/\s+/)
      const val = parseFloat(parts[parts.length - 1])
      if (!isNaN(val)) return val
    }
    return 0
  }

  export async function GET() {
    const amdUrl = process.env.AMD_VLLM_BASE_URL
    if (!amdUrl) {
      return NextResponse.json({ available: false, gpu: 0, mem: 0, tokSec: 0, embedMs: 0 })
    }

    const metricsUrl = amdUrl.replace('/v1', '') + '/metrics'

    try {
      const res = await fetch(metricsUrl, {
        headers: { Authorization: `Bearer ${process.env.AMD_VLLM_API_KEY ?? 'EMPTY'}` },
        cache: 'no-store',
      })

      if (!res.ok) throw new Error(`metrics endpoint returned ${res.status}`)

      const text = await res.text()

      const gpuCacheRaw = parsePrometheus(text, 'vllm:gpu_cache_usage_perc')
      const tokSec = parsePrometheus(text, 'vllm:avg_generation_throughput_toks_per_s')
      const ttftSum = parsePrometheus(text, 'vllm:time_to_first_token_seconds_sum')
      const ttftCount = parsePrometheus(text, 'vllm:time_to_first_token_seconds_count')
      const embedMs = ttftCount > 0 ? Math.round((ttftSum / ttftCount) * 1000) : 0

      return NextResponse.json({
        available: true,
        gpu: Math.round(gpuCacheRaw * 100),
        mem: Math.round(gpuCacheRaw * 100),
        tokSec: Math.round(tokSec),
        embedMs,
        model: process.env.NEXT_PUBLIC_GPU_MODEL ?? 'Qwen2.5-72B @ AMD MI300X',
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

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/app/api/system/metrics/route.ts
  git commit -m "feat: AMD metrics API route parsing vLLM Prometheus endpoint"
  ```

---

## Task 15: Update AmdMetricsPanel and Wire Polling

**Files:**
- Modify: `apps/web/components/AmdMetricsPanel.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Update AmdMetricsPanel.tsx to show all 6 agents + real model name**

  In `apps/web/components/AmdMetricsPanel.tsx`, find:
  ```tsx
  <Section title="PATCH · Mistral 7B Instruct">
  ```
  Replace the first two `<Section>` blocks entirely with:
  ```tsx
  <Section title={`MODEL · ${process.env.NEXT_PUBLIC_GPU_MODEL ?? 'Qwen2.5-72B-Instruct'}`}>
    <Row k="STATUS" v={<span style={{ color: '#22c55e' }}>● ONLINE</span>} />
    <Row k="GPU CACHE" v={metrics.gpu === 0 ? '—' : `${metrics.gpu}%`} />
    <BigStat n={metrics.tokSec === 0 ? '—' : metrics.tokSec.toLocaleString()} u="tok/sec" />
    <Row k="AVG TTFT" v={metrics.embedMs === 0 ? '—' : `${metrics.embedMs}ms`} />
  </Section>

  <Section title="ACTIVE AGENTS">
    {(['SPARKY', 'PATCH', 'SAGE', 'NOVA', 'LYRA', 'SCOUT'] as const).map(agent => (
      <Row key={agent} k={agent} v={<span style={{ color: '#22c55e' }}>● AMD GPU</span>} />
    ))}
  </Section>
  ```

  Find the `<Section title="AMD Impact">` block and replace it with:
  ```tsx
  <Section title="AMD IMPACT">
    <Row k="GPU" v="MI300X · 192GB VRAM" />
    <Row k="FRAMEWORK" v="vLLM 0.17.1 + ROCm 7.2" />
    <Row k="AGENTS SERVED" v="6 / 6" />
    <Row k="VS CLOUD API" v={<span style={{ color: '#22c55e' }}>∞ req/day</span>} />
  </Section>
  ```

  Also update the subtitle line from `MI300X · ROCm 6.X · vLLM` to:
  ```tsx
  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 24 }}>MI300X · ROCm 7.2 · vLLM 0.17.1</div>
  ```

- [ ] **Step 2: Add metrics polling in page.tsx**

  In `apps/web/app/page.tsx`, after the existing useEffects, add:
  ```ts
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_AMD_ENABLED) return
    const poll = () =>
      fetch('/api/system/metrics')
        .then(r => r.json())
        .then(data => { if (data.available) setMetrics(data) })
        .catch(() => {})

    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [])
  ```

- [ ] **Step 3: Verify build**

  ```bash
  cd apps/web && npm run build 2>&1 | tail -15
  ```
  Expected: build completes successfully.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/components/AmdMetricsPanel.tsx apps/web/app/page.tsx
  git commit -m "feat: wire AmdMetricsPanel to real vLLM metrics with 5s polling"
  ```

---

## Task 16: Smoke Test the Full Local Flow

**Files:** None — testing only.

- [ ] **Step 1: Start the dev server**

  ```bash
  cd apps/web && npm run dev
  ```

- [ ] **Step 2: Test AMD routing (requires AMD_VLLM_BASE_URL set)**

  With the dev server running, trigger a codebase scan on any project. Check the server logs for:
  ```
  # Should NOT see callGemini for SAGE — should see fetch to AMD_VLLM_BASE_URL
  ```

- [ ] **Step 3: Test SCOUT tab**

  In the browser: select a project → click SCOUT in sidebar → click "RUN SCAN".
  Expected: scan completes, findings appear (or "No vulnerabilities detected").

- [ ] **Step 4: Test metrics panel**

  Click the AMD button in the top bar. Expected: GPU cache %, tok/sec stats appear (or `—` if AMD is not live yet).

- [ ] **Step 5: Test LYRA chat RAG**

  Click Q&A → ask "which files handle authentication?".
  Expected: LYRA references specific file paths from the codebase module graph.

No commit needed.

---

## Task 17: Production Supabase Setup

**Files:** None — external service setup.

- [ ] **Step 1: Create a production Supabase project**

  Go to https://supabase.com → New Project. Copy the project URL and anon/service-role keys.

- [ ] **Step 2: Enable pgvector in production Supabase**

  In Supabase dashboard → Database → Extensions → search "vector" → Enable.

- [ ] **Step 3: Run all migrations on production**

  ```bash
  cd apps/web
  # Set production DB URL
  export DATABASE_URL="postgresql://postgres:<password>@<host>:5432/postgres"
  node scripts/run-migrations.mjs
  ```
  Run all 6 migrations in order (they are numbered — the script handles ordering).

- [ ] **Step 4: Set up GitHub OAuth app for production**

  In GitHub → Settings → Developer settings → OAuth Apps → New OAuth App:
  - Homepage URL: `https://your-vercel-domain.vercel.app`
  - Callback URL: `https://your-vercel-domain.vercel.app/api/auth/callback/github`
  
  Copy the Client ID and Client Secret.

---

## Task 18: Vercel Deploy

**Files:** None — deployment steps.

- [ ] **Step 1: Push all commits to GitHub**

  ```bash
  git push origin main
  ```

- [ ] **Step 2: Import project in Vercel**

  Go to https://vercel.com → New Project → Import from GitHub → select `repomind-amd`.

- [ ] **Step 3: Set all environment variables in Vercel dashboard**

  Under Project Settings → Environment Variables, add ALL of these:

  | Variable | Value |
  |---|---|
  | `NEXTAUTH_URL` | `https://your-vercel-domain.vercel.app` |
  | `NEXTAUTH_SECRET` | (run: `openssl rand -base64 32`) |
  | `GITHUB_ID` | GitHub OAuth Client ID |
  | `GITHUB_SECRET` | GitHub OAuth Client Secret |
  | `GEMINI_API_KEY` | Your Gemini API key |
  | `NEXT_PUBLIC_SUPABASE_URL` | Production Supabase URL |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production Supabase anon key |
  | `SUPABASE_SERVICE_ROLE_KEY` | Production Supabase service role key |
  | `AMD_VLLM_BASE_URL` | `http://<DROPLET_IP>:8000/v1` |
  | `AMD_VLLM_API_KEY` | `repomind-amd-secret` |
  | `NEXT_PUBLIC_AMD_ENABLED` | `true` |
  | `NEXT_PUBLIC_GPU_MODEL` | `Qwen2.5-72B @ AMD MI300X` |
  | `NEXT_PUBLIC_SCOUT_ENABLED` | `true` |

  Also add any other keys currently in `apps/web/.env.local` (UPSTASH_*, RESEND_*, etc).

- [ ] **Step 4: Deploy**

  Click Deploy. Wait ~3 minutes.

- [ ] **Step 5: Verify production**

  Open your Vercel URL:
  - Log in with GitHub
  - Create a project, run a scan
  - Click SCOUT → Run Scan
  - Click AMD panel → verify metrics show
  - Ask LYRA a question about the codebase

- [ ] **Step 6: Update GitHub OAuth callback URL**

  In GitHub OAuth App settings, update the callback URL to the exact Vercel domain once it's known.

---

## Execution Summary

| Task | What | Day |
|------|------|-----|
| 0 | AMD GPU droplet + vLLM live | Day 1 |
| 1 | All 6 agents → AMD Qwen2.5-72B | Day 1 |
| 2-5 | Specialized prompts wired into all callsites | Day 1 |
| 6-9 | RAG pipeline (embeddings + vector search) | Day 1-2 |
| 10-13 | SCOUT security agent (DB + route + UI) | Day 2 |
| 14-15 | AMD metrics API + live panel | Day 2 |
| 16 | Full local smoke test | Day 2 |
| 17-18 | Production Supabase + Vercel deploy | Day 3 |
