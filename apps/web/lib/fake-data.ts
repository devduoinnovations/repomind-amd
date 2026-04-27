import type { AgentState, AmdMetrics, LogEntry } from './types'

export const INITIAL_AGENTS: AgentState[] = [
  { name: 'SPARKY', color: '#f59e0b', status: 'idle',    role: 'The Architect',    model: 'opus-4-6',    isAmd: false, voiceLine: 'Plans become tickets become commits become history.' },
  { name: 'PATCH',  color: '#14b8a6', status: 'working', role: 'The Watcher',      model: 'mistral-7b',  isAmd: true,  voiceLine: "I didn't ask. I just knew." },
  { name: 'SAGE',   color: '#8b5cf6', status: 'idle',    role: 'The Cartographer', model: 'sonnet-4-6',  isAmd: true,  voiceLine: 'Every codebase is a city. I draw the map.' },
  { name: 'NOVA',   color: '#ec4899', status: 'idle',    role: 'The Herald',       model: 'opus-4-6',    isAmd: false, voiceLine: 'Ship something. I will tell the world.' },
  { name: 'LYRA',   color: '#60a5fa', status: 'idle',    role: 'The Librarian',    model: 'sonnet-4-6',  isAmd: true,  voiceLine: 'Ask anything. The answer is in the source.' },
  { name: 'SCOUT',  color: '#22c55e', status: 'sleeping', role: 'The Sentinel',    model: 'haiku-4-5',   isAmd: true,  voiceLine: 'A new CVE dropped. We are unaffected.' },
]

export const INITIAL_METRICS: AmdMetrics = { gpu: 34, mem: 51, tokSec: 2847, embedMs: 12 }

export const INITIAL_LOG: LogEntry[] = [
  { time: '14:22:01', msg: 'PATCH embed diff a7f3b9 → 12ms' },
  { time: '14:22:01', msg: 'PATCH match T-042 conf:0.94 → 8ms' },
  { time: '14:21:58', msg: 'SAGE batch embed 64 chunks → 184ms' },
  { time: '14:21:42', msg: 'PATCH embed diff 8b1ad7 → 11ms' },
  { time: '14:21:42', msg: 'PATCH match T-039 conf:0.92 → 9ms' },
  { time: '14:21:30', msg: 'LYRA query embed → 14ms' },
]
