// Mock GAS global APIs for Jest

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
      getLastColumn() { return this._rows[0] ? this._rows[0].length : 0 },
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
      insertSheet(name) {
        SpreadsheetApp._addSheet(name, [[]])
        return sheets[name]
      }
    }
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

// ── DriveApp ──────────────────────────────────────────────────────────────────
global.DriveApp = {
  Access:     { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
  Permission: { VIEW: 'VIEW' },
  _files: {},
  _reset()   { this._files = {} },
  getFolderById(id) {
    const files = this._files
    const file  = { id, name: id, _files: {} }
    return {
      getFoldersByName(n) {
        let hasNext = false
        const match = Object.values(files).find(f => f.name === n && f.isFolder)
        if (match) hasNext = true
        return { hasNext: () => hasNext, next: () => match }
      },
      createFolder(n) {
        const f = { id: 'folder_' + n, name: n, isFolder: true }
        files[f.id] = f
        return {
          getId()  { return f.id },
          createFile(blob) {
            const fid = 'file_' + Date.now()
            files[fid] = { id: fid, name: blob.getName(), trashed: false }
            return {
              getId()     { return fid },
              getUrl()    { return 'https://drive.google.com/file/d/' + fid },
              setSharing(){}
            }
          }
        }
      },
      getId() { return id }
    }
  },
  getFileById(id) {
    const files = this._files
    return {
      setTrashed(v) { if (files[id]) files[id].trashed = v },
      getUrl()      { return 'https://drive.google.com/file/d/' + id },
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
  getService() {
    return { getUrl() { return 'https://script.google.com/macros/s/test-script-id-1234/exec' } }
  }
}

// ── Session ───────────────────────────────────────────────────────────────────
global.Session = {
  getActiveUser() { return { getEmail: () => 'test@example.com' } }
}

// ── Logger ────────────────────────────────────────────────────────────────────
global.Logger = {
  log(...args) { /* silent in tests */ }
}

// ── Console ───────────────────────────────────────────────────────────────────
global.console = global.console || { log() {}, error() {}, warn() {} }
