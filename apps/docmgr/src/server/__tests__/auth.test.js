require('./setup.js')
const { resetAll, setupUserSheets, seedUser, loginAs } = require('./helpers')

beforeEach(() => {
  resetAll()
  setupUserSheets()
  seedUser(1, 'admin', 'admin123', 'admin@test.com', 'admin')
})

describe('autoLogin', () => {
  test('returns session token for matching email', () => {
    Session._setEmail('admin@test.com')
    const result = autoLogin()
    expect(result.token).toBeTruthy()
    expect(result.user.email).toBe('admin@test.com')
    expect(result.user.role).toBe('admin')
  })

  test('throws for email not in user list', () => {
    Session._setEmail('nobody@test.com')
    expect(() => autoLogin()).toThrow('chưa được cấp quyền')
  })

  test('throws for locked user', () => {
    Session._setEmail('admin@test.com')
    const token = loginAs('admin', 'admin123')
    seedUser(2, 'user2', 'pass', 'lock@test.com', 'Xem')
    lockUser(token, 2)
    invalidateSheetCache(SHEETS.USERS)
    Session._setEmail('lock@test.com')
    expect(() => autoLogin()).toThrow('khóa')
  })
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

describe('lockUser', () => {
  beforeEach(() => {
    seedUser(2, 'user2', 'pass123', 'u2@test.com', 'Biên tập viên')
  })

  test('locks target user', () => {
    const token = loginAs('admin', 'admin123')
    lockUser(token, 2)
    invalidateSheetCache(SHEETS.USERS)
    const users = getSheetData(SHEETS.USERS)
    const u2 = users.find(u => u['ID'] === 2)
    expect(u2['Trạng thái']).toBe('Locked')
  })

  test('cannot lock self', () => {
    const token = loginAs('admin', 'admin123')
    expect(() => lockUser(token, 1)).toThrow('Không thể tự khóa')
  })

  test('locked user cannot login', () => {
    const token = loginAs('admin', 'admin123')
    lockUser(token, 2)
    invalidateSheetCache(SHEETS.USERS)
    expect(() => login('user2', 'pass123')).toThrow('khóa')
  })
})

describe('unlockUser', () => {
  test('unlocks a locked user', () => {
    seedUser(2, 'user2', 'pass123', 'u2@test.com', 'Biên tập viên')
    const token = loginAs('admin', 'admin123')
    lockUser(token, 2)
    unlockUser(token, 2)
    invalidateSheetCache(SHEETS.USERS)
    expect(() => login('user2', 'pass123')).not.toThrow()
  })
})

describe('adminResetPassword', () => {
  beforeEach(() => {
    seedUser(2, 'user2', 'pass123', 'u2@test.com', 'Biên tập viên')
  })

  test('resets password for target user', () => {
    const token = loginAs('admin', 'admin123')
    adminResetPassword(token, 2, 'newpass99')
    invalidateSheetCache(SHEETS.USERS)
    expect(() => login('user2', 'newpass99')).not.toThrow()
  })

  test('throws when new password is too short', () => {
    const token = loginAs('admin', 'admin123')
    expect(() => adminResetPassword(token, 2, '123')).toThrow('ít nhất 6')
  })

  test('sets MustChangePass flag', () => {
    const token = loginAs('admin', 'admin123')
    adminResetPassword(token, 2, 'newpass99')
    invalidateSheetCache(SHEETS.USERS)
    const users = getSheetData(SHEETS.USERS)
    const u2 = users.find(u => u['ID'] === 2)
    expect(u2['MustChangePass']).toBe('TRUE')
  })
})
