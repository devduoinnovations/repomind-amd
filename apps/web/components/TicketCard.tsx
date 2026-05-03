'use client'
import type { Ticket } from '@/lib/types'

const PRIORITY_COLORS: Record<string, string> = { HIGH: '#ef4444', MED: '#f59e0b', LOW: '#22c55e' }
const COMPLEXITY_BG: Record<string, string>    = { S: 'rgba(34,197,94,0.15)', M: 'rgba(96,165,250,0.15)', L: 'rgba(245,158,11,0.15)', XL: 'rgba(239,68,68,0.15)' }
const COMPLEXITY_COLOR: Record<string, string> = { S: '#22c55e', M: '#60a5fa', L: '#f59e0b', XL: '#ef4444' }

interface Props {
  ticket: Ticket
  flash: boolean
}

export function TicketCard({ ticket, flash }: Props) {
  return (
    <div style={{
      background: flash ? 'rgba(96,165,250,0.08)' : 'var(--surface)',
      border: `1px solid ${flash ? 'rgba(96,165,250,0.3)' : 'var(--border)'}`,
      borderLeft: `3px solid ${PRIORITY_COLORS[ticket.priority] ?? '#64748b'}`,
      borderRadius: 6, padding: '10px 12px',
      transition: 'all 0.15s', marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
          {ticket.id}
        </span>
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)',
          background: COMPLEXITY_BG[ticket.complexity] ?? 'transparent',
          color: COMPLEXITY_COLOR[ticket.complexity] ?? 'var(--text-muted)',
        }}>
          {ticket.complexity}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1.4, marginBottom: 6 }}>
        {ticket.title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)',
          background: `rgba(${priorityRgb(ticket.priority)},0.12)`,
          color: PRIORITY_COLORS[ticket.priority] ?? 'var(--text-muted)',
        }}>
          {ticket.priority}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {ticket.age}
        </span>
      </div>
    </div>
  )
}

function priorityRgb(p: string): string {
  if (p === 'HIGH') return '239,68,68'
  if (p === 'MED')  return '245,158,11'
  return '34,197,94'
}
