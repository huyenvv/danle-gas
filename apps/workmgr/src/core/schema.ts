// ===== REGISTRY: domain (ASCII) ↔ lưu trữ (sheet header VN / cột SQL) =====
// Mọi tên cột VN/SQL chỉ sống ở đây + trong adapter. Service/Repo/client chỉ thấy field ASCII.
//
// Cờ `t`: 'int' dùng để adapter SQL ép kiểu số (SQLite trả string cho non-id TEXT),
// sửa vấn đề Minor từ v1. Mappers trong file này KHÔNG dùng `t` — chỉ khai báo.

import type { Collection, DomainRecord } from './ports/data-store'

export interface FieldDef {
  d: string        // tên domain (ASCII)
  h: string        // header sheet (tiếng Việt)
  c: string        // cột SQL (snake_case)
  t: 'int' | 'text'
}

interface CollectionSchema {
  sheet: string
  table: string
  idField: string
  fields: FieldDef[]
}

const SCHEMA: Record<Collection, CollectionSchema> = {
  labels: {
    sheet: 'Nhãn', table: 'labels', idField: 'id',
    fields: [
      { d: 'id',    h: 'ID',       c: 'id',    t: 'int'  },
      { d: 'name',  h: 'Tên nhãn', c: 'name',  t: 'text' },
      { d: 'color', h: 'Màu sắc',  c: 'color', t: 'text' },
    ],
  },
  activities: {
    sheet: '_Hoạt Động', table: 'activities', idField: 'id',
    fields: [
      { d: 'id',          h: 'ID',             c: 'id',          t: 'int'  },
      { d: 'type',        h: 'Loại',           c: 'type',        t: 'text' },
      { d: 'description', h: 'Mô tả',          c: 'description', t: 'text' },
      { d: 'objectType',  h: 'Đối tượng',      c: 'object_type', t: 'text' },
      { d: 'objectId',    h: 'Mã đối tượng',   c: 'object_id',   t: 'int'  },
      { d: 'userId',      h: 'UserID',         c: 'user_id',     t: 'text' },
      { d: 'userName',    h: 'Tên người dùng', c: 'user_name',   t: 'text' },
      { d: 'at',          h: 'Thời gian',      c: 'at',          t: 'text' },
    ],
  },
  audit: {
    sheet: '_Nhật Ký', table: 'audit', idField: 'id',
    fields: [
      { d: 'id',      h: 'ID',         c: 'id',      t: 'int'  },
      { d: 'at',      h: 'Thời gian',  c: 'at',      t: 'text' },
      { d: 'user',    h: 'Người dùng', c: 'user',    t: 'text' },
      { d: 'email',   h: 'Email',      c: 'email',   t: 'text' },
      { d: 'action',  h: 'Hành động',  c: 'action',  t: 'text' },
      { d: 'type',    h: 'Loại',       c: 'type',    t: 'text' },
      { d: 'target',  h: 'Đối tượng',  c: 'target',  t: 'text' },
      { d: 'details', h: 'Chi tiết',   c: 'details', t: 'text' },
    ],
  },
}

export function getSchema(collection: Collection): CollectionSchema {
  const s = SCHEMA[collection]
  if (!s) throw new Error('Schema không tồn tại cho collection: ' + collection)
  return s
}

export function sheetHeaders(collection: Collection): string[] {
  return getSchema(collection).fields.map(f => f.h)
}

type MapKey = 'd' | 'h' | 'c'

function _mapBy(collection: Collection, fromKey: MapKey, toKey: MapKey, obj: DomainRecord): DomainRecord {
  const out: DomainRecord = {}
  for (const f of getSchema(collection).fields) {
    const from = f[fromKey] as string
    const to = f[toKey] as string
    if (Object.prototype.hasOwnProperty.call(obj, from)) {
      out[to] = obj[from]
    }
  }
  return out
}

export function domainToSheet(collection: Collection, obj: DomainRecord): DomainRecord {
  return _mapBy(collection, 'd', 'h', obj)
}

export function sheetToDomain(collection: Collection, row: DomainRecord): DomainRecord {
  return _mapBy(collection, 'h', 'd', row)
}

export function domainToSqlRow(collection: Collection, obj: DomainRecord): DomainRecord {
  return _mapBy(collection, 'd', 'c', obj)
}

export function sqlRowToDomain(collection: Collection, row: DomainRecord): DomainRecord {
  return _mapBy(collection, 'c', 'd', row)
}
