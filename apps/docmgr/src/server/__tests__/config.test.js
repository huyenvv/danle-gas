require('./setup.js')

// ── helpers ───────────────────────────────────────────────────────────────────
function makeSheet(name, headers, rows) {
  SpreadsheetApp._addSheet(name, [headers, ...rows])
}

function resetAll() {
  SpreadsheetApp._reset()
  CacheService.getScriptCache()._reset()
  PropertiesService._reset()
}

// ── config ────────────────────────────────────────────────────────────────────
beforeEach(() => resetAll())

describe('getConfig / setConfig', () => {
  test('setConfig stores and getConfig retrieves', () => {
    setConfig('FOO', 'bar')
    expect(getConfig('FOO')).toBe('bar')
  })

  test('missing key returns null', () => {
    expect(getConfig('MISSING')).toBeNull()
  })
})

describe('getSheet routing', () => {
  test('sheet with _ prefix resolves from app spreadsheet', () => {
    makeSheet(SHEETS.USERS, ['ID', 'Tên đăng nhập'], [])
    expect(() => getSheet(SHEETS.USERS)).not.toThrow()
  })
})
