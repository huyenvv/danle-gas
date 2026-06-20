require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets } = require('./helpers')

// Helper: install a mock SSO parent spreadsheet with a _Người Dùng tab.
// Returns the parent spreadsheet object so callers can mutate rows.
function installMockSsoParent(users) {
  const PARENT_USERS_HEADERS = ['ID', 'Tên đăng nhập', 'Email', 'Tên nhân viên', 'Phòng ban']
  const parentRows = [PARENT_USERS_HEADERS, ...users.map(u => [
    u.ID, u['Tên đăng nhập'], u['Email'] || '', u['Tên nhân viên'] || '', u['Phòng ban'] || ''
  ])]
  const parent = {
    getSheetByName(name) {
      if (name !== '_Người Dùng') return null
      return {
        getName() { return '_Người Dùng' },
        getDataRange() { return { getValues() { return parentRows.map(r => [...r]) } } },
      }
    },
  }
  // Patch openById on the existing global SpreadsheetApp
  SpreadsheetApp.openById = (id) => (id === 'parent-sheet-id' ? parent : null)
  // Tell the SSO helper which parent to read
  setConfig('SSO_PARENT_SHEET_ID', 'parent-sheet-id')
  return parent
}

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
  SpreadsheetApp._addSheet(SHEETS.DU_AN, [['ID', 'Tên dự án viết tắt']])
  SpreadsheetApp._addSheet(SHEETS.NHA_CUNG_CAP, [['ID', 'Tên NCC viết tắt']])
})

describe('getAllData — users list', () => {
  test('returns users[] with Tên đăng nhập sourced from SSO, not stale APP_ROLES', () => {
    // SSO _Người Dùng: canonical source of truth
    installMockSsoParent([
      { ID: 10, 'Tên đăng nhập': 'tpkythuat@gmail.com', Email: 'tpkythuat@gmail.com', 'Tên nhân viên': 'TP Kỹ thuật' },
      { ID: 11, 'Tên đăng nhập': 'tpkehoach@gmail.com', Email: 'tpkehoach@gmail.com', 'Tên nhân viên': 'TP Kế hoạch' },
    ])
    // APP_ROLES has STALE / WRONG Tên đăng nhập (this is the real-world bug)
    SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push([1, 10, 'tpkehoach@gmail.com', APP_ID, 'Trưởng phòng', ''])
    SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push([2, 11, 'old-username',         APP_ID, 'Trưởng phòng', ''])
    invalidateSheetCache(SHEETS.APP_ROLES)

    const result = getAllData({ role: 'admin', userId: 99, username: 'admin' })

    const u10 = result.users.find(u => String(u.ID) === '10')
    const u11 = result.users.find(u => String(u.ID) === '11')

    // The dropdown uses u['Tên đăng nhập'] as the option value; that value MUST match
    // session.username (built from SSO _Người Dùng.Tên đăng nhập) — otherwise the
    // Phụ trách check fails for the assigned user and may match a different user.
    expect(u10['Tên đăng nhập']).toBe('tpkythuat@gmail.com')
    expect(u11['Tên đăng nhập']).toBe('tpkehoach@gmail.com')
  })

  test('falls back to APP_ROLES.Tên đăng nhập when SSO parent has no matching user', () => {
    installMockSsoParent([]) // empty parent
    SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push([1, 20, 'orphan@test.com', APP_ID, 'Nhân viên', ''])
    invalidateSheetCache(SHEETS.APP_ROLES)

    const result = getAllData({ role: 'admin', userId: 99, username: 'admin' })
    const u = result.users.find(x => String(x.ID) === '20')
    expect(u['Tên đăng nhập']).toBe('orphan@test.com')
  })

  test('KHÔNG lọc danh mục theo quyền user — non-privileged thấy TẤT CẢ danh mục (008)', () => {
    installMockSsoParent([{ ID: 5, 'Tên đăng nhập': 'nv', Email: 'nv@test.com', 'Tên nhân viên': 'NV' }])
    // Danh mục 1 giới hạn cho user khác (999); danh mục 2 công khai.
    SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([1, 'Bí mật', '', '', '', JSON.stringify(['999']), '', ''])
    SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([2, 'Công khai', '', '', '', '', '', ''])
    invalidateSheetCache(SHEETS.DANH_MUC)
    const result = getAllData({ role: 'Nhân viên', userId: 5, username: 'nv' })
    expect(result.danhMuc.map(c => String(c.ID)).sort()).toEqual(['1', '2']) // thấy cả danh mục bị giới hạn
  })

  test('falls back gracefully when SSO parent sheet is unavailable', () => {
    // No SSO_PARENT_SHEET_ID configured
    SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push([1, 30, 'alone@test.com', APP_ID, 'Nhân viên', ''])
    invalidateSheetCache(SHEETS.APP_ROLES)

    const result = getAllData({ role: 'admin', userId: 99, username: 'admin' })
    const u = result.users.find(x => String(x.ID) === '30')
    expect(u['Tên đăng nhập']).toBe('alone@test.com')
  })
})
