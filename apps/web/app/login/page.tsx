'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MascotSprite } from '@/components/mascots/MascotSprite'
import { Github, Rocket, LogIn, UserPlus, Sparkles, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [handle, setHandle] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    try {
      await signIn('github', { callbackUrl: '/' })
    } catch (err) {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--void)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background FX */}
      <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[var(--brand)]/5 to-transparent pointer-events-none" />
      
      {/* Floating Orbs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
          x: [0, 50, 0],
          y: [0, 30, 0]
        }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute -top-20 -left-20 w-96 h-96 bg-[var(--brand)] rounded-full blur-[120px] pointer-events-none"
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.05, 0.15, 0.05],
          x: [0, -40, 0],
          y: [0, -20, 0]
        }}
        transition={{ duration: 8, repeat: Infinity, delay: 1 }}
        className="absolute -bottom-20 -right-20 w-80 h-80 bg-[var(--agent-nova)] rounded-full blur-[100px] pointer-events-none"
      />

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center gap-12">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-gradient-to-br from-[var(--brand)] to-[var(--agent-nova)] rounded-2xl flex items-center justify-center shadow-2xl">
               <div className="w-6 h-6 bg-[var(--surface)] rounded-full flex items-center justify-center border border-white/20">
                  <div className="w-3 h-3 bg-[var(--brand)] rounded-full animate-pulse shadow-[0_0_10px_var(--brand)]"></div>
               </div>
             </div>
             <h1 className="font-[var(--font-display)] text-5xl tracking-[0.2em] text-[var(--text-primary)]">REPOMIND</h1>
          </div>
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.4em] text-[var(--text-muted)] opacity-60 text-center">Architecting Repository Intelligence</p>
        </motion.div>

        {/* Dual Portal Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Sign Up Portal */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className={`
              relative group p-8 rounded-[var(--radius-xl)] bg-glass border border-[var(--border)]
              transition-all duration-500 hover:border-[var(--brand)]/40 hover:shadow-[0_0_50px_rgba(88,166,255,0.1)]
              flex flex-col gap-8
            `}
          >
            <div className="flex justify-between items-start">
               <div>
                 <h2 className="font-[var(--font-display)] text-3xl tracking-wider text-[var(--text-primary)] mb-2">INITIALIZE</h2>
                 <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Connect New Identity</p>
               </div>
               <div className="w-12 h-12 rounded-full bg-[var(--brand)]/10 flex items-center justify-center text-[var(--brand)] shadow-inner">
                 <UserPlus size={22} />
               </div>
            </div>

            <div className="space-y-4">
               <div className="space-y-2">
                 <label className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-[var(--text-muted)] ml-1">Desired System Handle</label>
                 <div className="relative">
                   <input 
                     type="text" 
                     placeholder="e.g. shaffan_01"
                     value={handle}
                     onChange={(e) => setHandle(e.target.value)}
                     className="w-full bg-[var(--void)]/50 border border-[var(--border)] rounded-xl px-4 py-3 font-[var(--font-mono)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10 transition-all placeholder:opacity-30"
                   />
                   <Sparkles size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--brand)] opacity-40" />
                 </div>
               </div>
               <p className="font-[var(--font-mono)] text-[8px] text-[var(--text-muted)] opacity-60 leading-relaxed italic">
                 * This ID will be linked to your authorized GitHub account during initialization.
               </p>
            </div>

            <button 
              onClick={handleLogin}
              disabled={loading}
              className="mt-auto group/btn relative w-full h-14 rounded-xl overflow-hidden shadow-2xl transition-all active:scale-95 disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand)] to-[var(--agent-lyra)] transition-transform duration-500 group-hover/btn:scale-105" />
              <div className="relative h-full w-full flex items-center justify-center gap-3 text-[var(--void)] font-[var(--font-display)] text-xl tracking-widest uppercase">
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Github size={20} />}
                <span>{loading ? 'Processing...' : 'Authorize via GitHub'}</span>
              </div>
            </button>
            
            <div className="flex items-center gap-2 opacity-20 group-hover:opacity-40 transition-opacity">
               <div className="h-[1px] flex-1 bg-[var(--border)]" />
               <span className="font-[var(--font-mono)] text-[8px] uppercase tracking-widest">New Deployment</span>
               <div className="h-[1px] flex-1 bg-[var(--border)]" />
            </div>
          </motion.div>

          {/* Sign In Portal */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className={`
              relative group p-8 rounded-[var(--radius-xl)] bg-glass border border-[var(--border)]
              transition-all duration-500 hover:border-[var(--agent-nova)]/40 hover:shadow-[0_0_50px_rgba(255,123,114,0.1)]
              flex flex-col gap-8
            `}
          >
            <div className="flex justify-between items-start">
               <div>
                 <h2 className="font-[var(--font-display)] text-3xl tracking-wider text-[var(--text-primary)] mb-2">RESUME</h2>
                 <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Open Existing Workspace</p>
               </div>
               <div className="w-12 h-12 rounded-full bg-[var(--agent-nova)]/10 flex items-center justify-center text-[var(--agent-nova)] shadow-inner">
                 <LogIn size={22} />
               </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center py-4">
              <div className="relative group/mascot">
                <div className="absolute inset-0 bg-[var(--agent-nova)]/20 blur-3xl rounded-full scale-150 opacity-0 group-hover/mascot:opacity-100 transition-opacity duration-1000" />
                <div className="transition-transform duration-700 group-hover/mascot:scale-110 group-hover/mascot:-rotate-3">
                  <MascotSprite name="SPARKY" state="idle" w={120} h={180} />
                </div>
              </div>
            </div>

            <button 
              onClick={handleLogin}
              disabled={loading}
              className="group/btn relative w-full h-14 rounded-xl overflow-hidden shadow-2xl transition-all active:scale-95 disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--agent-nova)] to-[var(--danger)] transition-transform duration-500 group-hover/btn:scale-105" />
              <div className="relative h-full w-full flex items-center justify-center gap-3 text-[var(--void)] font-[var(--font-display)] text-xl tracking-widest uppercase">
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Rocket size={20} />}
                <span>{loading ? 'Opening...' : 'Open Workspace'}</span>
              </div>
            </button>

            <div className="flex items-center gap-2 opacity-20 group-hover:opacity-40 transition-opacity">
               <div className="h-[1px] flex-1 bg-[var(--border)]" />
               <span className="font-[var(--font-mono)] text-[8px] uppercase tracking-widest">Active Core</span>
               <div className="h-[1px] flex-1 bg-[var(--border)]" />
            </div>
          </motion.div>
        </div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1 }}
          className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-[var(--text-muted)] text-center max-w-md leading-loose px-4"
        >
          Secure authentication powered by GitHub OAuth. <br className="hidden md:block" />
          System access requires read:user and repo scopes.
        </motion.p>
      </div>

      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[var(--void)]/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
          >
            <div className="w-16 h-16 border-4 border-[var(--brand)]/20 border-t-[var(--brand)] rounded-full animate-spin shadow-[0_0_20px_var(--brand)]" />
            <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.4em] text-[var(--brand)] animate-pulse">Establishing Connection...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
