'use client'
import type { AgentName } from '@/lib/types'

const COLORS: Record<AgentName, string> = {
  SPARKY: '#f59e0b',
  PATCH:  '#14b8a6',
  SAGE:   '#8b5cf6',
  NOVA:   '#ec4899',
  LYRA:   '#60a5fa',
  SCOUT:  '#22c55e',
}

interface Props {
  name: AgentName
  state: 'idle' | 'working'
  clickEffect?: boolean
  w?: number
  h?: number
}

export function MascotSprite({ name, state, clickEffect, w = 80, h = 120 }: Props) {
  const working = state === 'working'
  const color = COLORS[name]
  return (
    <div
      className={`${working ? 'sprite-working' : 'sprite-idle'} ${clickEffect ? 'glitch' : ''}`}
      style={{
        width: w,
        height: h,
        filter: working
          ? `drop-shadow(0 0 12px ${color})`
          : `drop-shadow(0 0 6px ${color}66)`,
        transition: 'filter 240ms cubic-bezier(0.22,1,0.36,1)',
        flexShrink: 0,
      }}
    >
      <img
        src={`/mascots/${name.toLowerCase()}.svg`}
        width={w}
        height={h}
        alt={name}
        style={{ display: 'block' }}
      />
    </div>
  )
}
