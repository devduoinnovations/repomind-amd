'use client'
import { useState, useEffect } from 'react'
import { MascotSprite } from '@/components/mascots/MascotSprite'

interface Suggestion {
  id: string
  ticket_id: string
  ticket_path: string
  commit_sha: string
  commit_message: string
  suggested_status: string
  confidence: number
  created_at: string
}

interface Props {
  projectId: string | null
  repoFull?: string | null
  onApproved?: () => void
}

export function SuggestionsPanel({ projectId, repoFull, onApproved }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [diffs, setDiffs] = useState<Record<string, string | null>>({})
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null)

  const loadSuggestions = () => {
    if (!projectId) return
    setLoading(true)
    fetch(`/api/projects/${projectId}/repomind/suggestions`)
      .then(r => r.json())
      .then(d => {
        setSuggestions(d.suggestions || [])
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load suggestions')
        setLoading(false)
      })
  }

  useEffect(() => {
    loadSuggestions()
  }, [projectId])

  const toggleDiff = async (s: Suggestion) => {
    if (expandedDiff === s.id) {
      setExpandedDiff(null)
      return
    }
    setExpandedDiff(s.id)
    if (s.id in diffs) return
    if (!repoFull || !s.commit_sha) {
      setDiffs(prev => ({ ...prev, [s.id]: null }))
      return
    }
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repoFull}/commits/${s.commit_sha}`,
        { headers: { Accept: 'application/vnd.github.diff' } }
      )
      if (!res.ok) {
        setDiffs(prev => ({ ...prev, [s.id]: null }))
        return
      }
      const text = await res.text()
      setDiffs(prev => ({ ...prev, [s.id]: text }))
    } catch {
      setDiffs(prev => ({ ...prev, [s.id]: null }))
    }
  }

  const handleApprove = async (sid: string) => {
    if (!projectId || actioning) return
    setActioning(sid)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/repomind/suggestions/${sid}`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      setSuggestions(s => s.filter(x => x.id !== sid))
      onApproved?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActioning(null)
    }
  }

  const handleRunPatch = async () => {
    if (!projectId || loading) return;
    setLoading(true);
    try {
      await fetch(`/api/projects/${projectId}/repomind/suggestions/generate`, { method: 'POST' });
      loadSuggestions();
    } catch {
      setError('PATCH scan failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (sid: string) => {
    if (!projectId || actioning) return
    setActioning(sid)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/repomind/suggestions/${sid}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      setSuggestions(s => s.filter(x => x.id !== sid))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActioning(null)
    }
  }

  const renderDiff = (diffText: string) => {
    return diffText.split('\n').map((line, i) => {
      let color: string | undefined
      if (line.startsWith('+') && !line.startsWith('+++')) color = '#22c55e'
      else if (line.startsWith('-') && !line.startsWith('---')) color = '#ef4444'
      return (
        <span key={i} style={{ color, display: 'block' }}>
          {line || ' '}
        </span>
      )
    })
  }

  if (!projectId) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <MascotSprite name="PATCH" state="idle" w={160} h={240} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>SELECT A PROJECT</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>PATCH needs a repo to watch commits</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>PATCH is scanning commits...</div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <MascotSprite name="PATCH" state={loading ? 'working' : 'idle'} w={32} h={48} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#14b8a6', letterSpacing: '0.04em' }}>PATCH</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            {suggestions.length} pending suggestions
          </div>
        </div>
        <button
          onClick={loadSuggestions}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            letterSpacing: '0.06em',
            background: 'rgba(20,184,166,0.1)',
            color: '#14b8a6',
            border: '1px solid rgba(20,184,166,0.3)',
            padding: '6px 12px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          REFRESH
        </button>
        <button
          onClick={handleRunPatch}
          disabled={loading}
          style={{
            fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.06em',
            background: 'rgba(20,184,166,0.2)', color: '#14b8a6',
            border: '1px solid rgba(20,184,166,0.4)', padding: '6px 12px',
            borderRadius: 6, cursor: loading ? 'default' : 'pointer', marginLeft: 8,
          }}
        >
          RUN PATCH
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444', borderBottom: '1px solid var(--border)' }}>
          {error}
        </div>
      )}

      {/* Suggestions list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {suggestions.length === 0 ? (
          <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <MascotSprite name="PATCH" state="idle" w={80} h={120} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '0.06em' }}>
              No pending suggestions —<br />PATCH is watching for commits
            </div>
          </div>
        ) : (
          suggestions.map(s => (
            <div
              key={s.id}
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                  {s.ticket_id}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'rgba(20,184,166,0.15)',
                  color: '#14b8a6',
                  letterSpacing: '0.06em',
                }}>
                  {s.confidence}% MATCH
                </span>
              </div>

              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                → <span style={{ color: '#14b8a6' }}>{s.suggested_status}</span>
              </div>

              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                `{s.commit_sha.slice(0, 7)}` {s.commit_message}
              </div>

              {repoFull && s.commit_sha && (
                <>
                  <button
                    onClick={() => toggleDiff(s)}
                    style={{
                      alignSelf: 'flex-start',
                      fontFamily: 'var(--font-display)',
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      padding: '3px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    {expandedDiff === s.id ? 'HIDE DIFF' : 'SHOW DIFF'}
                  </button>

                  {expandedDiff === s.id && (
                    <pre style={{
                      background: 'var(--void)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: 12,
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      overflowX: 'auto',
                      maxHeight: 200,
                      overflowY: 'auto',
                      whiteSpace: 'pre',
                      marginBottom: 8,
                    }}>
                      {!(s.id in diffs)
                        ? 'Loading diff...'
                        : diffs[s.id] === null
                          ? 'Diff unavailable'
                          : renderDiff(diffs[s.id]!)}
                    </pre>
                  )}
                </>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleApprove(s.id)}
                  disabled={actioning === s.id}
                  style={{
                    flex: 1,
                    fontFamily: 'var(--font-display)',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    background: actioning === s.id ? 'var(--surface)' : 'rgba(20,184,166,0.2)',
                    color: actioning === s.id ? 'var(--text-muted)' : '#14b8a6',
                    border: '1px solid rgba(20,184,166,0.4)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    cursor: actioning === s.id ? 'default' : 'pointer',
                  }}
                >
                  {actioning === s.id ? '...' : 'APPROVE'}
                </button>
                <button
                  onClick={() => handleReject(s.id)}
                  disabled={actioning === s.id}
                  style={{
                    flex: 1,
                    fontFamily: 'var(--font-display)',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    cursor: actioning === s.id ? 'default' : 'pointer',
                  }}
                >
                  REJECT
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
