'use client'
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

export function KanbanBoard({ tickets, flashId, onStatusChange: _onStatusChange }: Props) {
  const grouped = COLS.reduce<Record<TicketStatus, Ticket[]>>(
    (acc, c) => ({ ...acc, [c]: tickets.filter(t => t.status === c) }),
    {} as Record<TicketStatus, Ticket[]>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, padding: 20, height: '100%', overflow: 'auto' }}>
      {COLS.map(col => (
        <div key={col} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${COL_COLOR[col]}` }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)', letterSpacing: '0.06em' }}>{col.replace('_', ' ')}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--surface)', color: 'var(--text-secondary)', padding: '1px 7px', borderRadius: 999, border: '1px solid var(--border)' }}>{grouped[col].length}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            {grouped[col].map(t => (
              <TicketCard key={t.id} ticket={t} flash={t.id === flashId} />
            ))}
            {grouped[col].length === 0 && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', padding: 12, textAlign: 'center' }}>—</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
