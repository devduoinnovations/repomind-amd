'use client'
import React, { useState, useEffect } from 'react'
import { MascotSprite } from '@/components/mascots/MascotSprite'

interface Release {
  id: string
  version: string
  title: string
  summary: string
  status: 'draft' | 'published'
  created_at: string
}

interface Props {
  projectId: string | null
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '6px 10px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
}

const primaryBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
  background: '#ec4899',
  color: '#0a0a14',
  border: 'none',
  padding: '6px 14px',
  borderRadius: 4,
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  padding: '6px 14px',
  borderRadius: 4,
  cursor: 'pointer',
}

export function ReleasesPanel({ projectId }: Props) {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [selected, setSelected] = useState<Release | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ version: '', title: '', summary: '' })
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!projectId || !form.version || !form.title) return
    setCreating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const r = await res.json()
        setReleases(prev => [r, ...prev])
        setShowForm(false)
        setForm({ version: '', title: '', summary: '' })
      }
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    fetch(`/api/projects/${projectId}/releases`)
      .then(r => r.json())
      .then(d => {
        setReleases(Array.isArray(d) ? d : [])
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load releases')
        setLoading(false)
      })
  }, [projectId])

  const handlePublish = async (releaseId: string) => {
    if (!projectId || publishing) return
    setPublishing(releaseId)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/releases/${releaseId}/publish`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      setReleases(r => r.map(x => x.id === releaseId ? { ...x, status: 'published' } : x))
      setSelected(s => s?.id === releaseId ? { ...s, status: 'published' } : s)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPublishing(null)
    }
  }

  if (!projectId) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <MascotSprite name="NOVA" state="idle" w={160} h={240} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>SELECT A PROJECT</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>NOVA needs a repo to manage releases</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>NOVA is loading releases...</div>
      </div>
    )
  }

  if (releases.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <MascotSprite name="NOVA" state="idle" w={160} h={240} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>NO RELEASES YET</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          NOVA will draft changelogs when PRs are merged
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            background: 'transparent',
            color: '#ec4899',
            border: '1px solid #ec4899',
            padding: '6px 14px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          + NEW RELEASE
        </button>
        {showForm && (
          <div style={{
            width: '100%',
            maxWidth: 400,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ec4899', letterSpacing: '0.06em' }}>NEW RELEASE</div>
            <input
              placeholder="VERSION (e.g. v1.2.0)"
              value={form.version}
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              style={inputStyle}
            />
            <input
              placeholder="TITLE"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={inputStyle}
            />
            <textarea
              placeholder="SUMMARY"
              value={form.summary}
              onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCreate} disabled={creating} style={primaryBtnStyle}>
                {creating ? 'CREATING...' : 'CREATE'}
              </button>
              <button onClick={() => { setShowForm(false); setForm({ version: '', title: '', summary: '' }) }} style={cancelBtnStyle}>
                CANCEL
              </button>
            </div>
          </div>
        )}
        {error && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444' }}>{error}</div>}
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      {/* List */}
      <div style={{ width: 260, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MascotSprite name="NOVA" state="idle" w={24} h={36} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: '#ec4899', letterSpacing: '0.04em' }}>NOVA · RELEASES</div>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.06em',
              background: 'transparent',
              color: '#ec4899',
              border: '1px solid #ec4899',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            + NEW
          </button>
        </div>
        {showForm && (
          <div style={{
            padding: 16,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            flexShrink: 0,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ec4899', letterSpacing: '0.06em' }}>NEW RELEASE</div>
            <input
              placeholder="VERSION (e.g. v1.2.0)"
              value={form.version}
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              style={inputStyle}
            />
            <input
              placeholder="TITLE"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={inputStyle}
            />
            <textarea
              placeholder="SUMMARY"
              value={form.summary}
              onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCreate} disabled={creating} style={primaryBtnStyle}>
                {creating ? 'CREATING...' : 'CREATE'}
              </button>
              <button onClick={() => { setShowForm(false); setForm({ version: '', title: '', summary: '' }) }} style={cancelBtnStyle}>
                CANCEL
              </button>
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {releases.map(r => (
            <div
              key={r.id}
              onClick={() => setSelected(r)}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: selected?.id === r.id ? 'rgba(236,72,153,0.08)' : 'transparent',
                borderLeft: selected?.id === r.id ? '2px solid #ec4899' : '2px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{r.version}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.06em',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: r.status === 'published' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: r.status === 'published' ? '#10b981' : '#f59e0b',
                }}>
                  {r.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.title}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>{selected.title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                {selected.version} · {new Date(selected.created_at).toLocaleDateString()}
              </div>
            </div>
            {selected.status === 'draft' && (
              <button
                onClick={() => handlePublish(selected.id)}
                disabled={publishing === selected.id}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 12,
                  letterSpacing: '0.08em',
                  background: publishing === selected.id ? 'var(--surface)' : '#ec4899',
                  color: publishing === selected.id ? 'var(--text-muted)' : '#0a0a14',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: publishing === selected.id ? 'default' : 'pointer',
                  boxShadow: publishing === selected.id ? 'none' : '0 0 16px rgba(236,72,153,0.4)',
                }}
              >
                {publishing === selected.id ? 'PUBLISHING...' : 'PUBLISH'}
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {selected.summary}
          </div>
          {error && <div style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444' }}>{error}</div>}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Select a release to view</div>
        </div>
      )}
    </div>
  )
}
