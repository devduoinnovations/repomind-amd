'use client'
import { useState, useEffect } from 'react'

interface Finding {
  id: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  file: string | null
  line: number | null
  description: string | null
  remediation: string | null
}

interface Props {
  projectId: string
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#6b7280',
}

export function ScoutPanel({ projectId }: Props) {
  const [findings, setFindings] = useState<Finding[]>([])
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFindings = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/repomind/scout`)
      const data = await res.json()
      setFindings(data.findings ?? [])
    } catch { /* ignore */ }
  }

  useEffect(() => { loadFindings() }, [projectId])

  const runScan = async () => {
    setScanning(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/repomind/scout`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Scan failed'); return }
      await loadFindings()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setScanning(false)
    }
  }

  const markResolved = async (findingId: string) => {
    await fetch(`/api/projects/${projectId}/repomind/scout`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findingId }),
    })
    setFindings(f => f.filter(x => x.id !== findingId))
  }

  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1

  return (
    <div style={{ padding: '0 24px 24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#22c55e', letterSpacing: '0.04em' }}>
            SCOUT
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.08em' }}>
            Security Sentinel · {process.env.NEXT_PUBLIC_GPU_MODEL ?? 'AMD MI300X'}
          </div>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
            padding: '8px 18px', border: '1px solid #22c55e', borderRadius: 6,
            background: scanning ? 'rgba(34,197,94,0.1)' : 'transparent',
            color: '#22c55e', cursor: scanning ? 'not-allowed' : 'pointer',
          }}
        >
          {scanning ? 'SCANNING...' : 'RUN SCAN'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(sev => (
          <div key={sev} style={{
            padding: '5px 12px', borderRadius: 6,
            border: `1px solid ${SEV_COLOR[sev]}`,
            background: counts[sev] > 0 ? `${SEV_COLOR[sev]}18` : 'transparent',
            fontFamily: 'var(--font-mono)', fontSize: 10, color: SEV_COLOR[sev],
            letterSpacing: '0.06em',
          }}>
            {sev}: {counts[sev]}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444', marginBottom: 16, padding: '8px 12px', border: '1px solid #ef444440', borderRadius: 6 }}>
          {error}
        </div>
      )}

      {scanning && (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#22c55e', letterSpacing: '0.06em' }}>
          SCOUT is scanning security-sensitive files on AMD GPU...
        </div>
      )}

      {!scanning && findings.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            No active vulnerabilities. Run a scan to check.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {findings.map(f => (
          <div key={f.id} style={{
            border: `1px solid ${SEV_COLOR[f.severity]}40`,
            borderLeft: `3px solid ${SEV_COLOR[f.severity]}`,
            borderRadius: 8, padding: 16, background: 'var(--panel)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px',
                  borderRadius: 4, background: `${SEV_COLOR[f.severity]}20`,
                  color: SEV_COLOR[f.severity], letterSpacing: '0.08em',
                }}>
                  {f.severity}
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)' }}>
                  {f.title}
                </span>
              </div>
              <button
                onClick={() => markResolved(f.id)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 8px', flexShrink: 0,
                  border: '1px solid var(--border)', borderRadius: 4,
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                RESOLVE
              </button>
            </div>
            {f.file && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                {f.file}{f.line ? `:${f.line}` : ''}
              </div>
            )}
            {f.description && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
                {f.description}
              </div>
            )}
            {f.remediation && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#22c55e', lineHeight: 1.5 }}>
                Fix: {f.remediation}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
