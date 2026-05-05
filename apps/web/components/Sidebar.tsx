import { useState } from 'react'
import { motion } from 'framer-motion'
import { MascotSprite } from '@/components/mascots/MascotSprite'
import type { AgentName } from '@/lib/types'
import { Settings as SettingsIcon } from 'lucide-react'

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
  { id: 'kanban',       label: 'KANBAN',       agent: 'SPARKY', agentColor: 'var(--agent-sparky)' },
  { id: 'suggestions',  label: 'SUGGESTIONS',  agent: 'PATCH',  agentColor: 'var(--agent-patch)' },
  { id: 'architecture', label: 'ARCHITECTURE', agent: 'SAGE',   agentColor: 'var(--agent-sage)' },
  { id: 'releases',     label: 'RELEASES',     agent: 'NOVA',   agentColor: 'var(--agent-nova)' },
  { id: 'chat',         label: 'Q&A',          agent: 'LYRA',   agentColor: 'var(--agent-lyra)' },
  { id: 'scout',        label: 'SECURITY',     agent: 'SCOUT',  agentColor: 'var(--agent-scout)' },
]
export function Sidebar({ active, onSelect, suggestionCount = 0, agentNames = {} }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const items = BASE_ITEMS.map(i => ({
    ...i,
    badge: i.id === 'suggestions' && suggestionCount > 0 ? suggestionCount : undefined,
  }))

  return (
    <div className={`transition-all duration-500 border-r border-[var(--border)] bg-glass/40 flex flex-col flex-none h-full relative ${isCollapsed ? 'w-20' : 'w-48'} hidden md:flex`}>
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-[var(--surface)] border border-[var(--border)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--brand)] z-50 shadow-xl transition-all hover:scale-110 active:scale-95"
      >
        <div className={`transition-transform duration-500 ${isCollapsed ? 'rotate-180' : ''}`}>
          <SettingsIcon size={12} />
        </div>
      </button>

      {/* Sidebar Edge Glow */}
      <div className="absolute right-0 top-0 w-[1px] h-full bg-gradient-to-b from-transparent via-[var(--brand)]/20 to-transparent" />

      <div className="flex-1 pt-4 overflow-y-auto scrollbar-hide space-y-0.5 px-2">
        {items.map(item => {
          const isActive = active === item.id
          const displayLabel = agentNames[item.agent] ?? item.label
          return (
            <motion.button
              key={item.id}
              whileHover={{ x: 2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-left transition-all relative group
                ${isActive ? 'bg-[var(--surface)] shadow-lg ring-1 ring-[var(--border-hover)]' : 'hover:bg-[var(--surface)]/30 opacity-60 hover:opacity-100'}
              `}
            >
              {isActive && (
                <motion.div 
                  layoutId="sidebar-indicator"
                  className="absolute -left-1 w-2 h-1/2 rounded-full blur-[2px]"
                  style={{ background: item.agentColor, boxShadow: `0 0 12px ${item.agentColor}` }}
                />
              )}
              
              <div className="flex-none transition-transform duration-500 group-hover:scale-110">
                <MascotSprite name={item.agent} state={isActive ? 'working' : 'idle'} w={26} h={39} />
              </div>
              
              <div className={`flex-1 min-w-0 transition-all duration-500 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
                <div 
                  className="font-[var(--font-display)] text-xs tracking-widest font-black transition-colors"
                  style={{ color: isActive ? item.agentColor : 'var(--text-muted)' }}
                >
                  {item.agent}
                </div>
                <div className={`
                  font-[var(--font-mono)] text-[9px] truncate mt-1 font-bold uppercase tracking-tighter transition-all
                  ${isActive ? 'text-[var(--text-primary)] opacity-100' : 'text-[var(--text-muted)] opacity-40'}
                `}>
                  {displayLabel}
                </div>
              </div>
              
              {item.badge && (
                <div className="absolute top-2 right-2">
                   <div className="bg-[var(--agent-patch)] text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center text-[8px] font-black font-[var(--font-mono)] shadow-lg animate-pulse ring-4 ring-[var(--agent-patch)]/20">
                    {item.badge}
                  </div>
                </div>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
