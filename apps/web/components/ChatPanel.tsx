'use client'
import { useState, useRef, useEffect } from 'react'
import { MascotSprite } from '@/components/mascots/MascotSprite'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  projectId: string | null
}

export function ChatPanel({ projectId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim() || !projectId || loading) return

    const userMsg: Message = { role: 'user', content: input.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      if (data.content) {
        setMessages(m => [...m, { role: 'assistant', content: data.content }])
      } else {
        setMessages(m => [...m, { role: 'assistant', content: `Error: ${data.error || 'Unknown error'}` }])
      }
    } catch (err: any) {
      setMessages(m => [...m, { role: 'assistant', content: `Network error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  if (!projectId) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <MascotSprite name="LYRA" state="idle" w={160} h={240} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>SELECT A PROJECT</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>LYRA needs a codebase to search</div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <MascotSprite name="LYRA" state={loading ? 'working' : 'idle'} w={32} h={48} />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#60a5fa', letterSpacing: '0.04em' }}>LYRA</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>RAG · CODEBASE Q&A</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 40, letterSpacing: '0.06em' }}>
            Ask LYRA anything about your codebase
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            background: m.role === 'user' ? 'rgba(96,165,250,0.15)' : 'var(--surface)',
            border: `1px solid ${m.role === 'user' ? 'rgba(96,165,250,0.3)' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '10px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{
            alignSelf: 'flex-start',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: '#60a5fa',
          }}>
            LYRA is searching...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about your codebase..."
          style={{
            flex: 1,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '8px 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          style={{
            background: '#60a5fa',
            color: '#0a0a14',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            letterSpacing: '0.06em',
            cursor: 'pointer',
            opacity: (!input.trim() || loading) ? 0.4 : 1,
          }}
        >
          SEND
        </button>
      </div>
    </div>
  )
}
