// transport/gas-entry.ts — GAS entrypoints.
// Imports ONLY composition/gas (no sqlite), so the GAS bundle stays clean.

import { makeApp } from '../composition/gas'
import type { Session } from '../core/domain/session'

// Lazy singleton — build once per GAS execution
let _app: ReturnType<typeof makeApp> | null = null
function getApp(): ReturnType<typeof makeApp> {
  if (!_app) _app = makeApp()
  return _app
}

// _wrap: standard JSON envelope for all api_* calls
function _wrap<T>(fn: () => T): { success: true; payload: T } | { success: false; error: string } {
  try {
    return { success: true, payload: fn() }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: msg }
  }
}

// requireAuth: validate SSO token → Session
// TODO SP1: replace stub with real cross-script SSO validation
function requireAuth(token: string): Session {
  if (!token) throw new Error('INVALID_SSO')
  // Dev stub: any non-empty token is accepted
  return { userId: 0, name: 'Dev', username: 'dev', role: 'admin' }
}

// doGet: serve the client HTML
function doGet(_e?: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Quản Lý Công Việc')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

// api_getLabels
function api_getLabels(token: string) {
  return _wrap(() => {
    const session = requireAuth(token)
    return getApp().labelService.labelList(session)
  })
}

// api_addLabel
function api_addLabel(token: string, data: { name?: string; color?: string }) {
  return _wrap(() => {
    const session = requireAuth(token)
    return getApp().labelService.labelAdd(session, data)
  })
}

// api_updateLabel
function api_updateLabel(token: string, id: number, data: Partial<{ name: string; color: string }>) {
  return _wrap(() => {
    const session = requireAuth(token)
    return getApp().labelService.labelUpdate(session, id, data)
  })
}

// api_deleteLabel
function api_deleteLabel(token: string, id: number) {
  return _wrap(() => {
    const session = requireAuth(token)
    return getApp().labelService.labelRemove(session, id)
  })
}

// Exported so the build (bundle-gas.mjs) can re-expose each as a TOP-LEVEL
// function declaration in Code.gs — GAS only surfaces top-level functions to
// `google.script.run` (a globalThis assignment inside esbuild's IIFE is NOT seen).
export { doGet, api_getLabels, api_addLabel, api_updateLabel, api_deleteLabel }
