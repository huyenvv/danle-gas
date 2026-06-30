import type { DataStore } from '../ports/data-store'
import type { Clock } from '../ports/clock'
import type { Session } from './session'

export interface ActivityLog {
  log(session: Session, type: string, objectType: string, objectId: string | number, description: string): void
}

export function createActivityLog(ds: DataStore, clock: Clock): ActivityLog {
  return {
    log(session, type, objectType, objectId, description) {
      try {
        ds.insert('activities', {
          type,
          description: description || '',
          objectType,
          objectId,
          userId: session && session.userId,
          userName: (session && session.name) || '',
          at: clock.now(),
        })
      } catch (_e) {
        // best-effort: swallow errors
      }
    },
  }
}
