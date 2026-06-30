// gviz.ts — Pure gviz query builder + response parser for SheetsDataStore.
// No GAS API calls here; UrlFetchApp lives in sheets-data-store.ts.
// Pattern copied from apps/docmgr/src/server/doc-query.js (proven on 10k+ rows).

import type { Collection, DomainRecord, Query } from '../../core/ports/data-store'
import { sheetToDomain } from '../../core/schema'

// ────── Column-letter helpers ──────────────────────────────────────────────────

/** 0-based index → gviz column letter (0→A, 25→Z, 26→AA, …). */
export function colLetter(i: number): string {
  let n = i + 1
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Header name → gviz column letter, given ordered header array. */
function _headerToLetter(headers: string[], header: string): string {
  const idx = headers.indexOf(header)
  if (idx === -1) throw new Error('Không tìm thấy header: ' + header)
  return colLetter(idx)
}

// ────── Literal escaping ───────────────────────────────────────────────────────

/**
 * Escape a string value as a gviz Query Language literal.
 * gviz does NOT support SQL-style doubling ('') — instead choose a quote char
 * the string does NOT contain. If both present, strip ' and wrap in ' (rare edge case).
 * Numbers and booleans are returned bare (no quotes).
 */
export function gvizLit(v: string | number | boolean): string {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  const s = String(v == null ? '' : v)
  if (s.indexOf("'") === -1) return "'" + s + "'"
  if (s.indexOf('"') === -1) return '"' + s + '"'
  // Both ' and " present — strip ' then wrap in ' (syntax safe, rarely reachable)
  return "'" + s.replace(/'/g, '') + "'"
}

// ────── Query builder ──────────────────────────────────────────────────────────

/**
 * Build a gviz `tq` query string from a domain Query + the schema headers.
 * `domainField → VN header → column letter` via position in headers array.
 * domainToSheet is NOT called here; caller provides the header→letter mapping
 * by passing the schema field list (header name is the key).
 *
 * @param fieldToHeader - maps domain field name → VN header name
 * @param query         - domain Query (where/orderBy/limit/offset)
 * @param headers       - ordered VN header array (defines column letters)
 * @param selectExpr    - override SELECT (default '*'); pass e.g. 'count(A)' for totals
 */
export function buildGvizTq(
  fieldToHeader: Record<string, string>,
  query: Query,
  headers: string[],
  selectExpr?: string,
): string {
  const { where = [], orderBy = [], limit, offset } = query

  const whereClauses: string[] = []
  for (const f of where) {
    const h = fieldToHeader[f.field]
    if (!h) throw new Error('Không tìm thấy mapping cho field: ' + f.field)
    const col = _headerToLetter(headers, h)
    const lit = gvizLit(f.value)
    let clause: string
    if (f.op === 'contains') {
      clause = col + ' contains ' + lit
    } else {
      clause = col + ' ' + f.op + ' ' + lit
    }
    whereClauses.push(clause)
  }

  const orderClauses: string[] = []
  for (const s of orderBy) {
    const h = fieldToHeader[s.field]
    if (!h) throw new Error('Không tìm thấy mapping cho field: ' + s.field)
    const col = _headerToLetter(headers, h)
    orderClauses.push(col + ' ' + s.dir)
  }

  let q = 'select ' + (selectExpr || '*')
  if (whereClauses.length) q += ' where ' + whereClauses.join(' and ')
  if (orderClauses.length) q += ' order by ' + orderClauses.join(', ')
  if (limit != null) q += ' limit ' + limit
  if (offset != null) q += ' offset ' + offset
  return q
}

// ────── Response parser ────────────────────────────────────────────────────────

/** Strip `google.visualization.Query.setResponse({…});` wrapper and parse inner JSON. */
function _parseGvizJson(body: string): { status?: string; errors?: { detailed_message?: string; message?: string }[]; table?: { cols: { label?: string }[]; rows: { c: ({ v?: unknown } | null)[] }[] } } {
  const text = String(body || '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) throw new Error('Phản hồi gviz không hợp lệ')
  try {
    return JSON.parse(text.substring(start, end + 1))
  } catch (_e) {
    throw new Error('Không phân tích được phản hồi gviz')
  }
}

/**
 * Parse a raw gviz JSONP response body into domain records.
 * Uses column position (same as docmgr) — robust even when labels are absent.
 */
export function parseGvizRows(
  responseText: string,
  collection: Collection,
  headers: string[],
): DomainRecord[] {
  const obj = _parseGvizJson(responseText)
  if (obj.status === 'error') {
    const e = obj.errors && obj.errors[0]
    const msg = (e && (e.detailed_message || e.message)) || 'lỗi truy vấn'
    throw new Error('Lỗi truy vấn gviz: ' + msg)
  }
  const table = obj.table || { cols: [], rows: [] }
  const cols = table.cols || []
  // Use label from response if present; fall back to headers by position.
  const labels = cols.map((c, i) => (c && c.label ? c.label : headers[i] || ''))
  const useFallback = labels.join('') === ''
  return (table.rows || []).map(row => {
    const cells = (row && row.c) || []
    const sheetRow: DomainRecord = {}
    const n = useFallback ? headers.length : labels.length
    for (let i = 0; i < n; i++) {
      const key = useFallback ? headers[i] : labels[i]
      if (!key) continue
      const cell = cells[i]
      sheetRow[key] = cell && cell.v != null ? cell.v : ''
    }
    return sheetToDomain(collection, sheetRow)
  })
}

/**
 * Parse the total count from a `select count(A)` gviz response.
 * Returns 0 if the table is empty or count cell is missing.
 */
export function parseGvizCount(responseText: string): number {
  const obj = _parseGvizJson(responseText)
  if (obj.status === 'error') return 0
  const table = obj.table || { cols: [], rows: [] }
  const row = (table.rows || [])[0]
  if (!row) return 0
  const cell = (row.c || [])[0]
  return cell && cell.v != null ? Number(cell.v) : 0
}
