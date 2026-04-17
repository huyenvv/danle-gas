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
    makeSheet(SHEETS.APP_ROLES, ['ID', 'UserID'], [])
    expect(() => getSheet(SHEETS.APP_ROLES)).not.toThrow()
  })
})
