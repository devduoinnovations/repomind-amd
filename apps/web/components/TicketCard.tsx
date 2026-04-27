'use client'
import type { Ticket, Priority, Complexity } from '@/lib/types'

interface Props {
  ticket: Ticket
  flash: boolean
}

export function TicketCard({ ticket, flash }: Props) {
  const t = ticket
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${flash ? 'rgba(20,184,166,0.6)' : 'var(--border)'}`,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      boxShadow: flash ? '0 0 24px rgba(20,184,166,0.4)' : 'none',
      transition: 'all 400ms var(--ease-snap)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{t.id}</span>
        <PriorityPill p={t.priority} />
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 10 }}>{t.title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: t.commit ? 8 : 0 }}>
        <ComplexityBar c={t.complexity} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{t.complexity}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: '#f59e0b' }}>⚡ SPARKY</span>
      </div>
      {t.commit && (
        <div style={{
          background: 'rgba(20,184,166,0.08)',
          border: '1px solid rgba(20,184,166,0.25)',
          borderRadius: 6,
          padding: '5px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          animation: flash ? 'slidein 400ms var(--ease-snap)' : 'none',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#5eead4' }}>{t.commit}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>conf {t.confidence} 🔍</span>
        </div>
      )}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 6 }}>{t.age}</div>
    </div>
  )
}

function PriorityPill({ p }: { p: Priority }) {
  const map: Record<Priority, { bg: string; fg: string; g: string }> = {
    HIGH: { bg: 'rgba(239,68,68,0.15)',  fg: '#ef4444',           g: '↑' },
    MED:  { bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b',           g: '' },
    LOW:  { bg: 'rgba(78,75,106,0.3)',   fg: 'var(--text-muted)', g: '↓' },
  }
  const s = map[p]
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', background: s.bg, color: s.fg, padding: '2px 7px', borderRadius: 999 }}>
      {p} {s.g}
    </span>
  )
}

function ComplexityBar({ c }: { c: Complexity }) {
  const filled = { S: 1, M: 2, L: 3, XL: 4 }[c] ?? 1
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[0, 1, 2, 3].map(i => (
        <span key={i} style={{ width: 12, height: 5, background: i < filled ? '#f59e0b' : 'rgba(245,158,11,0.25)', borderRadius: 1 }} />
      ))}
    </div>
  )
}
