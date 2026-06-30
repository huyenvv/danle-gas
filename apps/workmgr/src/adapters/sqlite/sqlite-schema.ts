// sqlite-schema: tạo bảng SQLite từ schema nếu chưa tồn tại.
// Ported from v1 dev-server/sqlite-data-store.js createSqliteSchema.
// Cột id → INTEGER PRIMARY KEY AUTOINCREMENT; các cột khác → TEXT.

import Database from 'better-sqlite3'
import type { Collection } from '../../core/ports/data-store'
import { getSchema } from '../../core/schema'

export function createSqliteTables(
  db: InstanceType<typeof Database>,
  collections: Collection[],
): void {
  for (const collection of collections) {
    const s = getSchema(collection)
    const defs = s.fields.map(f =>
      f.d === 'id'
        ? f.c + ' INTEGER PRIMARY KEY AUTOINCREMENT'
        : f.c + ' TEXT',
    )
    db.prepare('CREATE TABLE IF NOT EXISTS ' + s.table + ' (' + defs.join(', ') + ')').run()
  }
}
