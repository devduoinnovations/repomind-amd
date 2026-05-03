'use client'
import { useState } from 'react'
import { MascotSprite } from '@/components/mascots/MascotSprite'

const AGENTS = ['SPARKY','PATCH','SAGE','NOVA','LYRA','SCOUT'] as const
type AgentName = typeof AGENTS[number]

const AGENT_COLORS: Record<AgentName, string> = {
  SPARKY:'#f59e0b', PATCH:'#14b8a6', SAGE:'#8b5cf6',
  NOVA:'#ec4899', LYRA:'#60a5fa', SCOUT:'#22c55e',
}

const DEFAULT_VOICE_LINES: Record<AgentName, string> = {
  SPARKY: 'Plans become tickets become commits become history.',
  PATCH:  "I didn't ask. I just knew.",
  SAGE:   'Every codebase is a city. I draw the map.',
  NOVA:   'Ship something. I will tell the world.',
  LYRA:   'Ask anything. The answer is in the source.',
  SCOUT:  'A new CVE dropped. We are unaffected.',
}

interface Props {
  configs: Record<string, { displayName: string; voiceLine: string }>
  onClose: () => void
  onSaved: (configs: Record<string, any>) => void
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `${r},${g},${b}`
}

export function AgentCustomizeModal({ configs, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<AgentName>('SPARKY')
  const [displayName, setDisplayName] = useState(configs[selected]?.displayName ?? selected)
  const [voiceLine, setVoiceLine] = useState(configs[selected]?.voiceLine ?? DEFAULT_VOICE_LINES[selected])
  const [saving, setSaving] = useState(false)

  const switchAgent = (name: AgentName) => {
    setSelected(name)
    setDisplayName(configs[name]?.displayName ?? name)
    setVoiceLine(configs[name]?.voiceLine ?? DEFAULT_VOICE_LINES[name])
  }

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/user/agents', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName: selected, displayName, voiceLine }),
    })
    const data = await res.json()
    if (res.ok) onSaved(data.configs)
    setSaving(false)
  }

  const color = AGENT_COLORS[selected]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, padding:28, width:500, fontFamily:'var(--font-mono)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontSize:14, color:'var(--text-primary)', letterSpacing:'0.04em' }}>CUSTOMIZE AGENTS</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:18 }}>×</button>
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:20 }}>
          {AGENTS.map(a => (
            <button key={a} onClick={() => switchAgent(a)} style={{
              flex:1, padding:'8px 4px', background: selected===a ? `rgba(${hexToRgb(AGENT_COLORS[a])},0.15)` : 'transparent',
              border:`1px solid ${selected===a ? AGENT_COLORS[a] : 'var(--border)'}`,
              borderRadius:6, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            }}>
              <MascotSprite name={a} state="idle" w={20} h={30} />
              <span style={{ fontSize:9, color: selected===a ? AGENT_COLORS[a] : 'var(--text-muted)', letterSpacing:'0.04em' }}>{a}</span>
            </button>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>DISPLAY NAME</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)}
              style={{ width:'100%', padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:13, boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>VOICE LINE</label>
            <input value={voiceLine} onChange={e => setVoiceLine(e.target.value)}
              style={{ width:'100%', padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:13, boxSizing:'border-box' }} />
          </div>

          <div style={{ padding:'10px 12px', background:'rgba(0,0,0,0.2)', borderRadius:6, display:'flex', alignItems:'center', gap:10 }}>
            <MascotSprite name={selected} state="idle" w={28} h={42} />
            <div>
              <div style={{ fontSize:13, color, letterSpacing:'0.06em' }}>{displayName || selected}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, fontStyle:'italic' }}>{voiceLine}</div>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, marginTop:20 }}>
          <button onClick={save} disabled={saving} style={{ flex:1, padding:'9px', background:`rgba(${hexToRgb(color)},0.2)`, color, border:`1px solid rgba(${hexToRgb(color)},0.4)`, borderRadius:6, cursor:'pointer', fontSize:12, letterSpacing:'0.06em' }}>
            {saving ? 'SAVING…' : 'SAVE CHANGES'}
          </button>
          <button onClick={() => { setDisplayName(selected); setVoiceLine(DEFAULT_VOICE_LINES[selected]) }} style={{ padding:'9px 16px', background:'transparent', color:'var(--text-muted)', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', fontSize:12 }}>
            RESET
          </button>
        </div>
      </div>
    </div>
  )
}
