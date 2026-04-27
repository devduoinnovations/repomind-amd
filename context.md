# RepoMind — Codebase Context

**Date:** 2026-04-27
**Status:** Active Development
**Project Type:** AI-Powered Engineering Dashboard & Workflow Automation

## 1. Project Overview
RepoMind is a cyberpunk-themed dashboard for software engineering teams. It integrates with GitHub to manage tickets, automate planning, generate changelogs, and provide architectural insights using Large Language Models (specifically Google Gemini).

The system follows a "GitOps" approach for ticket management, where tickets and project metadata are stored directly in the target repository as Markdown files with YAML frontmatter.

---

## 2. Tech Stack

### Core
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (using CSS variables for design tokens)
- **Animations:** Framer Motion
- **Icons:** Lucide React

### Backend & Services
- **Database:** Supabase (PostgreSQL + Auth)
- **AI Engine:** Google Gemini (Gemini Flash for text, Gemini Embedding for vector search)
- **Auth:** NextAuth.js
- **State Management:** React `useState`/`useEffect` (Simulated state for UI-only components, API-driven for real project data)

### Utilities
- **Diagrams:** Mermaid.js
- **Drag & Drop:** `@dnd-kit` (Kanban board)
- **Parsing:** Zod (Schema validation), YAML (Frontmatter parsing)
- **Date Handling:** Day.js

---

## 3. Directory Structure (apps/web)

```text
apps/web/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes (GitHub webhooks, Projects, Tickets, AI)
│   ├── globals.css           # Design tokens, keyframe animations
│   ├── layout.tsx            # Global layout & font loading
│   └── page.tsx              # Main Dashboard entry point
├── components/               # React Components
│   ├── mascots/              # Agent mascot sprites (Sparky, Patch, etc.)
│   ├── AgentCard.tsx         # Individual agent status card
│   ├── CrewPanel.tsx         # Sidebar with agents, metrics, and activity feed
│   ├── KanbanBoard.tsx       # 5-column ticket board
│   ├── PlanInput.tsx         # Planning interface (Sparky)
│   ├── Topbar.tsx            # Global header with project selector
│   └── ...                   # Metrics, Architecture, Releases, Chat panels
├── lib/                      # Core Logic & Library Integrations
│   ├── ai/                   # Gemini API client, planning, matching logic
│   ├── git-storage/          # Git-backed persistence (Tickets as Markdown)
│   ├── auth.ts               # NextAuth configuration
│   ├── fake-data.ts          # Initial/Mocked state
│   ├── github.ts             # GitHub API client
│   ├── supabase.ts           # Supabase client
│   └── types.ts              # Global TypeScript interfaces
├── public/                   # Static Assets
│   ├── mascots/              # SVG assets for agents
│   └── logo.svg              # Brand logo
└── types/                    # External type definitions (NextAuth)
```

---

## 4. Key Systems & Data Flows

### A. Git-Backed Tickets (`lib/git-storage`)
Tickets are NOT stored primarily in a traditional database. Instead, they are persisted in the repository being managed:
- **Location:** `.repomind/tickets/`
- **Format:** Markdown with YAML frontmatter.
- **Naming:** `{id}-{slugified-title}.md`
- **Sync:** When a user updates a ticket (status change), an API call is made which (presumably) commits the change back to the Git repo.

### B. AI Agents (`components/CrewPanel.tsx`, `lib/ai/`)
The "Crew" consists of specialized agents:
- **SPARKY:** Planning & Ticket Generation.
- **PATCH:** Code Review & Suggestions.
- **SAGE:** Architecture & Documentation.
- **NOVA:** Release Management.
- **LYRA:** Quality Assurance.
- **SCOUT:** Monitoring & Metrics.

### C. Automated Planning (`lib/ai/plan.ts`)
Users input high-level goals in `PlanInput`. Sparky uses Gemini to "decompose" the plan into discrete tickets, which are then written to the Git storage.

### D. AMD Metrics (`components/AmdMetricsPanel.tsx`)
The UI features a simulated "AMD MI300X" metrics panel, showing GPU/VRAM usage and inference speeds (tokens/sec). This is part of the "terminal" aesthetic but designed to show real performance if integrated with AMD-backed inference servers.

---

## 5. Design Tokens & Aesthetic
- **Fonts:** Bebas Neue (Display), Syne (UI), JetBrains Mono (Labels), Instrument Serif (Voice Lines).
- **Colors:** Void (`#04040e`), Panel (`#09091a`), Surface (`#0f0f22`), AMD Red (`#ed1c24`).
- **Animations:** Pulse effects for working agents, float animations for idle mascots, and scanline overlays.

---

## 6. Implementation Notes (from `docs/`)
The dashboard was originally designed as a high-fidelity UI prototype (`repomind-dashboard-ui-design.md`) and has since been integrated with functional backend logic for GitHub and Supabase.
