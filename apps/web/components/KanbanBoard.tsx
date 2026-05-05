'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Plus, Filter, Layout, CheckCircle2, 
  Clock, RefreshCw, AlertCircle 
} from 'lucide-react'
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

const COL_STYLE: Record<TicketStatus, { color: string; bg: string; icon: any }> = {
  BACKLOG:     { color: 'var(--text-muted)', bg: 'bg-[var(--text-muted)]/5', icon: Layout },
  TODO:        { color: 'var(--agent-lyra)', bg: 'bg-[var(--agent-lyra)]/5', icon: Clock },
  IN_PROGRESS: { color: 'var(--agent-sparky)', bg: 'bg-[var(--agent-sparky)]/5', icon: RefreshCw },
  IN_REVIEW:   { color: 'var(--agent-sage)', bg: 'bg-[var(--agent-sage)]/5', icon: AlertCircle },
  DONE:        { color: 'var(--agent-scout)', bg: 'bg-[var(--agent-scout)]/5', icon: CheckCircle2 },
}

function DroppableColumn({ col, tickets, flashId, onTicketClick, loading }: { col: TicketStatus; tickets: Ticket[]; flashId: string | null; onTicketClick?: (t: Ticket) => void; loading?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: col })
  const style = COL_STYLE[col]
  const Icon = style.icon

  return (
    <div className="flex flex-col min-h-0 bg-glass rounded-[var(--radius-lg)] p-4 border border-[var(--border)] group">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${style.bg}`} style={{ color: style.color }}>
            <Icon size={16} />
          </div>
          <span className="font-[var(--font-display)] text-sm tracking-widest text-[var(--text-primary)]">{col.replace(/_/g, ' ')}</span>
        </div>
        <span className="font-[var(--font-mono)] text-[10px] bg-[var(--surface)] text-[var(--text-muted)] px-2 py-0.5 rounded-full border border-[var(--border)] shadow-sm">
          {tickets.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`
          flex-1 overflow-y-auto pr-1 space-y-1 min-h-[100px] transition-colors duration-300 rounded-[var(--radius-md)]
          ${isOver ? 'bg-[var(--hover)]/30' : 'transparent'}
        `}
      >
        <AnimatePresence mode="popLayout">
          {tickets.map(t => (
            <DraggableTicket key={t.id} ticket={t} flash={t.id === flashId} onClick={onTicketClick} />
          ))}
        </AnimatePresence>

        {tickets.length === 0 && loading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-24 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] opacity-40 animate-pulse" />
            ))}
          </div>
        )}
        
        {tickets.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full opacity-20 py-8">
            <Layout size={32} className="text-[var(--text-muted)] mb-2" />
            <span className="font-[var(--font-mono)] text-[8px] tracking-[0.2em] uppercase">Empty</span>
          </div>
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
      className={`
        touch-none transition-all
        ${isDragging ? 'z-50 rotate-3 scale-105 pointer-events-none' : 'z-0'}
      `}
      style={{
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.4 : 1,
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

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
      if (!res.ok) throw new Error('Failed to create ticket')
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
      if (!t.title?.toLowerCase().includes(q) && !(t as any).description?.toLowerCase().includes(q)) return false
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
      <div className="flex flex-col h-full bg-[var(--void)]">
        {/* Filter Bar */}
        <div className="h-14 px-6 flex items-center gap-4 bg-glass border-b border-[var(--border)] flex-none shadow-sm overflow-x-auto scrollbar-hide">
          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--agent-sparky)] transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--agent-sparky)] focus:ring-2 focus:ring-[var(--agent-sparky)]/10 rounded-full pl-9 pr-4 py-1.5 font-[var(--font-mono)] text-[10px] text-[var(--text-primary)] outline-none w-48 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 h-7 px-3 rounded-full bg-[var(--surface)] border border-[var(--border)]">
            <Filter size={12} className="text-[var(--text-muted)]" />
            <div className="flex gap-1">
              {['ALL', 'HIGH', 'MED', 'LOW'].map(p => (
                <button 
                  key={p} 
                  onClick={() => setFilterPriority(p)} 
                  className={`
                    px-2 py-0.5 rounded-full font-[var(--font-mono)] text-[8px] font-bold tracking-wider transition-all
                    ${filterPriority === p ? 'bg-[var(--agent-lyra)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}
                  `}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 h-7 px-3 rounded-full bg-[var(--surface)] border border-[var(--border)]">
            <Layout size={12} className="text-[var(--text-muted)]" />
            <div className="flex gap-1">
              {['ALL', 'S', 'M', 'L', 'XL'].map(c => (
                <button 
                  key={c} 
                  onClick={() => setFilterComplexity(c)} 
                  className={`
                    px-2 py-0.5 rounded-full font-[var(--font-mono)] text-[8px] font-bold tracking-wider transition-all
                    ${filterComplexity === c ? 'bg-[var(--agent-sage)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}
                  `}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <span className="font-[var(--font-mono)] text-[10px] text-[var(--text-muted)] font-bold tracking-wider opacity-60">
              {filtered.length} / {tickets.length} TASKS
            </span>
            {projectId && (
              <button
                onClick={() => { setNewTicketOpen(true); setCreateError(null) }}
                className="flex items-center gap-2 bg-[var(--agent-sparky)]/10 hover:bg-[var(--agent-sparky)]/20 text-[var(--agent-sparky)] border border-[var(--agent-sparky)]/30 px-4 py-1.5 rounded-full font-[var(--font-display)] text-xs tracking-widest transition-all hover:scale-[1.02] active:scale-95"
              >
                <Plus size={14} />
                NEW TASK
              </button>
            )}
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 p-6 overflow-auto">
          {COLS.map(col => (
            <DroppableColumn key={col} col={col} tickets={grouped[col]} flashId={flashId} onTicketClick={onTicketClick} loading={loading} />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.2, 1, 0.3, 1)' }}>
        {activeTicket ? (
          <div className="rotate-3 scale-105 opacity-90 shadow-2xl">
            <TicketCard ticket={activeTicket} flash={false} />
          </div>
        ) : null}
      </DragOverlay>

      {/* New Ticket Modal */}
      <AnimatePresence>
        {newTicketOpen && (
          <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setNewTicketOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-glass border border-[var(--border-hover)] rounded-[var(--radius-lg)] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--agent-sparky)] to-[var(--agent-nova)]" />
              
              <h3 className="font-[var(--font-display)] text-2xl tracking-[0.1em] text-[var(--text-primary)] mb-6">NEW TICKET</h3>
              
              <div className="space-y-4">
                <input
                  placeholder="What needs to be done?"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateTicket() }}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--agent-sparky)] rounded-xl px-4 py-3 font-[var(--font-mono)] text-sm text-[var(--text-primary)] outline-none transition-all placeholder:opacity-50"
                  autoFocus
                />
                <textarea
                  placeholder="Add details (optional)..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  rows={4}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--agent-sparky)] rounded-xl px-4 py-3 font-[var(--font-mono)] text-sm text-[var(--text-primary)] outline-none transition-all resize-none placeholder:opacity-50"
                />
              </div>

              {createError && (
                <div className="mt-4 p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} className="text-[var(--danger)]" />
                  <span className="font-[var(--font-mono)] text-[10px] text-[var(--danger)] font-bold">{createError}</span>
                </div>
              )}

              <div className="mt-8 flex gap-3 justify-end">
                <button
                  onClick={() => setNewTicketOpen(false)}
                  className="px-6 py-2 rounded-full font-[var(--font-display)] text-xs tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleCreateTicket}
                  disabled={creating || !newTitle.trim()}
                  className="px-8 py-2 rounded-full font-[var(--font-display)] text-xs tracking-widest bg-[var(--agent-sparky)] text-white shadow-lg shadow-[var(--agent-sparky)]/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                >
                  {creating ? 'CREATING...' : 'CREATE'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DndContext>
  )
}
