'use client'
import { useState } from 'react'
import { MascotSprite } from './mascots/MascotSprite'

interface Props {
  open: boolean
  onClose: () => void
  onDeploy: (text: string) => void
  working: boolean
  hasProject: boolean
}

export function PlanInput({ open, onClose, onDeploy, working, hasProject }: Props) {
  const [text, setText] = useState('Build OAuth login with Google and GitHub. Add JWT rotation, refresh tokens, and a session management page.')

  if (!open) return null

  return (
    <div style={{
      background: 'var(--panel)',
      borderBottom: '1px solid var(--border)',
      padding: '24px 32px',
      display: 'flex',
      gap: 24,
      alignItems: 'flex-start',
      animation: 'slidedown 280ms var(--ease-snap)',
    }}>
      <MascotSprite name="SPARKY" state={working ? 'working' : 'idle'} w={120} h={180} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: 'var(--text-primary)', letterSpacing: '0.02em', lineHeight: 1 }}>WHAT ARE WE BUILDING?</div>
        <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 15, color: 'var(--text-secondary)', marginTop: 6, marginBottom: 14 }}>
          Drop your spec, feature idea, or messy notes. SPARKY handles the rest.
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={working}
          rows={4}
          style={{
            width: '100%',
            background: 'var(--void)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            resize: 'none',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'center' }}>
          <button
            onClick={() => onDeploy(text)}
            disabled={working || !hasProject}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              letterSpacing: '0.06em',
              background: (working || !hasProject) ? '#1a1430' : '#f59e0b',
              color: (working || !hasProject) ? 'var(--text-muted)' : '#1a0e00',
              border: 'none',
              padding: '10px 22px',
              borderRadius: 6,
              cursor: (working || !hasProject) ? 'default' : 'pointer',
              boxShadow: (working || !hasProject) ? 'none' : '0 0 24px rgba(245,158,11,0.5)',
              transition: 'all 220ms var(--ease-snap)',
            }}
          >
            {working ? 'SPARKY IS THINKING…' : 'DEPLOY SPARKY'}
          </button>
          {!hasProject && !working && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
              Select a project first
            </span>
          )}
          {working && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#f59e0b' }}>
              decomposing plan… <span style={{ animation: 'blink 1s infinite' }}>▊</span>
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              padding: '8px 12px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  )
}
