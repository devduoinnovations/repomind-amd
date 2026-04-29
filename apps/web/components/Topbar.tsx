'use client'
import { useState } from 'react'

interface Project {
  id: string
  name: string
  repo_full: string
  slug?: string
  default_branch?: string | null
}

interface Props {
  gpu: number
  onAmdClick: () => void
  projects: Project[]
  selectedProject: Project | null
  onSelectProject: (p: Project) => void
  onAddProject: () => void
}

export function Topbar({ gpu, onAmdClick, projects, selectedProject, onSelectProject }: Props) {
  const [open, setOpen] = useState(false)

  const [owner, repo] = (selectedProject?.repo_full || 'select / project').split('/')

  return (
    <header style={{
      height: 64,
      flexShrink: 0,
      background: 'var(--panel)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 20,
      position: 'relative',
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="20" height="28" viewBox="0 0 32 48" fill="none">
          <path d="M16 4 L26 4 L20 22 L30 22 L14 48 L20 28 L10 28 Z" fill="#f59e0b" />
        </svg>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.06em', color: 'var(--text-primary)' }}>REPOMIND</div>
      </div>

      {/* Project selector */}
      <div style={{ position: 'relative' }}>
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'var(--surface)',
            border: `1px solid ${open ? 'var(--border-hover)' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            userSelect: 'none',
            minWidth: 180,
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>{owner} /</span>
          <span>{repo || 'select project'}</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>▾</span>
        </div>

        {open && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'var(--panel)',
            border: '1px solid var(--border-hover)',
            borderRadius: 8,
            overflow: 'hidden',
            minWidth: 240,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 200,
          }}>
            {projects.length === 0 ? (
              <div style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                No projects yet
              </div>
            ) : (
              projects.map(p => (
                <div
                  key={p.id}
                  onClick={() => { onSelectProject(p); setOpen(false) }}
                  style={{
                    padding: '10px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    cursor: 'pointer',
                    background: selectedProject?.id === p.id ? 'rgba(245,158,11,0.08)' : 'transparent',
                    borderLeft: selectedProject?.id === p.id ? '2px solid #f59e0b' : '2px solid transparent',
                  }}
                  onMouseEnter={e => { if (selectedProject?.id !== p.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)' }}
                  onMouseLeave={e => { if (selectedProject?.id !== p.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{p.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{p.repo_full}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onAmdClick}
          style={{
            background: 'var(--panel)',
            border: '1px solid rgba(237,28,36,0.4)',
            borderRadius: 999,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ed1c24', boxShadow: '0 0 8px #ed1c24' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em' }}>GPU {gpu}% · MI300X · ROCm</span>
        </button>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#ec4899)', border: '1px solid var(--border-hover)' }} />
      </div>
    </header>
  )
}
