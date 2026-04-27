# RepoMind Dashboard UI — Implementation Spec

**Date:** 2026-04-27
**Scope:** UI-only (fake/simulated state, no backend)
**Source:** Claude Design bundle `WRisVT615mU8gWuWoDnzgQ`
**Stack:** Next.js 16 App Router · TypeScript · Tailwind v4 · shadcn/ui

---

## Goal

Implement the RepoMind cyberpunk anime terminal dashboard pixel-perfectly from the design bundle. All state is local/simulated — no API calls, no SSE backend.

---

## Project Layout

```
/data/my_projects/repomind-amd/
└── apps/
    └── web/
        ├── app/
        │   ├── layout.tsx
        │   ├── globals.css         ← design tokens + keyframes
        │   └── page.tsx            ← App root + state
        ├── components/
        │   ├── Topbar.tsx
        │   ├── CrewPanel.tsx
        │   ├── AgentCard.tsx
        │   ├── KanbanBoard.tsx
        │   ├── TicketCard.tsx
        │   ├── PlanInput.tsx
        │   ├── AmdMetricsPanel.tsx
        │   ├── AgentModal.tsx
        │   └── mascots/
        │       └── MascotSprite.tsx
        ├── lib/
        │   ├── types.ts
        │   └── fake-data.ts
        └── public/
            ├── mascots/            ← 6 SVG files (sparky, patch, sage, nova, lyra, scout)
            └── logo.svg
```

---

## Design Tokens

All CSS custom properties from `colors_and_type.css` are included verbatim in `globals.css`:

- **Backgrounds:** `--void #04040e`, `--panel #09091a`, `--surface #0f0f22`, `--hover #141428`
- **Borders:** `--border rgba(255,255,255,0.06)`, `--border-hover 0.14`, `--border-focus 0.25`
- **Text:** `--text-primary #ece9ff`, `--text-secondary #8b8aaa`, `--text-muted #4e4b6a`, `--text-code #a5f3a5`
- **Agents:** `--sparky #f59e0b`, `--patch #14b8a6`, `--sage #8b5cf6`, `--nova #ec4899`, `--lyra #60a5fa`, `--scout #22c55e`
- **AMD:** `--amd-red #ed1c24`
- **Fonts:** Bebas Neue (display), Syne (UI), JetBrains Mono (code/labels), Instrument Serif italic (voice lines)
- **Layout:** `--topbar-h 64px`, `--crew-w 240px`, `--slideover-w 380px`

Fonts loaded via `next/font/google` in `layout.tsx` and exposed as CSS variables.

---

## Keyframe Animations (globals.css)

```
pulse         — status dot scale + opacity loop, 1.2–1.5s
borderPulse   — agent card left-border opacity 1s loop (working state)
float         — mascot idle up/down 3.2s
bounce        — mascot working faster bounce 0.8s
blink         — streaming cursor 1s
slidedown     — plan input entrance translateY(-20px)→0
slideleft     — AMD panel entrance translateX(40px)→0
slidein       — commit badge entrance translateX(-10px)→0
```

---

## Types (`lib/types.ts`)

```ts
type AgentName = 'SPARKY' | 'PATCH' | 'SAGE' | 'NOVA' | 'LYRA' | 'SCOUT'
type AgentStatus = 'idle' | 'working' | 'done' | 'error' | 'sleeping'
type TicketStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
type Priority = 'HIGH' | 'MED' | 'LOW'
type Complexity = 'S' | 'M' | 'L' | 'XL'

interface AgentState { name, color, status, role, model, isAmd, voiceLine }
interface Ticket { id, title, status, priority, complexity, age, commit?, confidence? }
interface ActivityEvent { color, text, ago }
interface AmdMetrics { gpu, mem, tokSec, embedMs }
interface LogEntry { time, msg }
```

---

## Components

### `MascotSprite` (`components/mascots/MascotSprite.tsx`)
- Props: `name: AgentName`, `state: 'idle' | 'working'`, `w?: number`, `h?: number`
- Renders `<img src={/mascots/${name.toLowerCase()}.svg}>` with class `sprite-idle` or `sprite-working`
- Working state: `drop-shadow(0 0 12px <agent-color>)` filter, bounce animation
- Idle state: `drop-shadow(0 0 6px <agent-color>66)` filter, float animation

### `AgentCard` (`components/AgentCard.tsx`)
- Props: `agent: AgentState`, `onClick: () => void`
- Dark card (`--surface`) with 4px left border in agent color
- Working: `borderPulse` animation, glow `box-shadow: 0 0 28px <color>55`
- Hover: voice line appears (Instrument Serif italic, 12px)
- Status dot: pulsing when working, green when done, muted otherwise
- AMD pill if `isAmd`

### `CrewPanel` (`components/CrewPanel.tsx`)
- Props: `agents`, `amdMetrics`, `activityFeed`, `onAgentClick`, `onAmdClick`
- 240px wide fixed sidebar, full height, scrollable
- Scanline texture via `repeating-linear-gradient`
- Sections: THE CREW (6 AgentCards) → AMD MI300X metrics (GPU/MEM bars, tok/sec, embed ms) → ACTIVITY feed (last 5 events)
- AMD section clickable → opens AMD panel

### `Topbar` (`components/Topbar.tsx`)
- Props: `gpu: number`, `onAmdClick: () => void`
- 64px fixed header
- Left: ⚡ bolt SVG + REPOMIND wordmark (Bebas Neue 24px)
- Center: repo selector pill (`safwan2003 / repomind ▾`)
- Right: AMD GPU pill (red dot + `GPU XX% · MI300X · ROCm`) + avatar circle

### `KanbanBoard` (`components/KanbanBoard.tsx`)
- Props: `tickets: Ticket[]`, `flashId: string | null`
- 5 columns: BACKLOG / TODO / IN_PROGRESS / IN_REVIEW / DONE
- Column colors: muted/blue/amber/purple/green
- Each column: header with count badge, scrollable ticket list
- Passes `flash={t.id === flashId}` to TicketCard

### `TicketCard` (`components/TicketCard.tsx`)
- Props: `ticket: Ticket`, `flash: boolean`
- Flash state: teal border `rgba(20,184,166,0.6)` + glow shadow
- ID (JetBrains Mono top-left), PriorityPill (top-right)
- Title (Syne bold 13px)
- ComplexityBar (4 amber blocks) + complexity label + `⚡ SPARKY` creator badge
- Commit row (if commit): teal tinted block with SHA + confidence + 🔍

### `PlanInput` (`components/PlanInput.tsx`)
- Props: `open`, `onClose`, `onDeploy`, `working`
- Slides down from tabs bar when open
- Left: SPARKY mascot sprite (120×180), working or idle state
- Right: `WHAT ARE WE BUILDING?` display headline + italic sub + textarea + `DEPLOY SPARKY` button
- Working state: button dims, streaming cursor `decomposing plan… ▊`

### `AmdMetricsPanel` (`components/AmdMetricsPanel.tsx`)
- Props: `open`, `onClose`, `metrics`, `log`
- 380px slide-over from right, blurred backdrop overlay
- Sections: PATCH · Mistral 7B, Embedder, AMD Impact, Live log
- BigStat for tok/sec (Bebas Neue 36px)

### `AgentModal` (`components/AgentModal.tsx`)
- Props: `agent: AgentState`, `onClose`
- Centered modal, 560px, blurred backdrop
- Left: mascot sprite 140×210
- Right: agent name in Bebas Neue 56px agent-color, role label, voice line (Instrument Serif italic 18px), model + AMD pills
- ESC button top-right

---

## App State (`app/page.tsx`)

All state in a single `App` component using `useState`:

- `agents: AgentState[]` — initial 6 agents
- `tickets: Ticket[]` — initial 10 tickets
- `feed: ActivityEvent[]` — initial 5 events
- `metrics: AmdMetrics` — `{ gpu: 34, mem: 51, tokSec: 2847, embedMs: 12 }`
- `tab: string` — active tab (Kanban / Architecture / Releases / Q&A)
- `planOpen / planWorking / amdOpen / agentModal / flashId` — UI state

**Timers:**
- AMD jitter: every 1400ms, randomize gpu/mem/tokSec/embedMs within bounds
- PATCH flash: every 6000ms, flash a random ticket (T-042/T-040/T-041) for 1500ms, set PATCH to working

**onDeploy:** set SPARKY working → after 2200ms create 3 new tickets in BACKLOG → add feed event → SPARKY done → 2s later SPARKY idle → close plan panel

---

## Tab stubs

Architecture / Releases / Q&A tabs show an `EmptyTab` component: centered mascot (SAGE/NOVA/LYRA) + display headline + muted subtitle + colored CTA button.

---

## Scrollbars

Custom thin scrollbars: `rgba(255,255,255,0.06)` thumb, `rgba(255,255,255,0.14)` on hover.

---

## Out of scope

- Real SSE / API routes
- Authentication / GitHub OAuth
- Agent worker processes
- Embeddable widget
- Public changelog page
