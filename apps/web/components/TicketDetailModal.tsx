'use client'
import type { Ticket, Priority, Complexity, TicketStatus } from '@/lib/types'

interface Props {
  ticket: Ticket
  onClose: () => void
  onStatusChange?: (ticketId: string, newStatus: string, path?: string) => void
}

const STATUS_FLOW: TicketStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']

const STATUS_COLOR: Record<TicketStatus, string> = {
  BACKLOG:     '#4e4b6a',
  TODO:        '#60a5fa',
  IN_PROGRESS: '#f59e0b',
  IN_REVIEW:   '#8b5cf6',
  DONE:        '#22c55e',
}

const PRIORITY_COLOR: Record<Priority, string> = {
  HIGH: '#ef4444',
  MED:  '#f59e0b',
  LOW:  '#4e4b6a',
}

const COMPLEXITY_LABEL: Record<Complexity, string> = {
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  XL: 'Extra Large',
}

export function TicketDetailModal({ ticket, onClose, onStatusChange }: Props) {
  const t = ticket
  const currentIdx = STATUS_FLOW.indexOf(t.status)
  const prevStatus = currentIdx > 0 ? STATUS_FLOW[currentIdx - 1] : null
  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,14,0.75)', backdropFilter: 'blur(10px)', zIndex: 60 }}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 560,
        maxHeight: '80vh',
        overflowY: 'auto',
        background: 'var(--panel)',
        border: '1px solid var(--border-hover)',
        borderRadius: 16,
        padding: 32,
        zIndex: 61,
        boxShadow: 'var(--shadow-modal)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.1em' }}>
              {t.id}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {t.title}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              padding: '6px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ESC
          </button>
        </div>

        {/* Status badges */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            background: `${STATUS_COLOR[t.status]}20`,
            color: STATUS_COLOR[t.status],
            border: `1px solid ${STATUS_COLOR[t.status]}55`,
            padding: '4px 12px',
            borderRadius: 999,
          }}>
            {t.status.replace(/_/g, ' ')}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            background: `${PRIORITY_COLOR[t.priority]}18`,
            color: PRIORITY_COLOR[t.priority],
            border: `1px solid ${PRIORITY_COLOR[t.priority]}44`,
            padding: '4px 12px',
            borderRadius: 999,
          }}>
            {t.priority} PRIORITY
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            padding: '4px 12px',
            borderRadius: 999,
          }}>
            {COMPLEXITY_LABEL[t.complexity]} ({t.complexity})
          </span>
        </div>

        {/* Complexity bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
            Complexity
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['S', 'M', 'L', 'XL'] as Complexity[]).map(c => (
              <div
                key={c}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  background: ['S', 'M', 'L', 'XL'].indexOf(c) <= ['S', 'M', 'L', 'XL'].indexOf(t.complexity)
                    ? '#f59e0b'
                    : 'rgba(245,158,11,0.2)',
                  transition: 'background 200ms',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {(['S', 'M', 'L', 'XL'] as Complexity[]).map(c => (
              <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{c}</span>
            ))}
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Age</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{t.age}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Agent</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#f59e0b' }}>⚡ SPARKY</div>
          </div>
          {t.confidence !== undefined && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Confidence</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#14b8a6' }}>{Math.round(t.confidence * 100)}%</div>
            </div>
          )}
        </div>

        {/* Commit badge */}
        {t.commit && (
          <div style={{
            background: 'rgba(20,184,166,0.08)',
            border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#5eead4' }}>{t.commit}</span>
            {t.confidence !== undefined && (
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                conf {t.confidence} 🔍
              </span>
            )}
          </div>
        )}

        {/* Status transitions */}
        {onStatusChange && (prevStatus || nextStatus) && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Move to
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {prevStatus && (
                <button
                  onClick={() => { onStatusChange(t.id, prevStatus, (t as any).path); onClose() }}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    background: `${STATUS_COLOR[prevStatus]}15`,
                    color: STATUS_COLOR[prevStatus],
                    border: `1px solid ${STATUS_COLOR[prevStatus]}44`,
                    padding: '8px 14px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  ← {prevStatus.replace(/_/g, ' ')}
                </button>
              )}
              {nextStatus && (
                <button
                  onClick={() => { onStatusChange(t.id, nextStatus, (t as any).path); onClose() }}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    background: `${STATUS_COLOR[nextStatus]}15`,
                    color: STATUS_COLOR[nextStatus],
                    border: `1px solid ${STATUS_COLOR[nextStatus]}44`,
                    padding: '8px 14px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  {nextStatus.replace(/_/g, ' ')} →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
