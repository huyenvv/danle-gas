require('./setup.js')
const { resetAll, setupRoleSheets, seedUser, createSession } = require('./helpers')

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  seedUser(1, 'admin', 'admin@test.com', 'admin')
})

describe('ssoCreateSession', () => {
  test('creates session with correct data', () => {
    var user = { ID: 1, 'Tên đăng nhập': 'admin', 'Email': 'admin@test.com', 'Phòng ban': '' }
    var appRole = { 'Quyền': 'admin', 'Phân quyền chi tiết': '' }
    var token = ssoCreateSession(user, appRole)
    expect(token).toBeTruthy()
    var session = validateSession(token)
    expect(session.username).toBe('admin')
    expect(session.role).toBe('admin')
  })

  test('parses departments from JSON array', () => {
    var user = { ID: 2, 'Tên đăng nhập': 'user2', 'Email': 'u2@test.com', 'Phòng ban': '["Kỹ thuật","Kinh doanh"]' }
    var appRole = { 'Quyền': 'Nhân viên', 'Phân quyền chi tiết': '' }
    var token = ssoCreateSession(user, appRole)
    var session = validateSession(token)
    expect(session.departments).toEqual(['Kỹ thuật', 'Kinh doanh'])
  })
})

describe('validateSession', () => {
  test('returns session for valid token', () => {
    var token = createSession(1, 'admin', 'admin@test.com', 'admin')
    var session = validateSession(token)
    expect(session).not.toBeNull()
    expect(session.username).toBe('admin')
  })

  test('returns null for invalid token', () => {
    expect(validateSession('bad-token')).toBeNull()
  })
})

describe('logout', () => {
  test('invalidates session', () => {
    var token = createSession(1, 'admin', 'admin@test.com', 'admin')
    logout(token)
    expect(validateSession(token)).toBeNull()
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

describe('getPermissions', () => {
  test('returns full perms for admin role', () => {
    var perms = getPermissions({ 'Quyền': 'admin', 'Phân quyền chi tiết': '' })
    expect(perms.hoSo.c).toBe(true)
    expect(perms.hoSo.d).toBe(true)
    expect(perms.user.c).toBe(true)
  })

  test('returns default perms for Xem role', () => {
    var perms = getPermissions({ 'Quyền': 'Xem', 'Phân quyền chi tiết': '' })
    expect(perms.hoSo.r).toBe(true)
    expect(perms.hoSo.c).toBe(false)
  })

  test('parses custom perms from JSON', () => {
    var custom = JSON.stringify({ hoSo: { c: true, r: true, u: true, d: false } })
    var perms = getPermissions({ 'Quyền': 'Nhân viên', 'Phân quyền chi tiết': custom })
    expect(perms.hoSo.c).toBe(true)
    expect(perms.hoSo.d).toBe(false)
  })
})
