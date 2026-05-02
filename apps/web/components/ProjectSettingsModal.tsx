'use client'
import { useState } from 'react'

interface Project { id: string; name: string; repo_full: string; default_branch?: string | null }
interface Props {
  project: Project
  onClose: () => void
  onUpdated: (p: Project) => void
  onDeleted: () => void
}

export function ProjectSettingsModal({ project, onClose, onUpdated, onDeleted }: Props) {
  const [name, setName] = useState(project.name)
  const [branch, setBranch] = useState(project.default_branch ?? 'main')
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, default_branch: branch }),
      })
      if (res.ok) { const data = await res.json(); onUpdated(data); onClose(); }
    } finally { setSaving(false) }
  }

  const rescan = async () => {
    setScanning(true)
    try {
      await fetch(`/api/projects/${project.id}/scan`, { method: 'POST' })
      onClose()
    } finally { setScanning(false) }
  }

  const deleteProject = async () => {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      onDeleted()
      onClose()
    } finally { setDeleting(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 28, width: 420, fontFamily: 'var(--font-mono)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 14, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>PROJECT SETTINGS</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PROJECT NAME</label>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>DEFAULT BRANCH</label>
            <input value={branch} onChange={e => setBranch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>REPO: {project.repo_full}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '8px', background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)', borderRadius: 6, cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em' }}>
            {saving ? 'SAVING…' : 'SAVE'}
          </button>
          <button onClick={rescan} disabled={scanning} style={{ flex: 1, padding: '8px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em' }}>
            {scanning ? 'SCANNING…' : 'RE-SCAN'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button onClick={deleteProject} disabled={deleting} style={{ width: '100%', padding: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em' }}>
            {deleting ? 'DELETING…' : 'DELETE PROJECT'}
          </button>
        </div>
      </div>
    </div>
  )
}
