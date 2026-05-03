'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { AgentState, AgentName, Ticket, ActivityEvent, AmdMetrics } from '@/lib/types'
import { INITIAL_AGENTS } from '@/lib/fake-data'
import { Topbar } from '@/components/Topbar'
import { CrewPanel } from '@/components/CrewPanel'
import { KanbanBoard } from '@/components/KanbanBoard'
import { PlanInput } from '@/components/PlanInput'
import { AmdMetricsPanel } from '@/components/AmdMetricsPanel'
import { AgentModal } from '@/components/AgentModal'
import { ChatPanel } from '@/components/ChatPanel'
import { ArchitecturePanel } from '@/components/ArchitecturePanel'
import { ReleasesPanel } from '@/components/ReleasesPanel'
import { SuggestionsPanel } from '@/components/SuggestionsPanel'
import { NewProjectModal } from '@/components/NewProjectModal'
import { TicketDetailModal } from '@/components/TicketDetailModal'
import { OnboardingEmpty } from '@/components/OnboardingEmpty'
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Sidebar } from '@/components/Sidebar'
import type { SectionId } from '@/components/Sidebar'
import { AgentWelcomeBanner } from '@/components/AgentWelcomeBanner'
import type { WelcomeContext } from '@/components/AgentWelcomeBanner'
import { AgentCustomizeModal } from '@/components/AgentCustomizeModal'

interface Project {
  id: string
  name: string
  repo_full: string
  slug?: string
  default_branch?: string | null
}

interface RawTicket {
  id: string
  title: string
  status: string
  priority: string
  complexity: string
  created_at: string
  path?: string
  description?: string
}

function mapTicket(t: RawTicket): Ticket {
  const statusMap: Record<string, Ticket['status']> = {
    backlog: 'BACKLOG', todo: 'TODO', 'in-progress': 'IN_PROGRESS', 'in_progress': 'IN_PROGRESS',
    'in-review': 'IN_REVIEW', 'in_review': 'IN_REVIEW', done: 'DONE',
  }
  const priorityMap: Record<string, Ticket['priority']> = {
    high: 'HIGH', medium: 'MED', med: 'MED', low: 'LOW',
  }
  const complexityMap: Record<string, Ticket['complexity']> = {
    s: 'S', m: 'M', l: 'L', xl: 'XL',
  }

  const now = Date.now()
  const created = t.created_at ? new Date(t.created_at).getTime() : now
  const diffMin = Math.round((now - created) / 60000)
  const age = diffMin < 1 ? 'just now' : diffMin < 60 ? `${diffMin}m ago` : `${Math.round(diffMin / 60)}h ago`

  return {
    id: t.id,
    title: t.title,
    status: statusMap[t.status?.toLowerCase()] ?? 'BACKLOG',
    priority: priorityMap[t.priority?.toLowerCase()] ?? 'MED',
    complexity: complexityMap[t.complexity?.toLowerCase()] ?? 'M',
    age,
    ...(t.path ? { path: t.path } : {}),
    ...(t.description ? { description: t.description } : {}),
  }
}

export default function App() {
  const { status } = useSession()
  const router = useRouter()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [agents, setAgents] = useState<AgentState[]>(INITIAL_AGENTS)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [feed, setFeed] = useState<ActivityEvent[]>([])
  const [metrics, setMetrics] = useState<AmdMetrics>({ gpu: 0, mem: 0, tokSec: 0, embedMs: 0 })
  const [section, setSection] = useState<SectionId>('kanban')
  const [planOpen, setPlanOpen] = useState(false)
  const [planWorking, setPlanWorking] = useState(false)
  const [amdOpen, setAmdOpen] = useState(false)
  const [agentModal, setAgentModal] = useState<AgentName | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [suggestionCount, setSuggestionCount] = useState(0)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [ticketDetail, setTicketDetail] = useState<Ticket | null>(null)
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false)
  const [agentNames, setAgentNames] = useState<Record<string, string>>({})
  const [agentCustomizeOpen, setAgentCustomizeOpen] = useState(false)
  const [agentConfigs, setAgentConfigs] = useState<Record<string, any>>({})

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  // Load projects on mount
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setProjects(list)
        if (list.length > 0) setSelectedProject(list[0])
      })
      .catch(() => {})
  }, [])

  // Load agent configs on mount
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

  // Load tickets when project changes
  const loadTickets = useCallback(async (projectId: string) => {
    setLoadingTickets(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/repomind/tickets`)
      if (!res.ok) return
      const data = await res.json()
      const raw: RawTicket[] = data.tickets || []
      setTickets(raw.map(mapTicket))
    } catch {
    } finally {
      setLoadingTickets(false)
    }
  }, [])

  // Load suggestions count for feed
  const loadSuggestions = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/repomind/suggestions`)
      if (!res.ok) return
      const data = await res.json()
      const count = (data.suggestions || []).length
      setSuggestionCount(count)
      if (count > 0) {
        setFeed(f => [
          { color: '#14b8a6', text: `PATCH found <span style="color:#14b8a6">${count} pending suggestions</span>`, ago: 'now' },
          ...f.filter(x => !x.text.includes('PATCH found')),
        ])
        setAgents(a => a.map(x => x.name === 'PATCH' ? { ...x, status: 'done' } : x))
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!selectedProject) return
    loadTickets(selectedProject.id)
    loadSuggestions(selectedProject.id)
  }, [selectedProject, loadTickets, loadSuggestions])

  const setAgent = (name: AgentName, status: AgentState['status']) =>
    setAgents(a => a.map(x => x.name === name ? { ...x, status } : x))

  const onDeploy = async (text: string) => {
    if (!selectedProject) {
      // No project: simulate
      setPlanWorking(true)
      setAgent('SPARKY', 'working')
      setTimeout(() => {
        setFeed(f => [{ color: '#f59e0b', text: 'SPARKY <span style="color:#fbbf24">needs a project selected</span>', ago: 'now' }, ...f])
        setAgent('SPARKY', 'idle')
        setPlanWorking(false)
        setPlanOpen(false)
      }, 1000)
      return
    }

    setPlanWorking(true)
    setAgent('SPARKY', 'working')
    setFeed(f => [{ color: '#f59e0b', text: 'SPARKY <span style="color:#fbbf24">decomposing plan...</span>', ago: 'now' }, ...f])

    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/repomind/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planText: text }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed')

      setFeed(f => [
        { color: '#f59e0b', text: `SPARKY <span style="color:#fbbf24">created ${data.ticketCount} tickets</span>`, ago: 'now' },
        ...f,
      ])
      setAgent('SPARKY', 'done')
      setTimeout(() => setAgent('SPARKY', 'idle'), 2000)

      // Reload tickets
      await loadTickets(selectedProject.id)
    } catch (err: any) {
      setFeed(f => [{ color: '#ef4444', text: `SPARKY <span style="color:#ef4444">error: ${err.message}</span>`, ago: 'now' }, ...f])
      setAgent('SPARKY', 'error')
      setTimeout(() => setAgent('SPARKY', 'idle'), 2000)
    } finally {
      setPlanWorking(false)
      setPlanOpen(false)
    }
  }

  const onTicketStatusChange = async (ticketId: string, newStatus: string, ticketPath?: string) => {
    if (!selectedProject) return
    // Optimistic update — move card immediately
    setTickets(ts => ts.map(t => t.id === ticketId ? { ...t, status: newStatus as Ticket['status'] } : t))
    try {
      await fetch(`/api/projects/${selectedProject.id}/repomind/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus.toLowerCase().replace(/_/g, '-'), path: ticketPath }),
      })
    } catch (err) {
      console.error('Failed to update ticket:', err)
      // Revert on failure
      loadTickets(selectedProject.id)
    }
  }

  const gpuRounded = Math.round(metrics.gpu)

  const SECTION_AGENTS: Partial<Record<SectionId, 'SPARKY'|'PATCH'|'SAGE'|'NOVA'|'LYRA'>> = {
    kanban: 'SPARKY',
    suggestions: 'PATCH',
    architecture: 'SAGE',
    releases: 'NOVA',
    chat: 'LYRA',
  }

  const welcomeContext: WelcomeContext = {
    ticketCount: tickets?.length ?? 0,
    suggestionCount: suggestionCount ?? 0,
    moduleCount: 0,
    releaseCount: 0,
    projectName: selectedProject?.name,
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', background: 'var(--void)' }}>
        {status === 'loading' ? 'authenticating…' : 'redirecting…'}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Topbar
        gpu={gpuRounded}
        onAmdClick={() => setAmdOpen(true)}
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={(p) => setSelectedProject(p)}
        onAddProject={() => setNewProjectOpen(true)}
        onSettingsClick={() => setProjectSettingsOpen(true)}
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <CrewPanel
          agents={agents}
          amdMetrics={{ ...metrics, gpu: gpuRounded, mem: Math.round(metrics.mem) }}
          activityFeed={feed}
          onAgentClick={n => setAgentModal(n)}
          onAmdClick={() => setAmdOpen(true)}
        />

        <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
          <Sidebar
            active={section}
            onSelect={(id) => {
              if (id === 'settings') { setProjectSettingsOpen(true); return }
              setSection(id)
            }}
            suggestionCount={suggestionCount}
            agentNames={agentNames}
          />

          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {!selectedProject && projects.length === 0 ? (
              <OnboardingEmpty onAddProject={() => setNewProjectOpen(true)} />
            ) : (
              <>
                {SECTION_AGENTS[section] && (
                  <AgentWelcomeBanner
                    agent={SECTION_AGENTS[section]!}
                    context={welcomeContext}
                    displayName={agentNames[SECTION_AGENTS[section]!]}
                  />
                )}

                {/* New Plan button bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderBottom: '1px solid var(--border)', background: 'var(--panel)', flexShrink: 0, padding: '0 16px', height: 44 }}>
                  <button
                    onClick={() => setAgentCustomizeOpen(true)}
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 600,
                      fontSize: 12,
                      background: 'var(--surface)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      padding: '6px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      marginRight: 8,
                    }}
                  >
                    AGENTS
                  </button>
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

                <PlanInput open={planOpen} onClose={() => setPlanOpen(false)} onDeploy={onDeploy} working={planWorking} hasProject={!!selectedProject} />

                <div key={section} className="slideleft" style={{ flex: 1, minHeight: 0 }}>
                  {section === 'kanban' && (
                    <ErrorBoundary>
                      <KanbanBoard
                        tickets={loadingTickets && tickets.length === 0 ? [] : tickets}
                        flashId={flashId}
                        onStatusChange={onTicketStatusChange}
                        onTicketClick={t => setTicketDetail(t)}
                        projectId={selectedProject?.id ?? null}
                        onTicketCreated={() => selectedProject && loadTickets(selectedProject.id)}
                      />
                    </ErrorBoundary>
                  )}
                  {section === 'suggestions' && <ErrorBoundary><SuggestionsPanel projectId={selectedProject?.id ?? null} repoFull={selectedProject?.repo_full ?? null} onApproved={() => loadTickets(selectedProject!.id)} /></ErrorBoundary>}
                  {section === 'architecture' && <ErrorBoundary><ArchitecturePanel projectId={selectedProject?.id ?? null} /></ErrorBoundary>}
                  {section === 'releases' && <ErrorBoundary><ReleasesPanel projectId={selectedProject?.id ?? null} /></ErrorBoundary>}
                  {section === 'chat' && <ErrorBoundary><ChatPanel projectId={selectedProject?.id ?? null} /></ErrorBoundary>}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      <AmdMetricsPanel
        open={amdOpen}
        onClose={() => setAmdOpen(false)}
        metrics={{ ...metrics, gpu: gpuRounded }}
        log={[]}
      />

      {agentModal && (
        <AgentModal
          agentName={agentModal}
          agents={agents}
          onClose={() => setAgentModal(null)}
          selectedProjectId={selectedProject?.id ?? null}
          onScanComplete={(result) => {
            setAgents(a => a.map(x => x.name === 'SCOUT' ? { ...x, status: 'done' } : x))
            setFeed(f => [
              { color: '#60a5fa', text: `SCOUT <span style="color:#60a5fa">indexed ${result.moduleCount} modules from ${result.fileCount} files</span>`, ago: 'now' },
              ...f,
            ])
            setTimeout(() => setAgents(a => a.map(x => x.name === 'SCOUT' ? { ...x, status: 'idle' } : x)), 3000)
          }}
        />
      )}

      {ticketDetail && (
        <TicketDetailModal
          ticket={ticketDetail}
          onClose={() => setTicketDetail(null)}
          onStatusChange={(id, status, path) => {
            onTicketStatusChange(id, status, path)
            setTicketDetail(null)
          }}
        />
      )}

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

      {newProjectOpen && (
        <NewProjectModal
          onClose={() => setNewProjectOpen(false)}
          onCreated={(project) => {
            setProjects(ps => [...ps, project])
            setSelectedProject(project)
            setNewProjectOpen(false)
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
        />
      )}

      {agentCustomizeOpen && (
        <AgentCustomizeModal
          configs={agentConfigs}
          onClose={() => setAgentCustomizeOpen(false)}
          onSaved={(configs) => {
            setAgentConfigs(configs)
            const names: Record<string, string> = {}
            for (const [k, v] of Object.entries(configs as any)) {
              names[k] = (v as any).displayName ?? k
            }
            setAgentNames(names)
            setAgents(a => a.map(x =>
              (configs as any)[x.name]?.voiceLine
                ? { ...x, voiceLine: (configs as any)[x.name].voiceLine }
                : x
            ))
            setAgentCustomizeOpen(false)
          }}
        />
      )}
    </div>
  )
}
