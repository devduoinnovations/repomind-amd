'use client'
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'

interface ToastItem { id: string; message: string; type: 'success' | 'error' | 'info' }

const ToastContext = createContext<{ toast: (msg: string, type?: ToastItem['type']) => void }>({
  toast: () => {},
})

export function useToast() { return useContext(ToastContext) }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  const COLORS = { success: '#22c55e', error: '#ef4444', info: '#60a5fa' }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position:'fixed', bottom:20, right:20, display:'flex', flexDirection:'column', gap:8, zIndex:9999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding:'10px 16px', background:'var(--panel)', border:`1px solid ${COLORS[t.type]}`,
            borderRadius:8, fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-primary)',
            maxWidth:320, display:'flex', alignItems:'center', gap:8,
            animation:'slideIn 0.2s ease',
          }}>
            <span style={{ color:COLORS[t.type], fontSize:14 }}>
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '●'}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
