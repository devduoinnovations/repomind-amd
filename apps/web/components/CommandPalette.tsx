'use client'

import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  if (!open) return null

  const navigate = (path: string) => {
    setOpen(false)
    router.push(path)
  }

  return (
    <>
      <div 
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(4,4,14,0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
        }}
      />
      <Command
        style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '560px',
          background: 'var(--panel)',
          border: '1px solid var(--border-hover)',
          borderRadius: '12px',
          overflow: 'hidden',
          zIndex: 10000,
          boxShadow: 'var(--shadow-modal)',
          display: 'flex',
          flexDirection: 'column',
        }}
        label="Global Command Menu"
      >
        <Command.Input
          autoFocus
          placeholder="Type a command or search..."
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '15px',
            padding: '16px 20px',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-primary)',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box'
          }}
        />

        <Command.List
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          <Command.Empty
            style={{
              padding: '16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            No results found.
          </Command.Empty>

          <Command.Group 
            heading="Navigation" 
            style={{ 
              fontFamily: 'var(--font-mono)', 
              fontSize: '10px', 
              color: 'var(--text-muted)', 
              padding: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            <Command.Item
              onSelect={() => navigate('/')}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              // cmdk uses data-selected attribute for hover state natively
              className="cmdk-item"
            >
              Dashboard
            </Command.Item>
            <Command.Item
              onSelect={() => navigate('/settings')}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              className="cmdk-item"
            >
              Settings
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>

      <style dangerouslySetInnerHTML={{__html: `
        .cmdk-item[data-selected="true"] {
          background: rgba(255, 255, 255, 0.05);
        }
      `}} />
    </>
  )
}
