import { motion } from 'framer-motion'
import type { Ticket } from '@/lib/types'
import { AlertCircle, Clock, BarChart2 } from 'lucide-react'

const PRIORITY_COLORS: Record<string, string> = { 
  HIGH: 'text-[var(--danger)] bg-[var(--danger)]/10 border-[var(--danger)]/20', 
  MED:  'text-[var(--warning)] bg-[var(--warning)]/10 border-[var(--warning)]/20', 
  LOW:  'text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/20' 
}

const COMPLEXITY_COLORS: Record<string, string> = { 
  S:  'text-emerald-500 bg-emerald-500/10', 
  M:  'text-blue-500 bg-blue-500/10', 
  L:  'text-amber-500 bg-amber-500/10', 
  XL: 'text-rose-500 bg-rose-500/10' 
}

interface Props {
  ticket: Ticket
  flash: boolean
}

export function TicketCard({ ticket, flash }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className={`
        group relative mb-3 p-4 rounded-[var(--radius-md)] border transition-all duration-300
        ${flash ? 'bg-blue-500/5 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-[var(--surface)] border-[var(--border)] card-shadow hover:border-[var(--border-hover)]'}
      `}
      style={{
        borderLeft: `3px solid ${ticket.priority === 'HIGH' ? 'var(--danger)' : ticket.priority === 'MED' ? 'var(--warning)' : 'var(--success)'}`
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-[var(--font-mono)] text-[9px] text-[var(--text-muted)] tracking-wider">
            #{ticket.id.slice(-6).toUpperCase()}
          </span>
          <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-[var(--font-mono)] ${COMPLEXITY_COLORS[ticket.complexity] ?? 'bg-gray-500/10 text-gray-500'}`}>
            {ticket.complexity}
          </span>
        </div>
        <div className={`p-1 rounded-full ${ticket.priority === 'HIGH' ? 'text-[var(--danger)] animate-pulse' : 'text-[var(--text-muted)]'}`}>
          <AlertCircle size={12} />
        </div>
      </div>

      <div className="font-[var(--font-mono)] text-[13px] text-[var(--text-primary)] leading-relaxed mb-4 font-medium line-clamp-2 group-hover:line-clamp-none transition-all">
        {ticket.title}
      </div>

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--border)]">
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8px] font-bold font-[var(--font-mono)] ${PRIORITY_COLORS[ticket.priority]}`}>
          <BarChart2 size={10} />
          {ticket.priority}
        </div>
        
        <div className="flex items-center gap-1.5 text-[var(--text-muted)] font-[var(--font-mono)] text-[9px]">
          <Clock size={10} />
          {ticket.age}
        </div>
      </div>
    </motion.div>
  )
}
