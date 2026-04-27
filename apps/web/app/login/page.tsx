'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { MascotSprite } from '@/components/mascots/MascotSprite'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    await signIn('github', { callbackUrl: '/' })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 32,
      padding: 24,
    }}>
      {/* Scanline overlay */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, maxWidth: 480 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="40" viewBox="0 0 32 48" fill="none">
            <path d="M16 4 L26 4 L20 22 L30 22 L14 48 L20 28 L10 28 Z" fill="#f59e0b" />
          </svg>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 40,
            letterSpacing: '0.06em',
            color: 'var(--text-primary)',
          }}>REPOMIND</div>
        </div>

        {/* Mascot */}
        <MascotSprite name="SPARKY" state="idle" w={160} h={240} />

        {/* Card */}
        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '32px 40px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          boxShadow: '0 0 60px rgba(245,158,11,0.08)',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
            textAlign: 'center',
          }}>
            AUTHENTICATE WITH GITHUB
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            SPARKY needs repo access to decompose<br />your plans into trackable tickets.
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              letterSpacing: '0.08em',
              background: loading ? 'var(--surface)' : '#f59e0b',
              color: loading ? 'var(--text-muted)' : '#0a0a14',
              border: 'none',
              padding: '14px 24px',
              borderRadius: 8,
              cursor: loading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'opacity 0.2s',
              boxShadow: loading ? 'none' : '0 0 24px rgba(245,158,11,0.35)',
            }}
          >
            {!loading && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
            )}
            {loading ? 'CONNECTING...' : 'SIGN IN WITH GITHUB'}
          </button>

          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
            opacity: 0.6,
          }}>
            Requests read:user, user:email, repo scopes
          </div>
        </div>
      </div>
    </div>
  )
}
