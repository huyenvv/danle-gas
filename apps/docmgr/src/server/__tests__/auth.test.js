require('./setup.js')

// Match actual headers from config.js
const USER_HEADERS = ['ID', 'Tên đăng nhập', 'Mật khẩu', 'Email', 'Trạng thái', 'MustChangePass', 'Đăng nhập cuối']
// APP_ROLES: UserID | AppID | Quyền | Phân quyền chi tiết
const ROLE_HEADERS = ['UserID', 'AppID', 'Quyền', 'Phân quyền chi tiết']

function reset() {
  SpreadsheetApp._reset()
  CacheService.getScriptCache()._reset()
  PropertiesService._reset()
}

function seedAdmin() {
  const hashed = _hashPassword('admin', 'admin123')
  // Rows must match USER_HEADERS order
  SpreadsheetApp._sheets[SHEETS.USERS]._rows.push(
    [1, 'admin', hashed, 'admin@test.com', 'Active', false, '']
  )
  // Role entry — Quyền must be 'admin' (what requireAdmin checks)
  SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push(
    [1, APP_ID, 'admin', '']
  )
  invalidateSheetCache(SHEETS.USERS)
  invalidateSheetCache(SHEETS.APP_ROLES)
}

beforeEach(() => {
  reset()
  SpreadsheetApp._addSheet(SHEETS.USERS, [USER_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.APP_ROLES, [ROLE_HEADERS])
  seedAdmin()
})

describe('login', () => {
  test('returns session token on valid credentials', () => {
    const result = login('admin', 'admin123')
    expect(result.token).toBeTruthy()
    expect(result.user.role).toBe('admin')
  })

  test('throws on wrong password', () => {
    expect(() => login('admin', 'wrong')).toThrow()
  })

  test('throws on unknown user', () => {
    expect(() => login('nobody', 'pass')).toThrow()
  })
})

describe('validateSession', () => {
  test('returns session for valid token', () => {
    const { token } = login('admin', 'admin123')
    const session = validateSession(token)
    expect(session).not.toBeNull()
    expect(session.username).toBe('admin')
  })

  test('returns null for invalid token', () => {
    expect(validateSession('bad-token')).toBeNull()
  })
})

describe('logout', () => {
  test('invalidates session', () => {
    const { token } = login('admin', 'admin123')
    logout(token)
    expect(validateSession(token)).toBeNull()
  })
})

describe('changePassword', () => {
  test('changes password and invalidates session', () => {
    const { token } = login('admin', 'admin123')
    changePassword(token, 'admin123', 'newpass99')
    expect(validateSession(token)).toBeNull()
    expect(() => login('admin', 'newpass99')).not.toThrow()
  })

  test('throws when old password is wrong', () => {
    const { token } = login('admin', 'admin123')
    expect(() => changePassword(token, 'wrong', 'newpass99')).toThrow()
  })

  test('throws when new password is too short', () => {
    const { token } = login('admin', 'admin123')
    expect(() => changePassword(token, 'admin123', '123')).toThrow()
  })
})

describe('requireAdmin', () => {
  test('passes for admin token', () => {
    const { token } = login('admin', 'admin123')
    expect(() => requireAdmin(token)).not.toThrow()
  })

  test('throws for invalid token', () => {
    expect(() => requireAdmin('bad')).toThrow()
  })
})
