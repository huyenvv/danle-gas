// composition/gas.ts — GAS composition root.
// Wires ONLY GAS adapters (no sqlite). Imported by transport/gas-entry.ts.
// CRITICAL: must NOT import anything from adapters/sqlite — keep GAS bundle clean.

import { CachingDataStore } from '../core/caching-data-store'
import { createGasCache } from '../adapters/gas/gas-cache'
import { createSheetsDataStore } from '../adapters/gas/sheets-data-store'
import { createLabelRepository } from '../core/domain/label-repository'
import { createActivityLog } from '../core/domain/activity-log'

import { createLabelService } from '../core/services/label-service'
import type { LabelService } from '../core/services/label-service'

export interface AppServices {
  labelService: LabelService
}

export function makeApp(): AppServices {
  const clock = { now: () => new Date().toISOString() }
  const cache = createGasCache()
  const ds = new CachingDataStore(createSheetsDataStore(), cache)
  const activityLog = createActivityLog(ds, clock)
  const labelRepo = createLabelRepository(ds)
  const labelService = createLabelService(labelRepo, activityLog)
  return { labelService }
}
