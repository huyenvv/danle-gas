// GAS global mock for Jest TS tests.
// Types: use @types/google-apps-script where reasonable.
// `any` is used only at GAS-mock boundaries (appendRow, getValues, etc.)
// where the real GAS API is untyped or too wide to model precisely.

// ── TextFinder ─────────────────────────────────────────────────────────────────
function _mockTextFinder(
  sheet: MockSheet,
  startRow: number,
  startCol: number,
  numRows: number,
  numCols: number,
  query: string,
) {
  let entire = false
  const q = String(query)
  function scan(collect: boolean): any {
    const out: any[] = []
    for (let r = 0; r < numRows; r++) {
      const rowArr = sheet._rows[startRow - 1 + r]
      if (!rowArr) continue
      for (let c = 0; c < numCols; c++) {
        const cell = rowArr[startCol - 1 + c]
        const s = cell == null ? '' : String(cell)
        const hit = entire ? s === q : s.indexOf(q) !== -1
        if (hit) {
          const absRow = startRow + r
          const absCol = startCol + c
          const range = { getRow: () => absRow, getColumn: () => absCol, getValue: () => cell }
          if (!collect) return range
          out.push(range)
        }
      }
    }
    return collect ? out : null
  }
  return {
    matchEntireCell(b: boolean) { entire = b; return this },
    matchCase() { return this },
    matchDiacritics() { return this },
    findNext() { return scan(false) },
    findAll() { return scan(true) },
  }
}

// ── MockSheet ─────────────────────────────────────────────────────────────────
interface MockSheet {
  _name: string
  _rows: any[][]
  getName(): string
  getLastRow(): number
  getLastColumn(): number
  getMaxColumns(): number
  getDataRange(): any
  getRange(row: number, col: number, numRows?: number, numCols?: number): any
  createTextFinder(q: string): any
  appendRow(row: any[]): void
  deleteRow(n: number): void
  hideSheet(): void
  insertRowAfter(): MockSheet
  setName(): MockSheet
}

function _makeSheet(name: string, rows?: any[][]): MockSheet {
  const sheet: MockSheet = {
    _name: name,
    _rows: rows ? rows.map((r: any[]) => [...r]) : [[]],
    getName() { return this._name },
    getLastRow() { return this._rows.length },
    getLastColumn() { return this._rows[0] ? this._rows[0].length : 0 },
    getMaxColumns() { return this._rows[0] ? this._rows[0].length : 0 },
    getDataRange() {
      const rows = this._rows
      return { getValues() { return rows.map((r: any[]) => [...r]) } }
    },
    getRange(row: number, col: number, numRows?: number, numCols?: number) {
      const sh = this
      if (numRows === 1 && numCols) {
        return {
          getValues() { return [sh._rows[row - 1].slice(col - 1, col - 1 + numCols!)] },
          getValue() { return sh._rows[row - 1][col - 1] },
          // setValues([[...headers]]) — used by ensureSheet to write header row
          setValues(data: any[][]) {
            const r = data[0]
            // Ensure row exists
            while (sh._rows.length < row) sh._rows.push([])
            sh._rows[row - 1] = [...r]
          },
          createTextFinder(q: string) { return _mockTextFinder(sh, row, col, numRows, numCols!, q) },
        }
      }
      return {
        getValue() { return sh._rows[row - 1][col - 1] },
        setValue(v: any) { sh._rows[row - 1][col - 1] = v },
        getValues() { return [sh._rows[row - 1].slice(col - 1, col - 1 + (numCols || 1))] },
        createTextFinder(q: string) { return _mockTextFinder(sh, row, col, numRows || 1, numCols || 1, q) },
      }
    },
    createTextFinder(q: string) {
      return _mockTextFinder(this, 1, 1, this._rows.length, (this._rows[0] || []).length, q)
    },
    appendRow(row: any[]) { this._rows.push([...row]) },
    deleteRow(n: number) { this._rows.splice(n - 1, 1) },
    hideSheet() {},
    insertRowAfter() { return this },
    setName() { return this },
  }
  return sheet
}

// ── SpreadsheetApp ────────────────────────────────────────────────────────────
interface MockSpreadsheetApp {
  _sheets: Record<string, MockSheet>
  _externalSpreadsheets: Record<string, { sheets: Record<string, MockSheet>; ownerEmail: string }>
  _reset(): void
  _addSheet(name: string, rows?: any[][]): void
  _addExternalSheet(ssId: string, sheetName: string, rows?: any[][]): void
  getActiveSpreadsheet(): any
  openById(id: string): any
}

const SpreadsheetAppMock: MockSpreadsheetApp = {
  _sheets: {},
  _externalSpreadsheets: {},
  _reset() {
    this._sheets = {}
    this._externalSpreadsheets = {}
  },
  _addSheet(name: string, rows?: any[][]) {
    this._sheets[name] = _makeSheet(name, rows)
  },
  _addExternalSheet(ssId: string, sheetName: string, rows?: any[][]) {
    if (!this._externalSpreadsheets[ssId]) {
      this._externalSpreadsheets[ssId] = { sheets: {}, ownerEmail: 'owner@test.com' }
    }
    this._externalSpreadsheets[ssId].sheets[sheetName] = _makeSheet(sheetName, rows)
  },
  getActiveSpreadsheet() {
    const sheets = this._sheets
    return {
      getSheetByName(name: string) { return sheets[name] || null },
      getSheets() { return Object.values(sheets) },
      getId() { return 'mock-spreadsheet-id' },
      getOwner() { return { getEmail() { return 'owner@test.com' } } },
      insertSheet(name: string) {
        SpreadsheetAppMock._addSheet(name, [[]])
        return sheets[name]
      },
    }
  },
  openById(id: string) {
    const ext = this._externalSpreadsheets[id]
    if (!ext) throw new Error('Spreadsheet not found: ' + id)
    return {
      getSheetByName(name: string) { return ext.sheets[name] || null },
      getSheets() { return Object.values(ext.sheets) },
      getId() { return id },
      getOwner() { return { getEmail() { return ext.ownerEmail || 'owner@test.com' } } },
    }
  },
}

// ── CacheService ──────────────────────────────────────────────────────────────
interface MockCacheStore {
  _reset(): void
  get(k: string): string | null
  put(k: string, v: string, ttl?: number): void
  remove(k: string): void
  getAll(keys: string[]): Record<string, string | null>
}

const CacheServiceMock = (() => {
  let _store: Record<string, string> = {}
  const cache: MockCacheStore = {
    _reset() { _store = {} },
    get(k: string) { return _store[k] !== undefined ? _store[k] : null },
    put(k: string, v: string) { _store[k] = v },
    remove(k: string) { delete _store[k] },
    getAll(keys: string[]) {
      const out: Record<string, string | null> = {}
      keys.forEach(k => { out[k] = _store[k] !== undefined ? _store[k] : null })
      return out
    },
  }
  return {
    getScriptCache() { return cache },
    getUserCache() { return cache },
    getDocumentCache() { return cache },
  }
})()

// ── PropertiesService ─────────────────────────────────────────────────────────
const PropertiesServiceMock = (() => {
  let _props: Record<string, string> = {}
  const store = {
    _reset() { _props = {} },
    getProperty(k: string) { return _props[k] || null },
    setProperty(k: string, v: string) { _props[k] = String(v) },
    deleteProperty(k: string) { delete _props[k] },
    getProperties() { return { ..._props } },
    setProperties(obj: Record<string, string>) { Object.assign(_props, obj) },
  }
  return {
    getScriptProperties() { return store },
    getUserProperties() { return store },
    getDocumentProperties() { return store },
    _store: () => _props,
    _reset() { store._reset() },
  }
})()

// ── Logger ────────────────────────────────────────────────────────────────────
const LoggerMock = {
  log(..._args: any[]) { /* silent in tests */ },
}

// ── UrlFetchApp ───────────────────────────────────────────────────────────────
// Queue-based: each fetch() call pops the first pending response.
// Tests push responses via UrlFetchAppMock._pushResponse({ code, body }).
// Captures all requests in UrlFetchAppMock._requests for assertion.
interface MockFetchResponse {
  code: number
  body: string
}

interface MockHttpResponse {
  getResponseCode(): number
  getContentText(): string
}

const UrlFetchAppMock = (() => {
  let _queue: MockFetchResponse[] = []
  let _requests: { url: string; options?: unknown }[] = []

  function _reset() {
    _queue = []
    _requests = []
  }
  function _pushResponse(r: MockFetchResponse) { _queue.push(r) }

  return {
    _reset,
    _pushResponse,
    get _requests() { return _requests },
    fetch(url: string, options?: unknown): MockHttpResponse {
      _requests.push({ url, options })
      const r = _queue.shift()
      if (!r) throw new Error('UrlFetchAppMock: no response queued for ' + url)
      return {
        getResponseCode() { return r.code },
        getContentText() { return r.body },
      }
    },
  }
})()

// ── ScriptApp ─────────────────────────────────────────────────────────────────
const ScriptAppMock = {
  getOAuthToken() { return 'mock-oauth-token' },
}

// ── Patch MockSheet to add getSheetId ─────────────────────────────────────────
// getSheetId() returns a stable numeric id based on sheet name hash (simple counter).
let _sheetIdCounter = 1
const _sheetIds = new Map<string, number>()

function _getSheetId(name: string): number {
  if (!_sheetIds.has(name)) _sheetIds.set(name, _sheetIdCounter++)
  return _sheetIds.get(name)!
}

// Patch _makeSheet to include getSheetId after the fact — we monkey-patch the
// mock objects in _addSheet rather than changing the function signature.
const _origAddSheet = SpreadsheetAppMock._addSheet.bind(SpreadsheetAppMock)
SpreadsheetAppMock._addSheet = function(name: string, rows?: any[][]) {
  _origAddSheet(name, rows)
  const sheet = this._sheets[name] as any
  sheet.getSheetId = () => _getSheetId(name)
}

// ── Register globals ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const global: any

global.SpreadsheetApp = SpreadsheetAppMock
global.CacheService = CacheServiceMock
global.PropertiesService = PropertiesServiceMock
global.Logger = LoggerMock
global.UrlFetchApp = UrlFetchAppMock
global.ScriptApp = ScriptAppMock

// ── Exported reset helper ─────────────────────────────────────────────────────
export function resetGAS(): void {
  SpreadsheetAppMock._reset()
  CacheServiceMock.getScriptCache()._reset()
  PropertiesServiceMock._reset()
  UrlFetchAppMock._reset()
  _sheetIds.clear()
  _sheetIdCounter = 1
}

export { SpreadsheetAppMock, CacheServiceMock, PropertiesServiceMock, UrlFetchAppMock }
