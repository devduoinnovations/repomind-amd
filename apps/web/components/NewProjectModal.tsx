'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Github, ChevronDown, AlertCircle, Info } from 'lucide-react'

type RepoOption = { full_name: string; name: string; private: boolean; default_branch: string }

interface Project {
  id: string
  name: string
  repo_full: string
  slug?: string
  default_branch?: string | null
}

interface Props {
  onClose: () => void
  onCreated: (project: Project & { _initialised?: boolean }) => void
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function NewProjectModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [repo, setRepo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [repos, setRepos] = useState<RepoOption[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [tokenWarning, setTokenWarning] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const slug = slugify(name)

  const loadRepos = async () => {
    if (repos.length > 0) return
    setReposLoading(true)
    try {
      const res = await fetch('/api/github/repos')
      if (res.ok) setRepos(await res.json())
    } catch {}
    setReposLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !repo.trim()) return
    if (!repo.includes('/')) {
      setError('Repo must be in owner/repo format')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), repoFull: repo.trim(), slug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create project')

      if (!data.github_token) {
        setTokenWarning(true)
        setLoading(false)
        setTimeout(() => { setTokenWarning(false); onCreated(data) }, 3000)
        return
      }

      onCreated(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = !loading && name.trim().length > 0 && repo.trim().length > 0

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-glass border border-[var(--border-hover)] rounded-[var(--radius-lg)] p-8 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-[var(--font-display)] text-3xl tracking-widest text-[var(--text-primary)]">
              NEW PROJECT
            </h2>
            <button
              onClick={onClose}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[var(--border)] text-[var(--text-secondary)] font-[var(--font-mono)] text-[11px] uppercase tracking-widest transition-all hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)] hover:scale-105 active:scale-95 shadow-sm"
            >
              <span className="font-bold">ESC</span>
              <X size={14} className="group-hover:rotate-90 transition-transform" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Name */}
            <div className="space-y-2">
              <label className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-bold block ml-1">
                Project Name
              </label>
              <div className="relative group">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. My Stellar App"
                  autoFocus
                  className="w-full bg-[var(--void)] border-2 border-[var(--border)] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10 rounded-xl px-4 py-3.5 font-[var(--font-mono)] text-sm text-[var(--text-primary)] outline-none transition-all placeholder:opacity-40"
                />
                {slug && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 font-[var(--font-mono)] text-[9px] text-[var(--text-muted)] opacity-50 bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
                    slug: {slug}
                  </div>
                )}
              </div>
            </div>

            {/* GitHub Repo */}
            <div className="space-y-2 relative">
              <label className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-bold block ml-1">
                GitHub Repository
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--brand)] transition-colors">
                  <Github size={18} />
                </div>
                <input
                  value={repoSearch}
                  onChange={e => { setRepoSearch(e.target.value); setRepo(e.target.value); setShowDropdown(true) }}
                  onFocus={() => { loadRepos(); setShowDropdown(true) }}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="owner/repo or search..."
                  className="w-full bg-[var(--void)] border-2 border-[var(--border)] focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/10 rounded-xl pl-12 pr-10 py-3.5 font-[var(--font-mono)] text-sm text-[var(--text-primary)] outline-none transition-all placeholder:opacity-40"
                />
                <div className={`absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-transform duration-300 ${showDropdown ? 'rotate-180 text-[var(--brand)]' : ''}`}>
                  <ChevronDown size={16} />
                </div>
              </div>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 z-50 bg-[var(--surface)] border-2 border-[var(--brand)]/40 rounded-2xl shadow-2xl overflow-y-auto max-h-[280px] animate-entrance scrollbar-thin"
                  >
                    {reposLoading && (
                      <div className="p-4 flex items-center justify-center gap-2 text-[var(--text-muted)] font-[var(--font-mono)] text-xs">
                        <div className="w-3 h-3 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
                        Scanning Repositories...
                      </div>
                    )}
                    {!reposLoading && repos.length === 0 && (
                      <div className="p-4 flex items-center gap-2 text-[var(--text-muted)] font-[var(--font-mono)] text-xs">
                        <Info size={14} />
                        No repositories found. Enter manually.
                      </div>
                    )}
                    {repos
                      .filter(r => !repoSearch || r.full_name.toLowerCase().includes(repoSearch.toLowerCase()))
                      .slice(0, 20)
                      .map(r => (
                        <button
                          key={r.full_name}
                          type="button"
                          onMouseDown={() => {
                            setRepo(r.full_name)
                            setRepoSearch(r.full_name)
                            setShowDropdown(false)
                          }}
                          className="w-full text-left px-5 py-3.5 flex items-center gap-3 transition-all hover:bg-[var(--brand)]/10 group/item border-b border-[var(--border)] last:border-0"
                        >
                          <Github size={14} className="text-[var(--text-muted)] group-hover/item:text-[var(--brand)]" />
                          <span className="font-[var(--font-mono)] text-xs text-[var(--text-primary)] flex-1 truncate">
                            {r.full_name}
                          </span>
                          {r.private && (
                            <span className="font-[var(--font-mono)] text-[8px] uppercase tracking-widest text-[var(--warning)] bg-[var(--warning)]/10 px-2 py-0.5 rounded-full border border-[var(--warning)]/20 shadow-sm">
                              PRIVATE
                            </span>
                          )}
                        </button>
                      ))
                    }
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Warning / Error */}
            <AnimatePresence>
              {tokenWarning && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 bg-[var(--warning)]/10 border border-[var(--warning)]/20 rounded-xl flex gap-3 items-start"
                >
                  <AlertCircle className="text-[var(--warning)] shrink-0 mt-0.5" size={16} />
                  <p className="font-[var(--font-mono)] text-[10px] leading-relaxed text-[var(--warning)]">
                    <span className="font-bold">WARNING:</span> No GitHub token found. R-authenticate to enable autonomous scans and ticket suggestions.
                  </p>
                </motion.div>
              )}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl flex gap-3 items-center"
                >
                  <AlertCircle className="text-[var(--danger)] shrink-0" size={16} />
                  <p className="font-[var(--font-mono)] text-[10px] font-bold text-[var(--danger)]">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex gap-4 pt-6">
              <button
                type="submit"
                disabled={!canSubmit}
                className={`
                  flex-[2] py-4 rounded-xl font-[var(--font-display)] text-base tracking-[0.2em] transition-all relative overflow-hidden
                  ${canSubmit 
                    ? 'bg-[var(--brand)] text-white shadow-xl shadow-[var(--brand)]/30 hover:scale-[1.02] hover:brightness-110 active:scale-95' 
                    : 'bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 cursor-not-allowed border border-transparent'}
                `}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    INITIALIZING...
                  </div>
                ) : (
                  'CREATE PROJECT'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-4 rounded-xl font-[var(--font-mono)] text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)] border-2 border-[var(--border)] hover:bg-[var(--surface-hover)] hover:border-[var(--text-muted)] transition-all active:scale-95 shadow-sm"
              >
                CANCEL
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
