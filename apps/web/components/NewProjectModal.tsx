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
  onClose: () => void
  onCreated: (project: Project) => void
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function NewProjectModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [repo, setRepo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slug = slugify(name)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !repo.trim()) return
    if (!repo.includes('/')) {
      setError('Repo must be in owner/repo format')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), repo_full: repo.trim(), slug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create project')
      onCreated(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = !loading && name.trim().length > 0 && repo.trim().length > 0

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
        width: 480,
        background: 'var(--panel)',
        border: '1px solid var(--border-hover)',
        borderRadius: 16,
        padding: 32,
        zIndex: 61,
        boxShadow: 'var(--shadow-modal)',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: 24 }}>
          NEW PROJECT
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Project Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Awesome App"
              autoFocus
              style={{
                width: '100%',
                background: 'var(--void)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {slug && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                slug: {slug}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              GitHub Repo
            </label>
            <input
              value={repo}
              onChange={e => setRepo(e.target.value)}
              placeholder="owner/repo"
              style={{
                width: '100%',
                background: 'var(--void)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                letterSpacing: '0.06em',
                background: canSubmit ? '#f59e0b' : '#1a1430',
                color: canSubmit ? '#1a0e00' : 'var(--text-muted)',
                border: 'none',
                padding: '10px 22px',
                borderRadius: 6,
                cursor: canSubmit ? 'pointer' : 'default',
                flex: 1,
                boxShadow: canSubmit ? '0 0 24px rgba(245,158,11,0.4)' : 'none',
                transition: 'all 220ms var(--ease-snap)',
              }}
            >
              {loading ? 'CREATING…' : 'CREATE PROJECT'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                padding: '10px 16px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              CANCEL
            </button>
          </div>
        </form>

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
