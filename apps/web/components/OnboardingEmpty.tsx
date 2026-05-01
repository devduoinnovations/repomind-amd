'use client'

import { MascotSprite } from './mascots/MascotSprite'

interface Props {
  onAddProject: () => void
}

export function OnboardingEmpty({ onAddProject }: Props) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 48,
    }}>
      <MascotSprite name="SPARKY" state="idle" w={120} h={180} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--text-primary)', letterSpacing: '0.04em', marginBottom: 10 }}>
          NO PROJECTS YET
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 380 }}>
          Connect a GitHub repo and the crew will scan it, map its structure,
          and be ready to decompose your plans into trackable tickets.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%', maxWidth: 340 }}>
        <button
          onClick={onAddProject}
          style={{
            width: '100%',
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            letterSpacing: '0.06em',
            background: '#f59e0b',
            color: '#0a0a14',
            border: 'none',
            padding: '14px 24px',
            borderRadius: 8,
            cursor: 'pointer',
            boxShadow: '0 0 28px rgba(245,158,11,0.4)',
          }}
        >
          + CONNECT A REPO
        </button>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
          We&#39;ll create a <code style={{ color: 'var(--text-secondary)' }}>.repomind/</code> folder in your repo
          to store tickets, architecture maps, and release notes — all in Git.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', maxWidth: 480, marginTop: 8 }}>
        {[
          { agent: 'SCOUT', color: '#22c55e', desc: 'Scans repo structure' },
          { agent: 'SPARKY', color: '#f59e0b', desc: 'Decomposes your plans' },
          { agent: 'PATCH', color: '#14b8a6', desc: 'Watches commits' },
        ].map(({ agent, color, desc }) => (
          <div key={agent} style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '14px 12px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color, letterSpacing: '0.08em', marginBottom: 4 }}>{agent}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
