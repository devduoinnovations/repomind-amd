'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { TeamPanel } from '@/components/TeamPanel'

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name)
  }, [session])

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setProjects(data)
        if (data.length > 0) setSelectedProjectId(data[0].id)
      }
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Delete your account? This cannot be undone.')) return
    await fetch('/api/user', { method: 'DELETE' })
    signOut({ callbackUrl: '/login' })
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 24px', fontFamily: 'var(--font-mono)' }}>
      <h1 style={{ fontSize: 20, color: 'var(--text-primary)', marginBottom: 32, letterSpacing: '0.04em' }}>
        SETTINGS
      </h1>

      {/* Profile */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 16 }}>PROFILE</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Display Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>GitHub Account</label>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
              {session?.user?.email ?? '—'}
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              alignSelf: 'flex-start', padding: '8px 20px', background: 'rgba(96,165,250,0.2)',
              color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)',
              borderRadius: 6, cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em',
            }}
          >
            {saved ? 'SAVED ✓' : saving ? 'SAVING…' : 'SAVE CHANGES'}
          </button>
        </div>
      </section>

      {/* Team */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 16 }}>TEAM</h2>
        {projects.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No projects yet.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {projects.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)',
                    background: selectedProjectId === p.id ? 'rgba(96,165,250,0.2)' : 'var(--surface)',
                    color: selectedProjectId === p.id ? '#60a5fa' : 'var(--text-muted)',
                    border: `1px solid ${selectedProjectId === p.id ? 'rgba(96,165,250,0.4)' : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {selectedProjectId && <TeamPanel projectId={selectedProjectId} isOwner={true} />}
          </>
        )}
      </section>

      {/* Danger Zone */}
      <section>
        <h2 style={{ fontSize: 12, color: '#ef4444', letterSpacing: '0.08em', marginBottom: 16 }}>DANGER ZONE</h2>
        <button
          onClick={handleDeleteAccount}
          style={{
            padding: '8px 20px', background: 'rgba(239,68,68,0.1)',
            color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6, cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em',
          }}
        >
          DELETE ACCOUNT
        </button>
      </section>
    </div>
  )
}
