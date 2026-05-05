'use client'
import { useState } from 'react'
import type { AgentState, AgentName } from '@/lib/types'
import { MascotSprite } from './mascots/MascotSprite'

interface Props {
  agentName: AgentName
  agents: AgentState[]
  onClose: () => void
  selectedProjectId?: string | null
  onScanComplete?: (result: { moduleCount: number; fileCount: number }) => void
}

export function AgentModal({ agentName, agents, onClose, selectedProjectId, onScanComplete }: Props) {
  const a = agents.find(x => x.name === agentName)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<{ moduleCount: number; fileCount: number } | null>(null)
  const [clicked, setClicked] = useState(false)

  if (!a) return null

  const isScout = a.name === 'SCOUT'

  const onMascotClick = () => {
    setClicked(true)
    setTimeout(() => setClicked(false), 300)
  }

  async function runScan() {
    if (!selectedProjectId || scanning) return
    setScanning(true)
    setScanError(null)
    setScanResult(null)
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/scan`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      
      // Poll for completion
      const interval = setInterval(async () => {
        try {
          const projRes = await fetch(`/api/projects/${selectedProjectId}`)
          if (!projRes.ok) return
          const projData = await projRes.json()
          const status = projData.config_cache?.scan_status

          if (status === 'idle') {
            clearInterval(interval)
            const moduleCount = projData.config_cache?.codebase?.module_graph?.modules?.length ?? 0
            const fileCount = projData.config_cache?.codebase?.file_count ?? 0
            setScanResult({ moduleCount, fileCount })
            onScanComplete?.({ moduleCount, fileCount })
            setScanning(false)
          } else if (status === 'error') {
            clearInterval(interval)
            setScanError('Background scan failed')
            setScanning(false)
          }
        } catch (e) {
          // ignore network error
        }
      }, 3000)
    } catch (err: any) {
      setScanError(err.message)
      setScanning(false)
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,14,0.8)', backdropFilter: 'blur(12px)', zIndex: 60 }}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 560,
        background: 'var(--panel)',
        border: `1px solid ${a.color}33`,
        borderRadius: 16,
        padding: 32,
        zIndex: 61,
        boxShadow: `var(--shadow-modal), 0 0 60px ${a.color}33`,
      }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <div onClick={onMascotClick} style={{ cursor: 'pointer' }}>
            <MascotSprite name={a.name} state="idle" w={140} h={210} clickEffect={clicked} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, color: a.color, letterSpacing: '0.02em', lineHeight: 0.9 }}>{a.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 4 }}>{a.role}</div>
            {isScout ? (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 18 }}>
                  SCOUT scans your repository, maps file relationships, and builds a module graph — enabling SPARKY to decompose plans accurately.
                </div>
                {scanResult ? (
                  <div style={{ background: `${a.color}12`, border: `1px solid ${a.color}33`, borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: a.color, marginBottom: 4 }}>Scan complete</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {scanResult.moduleCount} modules · {scanResult.fileCount} files indexed
                    </div>
                  </div>
                ) : scanError ? (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444' }}>
                    {scanError}
                  </div>
                ) : null}
                {selectedProjectId ? (
                  <button
                    onClick={runScan}
                    disabled={scanning}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 14,
                      letterSpacing: '0.06em',
                      background: scanning ? '#1a1430' : a.color,
                      color: scanning ? 'var(--text-muted)' : '#0a0a14',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: 6,
                      cursor: scanning ? 'default' : 'pointer',
                      boxShadow: scanning ? 'none' : `0 0 20px ${a.color}55`,
                      transition: 'all 220ms var(--ease-snap)',
                    }}
                  >
                    {scanning ? 'SCANNING…' : scanResult ? 'RESCAN' : 'SCAN NOW'}
                  </button>
                ) : (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    Select a project first to run a scan.
                  </div>
                )}
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 18, color: 'var(--text-secondary)', marginTop: 16, lineHeight: 1.4 }}>
                  &ldquo;{a.voiceLine}&rdquo;
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--surface)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)' }}>{a.model}</span>
                  {a.isAmd && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'rgba(237,28,36,0.12)', color: '#ed1c24', padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(237,28,36,0.4)' }}>⚙ AMD MI300X</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            padding: '6px 10px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          ESC
        </button>
      </div>
    </>
  )
}
