/** A user-defined label that can be attached to tasks or other objects. */
export interface Label { id: number; name: string; color: string }

/** A domain event recording something meaningful that happened (e.g. task created, label added). */
export interface Activity {
  id: number; type: string; description: string; objectType: string
  objectId: string | number; userId: string | number; userName: string; at: string
}

/** An immutable audit-trail entry written whenever a sensitive action is performed. */
export interface Audit {
  id: number; at: string; user: string; email: string
  action: string; type: string; target: string; details: string
}
