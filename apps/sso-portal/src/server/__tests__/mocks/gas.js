// Mock GAS global APIs for Jest — SSO Portal

// ── SpreadsheetApp ────────────────────────────────────────────────────────────
global.SpreadsheetApp = {
  _sheets: {},
  _reset() {
    this._sheets = {}
  },
  _addSheet(name, rows) {
    this._sheets[name] = {
      _name: name,
      _rows: rows ? rows.map(r => [...r]) : [[]],
      getName()   { return this._name },
      getLastRow() { return this._rows.length },
      getLastColumn()  { return this._rows[0] ? this._rows[0].length : 0 },
      getMaxColumns()  { return this._rows[0] ? this._rows[0].length : 0 },
      getDataRange() {
        const rows = this._rows
        return {
          getValues() { return rows.map(r => [...r]) }
        }
      },
      getRange(row, col, numRows, numCols) {
        const sheet = this
        if (numRows === 1 && numCols) {
          return {
            getValues() {
              return [sheet._rows[row - 1].slice(col - 1, col - 1 + numCols)]
            },
            setValues(vals) {
              vals[0].forEach((v, i) => { sheet._rows[row - 1][col - 1 + i] = v })
            },
            getValue() { return sheet._rows[row - 1][col - 1] }
          }
        }
        if (numRows && numCols) {
          return {
            getValues() {
              const result = []
              for (let r = 0; r < numRows; r++) {
                result.push(sheet._rows[row - 1 + r].slice(col - 1, col - 1 + numCols))
              }
              return result
            },
            setValues(vals) {
              for (let r = 0; r < vals.length; r++) {
                for (let c = 0; c < vals[r].length; c++) {
                  if (!sheet._rows[row - 1 + r]) sheet._rows[row - 1 + r] = []
                  sheet._rows[row - 1 + r][col - 1 + c] = vals[r][c]
                }
              }
            },
          }
        }
        return {
          getValue() { return sheet._rows[row - 1][col - 1] },
          setValue(v) { sheet._rows[row - 1][col - 1] = v },
          getValues() { return [sheet._rows[row - 1].slice(col - 1, col - 1 + (numCols || 1))] }
        }
      },
      appendRow(row) { this._rows.push([...row]) },
      deleteRow(n) { this._rows.splice(n - 1, 1) },
      hideSheet() {},
      hideColumns() {},
      setFrozenRows() {},
      insertRowAfter() { return this },
      setName() { return this },
    }
  },
  getActiveSpreadsheet() {
    const sheets = this._sheets
    return {
      getSheetByName(name) { return sheets[name] || null },
      getSheets()          { return Object.values(sheets) },
      getId()              { return 'mock-spreadsheet-id' },
      getOwner()           { return { getEmail() { return 'owner@test.com' } } },
      insertSheet(name) {
        SpreadsheetApp._addSheet(name, [[]])
        return sheets[name]
      }
    }
  },
  openById(id) {
    // Cross-script: return same spreadsheet (for testing)
    return this.getActiveSpreadsheet()
  }
}

// ── CacheService ──────────────────────────────────────────────────────────────
global.CacheService = (() => {
  let _store = {}
  const cache = {
    _reset()  { _store = {} },
    get(k)    { return _store[k] !== undefined ? _store[k] : null },
    put(k, v) { _store[k] = v },
    remove(k) { delete _store[k] },
    getAll(keys) {
      const out = {}
      keys.forEach(k => { out[k] = _store[k] !== undefined ? _store[k] : null })
      return out
    }
  }
  return {
    getScriptCache()  { return cache },
    getUserCache()    { return cache },
    getDocumentCache(){ return cache },
  }
})()

// ── LockService ───────────────────────────────────────────────────────────────
global.LockService = {
  getScriptLock() {
    return {
      waitLock() {},
      releaseLock() {},
      tryLock() { return true },
    }
  }
}

// ── PropertiesService ─────────────────────────────────────────────────────────
global.PropertiesService = (() => {
  let _props = {}
  const store = {
    _reset()     { _props = {} },
    getProperty(k)       { return _props[k] || null },
    setProperty(k, v)    { _props[k] = String(v) },
    deleteProperty(k)    { delete _props[k] },
    getProperties()      { return { ..._props } },
    setProperties(obj)   { Object.assign(_props, obj) },
  }
  return {
    getScriptProperties()  { return store },
    getUserProperties()    { return store },
    getDocumentProperties(){ return store },
    _store: () => _props,
    _reset() { store._reset() }
  }
})()

// ── Utilities ─────────────────────────────────────────────────────────────────
global.Utilities = {
  getUuid()       { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  }) },
  base64Decode(s) { return Array.from(Buffer.from(s, 'base64')) },
  newBlob(bytes, mime, name) {
    return {
      getBytes()  { return bytes },
      getName()   { return name },
      getMimeType(){ return mime },
      getDataAsString() { return Buffer.from(bytes).toString('utf8') }
    }
  },
  computeDigest(algo, input) {
    const bytes = []
    for (let i = 0; i < input.length; i++) bytes.push(input.charCodeAt(i) & 0xff)
    return bytes
  },
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  formatDate(date, tz, fmt) {
    return date.toISOString()
  },
}

// ── HtmlService ───────────────────────────────────────────────────────────────
global.HtmlService = {
  XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' },
  createHtmlOutput(html) {
    return {
      _html: html,
      getContent() { return html },
      setTitle(t) { this._title = t; return this },
      setXFrameOptionsMode() { return this },
    }
  },
  createHtmlOutputFromFile(name) {
    return this.createHtmlOutput('FILE:' + name)
  }
}

// ── ScriptApp ─────────────────────────────────────────────────────────────────
global.ScriptApp = {
  _scriptId: 'test-script-id-1234',
  getScriptId() { return this._scriptId },
  getService() {
    return { getUrl() { return 'https://script.google.com/macros/s/test-script-id-1234/exec' } }
  }
}

// ── Session ───────────────────────────────────────────────────────────────────
let _sessionEmail = 'test@example.com'
global.Session = {
  _setEmail(email) { _sessionEmail = email },
  getActiveUser() { return { getEmail: () => _sessionEmail } }
}

// ── GmailApp ──────────────────────────────────────────────────────────────────
global.GmailApp = {
  _sent: [],
  _reset() { this._sent = [] },
  sendEmail(to, subject, body, options) {
    this._sent.push({ to, subject, body, options })
  }
}

// ── Logger ────────────────────────────────────────────────────────────────────
global.Logger = {
  log(...args) { /* silent in tests */ }
}

// ── Console ───────────────────────────────────────────────────────────────────
global.console = global.console || { log() {}, error() {}, warn() {} }
