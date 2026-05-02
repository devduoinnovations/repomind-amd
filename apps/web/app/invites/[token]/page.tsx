'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function AcceptInvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params?.token as string
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) return
    fetch(`/api/invites/${token}`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (d.projectId) {
          setStatus('success')
          setMessage(`Joined project: ${d.projectName}`)
          setTimeout(() => router.push('/'), 2000)
        } else {
          setStatus('error')
          setMessage(d.error ?? 'Invalid invite')
        }
      })
      .catch(() => { setStatus('error'); setMessage('Failed to accept invite') })
  }, [token, router])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--font-mono)', flexDirection: 'column', gap: 12 }}>
      {status === 'loading' && <div style={{ color: 'var(--text-muted)' }}>Accepting invite…</div>}
      {status === 'success' && <div style={{ color: '#22c55e' }}>{message} — Redirecting…</div>}
      {status === 'error' && <div style={{ color: '#ef4444' }}>{message}</div>}
    </div>
  )
}
