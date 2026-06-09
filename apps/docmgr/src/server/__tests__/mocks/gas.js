// Mock GAS global APIs for Jest

// ── SpreadsheetApp ────────────────────────────────────────────────────────────
global.SpreadsheetApp = {
  _sheets: {},
  _externalSpreadsheets: {},  // id → { sheets: {}, ownerEmail }
  _reset() {
    this._sheets = {}
    this._externalSpreadsheets = {}
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
            getValue() { return sheet._rows[row - 1][col - 1] }
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
    const ext = this._externalSpreadsheets[id]
    if (!ext) throw new Error('Spreadsheet not found: ' + id)
    return {
      getSheetByName(name) { return ext.sheets[name] || null },
      getSheets()          { return Object.values(ext.sheets) },
      getId()              { return id },
      getOwner()           { return { getEmail() { return ext.ownerEmail || 'owner@test.com' } } },
    }
  },
  /** Register an external spreadsheet (e.g. SSO parent) for openById */
  _addExternalSheet(ssId, sheetName, rows) {
    if (!this._externalSpreadsheets[ssId]) {
      this._externalSpreadsheets[ssId] = { sheets: {}, ownerEmail: 'owner@test.com' }
    }
    const sheetObj = {
      _name: sheetName,
      _rows: rows ? rows.map(r => [...r]) : [[]],
      getName()   { return this._name },
      getLastRow() { return this._rows.length },
      getDataRange() {
        const data = this._rows
        return { getValues() { return data.map(r => [...r]) } }
      },
      getRange(row, col) {
        const sheet = this
        return {
          getValue() { return sheet._rows[row - 1][col - 1] },
          setValue(v) { sheet._rows[row - 1][col - 1] = v },
        }
      },
      appendRow(row) { this._rows.push([...row]) },
    }
    this._externalSpreadsheets[ssId].sheets[sheetName] = sheetObj
  },
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

// ── DriveApp ──────────────────────────────────────────────────────────────────
global.DriveApp = {
  Access:     { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
  Permission: { VIEW: 'VIEW' },
  _files: {},
  _reset()   { this._files = {} },
  getFolderById(id) {
    const files = this._files
    const self = this
    // Returns a folder "handle" — raw file object augmented with folder-API methods
    function makeFolderHandle(f) {
      return Object.assign(f, {
        getId()  { return f.id },
        setName(nm) { f.name = nm },
        getFoldersByName(n) {
          const match = Object.values(files).find(fi => fi.name === n && fi.isFolder)
          return { hasNext: () => !!match, next: () => match ? makeFolderHandle(match) : null }
        },
        createFolder(n) {
          const nf = { id: 'folder_' + n, name: n, isFolder: true }
          files[nf.id] = nf
          return makeFolderHandle(nf)
        },
        createFile(blob) {
          const fid = 'file_' + Date.now()
          files[fid] = { id: fid, name: blob.getName(), trashed: false }
          return {
            getId()     { return fid },
            getUrl()    { return 'https://drive.google.com/file/d/' + fid },
            setSharing(){}
          }
        },
      })
    }
    // Ensure root pseudo-folder exists
    if (!files[id]) files[id] = { id, name: 'root', isFolder: true }
    return makeFolderHandle(files[id])
  },
  getFileById(id) {
    const files = this._files
    if (!files[id]) throw new Error('No item with the given ID could be found: ' + id)
    return {
      setTrashed(v) { files[id].trashed = v },
      getUrl()      { return 'https://drive.google.com/file/d/' + id },
      moveTo(folder) { /* no-op in mock */ },
      setSharing(access, permission) { files[id].sharing = { access, permission } },
    }
  }
}

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
    // Simple deterministic mock — just hash the string chars
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
  getOAuthToken() { return 'mock-oauth-token' },
  getService() {
    return { getUrl() { return 'https://script.google.com/macros/s/test-script-id-1234/exec' } }
  }
}

// ── UrlFetchApp ────────────────────────────────────────────────────────────────
// Configurable response for resumable-upload tests. Set _nextResponse before a call.
global.UrlFetchApp = {
  _nextResponse: { code: 200, headers: { Location: 'https://www.googleapis.com/upload/resume-uri' }, body: '{}' },
  _lastRequest: null,
  fetch(url, params) {
    this._lastRequest = { url, params }
    const r = this._nextResponse
    return {
      getResponseCode() { return r.code },
      getAllHeaders()   { return r.headers || {} },
      getContentText()  { return r.body || '' },
    }
  }
}

// ── Session ───────────────────────────────────────────────────────────────────
let _sessionEmail = 'test@example.com'
global.Session = {
  _setEmail(email) { _sessionEmail = email },
  getActiveUser() { return { getEmail: () => _sessionEmail } }
}

// ── Logger ────────────────────────────────────────────────────────────────────
global.Logger = {
  log(...args) { /* silent in tests */ }
}

// ── GmailApp ─────────────────────────────────────────────────────────────
global.GmailApp = {
  _sent: [],
  _reset() { this._sent = [] },
  sendEmail(to, subject, body, options) {
    this._sent.push({ to, subject, body, options: options || {} })
  }
}

// ── Console ───────────────────────────────────────────────────────────────────
global.console = global.console || { log() {}, error() {}, warn() {} }
