'use client'
import type { AgentState, AmdMetrics, ActivityEvent, AgentName } from '@/lib/types'
import { AgentCard } from './AgentCard'

interface Props {
  agents: AgentState[]
  amdMetrics: AmdMetrics
  activityFeed: ActivityEvent[]
  onAgentClick: (name: AgentName) => void
  onAmdClick: () => void
}

export function CrewPanel({ agents, amdMetrics, activityFeed, onAgentClick, onAmdClick }: Props) {
  return (
    <aside style={{
      width: 240,
      flexShrink: 0,
      height: '100%',
      background: 'var(--panel)',
      borderRight: '1px solid var(--border)',
      overflowY: 'auto',
      position: 'relative',
      backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px)',
    }}>
      {/* Crew */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>The Crew</div>
        {agents.map(a => (
          <AgentCard key={a.name} agent={a} onClick={() => onAgentClick(a.name)} />
        ))}
      </div>

      {/* AMD Metrics */}
      <div style={{ padding: 14, borderTop: '1px solid var(--border)', cursor: 'pointer' }} onClick={onAmdClick}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ed1c24', boxShadow: '0 0 8px #ed1c24', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-primary)' }}>AMD MI300X · ROCm</span>
        </div>
        <Bar label="GPU" value={amdMetrics.gpu} color="#ed1c24" />
        <Bar label="MEM" value={amdMetrics.mem} color="#8b5cf6" />
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          <Stat n={amdMetrics.tokSec.toLocaleString()} label="tok/sec" />
          <Stat n={amdMetrics.embedMs} unit="ms" label="embed" />
        </div>
      </div>

      {/* Activity Feed */}
      <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Activity</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activityFeed.slice(0, 5).map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: e.color, marginTop: 5, flexShrink: 0, boxShadow: i === 0 ? `0 0 6px ${e.color}` : 'none' }} />
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-primary)', flex: 1, lineHeight: 1.4 }}
                dangerouslySetInnerHTML={{ __html: e.text }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{e.ago}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)' }}>{value}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--void)', borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, transition: 'width 600ms var(--ease-snap)' }} />
      </div>
    </div>
  )
}

function Stat({ n, unit, label }: { n: string | number; unit?: string; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', lineHeight: 1 }}>
        {n}{unit && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
    </div>
  )
}
