'use client'
import { useState } from 'react'
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
}

const COLS: TicketStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']

const COL_COLOR: Record<TicketStatus, string> = {
  BACKLOG:     '#4e4b6a',
  TODO:        '#60a5fa',
  IN_PROGRESS: '#f59e0b',
  IN_REVIEW:   '#8b5cf6',
  DONE:        '#22c55e',
}

function DroppableColumn({ col, tickets, flashId }: { col: TicketStatus; tickets: Ticket[]; flashId: string | null }) {
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
          <DraggableTicket key={t.id} ticket={t} flash={t.id === flashId} />
        ))}
        {tickets.length === 0 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', padding: 12, textAlign: 'center' }}>—</div>
        )}
      </div>
    </div>
  )
}

function DraggableTicket({ ticket, flash }: { ticket: Ticket; flash: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
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

export function KanbanBoard({ tickets, flashId, onStatusChange }: Props) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const grouped = COLS.reduce<Record<TicketStatus, Ticket[]>>(
    (acc, c) => ({ ...acc, [c]: tickets.filter(t => t.status === c) }),
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, padding: 20, height: '100%', overflow: 'auto' }}>
        {COLS.map(col => (
          <DroppableColumn key={col} col={col} tickets={grouped[col]} flashId={flashId} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeTicket ? <TicketCard ticket={activeTicket} flash={false} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
