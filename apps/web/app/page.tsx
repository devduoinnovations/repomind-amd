'use client'
import { useState, useEffect, useCallback } from 'react'
import type { AgentState, AgentName, Ticket, ActivityEvent, AmdMetrics } from '@/lib/types'
import { INITIAL_AGENTS, INITIAL_METRICS, INITIAL_LOG } from '@/lib/fake-data'
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

const TABS = ['Kanban', 'Suggestions', 'Architecture', 'Releases', 'Q&A'] as const
type Tab = typeof TABS[number]

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
    ...(t.path ? { path: t.path } as any : {}),
  }
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [agents, setAgents] = useState<AgentState[]>(INITIAL_AGENTS)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [feed, setFeed] = useState<ActivityEvent[]>([])
  const [metrics, setMetrics] = useState<AmdMetrics>(INITIAL_METRICS)
  const [tab, setTab] = useState<Tab>('Kanban')
  const [planOpen, setPlanOpen] = useState(false)
  const [planWorking, setPlanWorking] = useState(false)
  const [amdOpen, setAmdOpen] = useState(false)
  const [agentModal, setAgentModal] = useState<AgentName | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [loadingTickets, setLoadingTickets] = useState(false)

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

  // AMD metrics jitter
  useEffect(() => {
    const id = setInterval(() => {
      setMetrics(m => ({
        gpu:     Math.max(20, Math.min(95, m.gpu     + (Math.random() * 12 - 6))),
        mem:     Math.max(40, Math.min(75, m.mem     + (Math.random() * 4  - 2))),
        tokSec:  Math.max(1800, Math.min(3400, m.tokSec + Math.round(Math.random() * 200 - 100))),
        embedMs: Math.max(8,    Math.min(20,   m.embedMs + Math.round(Math.random() * 4   - 2))),
      }))
    }, 1400)
    return () => clearInterval(id)
  }, [])

  // PATCH commit flash (simulated if no real project)
  useEffect(() => {
    if (selectedProject || tickets.length === 0) return
    const id = setInterval(() => {
      if (tickets.length === 0) return
      const tid = tickets[Math.floor(Math.random() * Math.min(3, tickets.length))]?.id
      if (!tid) return
      setFlashId(tid)
      setAgents(a => a.map(x => x.name === 'PATCH' ? { ...x, status: 'working' } : x))
      setTimeout(() => setFlashId(null), 1500)
    }, 6000)
    return () => clearInterval(id)
  }, [selectedProject, tickets])

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
    try {
      await fetch(`/api/projects/${selectedProject.id}/repomind/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus.toLowerCase().replace('_', '-'), path: ticketPath }),
      })
    } catch (err) {
      console.error('Failed to update ticket:', err)
    }
  }

  const gpuRounded = Math.round(metrics.gpu)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Topbar
        gpu={gpuRounded}
        onAmdClick={() => setAmdOpen(true)}
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={(p) => setSelectedProject(p)}
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <CrewPanel
          agents={agents}
          amdMetrics={{ ...metrics, gpu: gpuRounded, mem: Math.round(metrics.mem) }}
          activityFeed={feed}
          onAgentClick={n => setAgentModal(n)}
          onAmdClick={() => setAmdOpen(true)}
        />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--panel)', flexShrink: 0 }}>
            <div className="tabs" style={{ display: 'flex' }}>
              {TABS.map(t => (
                <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
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

          <PlanInput open={planOpen} onClose={() => setPlanOpen(false)} onDeploy={onDeploy} working={planWorking} />

          <div style={{ flex: 1, minHeight: 0 }}>
            {tab === 'Kanban' && (
              <KanbanBoard
                tickets={loadingTickets && tickets.length === 0 ? [] : tickets}
                flashId={flashId}
                onStatusChange={onTicketStatusChange}
              />
            )}
            {tab === 'Suggestions' && <SuggestionsPanel projectId={selectedProject?.id ?? null} onApproved={() => loadTickets(selectedProject!.id)} />}
            {tab === 'Architecture' && <ArchitecturePanel projectId={selectedProject?.id ?? null} />}
            {tab === 'Releases' && <ReleasesPanel projectId={selectedProject?.id ?? null} />}
            {tab === 'Q&A' && <ChatPanel projectId={selectedProject?.id ?? null} />}
          </div>
        </main>
      </div>

      <AmdMetricsPanel
        open={amdOpen}
        onClose={() => setAmdOpen(false)}
        metrics={{ ...metrics, gpu: gpuRounded }}
        log={INITIAL_LOG}
      />

      {agentModal && (
        <AgentModal agentName={agentModal} agents={agents} onClose={() => setAgentModal(null)} />
      )}
    </div>
  )
}
