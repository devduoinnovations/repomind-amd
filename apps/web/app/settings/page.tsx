'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { TeamPanel } from '@/components/TeamPanel'
import { ChevronLeft, Save, Trash2, User, Users, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name)
  }, [session])

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setProjects(data)
        if (data.length > 0) setSelectedProjectId(data[0].id)
      }
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Delete your account? This cannot be undone.')) return
    await fetch('/api/user', { method: 'DELETE' })
    signOut({ callbackUrl: '/login' })
  }

  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--text-primary)] font-[var(--font-mono)] py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-12">
        
        {/* Navigation Header (Sticky) */}
        <div className="sticky top-0 z-50 bg-[var(--void)]/80 backdrop-blur-xl -mx-6 px-6 py-6 border-b border-[var(--border)] mb-12 flex items-center justify-between">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--brand)] transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--brand)]/50 transition-all">
              <ChevronLeft size={16} />
            </div>
            <span className="text-[10px] font-black tracking-[0.2em] uppercase">Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-4">
             <div className="w-2 h-2 rounded-full bg-[var(--brand)] shadow-[0_0_8px_var(--brand)] animate-pulse" />
             <h1 className="text-2xl font-black tracking-[0.3em] uppercase drop-shadow-2xl">Settings</h1>
          </div>
        </div>

        {/* Profile Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-glass p-8 rounded-2xl border border-[var(--border)] relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-[var(--agent-sparky)] shadow-[0_0_15px_var(--agent-sparky)]" />
          <div className="flex items-center gap-3 mb-8">
            <User size={16} className="text-[var(--agent-sparky)]" />
            <h2 className="text-xs font-black tracking-[0.2em] text-[var(--text-muted)] uppercase">System Identity</h2>
          </div>

          <div className="grid gap-8 max-w-md">
            <div>
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-black mb-3 block">Display Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[var(--void)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-black mb-3 block">Primary Node (Email)</label>
              <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-muted)] opacity-60">
                {session?.user?.email ?? 'anonymous@repomind.ai'}
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all
                ${saved ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[var(--brand)]/10 text-[var(--brand)] border border-[var(--brand)]/30 hover:bg-[var(--brand)]/20 active:scale-95'}
              `}
            >
              <Save size={14} />
              {saved ? 'Changes Synced' : saving ? 'Syncing...' : 'Update Identity'}
            </button>
          </div>
        </motion.section>

        {/* Team Management */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-glass p-8 rounded-2xl border border-[var(--border)] relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-[var(--agent-patch)] shadow-[0_0_15px_var(--agent-patch)]" />
          <div className="flex items-center gap-3 mb-8">
            <Users size={16} className="text-[var(--agent-patch)]" />
            <h2 className="text-xs font-black tracking-[0.2em] text-[var(--text-muted)] uppercase">Fleet Management</h2>
          </div>

          {projects.length === 0 ? (
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest text-center py-12 border-2 border-dashed border-[var(--border)] rounded-2xl">
              No active fleets deployed
            </div>
          ) : (
            <>
              <div className="flex gap-3 mb-8 overflow-x-auto pb-4 scrollbar-hide">
                {projects.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`
                      px-4 py-2 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all whitespace-nowrap border
                      ${selectedProjectId === p.id 
                        ? 'bg-[var(--agent-patch)]/20 text-[var(--agent-patch)] border-[var(--agent-patch)] shadow-[0_0_15px_rgba(20,184,166,0.1)]' 
                        : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--brand)]/50'}
                    `}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="bg-[var(--void)]/50 rounded-2xl border border-[var(--border)] p-1">
                {selectedProjectId && <TeamPanel projectId={selectedProjectId} isOwner={true} />}
              </div>
            </>
          )}
        </motion.section>

        {/* Danger Zone */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-glass p-8 rounded-2xl border border-red-500/10 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
          <div className="flex items-center gap-3 mb-8">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="text-xs font-black tracking-[0.2em] text-red-500/80 uppercase">Destruction Core</h2>
          </div>

          <div className="max-w-md">
            <p className="text-[11px] text-[var(--text-muted)] mb-8 leading-relaxed opacity-60">
              Permanently de-initialize your account and purge all associated project metadata. This action is irreversible.
            </p>
            <button
              onClick={handleDeleteAccount}
              className="flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/30 rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-red-500/20 active:scale-95 transition-all"
            >
              <Trash2 size={14} />
              Terminate Account
            </button>
          </div>
        </motion.section>

      </div>
    </div>
  )
}
