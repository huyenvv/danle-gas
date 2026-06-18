require('./setup.js')
const { resetAll, setupRoleSheets, seedUser, createSession } = require('./helpers')

const SSO_PARENT_ID = 'sso-parent-id'

function setupSsoParent(assignments) {
  var headers = ['ID', 'UserID', 'Chức vụ', 'PhongBanID']
  var rows = [headers]
  assignments.forEach(function(a, i) { rows.push([i + 1, a.userId, a.chucVu, a.phongBanId || '1']) })
  SpreadsheetApp._addExternalSheet(SSO_PARENT_ID, '_Phân Bổ', rows)
}

function setupPhongBan(depts) {
  var rows = [['ID', 'Tên phòng ban']]
  depts.forEach(function(d) { rows.push([d.id, d.name]) })
  SpreadsheetApp._addExternalSheet(SSO_PARENT_ID, '_Phòng Ban', rows)
}

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  seedUser(1, 'admin', 'admin@test.com', 'admin')
})


describe('validateAccessToken', () => {
  test('returns session for valid access token', () => {
    var token = createSession(1, 'admin', 'admin@test.com', 'admin')
    var session = validateAccessToken(token)
    expect(session).not.toBeNull()
    expect(session.username).toBe('admin')
  })

  test('returns null for invalid token', () => {
    expect(validateAccessToken('bad-token')).toBeNull()
  })
})

describe('revokeAccessToken', () => {
  test('invalidates access token', () => {
    var token = createSession(1, 'admin', 'admin@test.com', 'admin')
    revokeAccessToken(token)
    expect(validateAccessToken(token)).toBeNull()
  })
})

describe('requireAdmin', () => {
  test('passes for admin token', () => {
    var token = createSession(1, 'admin', 'admin@test.com', 'admin')
    expect(() => requireAdmin(token)).not.toThrow()
  })

  test('throws for invalid token', () => {
    expect(() => requireAdmin('bad')).toThrow()
  })
})

describe('_getDeptRole', () => {
  test('returns highest role when user has multiple assignments', () => {
    setupSsoParent([
      { userId: 10, chucVu: 'Nhân viên' },
      { userId: 10, chucVu: 'Trưởng phòng' },
      { userId: 10, chucVu: 'Phó phòng' },
    ])
    var parentSs = SpreadsheetApp.openById(SSO_PARENT_ID)
    expect(_getDeptRole(parentSs, 10)).toBe('Trưởng phòng')
  })

  test('returns Giám đốc as highest', () => {
    setupSsoParent([
      { userId: 5, chucVu: 'Giám đốc' },
      { userId: 5, chucVu: 'Trưởng phòng' },
    ])
    var parentSs = SpreadsheetApp.openById(SSO_PARENT_ID)
    expect(_getDeptRole(parentSs, 5)).toBe('Giám đốc')
  })

  test('returns single role for user with one assignment', () => {
    setupSsoParent([
      { userId: 7, chucVu: 'Phó GĐ' },
    ])
    var parentSs = SpreadsheetApp.openById(SSO_PARENT_ID)
    expect(_getDeptRole(parentSs, 7)).toBe('Phó GĐ')
  })

  test('returns null when user has no assignments', () => {
    setupSsoParent([
      { userId: 99, chucVu: 'Giám đốc' },
    ])
    var parentSs = SpreadsheetApp.openById(SSO_PARENT_ID)
    expect(_getDeptRole(parentSs, 1)).toBeNull()
  })

  test('returns null when _Phân Bổ sheet is missing', () => {
    SpreadsheetApp._addExternalSheet(SSO_PARENT_ID, '_Dummy', [['ID']])
    var parentSs = SpreadsheetApp.openById(SSO_PARENT_ID)
    expect(_getDeptRole(parentSs, 1)).toBeNull()
  })

  test('matches userId as string comparison', () => {
    setupSsoParent([
      { userId: '10', chucVu: 'Phó GĐ' },
    ])
    var parentSs = SpreadsheetApp.openById(SSO_PARENT_ID)
    expect(_getDeptRole(parentSs, 10)).toBe('Phó GĐ')
  })

  test('excludes admin — returns null when user only has admin Chức vụ', () => {
    setupSsoParent([
      { userId: 20, chucVu: 'admin' },
    ])
    var parentSs = SpreadsheetApp.openById(SSO_PARENT_ID)
    expect(_getDeptRole(parentSs, 20)).toBeNull()
  })

  test('excludes admin but keeps the real position when both exist', () => {
    setupSsoParent([
      { userId: 21, chucVu: 'admin' },
      { userId: 21, chucVu: 'Trưởng phòng' },
    ])
    var parentSs = SpreadsheetApp.openById(SSO_PARENT_ID)
    expect(_getDeptRole(parentSs, 21)).toBe('Trưởng phòng')
  })

  test('Văn thư ranks above Nhân viên', () => {
    setupSsoParent([
      { userId: 22, chucVu: 'Nhân viên' },
      { userId: 22, chucVu: 'Văn thư' },
    ])
    var parentSs = SpreadsheetApp.openById(SSO_PARENT_ID)
    expect(_getDeptRole(parentSs, 22)).toBe('Văn thư')
  })
})

describe('_getDeptInfo', () => {
  test('returns highest role + its department name', () => {
    setupPhongBan([{ id: 1, name: 'Phòng Kế hoạch' }, { id: 2, name: 'Phòng Kỹ thuật' }])
    setupSsoParent([
      { userId: 30, chucVu: 'Nhân viên', phongBanId: '2' },
      { userId: 30, chucVu: 'Trưởng phòng', phongBanId: '1' },
    ])
    var parentSs = SpreadsheetApp.openById(SSO_PARENT_ID)
    expect(_getDeptInfo(parentSs, 30)).toEqual({ role: 'Trưởng phòng', phongBan: 'Phòng Kế hoạch' })
  })

  test('returns empty info for user with no assignment', () => {
    setupSsoParent([{ userId: 30, chucVu: 'Giám đốc' }])
    var parentSs = SpreadsheetApp.openById(SSO_PARENT_ID)
    expect(_getDeptInfo(parentSs, 999)).toEqual({ role: '', phongBan: '' })
  })

  test('empty phongBan when _Phòng Ban sheet missing', () => {
    setupSsoParent([{ userId: 31, chucVu: 'Giám đốc', phongBanId: '1' }])
    var parentSs = SpreadsheetApp.openById(SSO_PARENT_ID)
    expect(_getDeptInfo(parentSs, 31)).toEqual({ role: 'Giám đốc', phongBan: '' })
  })
})

describe('_buildSessionFromRows', () => {
  test('canCreate from boolean column only', () => {
    var userRow = { ID: 1, 'Tên đăng nhập': 'test', 'Email': 'test@t.com', 'Tên nhân viên': 'Test' }
    var roleRow = { 'Quyền': 'Nhân viên', 'Được tạo hồ sơ': 'TRUE', 'Được tạo danh mục con': '', 'Được phát hành': '' }
    var session = _buildSessionFromRows(userRow, roleRow)
    expect(session.canCreate).toBe(true)
    expect(session.canCreateSubCat).toBe(false)
    expect(session.canPublish).toBe(false)
  })

  test('canCreateSubCat from boolean column', () => {
    var userRow = { ID: 2, 'Tên đăng nhập': 'u2', 'Email': 'u2@t.com' }
    var roleRow = { 'Quyền': 'Văn thư', 'Được tạo hồ sơ': '', 'Được tạo danh mục con': 'TRUE', 'Được phát hành': 'TRUE' }
    var session = _buildSessionFromRows(userRow, roleRow)
    expect(session.canCreate).toBe(false)
    expect(session.canCreateSubCat).toBe(true)
    expect(session.canPublish).toBe(true)
  })

  test('session does not contain permissions object', () => {
    var userRow = { ID: 1, 'Tên đăng nhập': 'a', 'Email': 'a@t.com' }
    var roleRow = { 'Quyền': 'admin', 'Được tạo hồ sơ': '', 'Được tạo danh mục con': '', 'Được phát hành': '' }
    var session = _buildSessionFromRows(userRow, roleRow)
    expect(session.permissions).toBeUndefined()
  })
})

