'use client'
import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Ticket, TicketStatus } from '@/lib/types'
import { TicketCard } from './TicketCard'

interface Props {
  tickets: Ticket[]
  flashId: string | null
  onStatusChange?: (ticketId: string, newStatus: string, ticketPath?: string) => void
  onTicketClick?: (ticket: Ticket) => void
  projectId?: string | null
  onTicketCreated?: () => void
  loading?: boolean
}

const COLS: TicketStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']

const COL_COLOR: Record<TicketStatus, string> = {
  BACKLOG:     '#4e4b6a',
  TODO:        '#60a5fa',
  IN_PROGRESS: '#f59e0b',
  IN_REVIEW:   '#8b5cf6',
  DONE:        '#22c55e',
}

function DroppableColumn({ col, tickets, flashId, onTicketClick, loading }: { col: TicketStatus; tickets: Ticket[]; flashId: string | null; onTicketClick?: (t: Ticket) => void; loading?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: col })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${COL_COLOR[col]}` }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)', letterSpacing: '0.06em' }}>{col.replace(/_/g, ' ')}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--surface)', color: 'var(--text-secondary)', padding: '1px 7px', borderRadius: 999, border: '1px solid var(--border)' }}>{tickets.length}</span>
      </div>
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: 4,
          borderRadius: 8,
          minHeight: 60,
          background: isOver ? `${COL_COLOR[col]}12` : 'transparent',
          transition: 'background 120ms',
        }}
      >
        {tickets.map(t => (
          <DraggableTicket key={t.id} ticket={t} flash={t.id === flashId} onClick={onTicketClick} />
        ))}
        {tickets.length === 0 && loading && (
          <>
            <div style={{ height: 64, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 8, opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
            <div style={{ height: 64, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 8, opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
          </>
        )}
        {tickets.length === 0 && !loading && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', padding: 12, textAlign: 'center' }}>—</div>
        )}
      </div>
    </div>
  )
}

function DraggableTicket({ ticket, flash, onClick }: { ticket: Ticket; flash: boolean; onClick?: (t: Ticket) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => { if (!isDragging) onClick?.(ticket) }}
      style={{
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.35 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    >
      <TicketCard ticket={ticket} flash={flash} />
    </div>
  )
}

export function KanbanBoard({ tickets, flashId, onStatusChange, onTicketClick, projectId, onTicketCreated, loading }: Props) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [filterPriority, setFilterPriority] = useState<string>('ALL')
  const [filterComplexity, setFilterComplexity] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [newTicketOpen, setNewTicketOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    if (!newTicketOpen) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setNewTicketOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [newTicketOpen])

  async function handleCreateTicket() {
    if (!projectId || !newTitle.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/repomind/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }
      setNewTicketOpen(false)
      setNewTitle('')
      setNewDesc('')
      onTicketCreated?.()
    } catch (err: any) {
      setCreateError(err?.message ?? 'Unknown error')
    } finally {
      setCreating(false)
    }
  }

  const filtered = tickets.filter(t => {
    if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false
    if (filterComplexity !== 'ALL' && t.complexity !== filterComplexity) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const inTitle = t.title?.toLowerCase().includes(q)
      const inDesc = (t as any).description?.toLowerCase().includes(q)
      if (!inTitle && !inDesc) return false
    }
    return true
  })

  const grouped = COLS.reduce<Record<TicketStatus, Ticket[]>>(
    (acc, c) => ({ ...acc, [c]: filtered.filter(t => t.status === c) }),
    {} as Record<TicketStatus, Ticket[]>
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTicket(null)
    if (!over || !onStatusChange) return
    const ticket = tickets.find(t => t.id === active.id)
    if (!ticket) return
    const newStatus = over.id as TicketStatus
    if (ticket.status === newStatus) return
    onStatusChange(ticket.id, newStatus, (ticket as any).path)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveTicket(tickets.find(t => t.id === active.id) ?? null)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTicket(null)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* filter bar */}
        <div style={{ padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--panel)' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tickets…"
            style={{
              background: 'var(--void)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '3px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-primary)',
              outline: 'none',
              width: 140,
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PRIORITY:</span>
          {['ALL', 'HIGH', 'MED', 'LOW'].map(p => (
            <button key={p} onClick={() => setFilterPriority(p)} style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)',
              background: filterPriority === p ? 'rgba(96,165,250,0.2)' : 'transparent',
              color: filterPriority === p ? '#60a5fa' : 'var(--text-muted)',
              border: `1px solid ${filterPriority === p ? 'rgba(96,165,250,0.4)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}>{p}</button>
          ))}
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>SIZE:</span>
          {['ALL', 'S', 'M', 'L', 'XL'].map(c => (
            <button key={c} onClick={() => setFilterComplexity(c)} style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)',
              background: filterComplexity === c ? 'rgba(139,92,246,0.2)' : 'transparent',
              color: filterComplexity === c ? '#8b5cf6' : 'var(--text-muted)',
              border: `1px solid ${filterComplexity === c ? 'rgba(139,92,246,0.4)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}>{c}</button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {filtered.length} / {tickets.length} tickets
          </span>
          {projectId && (
            <button
              onClick={() => { setNewTicketOpen(true); setCreateError(null) }}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 11,
                letterSpacing: '0.06em',
                background: 'rgba(96,165,250,0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(96,165,250,0.3)',
                padding: '4px 10px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              + New Ticket
            </button>
          )}
        </div>
        {/* kanban columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, padding: 20, flex: 1, overflow: 'auto' }}>
          {COLS.map(col => (
            <DroppableColumn key={col} col={col} tickets={grouped[col]} flashId={flashId} onTicketClick={onTicketClick} loading={loading} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeTicket ? <TicketCard ticket={activeTicket} flash={false} /> : null}
      </DragOverlay>

      {newTicketOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) { setNewTicketOpen(false) } }}
        >
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border-hover)', borderRadius: 10, padding: 24, minWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.08em', color: 'var(--text-primary)' }}>NEW TICKET</span>
            <input
              placeholder="Title (required)"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateTicket() }}
              style={{ background: 'var(--void)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box' }}
              autoFocus
            />
            <textarea
              placeholder="Description (optional)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              rows={3}
              style={{ background: 'var(--void)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
            {createError && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#f87171' }}>{createError}</span>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setNewTicketOpen(false)}
                style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.06em', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '4px 12px', borderRadius: 4, cursor: 'pointer' }}
              >
                CANCEL
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={creating || !newTitle.trim()}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  background: creating || !newTitle.trim() ? 'rgba(96,165,250,0.06)' : 'rgba(96,165,250,0.15)',
                  color: creating || !newTitle.trim() ? 'rgba(96,165,250,0.4)' : '#60a5fa',
                  border: `1px solid ${creating || !newTitle.trim() ? 'rgba(96,165,250,0.15)' : 'rgba(96,165,250,0.3)'}`,
                  padding: '4px 12px',
                  borderRadius: 4,
                  cursor: creating || !newTitle.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? 'CREATING...' : 'CREATE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  )
}
