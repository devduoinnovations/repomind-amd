'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

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
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)

  const loadFindings = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/repomind/scout`)
      const data = await res.json()
      setFindings(data.findings ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFindings() }, [projectId])

  const runScan = async () => {
    setScanning(true)
    const scanId = toast.loading('SCOUT is scanning for vulnerabilities...')
    try {
      const res = await fetch(`/api/projects/${projectId}/repomind/scout`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')
      await loadFindings()
      toast.success('Security scan completed', { id: scanId })
    } catch (e: any) {
      toast.error(e.message, { id: scanId })
    } finally {
      setScanning(false)
    }
  }

  const markResolved = async (findingId: string) => {
    const resId = toast.loading('Marking as resolved...')
    try {
      await fetch(`/api/projects/${projectId}/repomind/scout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingId }),
      })
      setFindings(f => f.filter(x => x.id !== findingId))
      toast.success('Finding resolved', { id: resId })
    } catch (err: any) {
      toast.error('Failed to resolve finding', { id: resId })
    }
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


      {scanning && (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#22c55e', letterSpacing: '0.06em' }}>
          SCOUT is scanning security-sensitive files on AMD GPU...
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          Loading findings...
        </div>
      )}

      {!loading && !scanning && findings.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--void)', border: '1px dashed var(--border)', borderRadius: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 16, color: '#22c55e' }}>🛡️</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--text-primary)', marginBottom: 8 }}>
            NO VULNERABILITIES FOUND
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            SCOUT scans package configs, env files, and secrets. Run a scan to ensure your architecture is secure.
          </div>
          <button
            onClick={runScan}
            style={{
              fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.08em',
              padding: '10px 24px', border: 'none', borderRadius: 6,
              background: '#22c55e', color: '#04040e', cursor: 'pointer',
              boxShadow: '0 0 24px rgba(34,197,94,0.3)',
            }}
          >
            RUN SECURITY SCAN
          </button>
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
