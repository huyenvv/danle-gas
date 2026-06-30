// Shared test setup — loads GAS mocks, gas-core, and app server modules into global scope.
// App files are auto-detected with the SAME ordering as scripts/bundle-server.js so this
// setup can never drift from the production bundle.
require('./mocks/gas.js')

const fs   = require('fs')
const path = require('path')
const vm   = require('vm')

const GAS_CORE_DIR = path.resolve(__dirname, '../../../../../packages/gas-core')
const SERVER_DIR = path.resolve(__dirname, '../')

// gas-core load order — must match scripts/bundle-server.js GAS_CORE_FILES
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

// App files — auto-detect + sort identically to bundle-server.js (config→sheets→auth→…→main)
const APP_FILES = fs.readdirSync(SERVER_DIR)
  .filter(f => f.endsWith('.js') && !f.startsWith('_'))
  .filter(f => f !== '__tests__')
  .sort((a, b) => {
    const order = ['config.js', 'sheets.js', 'auth.js']
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    if (a === 'main.js') return 1
    if (b === 'main.js') return -1
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b)
  })

const ctx = vm.createContext(globalThis)

GAS_CORE_FILES.forEach(f => {
  const filePath = path.join(GAS_CORE_DIR, f)
  if (fs.existsSync(filePath)) {
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), ctx)
  }
})

APP_FILES.forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(SERVER_DIR, f), 'utf8'), ctx)
})

function resetGAS() {
  SpreadsheetApp._reset()
  CacheService.getScriptCache()._reset()
  if (typeof PropertiesService !== 'undefined') PropertiesService._reset()
}

module.exports = { resetGAS, APP_FILES }
