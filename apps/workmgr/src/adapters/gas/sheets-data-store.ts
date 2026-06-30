// SheetsDataStore: pure Sheets I/O adapter for DataStore port.
// Ported from v1 src/server/core/sheets-data-store.js.
// ALL cache calls removed — caching is CachingDataStore's job (decorator, T4).

import type { DataStore, Collection, DomainRecord, Query, Page } from '../../core/ports/data-store'
import { getSchema, sheetHeaders, domainToSheet, sheetToDomain } from '../../core/schema'
import { ensureSheet, getCentralSheet } from './gas-config'
import { buildGvizTq, parseGvizRows, parseGvizCount } from './gviz'

export function createSheetsDataStore(): DataStore {
  function _sheet(collection: Collection): GoogleAppsScript.Spreadsheet.Sheet {
    const s = getSchema(collection)
    return ensureSheet(s.sheet, sheetHeaders(collection))
  }

  // Read all rows from sheet, return as objects keyed by VN header.
  function _readRaw(collection: Collection): DomainRecord[] {
    const sheet = _sheet(collection)
    const values: unknown[][] = sheet.getDataRange().getValues() as unknown[][]
    const headers = (values[0] || []) as string[]
    const rows: DomainRecord[] = []
    for (let i = 1; i < values.length; i++) {
      const obj: DomainRecord = {}
      headers.forEach((h, c) => { obj[h] = (values[i] as unknown[])[c] })
      rows.push(obj)
    }
    return rows
  }

  function _nextId(collection: Collection): number {
    const rows = _readRaw(collection)
    let max = 0
    rows.forEach(r => {
      const n = Number(r['ID'])
      if (n > max) max = n
    })
    return max + 1
  }

  const store: DataStore = {
    getAll(collection: Collection): DomainRecord[] {
      return _readRaw(collection).map(row => sheetToDomain(collection, row))
    },

    insert(collection: Collection, record: DomainRecord): DomainRecord {
      const dom: DomainRecord = { ...record }
      if (dom.id == null) dom.id = _nextId(collection)
      const headers = sheetHeaders(collection)
      const rowObj = domainToSheet(collection, dom)
      const sheet = _sheet(collection)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GAS appendRow accepts any[]
      sheet.appendRow(headers.map(h => (Object.prototype.hasOwnProperty.call(rowObj, h) ? rowObj[h] : '')) as any[])
      return dom
    },

    update(collection: Collection, id: string | number, fields: DomainRecord): void {
      const s = getSchema(collection)
      const sheet = _sheet(collection)
      const values: unknown[][] = sheet.getDataRange().getValues() as unknown[][]
      const headers = (values[0] || []) as string[]
      const idCol = headers.indexOf('ID')
      if (idCol === -1) throw new Error('Sheet không có cột ID: ' + s.sheet)
      const rowObj = domainToSheet(collection, fields)
      for (let i = 1; i < values.length; i++) {
        if (String((values[i] as unknown[])[idCol]) === String(id)) {
          headers.forEach((h, c) => {
            if (Object.prototype.hasOwnProperty.call(rowObj, h)) {
              sheet.getRange(i + 1, c + 1).setValue(rowObj[h])
            }
          })
          return
        }
      }
      throw new Error('Không tìm thấy bản ghi ID: ' + id)
    },

    remove(collection: Collection, id: string | number): void {
      const sheet = _sheet(collection)
      const values: unknown[][] = sheet.getDataRange().getValues() as unknown[][]
      const headers = (values[0] || []) as string[]
      const idCol = headers.indexOf('ID')
      for (let i = 1; i < values.length; i++) {
        if (String((values[i] as unknown[])[idCol]) === String(id)) {
          sheet.deleteRow(i + 1)
          return
        }
      }
      throw new Error('Không tìm thấy bản ghi ID: ' + id)
    },

    find(collection: Collection, query: Query): Page {
      const schema = getSchema(collection)
      const headers = sheetHeaders(collection)

      // Build domain-field → VN-header map from schema
      const fieldToHeader: Record<string, string> = {}
      for (const f of schema.fields) fieldToHeader[f.d] = f.h

      const ss = getCentralSheet()
      const sheet = ss.getSheetByName(schema.sheet)
      if (!sheet) return { rows: [], total: 0 }

      const ssId = ss.getId()
      const gid = sheet.getSheetId()
      const baseUrl = 'https://docs.google.com/spreadsheets/d/' + ssId + '/gviz/tq?gid=' + gid + '&headers=1'

      const authHeader = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }

      // Data query (with limit/offset)
      const dataTq = buildGvizTq(fieldToHeader, query, headers)
      const dataUrl = baseUrl + '&tq=' + encodeURIComponent(dataTq)
      const dataResp = UrlFetchApp.fetch(dataUrl, { headers: authHeader, muteHttpExceptions: true })
      if (dataResp.getResponseCode() !== 200) {
        throw new Error('Lỗi gviz fetch (mã ' + dataResp.getResponseCode() + ')')
      }
      const rows = parseGvizRows(dataResp.getContentText(), collection, headers)

      // Count query (same WHERE, no limit/offset, select count(A))
      const countTq = buildGvizTq(fieldToHeader, { where: query.where }, headers, 'count(A)')
      const countUrl = baseUrl + '&tq=' + encodeURIComponent(countTq)
      const countResp = UrlFetchApp.fetch(countUrl, { headers: authHeader, muteHttpExceptions: true })
      if (countResp.getResponseCode() !== 200) {
        throw new Error('gviz count query failed: HTTP ' + countResp.getResponseCode())
      }
      const total = parseGvizCount(countResp.getContentText())

      return { rows, total }
    },
  }

  return store
}
