require('./setup.js')
const { resetAll, setupRoleSheets, seedUser, createSession } = require('./helpers')

describe('api_ssoLogin parent enforcement', () => {
  beforeEach(() => {
    resetAll()
    setupRoleSheets()
  })

  test('rejects parentSheetId that does not match the pinned parent', () => {
    ssoStoreParentSheetId('real-parent-id')
    const result = api_ssoLogin('fake-parent-id', 'sometoken', 'desktop')
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_SSO')
  })
})

// Documents the root-cause mechanism behind the director-notify bug: api_ssoLogin forces
// the local role to 'admin' for whoever owns the central sheet (mock owner = owner@test.com),
// regardless of their SSO Chức vụ. This is why director recipients must be resolved from
// SSO _Phân Bổ, not the local _Phân Quyền role string.
describe('api_ssoLogin local role assignment', () => {
  const PARENT = 'sso-parent-login'

  beforeEach(() => {
    resetAll()
    setupRoleSheets()
    SpreadsheetApp._addExternalSheet(PARENT, '_Người Dùng', [
      ['ID', 'Tên đăng nhập', 'Email', 'Tên nhân viên', 'Trạng thái', 'AccessToken', 'AccessTokenExpiry'],
      [2, 'giamdoc', 'owner@test.com', 'Giám Đốc', 'Active', 'tok-gd', Date.now() + 3600000],
      [3, 'truongphong', 'tp@test.com', 'Trưởng Phòng', 'Active', 'tok-tp', Date.now() + 3600000],
    ])
    SpreadsheetApp._addExternalSheet(PARENT, '_Phân Bổ', [
      ['ID', 'UserID', 'Chức vụ', 'PhongBanID'],
      [1, 2, 'Giám đốc', ''],
      [2, 3, 'Trưởng phòng', '1'],
    ])
    ssoStoreParentSheetId(PARENT)
  })

  test('director who owns the sheet is forced to local role admin', () => {
    const res = api_ssoLogin(PARENT, 'tok-gd', 'desktop') // pinned parent matches → allowed
    expect(res.success).toBe(true)
    const row = getSheetData(SHEETS.APP_ROLES).find(r => String(r['UserID']) === '2')
    expect(row['Quyền']).toBe('admin') // owner email match → admin, NOT 'Giám đốc'
  })

  test('non-owner gets their SSO Chức vụ as local role', () => {
    const res = api_ssoLogin(PARENT, 'tok-tp', 'desktop')
    expect(res.success).toBe(true)
    const row = getSheetData(SHEETS.APP_ROLES).find(r => String(r['UserID']) === '3')
    expect(row['Quyền']).toBe('Trưởng phòng')
  })
})

describe('api_updateUser', () => {
  beforeEach(() => {
    resetAll()
    setupRoleSheets()
    seedUser(1, 'director', 'director@test.com', 'Giám đốc')
  })

  test('director cannot assign admin role', () => {
    const directorToken = createSession(1, 'director', 'director@test.com', 'Giám đốc')

    const result = api_updateUser(directorToken, 2, {
      'Tên đăng nhập': 'staff',
      'Quyền': 'admin',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Giám đốc hoặc admin')
  })

  test('director cannot assign Giám đốc role', () => {
    const directorToken = createSession(1, 'director', 'director@test.com', 'Giám đốc')

    const result = api_updateUser(directorToken, 2, {
      'Tên đăng nhập': 'staff',
      'Quyền': 'Giám đốc',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Giám đốc hoặc admin')
  })
})