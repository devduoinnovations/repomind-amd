'use client'
import { useState, useEffect, useRef } from 'react'
import { MascotSprite } from '@/components/mascots/MascotSprite'

interface ArchData {
  lastScanAt: string | null
  codebase: {
    module_graph?: { nodes: any[]; edges: any[] }
    summary?: string
    files?: number
    external_deps?: number
  } | null
}

interface Props {
  projectId: string | null
}

export function ArchitecturePanel({ projectId }: Props) {
  const [data, setData] = useState<ArchData | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const diagramRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!projectId) return
    fetch(`/api/projects/${projectId}/architecture`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError('Failed to load architecture data'))
  }, [projectId])

  useEffect(() => {
    if (!data?.codebase?.module_graph || !diagramRef.current) return
    renderDiagram(data.codebase.module_graph, diagramRef.current)
  }, [data])

  const renderDiagram = (graph: { nodes: any[]; edges: any[] }, el: HTMLDivElement) => {
    // Build a simple mermaid diagram string
    const lines = ['graph LR']
    graph.edges?.slice(0, 30).forEach((e: any) => {
      const from = (e.from || e.source || '').replace(/[^a-zA-Z0-9_]/g, '_')
      const to = (e.to || e.target || '').replace(/[^a-zA-Z0-9_]/g, '_')
      if (from && to) lines.push(`  ${from} --> ${to}`)
    })

    const mermaidText = lines.join('\n')

    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'dark', themeVariables: { primaryColor: '#8b5cf6', edgeLabelBackground: '#1a1a2e' } })
      mermaid.render('arch-diagram', mermaidText).then(({ svg }) => {
        el.innerHTML = svg
      }).catch(() => {
        el.innerHTML = `<pre style="color:var(--text-muted);font-size:10px;white-space:pre-wrap">${mermaidText}</pre>`
      })
    })
  }

  const handleScan = async () => {
    if (!projectId || scanning) return
    setScanning(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/scan`, { method: 'POST' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      // Reload arch data after scan
      const archRes = await fetch(`/api/projects/${projectId}/architecture`)
      setData(await archRes.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setScanning(false)
    }
  }

  if (!projectId) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <MascotSprite name="SAGE" state="idle" w={160} h={240} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>SELECT A PROJECT</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>SAGE needs a codebase to map</div>
      </div>
    )
  }

  if (!data?.codebase) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <MascotSprite name="SAGE" state={scanning ? 'working' : 'idle'} w={160} h={240} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
          {scanning ? 'SAGE IS SCANNING...' : 'NO SCAN YET'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          {scanning ? 'building module graph' : 'run a scan to map your architecture'}
        </div>
        {error && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444', textAlign: 'center', maxWidth: 400 }}>
            {error}
          </div>
        )}
        {!scanning && (
          <button
            onClick={handleScan}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              letterSpacing: '0.08em',
              background: '#8b5cf6',
              color: '#0a0a14',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 6,
              cursor: 'pointer',
              boxShadow: '0 0 24px rgba(139,92,246,0.4)',
            }}
          >
            SCAN CODEBASE
          </button>
        )}
      </div>
    )
  }

  const { codebase } = data

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <MascotSprite name="SAGE" state={scanning ? 'working' : 'idle'} w={32} h={48} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#8b5cf6', letterSpacing: '0.04em' }}>SAGE</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            {codebase.files ?? '?'} files · {codebase.external_deps ?? '?'} deps
            {data.lastScanAt && ` · scanned ${new Date(data.lastScanAt).toLocaleDateString()}`}
          </div>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            letterSpacing: '0.06em',
            background: scanning ? 'var(--surface)' : 'rgba(139,92,246,0.2)',
            color: scanning ? 'var(--text-muted)' : '#8b5cf6',
            border: '1px solid rgba(139,92,246,0.4)',
            padding: '6px 12px',
            borderRadius: 6,
            cursor: scanning ? 'default' : 'pointer',
          }}
        >
          {scanning ? 'SCANNING...' : 'RESCAN'}
        </button>
      </div>

      {/* Summary */}
      {codebase.summary && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, flexShrink: 0 }}>
          {codebase.summary}
        </div>
      )}

      {/* Module graph */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {error && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{error}</div>}
        <div ref={diagramRef} style={{ minHeight: 200 }} />
      </div>
    </div>
  )
}
