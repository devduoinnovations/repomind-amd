export type AgentName = 'SPARKY' | 'PATCH' | 'SAGE' | 'NOVA' | 'LYRA' | 'SCOUT'
export type AgentStatus = 'idle' | 'working' | 'done' | 'error' | 'sleeping'
export type TicketStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
export type Priority = 'HIGH' | 'MED' | 'LOW'
export type Complexity = 'S' | 'M' | 'L' | 'XL'

export interface AgentState {
  name: AgentName
  color: string
  status: AgentStatus
  role: string
  model: string
  isAmd: boolean
  voiceLine: string
}

export interface Ticket {
  id: string
  title: string
  status: TicketStatus
  priority: Priority
  complexity: Complexity
  age: string
  commit?: string
  confidence?: number
}

export interface ActivityEvent {
  color: string
  text: string
  ago: string
}

export interface AmdMetrics {
  gpu: number
  mem: number
  tokSec: number
  embedMs: number
}

export interface LogEntry {
  time: string
  msg: string
}
