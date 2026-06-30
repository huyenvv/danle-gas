// composition/node.ts — Node.js composition root (dev / test).
// Wires thẳng SqliteDataStore (không có caching decorator) — dev/test chạy in-process, không cần cache.

import Database from 'better-sqlite3'
import { createSqliteDataStore } from '../adapters/sqlite/sqlite-data-store'
import { createLabelRepository } from '../core/domain/label-repository'
import { createActivityLog } from '../core/domain/activity-log'
import { createLabelService } from '../core/services/label-service'
import type { LabelService } from '../core/services/label-service'

export interface AppServices {
  labelService: LabelService
}

export function makeApp(db: InstanceType<typeof Database>): AppServices {
  const clock = { now: () => new Date().toISOString() }
  // Raw sqlite store — no caching wrapper needed for dev/test (in-process, fast)
  const ds = createSqliteDataStore(db)
  const activityLog = createActivityLog(ds, clock)
  const labelRepo = createLabelRepository(ds)
  const labelService = createLabelService(labelRepo, activityLog)
  return { labelService }
}
