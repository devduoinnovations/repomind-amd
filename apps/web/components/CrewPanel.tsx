'use client'
import type { AgentState, AmdMetrics, ActivityEvent, AgentName } from '@/lib/types'
import { AgentCard } from './AgentCard'
import { Activity, Cpu, Microchip } from 'lucide-react'

interface Props {
  agents: AgentState[]
  amdMetrics: AmdMetrics
  activityFeed: ActivityEvent[]
  onAgentClick: (name: AgentName) => void
  onAmdClick: () => void
}

export function CrewPanel({ agents, amdMetrics, activityFeed, onAgentClick, onAmdClick }: Props) {
  return (
    <aside className="w-[240px] shrink-0 h-full bg-glass/60 border-l border-[var(--border)] overflow-y-auto scrollbar-hide relative z-10 flex flex-col">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />

      {/* Crew Section */}
      <div className="p-4 flex flex-col gap-3 relative z-10">
        <div className="flex items-center gap-2 mb-2">
           <Activity size={12} className="text-[var(--brand)]" />
           <div className="font-[var(--font-mono)] text-[9px] tracking-[0.2em] font-black text-[var(--text-muted)] uppercase">The Crew</div>
        </div>
        {agents.map(a => (
          <AgentCard key={a.name} agent={a} onClick={() => onAgentClick(a.name)} />
        ))}
      </div>

      <div className="flex-1" />

      {/* AMD Metrics Section */}
      <div 
        className="p-4 border-t border-[var(--border)] cursor-pointer hover:bg-[var(--surface)]/50 transition-colors group relative z-10"
        onClick={onAmdClick}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--amd-red)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--amd-red)] shadow-[0_0_8px_var(--amd-red)]"></span>
          </div>
          <span className="font-[var(--font-mono)] text-[9px] tracking-[0.15em] font-black text-[var(--text-primary)]">AMD MI300X · ROCm</span>
        </div>
        
        <Bar label="GPU" value={amdMetrics.gpu} color="var(--amd-red)" />
        <Bar label="MEM" value={amdMetrics.mem} color="var(--agent-sage)" />
        
        <div className="flex gap-4 mt-4">
          <Stat n={amdMetrics.tokSec.toLocaleString()} label="tok/sec" />
          <Stat n={amdMetrics.embedMs} unit="ms" label="embed" />
        </div>
      </div>

      {/* Activity Feed */}
      <div className="p-4 border-t border-[var(--border)] relative z-10 bg-[var(--void)]/30">
        <div className="flex items-center gap-2 mb-4">
           <Microchip size={12} className="text-[var(--text-muted)]" />
           <div className="font-[var(--font-mono)] text-[9px] tracking-[0.2em] font-black text-[var(--text-muted)] uppercase">Activity Log</div>
        </div>
        <div className="flex flex-col gap-3">
          {activityFeed.slice(0, 5).map((e, i) => (
            <div key={i} className={`flex gap-2.5 items-start ${i === 0 ? 'opacity-100' : 'opacity-60'} transition-opacity hover:opacity-100`}>
              <span 
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 transition-all duration-500"
                style={{ background: e.color, boxShadow: i === 0 ? `0 0 8px ${e.color}` : 'none' }} 
              />
              <span className="font-[var(--font-mono)] text-[9px] font-bold text-[var(--text-primary)] flex-1 leading-relaxed tracking-tighter">
                {e.agent
                  ? <><span style={{ color: e.color }}>{e.agent}</span> {e.detail}</>
                  : e.text
                }
              </span>
              <span className="font-[var(--font-mono)] text-[8px] text-[var(--text-muted)] font-black uppercase tracking-widest pt-0.5 shrink-0">{e.ago}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-2.5 group/bar">
      <div className="flex justify-between items-end mb-1">
        <span className="font-[var(--font-mono)] text-[8px] font-black text-[var(--text-muted)] tracking-widest uppercase">{label}</span>
        <span className="font-[var(--font-mono)] text-[9px] font-bold text-[var(--text-secondary)]">{value === 0 ? '—' : `${value}%`}</span>
      </div>
      <div className="h-1 bg-[var(--void)] rounded-full overflow-hidden shadow-inner">
        <div 
          className="h-full transition-all duration-700 ease-out rounded-full"
          style={{ width: `${value}%`, background: color, boxShadow: `0 0 10px ${color}` }} 
        />
      </div>
    </div>
  )
}

function Stat({ n, unit, label }: { n: string | number; unit?: string; label: string }) {
  return (
    <div className="flex-1">
      <div className="font-[var(--font-display)] text-xl tracking-wider text-[var(--text-primary)] leading-none flex items-baseline gap-1">
        {(n === 0 || n === '0') ? '—' : n}
        {unit && <span className="text-[9px] font-[var(--font-mono)] font-bold text-[var(--text-muted)] uppercase tracking-widest">{unit}</span>}
      </div>
      <div className="font-[var(--font-mono)] text-[7px] text-[var(--text-muted)] tracking-[0.2em] uppercase mt-1 font-black opacity-60">{label}</div>
    </div>
  )
}
