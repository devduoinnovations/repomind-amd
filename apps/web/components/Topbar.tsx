'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { Sun, Moon, LogOut, Settings, RefreshCw, Plus, ChevronDown } from 'lucide-react'

interface Project {
  id: string
  name: string
  repo_full: string
  slug?: string
  default_branch?: string | null
}

interface Props {
  gpu: number
  onAmdClick: () => void
  projects: Project[]
  selectedProject: Project | null
  onSelectProject: (p: Project) => void
  onAddProject: () => void
  onSettingsClick?: () => void
  onSync?: () => void
}

export function Topbar({ gpu, onAmdClick, projects, selectedProject, onSelectProject, onAddProject, onSettingsClick, onSync }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()

  const [owner, repo] = (selectedProject?.repo_full || 'select / project').split('/')

  return (
    <header className="h-20 px-8 flex items-center justify-between bg-glass border-b border-[var(--border)] z-50 sticky top-0 shadow-2xl">
      {/* Header Accent Line */}
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--brand)]/30 to-transparent" />

      <div className="flex items-center gap-8">
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => router.push('/')}>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand)] to-[var(--agent-nova)] blur-xl opacity-40 group-hover:opacity-100 transition-opacity" />
            <div className="relative w-10 h-10 bg-gradient-to-br from-[var(--brand)] to-[var(--agent-nova)] rounded-xl flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
              <div className="w-5.5 h-5.5 bg-[var(--surface)] rounded-full flex items-center justify-center border border-white/20">
                 <div className="w-2.5 h-2.5 bg-[var(--brand)] rounded-full animate-pulse shadow-[0_0_8px_var(--brand)]"></div>
              </div>
            </div>
          </div>
          <span className="font-[var(--font-display)] text-3xl tracking-[0.2em] text-[var(--text-primary)] group-hover:text-gradient transition-all duration-500">
            REPOMIND
          </span>
        </div>

        <div className="relative group/select">
          <div
            onClick={() => setOpen(o => !o)}
            className={`
              relative overflow-hidden
              bg-[var(--surface)]/40 backdrop-blur-md border border-[var(--border)] hover:border-[var(--brand)]/50
              rounded-xl px-5 py-2.5 flex items-center gap-4 font-[var(--font-mono)] text-xs
              text-[var(--text-primary)] cursor-pointer select-none min-w-[260px] transition-all duration-300
              shadow-inner hover:shadow-[0_0_20px_rgba(88,166,255,0.1)] active:scale-[0.98]
              ${open ? 'ring-2 ring-[var(--brand)]/20 border-[var(--brand)]/50' : ''}
            `}
          >
            {/* Accent Line */}
            <div className="absolute left-0 top-1/4 h-1/2 w-0.5 bg-[var(--brand)] rounded-r-full shadow-[0_0_8px_var(--brand)]" />
            
            <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0 pl-1">
               <span className="text-[8px] text-[var(--brand)] font-black tracking-[0.2em] uppercase opacity-70">Connected Host</span>
               <div className="flex items-center gap-2 w-full">
                 <span className="text-[var(--text-muted)] shrink-0 opacity-50">{owner} <span className="opacity-20">/</span></span>
                 <span className="font-black truncate text-[var(--text-primary)] tracking-tight text-[13px]">{repo || 'SELECT REPO'}</span>
               </div>
            </div>
            <div className={`w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--void)]/50 border border-[var(--border)] transition-all duration-500 ${open ? 'rotate-180 bg-[var(--brand)] text-white border-[var(--brand)] shadow-lg shadow-[var(--brand)]/40' : 'text-[var(--text-muted)] group-hover/select:border-[var(--brand)]/30 group-hover/select:text-[var(--brand)]'}`}>
              <ChevronDown size={14} />
            </div>
          </div>

          {open && (
            <div className="absolute top-[calc(100%+12px)] left-0 bg-[var(--surface)] border-2 border-[var(--brand)]/20 rounded-2xl overflow-hidden min-w-[280px] shadow-2xl z-[100] animate-entrance backdrop-blur-xl">
              <div className="p-3 border-b border-[var(--border)] bg-[var(--void)]/50">
                 <span className="font-[var(--font-mono)] text-[9px] font-black tracking-widest text-[var(--text-muted)] opacity-50">AVAILABLE PROJECTS</span>
              </div>
              {projects.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-[var(--font-mono)] text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-3">No projects indexed</p>
                  <button onClick={onAddProject} className="text-[10px] text-[var(--brand)] font-black underline underline-offset-4 tracking-widest">CONNECT NOW</button>
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto py-2 scrollbar-thin">
                  {projects.map(p => (
                    <div
                      key={p.id}
                      onClick={() => { onSelectProject(p); setOpen(false) }}
                      className={`
                        px-5 py-4 flex flex-col gap-1 cursor-pointer transition-all relative group/item
                        ${selectedProject?.id === p.id ? 'bg-[var(--brand)]/10' : 'hover:bg-[var(--brand)]/5'}
                      `}
                    >
                      {selectedProject?.id === p.id && <div className="absolute left-0 top-0 w-1 h-full bg-[var(--brand)]" />}
                      <span className="font-[var(--font-display)] text-lg tracking-widest text-[var(--text-primary)] group-hover/item:text-[var(--brand)] transition-colors">{p.name}</span>
                      <span className="font-[var(--font-mono)] text-[9px] text-[var(--text-muted)] font-black opacity-40 uppercase tracking-tighter">{p.repo_full}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAddProject}
          className="relative group w-11 h-11 rounded-xl overflow-hidden cursor-pointer shadow-lg active:shadow-sm transition-shadow"
          title="New Project"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand)] to-[var(--agent-nova)] opacity-100 group-hover:scale-110 transition-transform duration-500" />
          <div className="absolute inset-[1.5px] bg-[var(--surface)] rounded-[10px] opacity-20 group-hover:opacity-10 transition-opacity" />
          <div className="relative h-full w-full flex items-center justify-center text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
            <Plus size={22} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
          </div>
        </motion.button>
      </div>

      <div className="ml-auto flex items-center gap-6">
        {/* GPU Status Indicator */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          onClick={onAmdClick}
          className="bg-glass/50 border border-[var(--amd-red)]/40 rounded-full px-5 py-2 flex items-center gap-4 cursor-pointer group hover:bg-[var(--amd-red)]/10 transition-all shadow-lg"
        >
          <div className="relative flex h-2.5 w-2.5">
            <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--amd-red)] opacity-75"></div>
            <div className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--amd-red)] shadow-[0_0_12px_var(--amd-red)]"></div>
          </div>
          <div className="flex flex-col items-start gap-0">
             <span className="font-[var(--font-mono)] text-[8px] font-black text-[var(--amd-red)] uppercase tracking-[0.2em] opacity-80">System Core</span>
             <span className="font-[var(--font-mono)] text-[10px] tracking-widest font-black text-[var(--text-primary)]">
               GPU {gpu}% <span className="text-[var(--text-muted)] mx-1 opacity-30">|</span> {process.env.NEXT_PUBLIC_GPU_MODEL ?? 'MI300X ROCm'}
             </span>
          </div>
        </motion.div>

        <div className="h-10 w-[1px] bg-gradient-to-b from-transparent via-[var(--border)] to-transparent mx-2" />

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--brand)] hover:border-[var(--brand)] transition-all hover:scale-110 active:scale-95 shadow-sm"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          onClick={() => router.push('/settings')}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ml-1"
          title="Settings"
        >
          <Settings size={18} />
        </button>

        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 font-[var(--font-mono)] text-[10px] font-black tracking-widest text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors group ml-2 mr-2"
        >
          <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          LOGOUT
        </button>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-[var(--brand)] to-[var(--agent-nova)] rounded-full blur-md opacity-20 group-hover:opacity-60 transition duration-500" />
          <button 
            className="relative w-11 h-11 rounded-full bg-[var(--surface)] border-2 border-[var(--border-hover)] flex items-center justify-center font-[var(--font-display)] text-xl text-[var(--text-primary)] font-black select-none cursor-pointer hover:border-[var(--brand)] transition-all group-hover:scale-105 active:scale-95 overflow-hidden"
            onClick={() => signOut()}
          >
            {session?.user?.image ? (
              <img 
                src={session.user.image} 
                alt={session.user.name || 'User'} 
                className="w-full h-full object-cover"
              />
            ) : (
              (session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? '?').toUpperCase()
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
