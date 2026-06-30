import type { DataStore } from '../ports/data-store'
import type { Clock } from '../ports/clock'
import type { Session } from './session'

export interface AuditLog {
  log(session: Session, action: string, type: string, target: string, details: string): void
}

export function createAuditLog(ds: DataStore, clock: Clock): AuditLog {
  return {
    log(session, action, type, target, details) {
      try {
        ds.insert('audit', {
          at: clock.now(),
          user: (session && session.username) || 'system',
          email: '',
          action: action || '',
          type: type || '',
          target: target || '',
          details: details || '',
        })
      } catch (_e) {
        // best-effort: swallow errors
      }
    },
  }
}
