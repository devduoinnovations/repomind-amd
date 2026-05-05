'use client'
import { motion } from 'framer-motion'
import { MascotSprite } from './mascots/MascotSprite'
import { Rocket, Shield, Zap } from 'lucide-react'

interface Props {
  onAddProject: () => void
}

export function OnboardingEmpty({ onAddProject }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden bg-grid">
      {/* Background Decorative Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--brand)]/5 rounded-full blur-[120px] animate-pulse" />
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 text-center max-w-2xl"
      >
        <div className="mb-10 flex justify-center">
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-[var(--brand)] blur-3xl opacity-20 scale-150" />
            <MascotSprite name="SPARKY" state="idle" w={160} h={240} />
          </motion.div>
        </div>

        <h1 className="font-[var(--font-display)] text-7xl tracking-tighter text-[var(--text-primary)] mb-4 drop-shadow-2xl">
          REPO<span className="text-gradient">MIND</span>
        </h1>
        
        <p className="font-[var(--font-ui)] text-xl text-[var(--text-secondary)] mb-10 leading-relaxed font-medium">
          The ultimate AI workforce for your repositories. <br />
          Map, architect, and deploy with <span className="text-[var(--brand)] font-bold">AMD MI300X</span> precision.
        </p>

        <div className="flex flex-col items-center gap-6">
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(88, 166, 255, 0.4)' }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddProject}
            className="group relative px-14 py-5 bg-[var(--brand)] text-white rounded-[var(--radius-xl)] font-[var(--font-display)] text-2xl tracking-[0.2em] shadow-2xl transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <span className="relative z-10 flex items-center gap-4">
              <Rocket size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              CONNECT YOUR REPO
            </span>
          </motion.button>
          
          <div className="font-[var(--font-mono)] text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.3em] font-black flex items-center gap-4">
            <div className="w-12 h-[1px] bg-[var(--border-hover)]" />
            NO CREDIT CARD REQUIRED
            <div className="w-12 h-[1px] bg-[var(--border-hover)]" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-20">
          {[
            { agent: 'SCOUT', icon: <Shield size={16} />, color: 'var(--agent-scout)', desc: 'Architectural Analysis' },
            { agent: 'SPARKY', icon: <Zap size={16} />, color: 'var(--agent-sparky)', desc: 'Plan Decomposition' },
            { agent: 'PATCH', icon: <Rocket size={16} />, color: 'var(--agent-patch)', desc: 'Autonomous Fixes' },
          ].map(({ agent, icon, color, desc }, i) => (
            <motion.div
              key={agent}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="p-6 bg-glass border border-[var(--border-hover)]/30 rounded-2xl flex flex-col items-center text-center group hover:border-[var(--brand)]/40 transition-all cursor-default shadow-lg"
            >
              <div className="mb-3 p-2 rounded-lg transition-transform duration-500 group-hover:scale-110" style={{ color }}>{icon}</div>
              <div className="font-[var(--font-display)] text-xl tracking-widest mb-1" style={{ color }}>{agent}</div>
              <div className="font-[var(--font-mono)] text-[9px] text-[var(--text-primary)] font-black uppercase tracking-widest opacity-80">{desc}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
