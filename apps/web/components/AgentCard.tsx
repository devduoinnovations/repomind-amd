'use client'
import { useState } from 'react'
import type { AgentState } from '@/lib/types'
import { MascotSprite } from './mascots/MascotSprite'

interface Props {
  agent: AgentState
  onClick: () => void
}

export function AgentCard({ agent, onClick }: Props) {
  const [hover, setHover] = useState(false)
  const { name, color, status, role, model, isAmd, voiceLine } = agent
  const working = status === 'working'
  const done = status === 'done'

  return (
    <div
      data-agent={name.toLowerCase()}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`agent-card${working ? ' is-working' : ''}${done ? ' is-done' : ''}`}
      style={{
        '--agent': color,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${color}`,
        borderRadius: 10,
        padding: '12px 12px 12px 14px',
        cursor: 'pointer',
        position: 'relative',
        boxShadow: working ? `0 0 28px ${color}55` : 'none',
        transition: 'box-shadow 240ms var(--ease-snap)',
      } as React.CSSProperties}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <MascotSprite name={name} state={working ? 'working' : 'idle'} w={44} h={66} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color, lineHeight: 1, letterSpacing: '0.04em' }}>{name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 3 }}>{role}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: working ? color : (done ? '#22c55e' : '#4e4b6a'),
              boxShadow: working ? `0 0 8px ${color}` : 'none',
              animation: working ? 'pulse 1.2s var(--ease-pulse) infinite' : 'none',
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: working ? color : 'var(--text-muted)', textTransform: 'uppercase' }}>
              {status}
            </span>
            {isAmd && (
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em', color: '#ed1c24', border: '1px solid rgba(237,28,36,0.4)', borderRadius: 999, padding: '1px 5px' }}>AMD</span>
            )}
          </div>
        </div>
      </div>
      {hover && voiceLine && (
        <div style={{
          marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
          fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 12,
          color: 'var(--text-secondary)', lineHeight: 1.4,
        }}>
          &ldquo;{voiceLine}&rdquo;
        </div>
      )}
    </div>
  )
}
