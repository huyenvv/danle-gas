require('./setup.js')
const { resetAll, setupRoleSheets, seedUser, createSession } = require('./helpers')

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
