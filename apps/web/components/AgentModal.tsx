'use client'
import type { AgentState, AgentName } from '@/lib/types'
import { MascotSprite } from './mascots/MascotSprite'

interface Props {
  agentName: AgentName
  agents: AgentState[]
  onClose: () => void
}

export function AgentModal({ agentName, agents, onClose }: Props) {
  const a = agents.find(x => x.name === agentName)
  if (!a) return null

  const isScout = a.name === 'SCOUT'

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,14,0.8)', backdropFilter: 'blur(12px)', zIndex: 60 }}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 560,
        background: 'var(--panel)',
        border: `1px solid ${a.color}33`,
        borderRadius: 16,
        padding: 32,
        zIndex: 61,
        boxShadow: `var(--shadow-modal), 0 0 60px ${a.color}33`,
      }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <MascotSprite name={a.name} state="idle" w={140} h={210} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, color: a.color, letterSpacing: '0.02em', lineHeight: 0.9 }}>{a.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 4 }}>{a.role}</div>
            {isScout ? (
              <div style={{ marginTop: 20 }}>
                <div style={{
                  display: 'inline-block',
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  letterSpacing: '0.16em',
                  color: a.color,
                  background: `${a.color}18`,
                  border: `1px solid ${a.color}44`,
                  borderRadius: 6,
                  padding: '6px 14px',
                  marginBottom: 12,
                }}>COMING SOON</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  SCOUT will autonomously browse your repository, map file relationships, detect dead code, and surface refactor opportunities — directly on AMD MI300X.
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 18, color: 'var(--text-secondary)', marginTop: 16, lineHeight: 1.4 }}>
                  &ldquo;{a.voiceLine}&rdquo;
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--surface)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)' }}>{a.model}</span>
                  {a.isAmd && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'rgba(237,28,36,0.12)', color: '#ed1c24', padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(237,28,36,0.4)' }}>⚙ AMD MI300X</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            padding: '6px 10px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          ESC
        </button>
      </div>
    </>
  )
}
