'use client'
import { useState, useEffect } from 'react'

interface Member { id: string; user: { id: string; name: string; email: string; avatar_url?: string }; role: string }
interface Props { projectId: string; isOwner: boolean }

export function TeamPanel({ projectId, isOwner }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/projects/${projectId}/members`).then(r => r.json()).then(setMembers).catch(() => {})
  }, [projectId])

  const sendInvite = async () => {
    if (!inviteEmail) return
    setInviting(true); setError(''); setInviteLink('')
    try {
      const res = await fetch(`/api/projects/${projectId}/members/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      })
      const data = await res.json()
      if (res.ok) { setInviteLink(data.inviteUrl); setInviteEmail('') }
      else setError(data.error)
    } finally { setInviting(false) }
  }

  const removeMember = async (userId: string) => {
    await fetch(`/api/projects/${projectId}/members`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setMembers(m => m.filter(x => x.user.id !== userId))
  }

  return (
    <div style={{ fontFamily: 'var(--font-mono)' }}>
      <h3 style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 16 }}>TEAM MEMBERS</h3>

      {members.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>No team members yet.</div>
      )}

      {members.map(m => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{m.user?.name ?? m.user?.email}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.user?.email} · {m.role}</div>
          </div>
          {isOwner && (
            <button onClick={() => removeMember(m.user.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
              REMOVE
            </button>
          )}
        </div>
      ))}

      {isOwner && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 12 }}>INVITE</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="teammate@email.com"
              style={{ flex: 1, padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}
            />
            <button onClick={sendInvite} disabled={inviting} style={{ padding: '8px 16px', background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              {inviting ? '…' : 'INVITE'}
            </button>
          </div>
          {inviteLink && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#22c55e', wordBreak: 'break-all' }}>
              Invite link: {inviteLink}
            </div>
          )}
          {error && <div style={{ marginTop: 8, fontSize: 11, color: '#ef4444' }}>{error}</div>}
        </div>
      )}
    </div>
  )
}
