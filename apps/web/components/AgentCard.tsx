import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AgentState } from '@/lib/types'
import { MascotSprite } from './mascots/MascotSprite'

interface Props {
  agent: AgentState
  onClick: () => void
}

export function AgentCard({ agent, onClick }: Props) {
  const [hover, setHover] = useState(false)
  const { name, color, status, role, isAmd, voiceLine } = agent
  const working = status === 'working'
  const done = status === 'done'

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`
        relative overflow-hidden cursor-pointer group
        bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)]
        p-3 transition-all duration-500 card-shadow
        hover:border-[var(--brand)]/30
      `}
    >
      {/* Background Accent Gradient */}
      <div 
        className="absolute -inset-2 opacity-0 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none blur-xl"
        style={{ background: `radial-gradient(circle at 30% 30%, ${color}, transparent 70%)` }}
      />
      
      {/* Animated Edge Glow */}
      <div className="absolute top-0 left-0 w-1 h-full transition-all duration-500 group-hover:w-1.5" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />

      <div className="flex gap-2 items-center relative z-10 pl-1">
        <div className="flex-shrink-0 relative">
          <div className="absolute inset-0 bg-white/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          <MascotSprite name={name} state={working ? 'working' : 'idle'} w={40} h={60} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-[var(--font-display)] text-xl tracking-wider leading-none mb-0.5 drop-shadow-sm transition-transform duration-500 group-hover:translate-x-1" style={{ color }}>
            {name}
          </div>
          <div className="font-[var(--font-mono)] text-[8px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-black opacity-60">
            {role}
          </div>
          
          <div className="flex gap-1.5 items-center mt-2.5">
            <div className="relative">
              {working && (
                 <div className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ backgroundColor: color }} />
              )}
              <div 
                className={`w-2 h-2 rounded-full relative z-10 transition-all duration-500 ${working ? 'scale-110' : ''}`}
                style={{ 
                  background: working ? color : (done ? 'var(--success)' : 'var(--text-muted)'),
                  boxShadow: working ? `0 0 10px ${color}` : 'none'
                }}
              />
            </div>
            <span className={`
              font-[var(--font-mono)] text-[9px] uppercase tracking-[0.1em] font-black transition-colors duration-500
              ${working ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}
            `}>
              {status}
            </span>
            {isAmd && (
              <span className="ml-auto font-[var(--font-mono)] text-[7px] font-black text-[var(--amd-red)] border border-[var(--amd-red)]/40 rounded px-1 py-0.5 bg-[var(--amd-red)]/10 uppercase tracking-tighter whitespace-nowrap">
                AMD ROCm
              </span>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {hover && voiceLine && (
          <motion.div 
            initial={{ height: 0, opacity: 0, y: 5 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 5 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-[var(--border)] font-[var(--font-ui)] font-medium text-[11px] text-[var(--text-secondary)] leading-relaxed relative">
               <span className="absolute -top-2 left-2 bg-[var(--surface)] px-1 text-[8px] text-[var(--text-muted)] opacity-50 uppercase tracking-widest font-black">Thought</span>
               &ldquo;{voiceLine}&rdquo;
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
