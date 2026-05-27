require('./setup.js')
const { resetAll, setupAllSheets, seedUser, createAdminSession } = require('./helpers')

var adminToken

beforeEach(() => {
  resetAll()
  setupAllSheets()
  seedUser(1, 'admin', 'admin@test.com', { quyen: 'Quản trị', name: 'Admin' })
  seedUser(2, 'huyenvv', 'huyenvv@test.com', { name: 'Huyên' })
  seedUser(3, 'user3', 'user3@test.com', { name: 'User 3' })
  adminToken = createAdminSession(1, 'admin', 'admin@test.com')
})

// ── portalChangePassword ─────────────────────────────────────────────────────

describe('portalChangePassword', () => {
  test('succeeds with correct old password', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    var result = portalChangePassword(userToken, 'Admin@@123', 'NewPass@@456')
    expect(result.success).toBe(true)
  })

  test('new password works for login after change', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    portalChangePassword(userToken, 'Admin@@123', 'NewPass@@456')
    var result = login('huyenvv@test.com', 'NewPass@@456', 'desktop')
    expect(result.user.username).toBe('huyenvv')
  })

  test('throws on wrong old password', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    expect(() => portalChangePassword(userToken, 'WRONG', 'NewPass@@456')).toThrow('không đúng')
  })

  test('throws when new password equals old password', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    expect(() => portalChangePassword(userToken, 'Admin@@123', 'Admin@@123')).toThrow('khác')
  })

  test('throws on policy violation (too short)', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    expect(() => portalChangePassword(userToken, 'Admin@@123', '123')).toThrow()
  })

  test('clears mustChangePass flag in session', () => {
    // Seed user with mustChangePass=TRUE
    seedUser(4, 'newbie', 'newbie@test.com', { mustChangePass: 'TRUE' })
    var userToken = login('newbie@test.com', 'Admin@@123', 'desktop').accessToken
    portalChangePassword(userToken, 'Admin@@123', 'Changed@@789')
    // Session cache should reflect change
    var session = requireAuth(userToken)
    expect(session.mustChangePass).toBe(false)
  })

  test('rejects unauthenticated call', () => {
    expect(() => portalChangePassword('bad-token', 'Admin@@123', 'NewPass@@456')).toThrow()
  })
})

// ── portalAdminResetPassword ─────────────────────────────────────────────────

describe('portalAdminResetPassword', () => {
  test('resets target user password and sets MustChangePass', () => {
    portalAdminResetPassword(adminToken, 2)
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '2' })
    expect(user['MustChangePass']).toBe('TRUE')
  })

  test('user can login with default password after reset', () => {
    portalAdminResetPassword(adminToken, 2)
    var result = login('huyenvv@test.com', DEFAULT_PASSWORD, 'desktop')
    expect(result.user.username).toBe('huyenvv')
  })

  test('throws for non-existent user ID', () => {
    expect(() => portalAdminResetPassword(adminToken, 999)).toThrow('Không tìm thấy')
  })

  test('throws when targeting owner account', () => {
    // Owner email is 'owner@test.com' per the mock
    seedUser(10, 'owner', 'owner@test.com', {})
    expect(() => portalAdminResetPassword(adminToken, 10)).toThrow('chủ sở hữu')
  })

  test('throws for non-admin caller', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    expect(() => portalAdminResetPassword(userToken, 3)).toThrow()
  })
})

// ── portalBulkResetPassword ──────────────────────────────────────────────────

describe('portalBulkResetPassword', () => {
  test('resets multiple users and returns count', () => {
    var result = portalBulkResetPassword(adminToken, [2, 3])
    expect(result.count).toBe(2)
    expect(result.skipped).toBe(0)
  })

  test('skips owner and still processes others', () => {
    seedUser(10, 'owner', 'owner@test.com', {})
    var result = portalBulkResetPassword(adminToken, [10, 2])
    expect(result.count).toBe(1)
    expect(result.skipped).toBe(1)
  })

  test('skips unknown IDs', () => {
    var result = portalBulkResetPassword(adminToken, [999, 2])
    expect(result.count).toBe(1)
    expect(result.skipped).toBe(1)
  })

  test('throws when no users provided', () => {
    expect(() => portalBulkResetPassword(adminToken, [])).toThrow()
  })

  test('throws for non-admin caller', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    expect(() => portalBulkResetPassword(userToken, [3])).toThrow()
  })
})
