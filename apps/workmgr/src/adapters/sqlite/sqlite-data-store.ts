// SqliteDataStore: Node-only adapter for DataStore port using better-sqlite3.
// Ported from v1 dev-server/sqlite-data-store.js.
// Fix v1: ép kiểu theo cờ `t` trong schema khi ĐỌC — t:'int' → Number(), t:'text' → String().
// Không blanket String() mọi thứ như v1 → objectId/id trả về number đúng kiểu.

import Database from 'better-sqlite3'
import type { DataStore, Collection, DomainRecord, Query, Page, FilterOp } from '../../core/ports/data-store'
import { getSchema, domainToSqlRow, sqlRowToDomain } from '../../core/schema'

export function createSqliteDataStore(db: InstanceType<typeof Database>): DataStore {
  function _table(collection: Collection): string {
    return getSchema(collection).table
  }

  // Ép kiểu theo cờ `t` — đây là fix v1 chính: t:'int' trả number, t:'text' trả string.
  function _coerce(collection: Collection, sqlRow: DomainRecord): DomainRecord {
    const fields = getSchema(collection).fields
    const domain = sqlRowToDomain(collection, sqlRow)
    const result: DomainRecord = {}
    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(domain, f.d)) {
        const val = domain[f.d]
        if (val == null) {
          result[f.d] = val
        } else if (f.t === 'int') {
          result[f.d] = Number(val)  // <- int-coercion: line 26
        } else {
          result[f.d] = String(val)
        }
      }
    }
    return result
  }

  // Map a domain field name to its SQL column name via schema.
  function _colOf(collection: Collection, field: string): string {
    const row = domainToSqlRow(collection, { [field]: null })
    const keys = Object.keys(row)
    if (!keys.length) throw new Error('Field không tồn tại trong schema: ' + field)
    return keys[0]
  }

  // Map FilterOp to SQL operator fragment (returns [sqlFragment, bindValue]).
  function _opSql(col: string, op: FilterOp, value: string | number | boolean): [string, unknown] {
    if (op === 'contains') return [col + " LIKE '%' || ? || '%'", value]
    // Validate op is one of the safe set — no interpolation risk since col comes from schema.
    const safe: Record<string, string> = { '=': '=', '!=': '!=', '<': '<', '>': '>', '>=': '>=', '<=': '<=' }
    if (!safe[op]) throw new Error('FilterOp không hợp lệ: ' + op)
    return [col + ' ' + safe[op] + ' ?', value]
  }

  const store: DataStore = {
    getAll(collection: Collection): DomainRecord[] {
      const rows = db.prepare('SELECT * FROM ' + _table(collection)).all() as DomainRecord[]
      return rows.map(r => _coerce(collection, r))
    },

    insert(collection: Collection, record: DomainRecord): DomainRecord {
      const row = domainToSqlRow(collection, record)
      delete row.id // để SQLite tự tăng autoincrement
      const cols = Object.keys(row)
      const sql = 'INSERT INTO ' + _table(collection) +
        ' (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')'
      const binds = cols.map(c => (row[c] == null ? null : String(row[c])))
      const info = db.prepare(sql).run(binds)
      const newId = Number(info.lastInsertRowid) // lastInsertRowid là number|bigint → ép về number
      return { ...record, id: newId }
    },

    update(collection: Collection, id: string | number, fields: DomainRecord): void {
      const row = domainToSqlRow(collection, fields)
      delete row.id
      const cols = Object.keys(row)
      if (!cols.length) return
      const sql = 'UPDATE ' + _table(collection) +
        ' SET ' + cols.map(c => c + '=?').join(',') + ' WHERE id=?'
      const binds = [...cols.map(c => (row[c] == null ? null : String(row[c]))), id]
      const info = db.prepare(sql).run(binds)
      if (info.changes === 0) throw new Error('Không tìm thấy bản ghi ID: ' + id)
    },

    remove(collection: Collection, id: string | number): void {
      const info = db.prepare('DELETE FROM ' + _table(collection) + ' WHERE id=?').run(id)
      if (info.changes === 0) throw new Error('Không tìm thấy bản ghi ID: ' + id)
    },

    find(collection: Collection, query: Query): Page {
      const table = _table(collection)
      const { where = [], orderBy = [], limit, offset } = query

      // Build WHERE clause with parameterized binds.
      const whereParts: string[] = []
      const binds: unknown[] = []
      for (const f of where) {
        const col = _colOf(collection, f.field)
        const [frag, val] = _opSql(col, f.op, f.value)
        whereParts.push(frag)
        binds.push(val)
      }
      const whereClause = whereParts.length ? ' WHERE ' + whereParts.join(' AND ') : ''

      // COUNT for total (ignores limit/offset).
      const countRow = db.prepare('SELECT COUNT(*) as n FROM ' + table + whereClause).get(binds) as { n: number }
      const total = Number(countRow.n)

      // Build ORDER BY clause. Validate dir to prevent injection.
      let orderClause = ''
      if (orderBy.length) {
        const parts = orderBy.map(s => {
          const col = _colOf(collection, s.field)
          if (s.dir !== 'asc' && s.dir !== 'desc') throw new Error('Sort dir không hợp lệ: ' + s.dir)
          return col + ' ' + s.dir
        })
        orderClause = ' ORDER BY ' + parts.join(', ')
      }

      let sql = 'SELECT * FROM ' + table + whereClause + orderClause
      if (limit != null) sql += ' LIMIT ' + Number(limit)
      if (offset != null) sql += ' OFFSET ' + Number(offset)

      const sqlRows = db.prepare(sql).all(binds) as DomainRecord[]
      const rows = sqlRows.map(r => _coerce(collection, r))
      return { rows, total }
    },
  }

  return store
}
