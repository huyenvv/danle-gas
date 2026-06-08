// Shared test setup — loads GAS mocks, gas-core, and SSO Portal server modules into global scope
require('./mocks/gas.js')

const fs   = require('fs')
const path = require('path')
const vm   = require('vm')

const GAS_CORE_DIR = path.resolve(__dirname, '../../../../../packages/gas-core')
const SERVER_DIR = path.resolve(__dirname, '../')

// gas-core files first (dependency order)
const GAS_CORE_FILES = [
  'config-base.js',
  'cache.js',
  'utils.js',
  'sheets-crud.js',
  'auth-core.js',
  'access-token.js',
  'refresh-token.js',
  'session-epoch.js',
  'sso.js',
  'drive-io.js',
  'license.js',
]

// App-specific files (dependency order)
const APP_FILES = [
  'config.js',
  'auth.js',
  'main.js',
]

// Contextify globalThis so that var declarations in server files
// become accessible as globals in Jest test files.
const ctx = vm.createContext(globalThis)

GAS_CORE_FILES.forEach(f => {
  const filePath = path.join(GAS_CORE_DIR, f)
  if (fs.existsSync(filePath)) {
    const code = fs.readFileSync(filePath, 'utf8')
    vm.runInContext(code, ctx)
  }
})

APP_FILES.forEach(f => {
  const code = fs.readFileSync(path.join(SERVER_DIR, f), 'utf8')
  vm.runInContext(code, ctx)
})

function resetGAS() {
  SpreadsheetApp._reset()
  CacheService.getScriptCache()._reset()
  if (typeof PropertiesService !== 'undefined') PropertiesService._reset()
  if (typeof GmailApp !== 'undefined') GmailApp._reset()
}

function setSheetData(sheetName, rows) {
  if (!rows || rows.length === 0) {
    SpreadsheetApp._addSheet(sheetName, [[]])
    return
  }
  const headers = Object.keys(rows[0])
  const matrix = [headers]
  rows.forEach((row) => {
    const r = headers.map(h => row[h] !== undefined ? row[h] : '')
    matrix.push(r)
  })
  if (SpreadsheetApp._sheets[sheetName]) delete SpreadsheetApp._sheets[sheetName]
  SpreadsheetApp._addSheet(sheetName, matrix)
  if (typeof invalidateSheetCache === 'function') invalidateSheetCache(sheetName)
}

function getTestSheetData(sheetName) {
  return getSheetData(sheetName)
}

module.exports = {
  resetGAS,
  setSheetData,
  getSheetData: getTestSheetData,
}
