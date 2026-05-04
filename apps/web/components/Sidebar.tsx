'use client'
import { MascotSprite } from '@/components/mascots/MascotSprite'
import type { AgentName } from '@/lib/types'

export type SectionId = 'kanban' | 'suggestions' | 'architecture' | 'releases' | 'chat' | 'scout' | 'settings'

interface SidebarItem {
  id: SectionId
  label: string
  agent: AgentName
  agentColor: string
}

interface Props {
  active: SectionId
  onSelect: (id: SectionId) => void
  suggestionCount?: number
  agentNames?: Record<string, string>
}

const BASE_ITEMS: SidebarItem[] = [
  { id: 'kanban',       label: 'KANBAN',       agent: 'SPARKY', agentColor: '#f59e0b' },
  { id: 'suggestions',  label: 'SUGGESTIONS',  agent: 'PATCH',  agentColor: '#14b8a6' },
  { id: 'architecture', label: 'ARCHITECTURE', agent: 'SAGE',   agentColor: '#8b5cf6' },
  { id: 'releases',     label: 'RELEASES',     agent: 'NOVA',   agentColor: '#ec4899' },
  { id: 'chat',         label: 'Q&A',          agent: 'LYRA',   agentColor: '#60a5fa' },
  { id: 'scout',        label: 'SECURITY',     agent: 'SCOUT',  agentColor: '#22c55e' },
]

export function Sidebar({ active, onSelect, suggestionCount = 0, agentNames = {} }: Props) {
  const items = BASE_ITEMS.map(i => ({
    ...i,
    badge: i.id === 'suggestions' && suggestionCount > 0 ? suggestionCount : undefined,
  }))

  return (
    <div style={{
      width: 200, borderRight: '1px solid var(--border)', background: 'var(--panel)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%',
    }}>
      <div style={{ flex: 1, paddingTop: 8 }}>
        {items.map(item => {
          const isActive = active === item.id
          const displayLabel = agentNames[item.agent] ?? item.label
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: 'none', borderLeft: `2px solid ${isActive ? item.agentColor : 'transparent'}`,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <MascotSprite name={item.agent} state={isActive ? 'working' : 'idle'} w={24} h={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: isActive ? item.agentColor : 'var(--text-muted)', letterSpacing: '0.06em' }}>
                  {item.agent}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: 1 }}>
                  {displayLabel}
                </div>
              </div>
              {item.badge && (
                <span style={{ background: item.agentColor, color: '#fff', borderRadius: 999, padding: '1px 5px', fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => onSelect('settings')}
        style={{
          width: '100%', padding: '12px 14px', background: active === 'settings' ? 'rgba(255,255,255,0.05)' : 'transparent',
          border: 'none', borderTop: '1px solid var(--border)', borderLeft: `2px solid ${active === 'settings' ? '#60a5fa' : 'transparent'}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <span style={{ fontSize: 14 }}>&#9881;</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: active === 'settings' ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: '0.06em' }}>
          SETTINGS
        </span>
      </button>
    </div>
  )
}
