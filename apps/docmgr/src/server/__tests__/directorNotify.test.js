require('./setup.js')
const { resetAll, setupRoleSheets } = require('./helpers')

// Regression test: directors must be resolved from the SSO `_Phân Bổ` (Chức vụ='Giám đốc'),
// NOT the local _Phân Quyền role string. A director who also owns the spreadsheet gets the
// local role 'admin' (api_ssoLogin), which previously excluded them from all notifications.
const SSO_PARENT_ID = 'sso-parent-id'

function setupAssignments(rows) {
  const headers = ['ID', 'UserID', 'Chức vụ', 'PhongBanID']
  const data = [headers]
  rows.forEach((a, i) => data.push([i + 1, a.userId, a.chucVu, '']))
  SpreadsheetApp._addExternalSheet(SSO_PARENT_ID, '_Phân Bổ', data)
}

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  ssoStoreParentSheetId(SSO_PARENT_ID)
})

describe('_getDirectorUserIds', () => {
  test('returns director UserIDs from SSO _Phân Bổ', () => {
    setupAssignments([
      { userId: 5, chucVu: 'Giám đốc' },
      { userId: 6, chucVu: 'Nhân viên' },
      { userId: 7, chucVu: 'Giám đốc' },
    ])
    expect(_getDirectorUserIds().sort()).toEqual(['5', '7'])
  })

  test('finds the director even when they own the sheet (local role admin)', () => {
    // Director id 5 owns the sheet → local _Phân Quyền role is 'admin'
    SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push([0, 5, 'giamdoc', APP_ID, 'admin', '', '', ''])
    invalidateSheetCache(SHEETS.APP_ROLES)
    setupAssignments([{ userId: 5, chucVu: 'Giám đốc' }])
    // Resolved from SSO assignment, so the local 'admin' role is irrelevant
    expect(_getDirectorUserIds()).toContain('5')
  })

  test('dedupes a director with multiple assignments', () => {
    setupAssignments([
      { userId: 5, chucVu: 'Giám đốc' },
      { userId: 5, chucVu: 'Giám đốc' },
    ])
    expect(_getDirectorUserIds()).toEqual(['5'])
  })

  test('falls back to admins when NO director is assigned (admin == giám đốc)', () => {
    setupAssignments([
      { userId: 9, chucVu: 'admin' },
      { userId: 6, chucVu: 'Nhân viên' },
    ])
    expect(_getDirectorUserIds()).toEqual(['9'])
  })

  test('prefers directors over admins when both exist (no admin spam)', () => {
    setupAssignments([
      { userId: 5, chucVu: 'Giám đốc' },
      { userId: 9, chucVu: 'admin' },
    ])
    expect(_getDirectorUserIds()).toEqual(['5'])
  })

  test('returns empty when neither director nor admin is assigned', () => {
    setupAssignments([{ userId: 6, chucVu: 'Nhân viên' }])
    expect(_getDirectorUserIds()).toEqual([])
  })

  test('returns empty when parent sheet id is not configured', () => {
    PropertiesService._reset()
    expect(_getDirectorUserIds()).toEqual([])
  })
})
