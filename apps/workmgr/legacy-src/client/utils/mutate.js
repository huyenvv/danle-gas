// Wrapper around `gasCall` for mutating endpoints. On success, busts any
// cache prefixes that the change could invalidate so the next render fetches
// fresh data — without waiting for the SWR background refresh.
//
// Add a rule when you wire a new write endpoint. Reads (api_get*) skip here.

import gasCall from '../gasClient.js'
import { cache, persistentCache } from './cache.js'

const RULES = {
  // Tasks affect every screen that shows tasks or task counts
  api_createTask:           ['dashboard', 'kanban', 'tasklist', 'calendar', 'timeline'],
  api_updateTask:           ['dashboard', 'kanban', 'tasklist', 'calendar', 'timeline'],
  api_deleteTask:           ['dashboard', 'kanban', 'tasklist', 'calendar', 'timeline'],
  api_updateTaskStatus:     ['dashboard', 'kanban', 'tasklist'],
  api_updateTaskProgress:   ['dashboard', 'kanban', 'tasklist'],
  api_batchUpdateTaskStatus:['dashboard', 'kanban', 'tasklist'],
  // Labels live in masterData (persistent)
  api_addLabel:             ['__persistent_masterData'],
  api_updateLabel:          ['__persistent_masterData'],
  api_deleteLabel:          ['__persistent_masterData'],
  // Users (auth roles)
  api_updateUser:           ['__persistent_masterData'],
  api_removeUserRole:       ['__persistent_masterData'],
  // Schedules — their own list cache
  api_createSchedule:       ['schedules'],
  api_updateSchedule:       ['schedules'],
  api_approveSchedule:      ['schedules'],
  api_rejectSchedule:       ['schedules'],
  api_deleteSchedule:       ['schedules'],
}

export async function mutate(method, ...args) {
  const result = await gasCall(method, ...args)
  const prefixes = RULES[method]
  if (prefixes) {
    prefixes.forEach(p => {
      if (p.startsWith('__persistent_')) persistentCache.invalidate(p.slice('__persistent_'.length))
      else cache.invalidate(p)
    })
  }
  return result
}
