require('./setup.js')
const { resetAll } = require('./helpers')

function makeSheet(name, headers, rows) {
  SpreadsheetApp._addSheet(name, [headers, ...rows])
}

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
