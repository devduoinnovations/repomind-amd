'use client'
import { Component, ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: 24, color: '#ef4444' }}>⚠</div>
          <div style={{ fontSize: 12 }}>Something went wrong</div>
          <div style={{ fontSize: 11, color: '#ef4444', maxWidth: 300, textAlign: 'center' }}>
            {this.state.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{ marginTop: 8, padding: '6px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}
          >
            RETRY
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
