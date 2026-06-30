// dev-server/server.ts — Dev HTTP server (Node, tsx).
// Import composition/node trực tiếp (không dùng vm), phục vụ POST /api.
// Thay thế v1 server.js (vm-based).

import * as http from 'http'
import * as path from 'path'
import Database from 'better-sqlite3'
import { createSqliteTables } from '../src/adapters/sqlite/sqlite-schema'
import { makeApp } from '../src/composition/node'
import type { Session } from '../src/core/domain/session'

const PORT = 3100
const DB_PATH = path.join(__dirname, 'workmgr-dev.sqlite')

// ── Setup DB + App ──
const db = new Database(DB_PATH)
createSqliteTables(db, ['labels', 'activities', 'audit'])
const app = makeApp(db)

// ── Auth stub ──
function requireAuth(token: unknown): Session {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error('INVALID_SSO')
  }
  return { userId: 'dev', name: 'Dev User', username: token, role: 'admin' }
}

// ── Handler map ──
type Envelope = { success: true; payload: unknown } | { success: false; error: string }

type Handler = (...args: unknown[]) => Envelope

function ok(payload: unknown): Envelope {
  return { success: true, payload }
}
function fail(error: string): Envelope {
  return { success: false, error }
}

const handlers: Record<string, Handler> = {
  api_getLabels(token: unknown) {
    const session = requireAuth(token)
    return ok(app.labelService.labelList(session))
  },
  api_addLabel(token: unknown, data: unknown) {
    const session = requireAuth(token)
    return ok(app.labelService.labelAdd(session, data as { name?: string; color?: string }))
  },
  api_updateLabel(token: unknown, id: unknown, data: unknown) {
    const session = requireAuth(token)
    return ok(app.labelService.labelUpdate(session, id as number, data as Partial<{ name: string; color: string }>))
  },
  api_deleteLabel(token: unknown, id: unknown) {
    const session = requireAuth(token)
    return ok(app.labelService.labelRemove(session, id as number))
  },
}

// ── HTTP server ──
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  if (req.method !== 'POST' || req.url !== '/api') {
    res.writeHead(404)
    return res.end()
  }

  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    let out: Envelope
    try {
      const { method, args } = JSON.parse(body || '{}') as { method: unknown; args: unknown[] }
      if (typeof method !== 'string' || !/^api_/.test(method)) {
        out = fail('Method không hợp lệ: ' + String(method))
      } else if (!(method in handlers)) {
        out = fail('Method không tồn tại: ' + method)
      } else {
        out = handlers[method](...(args || []))
      }
    } catch (e) {
      out = fail(e instanceof Error ? e.message : String(e))
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(out))
  })
})

server.listen(PORT, () => {
  console.log('workmgr dev-server (TS): http://localhost:' + PORT + '/api')
})
