'use client'
import { useEffect, useState } from 'react'
import { MascotSprite } from '@/components/mascots/MascotSprite'

const WELCOME_LINES: Record<string, (ctx: WelcomeContext) => string> = {
  SPARKY: (ctx) => ctx.ticketCount && ctx.ticketCount > 0
    ? `${ctx.ticketCount} tickets loaded. Ready to decompose your next plan.`
    : `No tickets yet. Drop a plan and I'll break it down.`,
  PATCH:  (ctx) => ctx.suggestionCount && ctx.suggestionCount > 0
    ? `${ctx.suggestionCount} commit${ctx.suggestionCount > 1 ? 's' : ''} matched to open tickets. Your review is needed.`
    : `All clear. Watching commits for ticket matches.`,
  SAGE:   (ctx) => ctx.moduleCount && ctx.moduleCount > 0
    ? `${ctx.moduleCount} modules mapped. The architecture is ready.`
    : `Scan the repo and I'll draw the map.`,
  NOVA:   (ctx) => ctx.releaseCount && ctx.releaseCount > 0
    ? `${ctx.releaseCount} release draft${ctx.releaseCount > 1 ? 's' : ''} waiting. Ready to ship?`
    : `No releases yet. Merge a PR and I'll draft the changelog.`,
  LYRA:   (ctx) => ctx.projectName
    ? `Ask me anything about ${ctx.projectName}. I've read every file.`
    : `Select a project and I'll have answers ready.`,
}

export interface WelcomeContext {
  ticketCount?: number
  suggestionCount?: number
  moduleCount?: number
  releaseCount?: number
  projectName?: string
}

const AGENT_COLORS: Record<string, string> = {
  SPARKY: '#f59e0b', PATCH: '#14b8a6', SAGE: '#8b5cf6', NOVA: '#ec4899', LYRA: '#60a5fa',
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `${r},${g},${b}`
}

interface Props {
  agent: 'SPARKY' | 'PATCH' | 'SAGE' | 'NOVA' | 'LYRA'
  displayName?: string
  context: WelcomeContext
}

export function AgentWelcomeBanner({ agent, displayName, context }: Props) {
  const [visible, setVisible] = useState(false)
  const color = AGENT_COLORS[agent]
  const name = displayName ?? agent
  const line = WELCOME_LINES[agent]?.(context) ?? ''

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [agent])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
      borderBottom: '1px solid var(--border)', background: `rgba(${hexToRgb(color)},0.04)`,
      flexShrink: 0, transition: 'opacity 0.2s', opacity: visible ? 1 : 0,
    }}>
      <MascotSprite name={agent} state="idle" w={32} h={48} />
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color, letterSpacing: '0.06em' }}>
          {name}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {line}
        </div>
      </div>
    </div>
  )
}
