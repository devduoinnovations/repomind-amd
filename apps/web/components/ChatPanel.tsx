'use client'
import { useState, useRef, useEffect } from 'react'
import { MascotSprite } from './mascots/MascotSprite'

interface Message { role: 'user' | 'assistant'; content: string }
interface Props { projectId: string | null }

export function ChatPanel({ projectId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading || !projectId) return
    setInput('')
    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', content: data.reply ?? data.error ?? 'Error' }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Network error. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <MascotSprite name="LYRA" state={loading ? 'working' : 'idle'} w={32} h={48} />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#60a5fa', letterSpacing: '0.04em' }}>LYRA</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>RAG · CODEBASE Q&A</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, opacity: 0.6 }}>
            <MascotSprite name="LYRA" state="idle" w={80} h={120} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              {projectId ? 'Ask LYRA anything about this codebase.' : 'Select a project first.'}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              lineHeight: 1.6,
              background: m.role === 'user' ? 'rgba(245,158,11,0.1)' : 'var(--surface)',
              border: `1px solid ${m.role === 'user' ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '10px 14px',
              maxWidth: '75%',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#60a5fa' }}>
              LYRA is thinking▊
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px', display: 'flex', gap: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={projectId ? 'Ask about this codebase…' : 'Select a project first'}
          disabled={!projectId || loading}
          style={{
            flex: 1,
            background: 'var(--void)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={!projectId || loading || !input.trim()}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            letterSpacing: '0.06em',
            background: (!projectId || loading || !input.trim()) ? 'var(--surface)' : '#60a5fa',
            color: (!projectId || loading || !input.trim()) ? 'var(--text-muted)' : '#0a0a14',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 6,
            cursor: (!projectId || loading || !input.trim()) ? 'default' : 'pointer',
          }}
        >
          ASK
        </button>
      </div>
    </div>
  )
}
