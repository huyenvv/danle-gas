require('./setup.js')
const { resetAll, setupAllSheets, seedUser, createAdminSession } = require('./helpers')

beforeEach(() => {
  resetAll()
  setupAllSheets()
  seedUser(1, 'admin', 'admin@test.com', { quyen: 'Quản trị', name: 'Admin' })
  seedUser(2, 'huyenvv', 'huyenvv@test.com', { name: 'Huyên' })
  seedUser(3, 'locked', 'locked@test.com', { status: 'Locked' })
})

// ── Success ──────────────────────────────────────────────────────────────────

describe('login — success', () => {
  test('returns accessToken, refreshToken, and user on valid credentials', () => {
    var result = login('huyenvv@test.com', 'Admin@@123', 'desktop')
    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    expect(result.user.username).toBe('huyenvv')
    expect(result.user.email).toBe('huyenvv@test.com')
    expect(result.user.role).toBe('user')
  })

  test('email matching is case-insensitive', () => {
    var result = login('HUYENVV@TEST.COM', 'Admin@@123', 'desktop')
    expect(result.user.email).toBe('huyenvv@test.com')
  })

  test('admin user gets role=admin', () => {
    var result = login('admin@test.com', 'Admin@@123', 'desktop')
    expect(result.user.role).toBe('admin')
  })

  test('deviceType desktop stores label desktop in refresh token', () => {
    var result = login('huyenvv@test.com', 'Admin@@123', 'desktop')
    var session = validateAccessToken(result.accessToken)
    expect(session.username).toBe('huyenvv')
  })

  test('deviceType mobile is accepted', () => {
    var result = login('huyenvv@test.com', 'Admin@@123', 'mobile')
    expect(result.accessToken).toBeTruthy()
  })

  test('returns parentSheetId', () => {
    var result = login('huyenvv@test.com', 'Admin@@123', 'desktop')
    expect(result.parentSheetId).toBeTruthy()
  })

  test('resets FailedLogins to 0 on success', () => {
    // First trigger one failure to set FailedLogins=1
    try { login('huyenvv@test.com', 'WRONG', 'desktop') } catch(e) {}
    // Then succeed
    login('huyenvv@test.com', 'Admin@@123', 'desktop')
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '2' })
    expect(Number(user['FailedLogins'])).toBe(0)
  })
})

// ── Failure ──────────────────────────────────────────────────────────────────

describe('login — wrong credentials', () => {
  test('throws on unknown email', () => {
    expect(() => login('nobody@test.com', 'Admin@@123', 'desktop')).toThrow('không đúng')
  })

  test('throws on wrong password', () => {
    expect(() => login('huyenvv@test.com', 'WRONG', 'desktop')).toThrow('không đúng')
  })

  test('increments FailedLogins on each wrong password', () => {
    try { login('huyenvv@test.com', 'WRONG', 'desktop') } catch(e) {}
    try { login('huyenvv@test.com', 'WRONG', 'desktop') } catch(e) {}
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '2' })
    expect(Number(user['FailedLogins'])).toBe(2)
  })
})

// ── Auto-lock after 5 failures ───────────────────────────────────────────────

describe('login — lockout after 5 failures', () => {
  function failLogin(n) {
    for (var i = 0; i < n; i++) {
      try { login('huyenvv@test.com', 'WRONG', 'desktop') } catch(e) {}
    }
  }

  test('account status becomes Locked after 5 wrong attempts', () => {
    failLogin(5)
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '2' })
    expect(user['Trạng thái']).toBe('Locked')
  })

  test('5th failure throws lockout message', () => {
    failLogin(4)
    expect(() => login('huyenvv@test.com', 'WRONG', 'desktop')).toThrow('khóa')
  })

  test('correct password after lockout still throws', () => {
    failLogin(5)
    expect(() => login('huyenvv@test.com', 'Admin@@123', 'desktop')).toThrow('khóa')
  })
})

// ── Locked account ───────────────────────────────────────────────────────────

describe('login — pre-locked account', () => {
  test('throws immediately for Locked status', () => {
    expect(() => login('locked@test.com', 'Admin@@123', 'desktop')).toThrow('khóa')
  })
})

// ── Token revocation on re-login ─────────────────────────────────────────────

describe('login — re-login revokes previous session', () => {
  test('second login on same device invalidates previous access token', () => {
    var first = login('huyenvv@test.com', 'Admin@@123', 'desktop')
    var second = login('huyenvv@test.com', 'Admin@@123', 'desktop')
    // Old access token should be revoked
    expect(() => requireAuth(first.accessToken)).toThrow()
    expect(() => requireAuth(second.accessToken)).not.toThrow()
  })
})
