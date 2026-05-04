'use client'
import type { AmdMetrics, LogEntry } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  metrics: AmdMetrics
  log: LogEntry[]
}

export function AmdMetricsPanel({ open, onClose, metrics, log }: Props) {
  if (!open) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,14,0.7)', backdropFilter: 'blur(8px)', zIndex: 50 }}
      />
      <div style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: 380,
        background: 'var(--panel)',
        borderLeft: '1px solid var(--border)',
        zIndex: 51,
        padding: 24,
        overflowY: 'auto',
        animation: 'slideleft 280ms var(--ease-snap)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ed1c24', boxShadow: '0 0 10px #ed1c24', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>AMD DEVELOPER CLOUD</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 24 }}>MI300X · ROCm 7.2 · vLLM 0.17.1</div>

        <Section title={`MODEL · ${process.env.NEXT_PUBLIC_GPU_MODEL ?? 'Qwen2.5-72B-Instruct'}`}>
          <Row k="STATUS" v={<span style={{ color: '#22c55e' }}>● ONLINE</span>} />
          <Row k="GPU CACHE" v={metrics.gpu === 0 ? '—' : `${metrics.gpu}%`} />
          <BigStat n={metrics.tokSec === 0 ? '—' : metrics.tokSec.toLocaleString()} u="tok/sec" />
          <Row k="AVG TTFT" v={metrics.embedMs === 0 ? '—' : `${metrics.embedMs}ms`} />
        </Section>

        <Section title="ACTIVE AGENTS">
          {(['SPARKY', 'PATCH', 'SAGE', 'NOVA', 'LYRA', 'SCOUT'] as const).map(agent => (
            <Row key={agent} k={agent} v={<span style={{ color: '#22c55e' }}>● AMD GPU</span>} />
          ))}
        </Section>

        <Section title="AMD IMPACT">
          <Row k="GPU" v="MI300X · 192GB VRAM" />
          <Row k="FRAMEWORK" v="vLLM 0.17.1 + ROCm 7.2" />
          <Row k="AGENTS SERVED" v="6 / 6" />
          <Row k="VS CLOUD API" v={<span style={{ color: '#22c55e' }}>∞ req/day</span>} />
        </Section>

        <Section title="Live log">
          <div style={{ background: 'var(--void)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, maxHeight: 180, overflowY: 'auto' }}>
            {log.map((l, i) => (
              <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-code)', lineHeight: 1.6 }}>
                <span style={{ color: 'var(--text-muted)' }}>[{l.time}]</span> {l.msg}
              </div>
            ))}
          </div>
        </Section>

        <button
          onClick={onClose}
          style={{
            marginTop: 18,
            width: '100%',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            padding: 10,
            borderRadius: 6,
            cursor: 'pointer',
            letterSpacing: '0.1em',
          }}
        >
          CLOSE
        </button>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</span>
      <span style={{ color: 'var(--text-primary)' }}>{v}</span>
    </div>
  )
}

function BigStat({ n, u }: { n: string; u: string }) {
  return (
    <div style={{ marginTop: 4 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: 'var(--text-primary)', lineHeight: 1 }}>{n}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{u}</span>
    </div>
  )
}
