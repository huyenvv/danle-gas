const { loadGAS, resetGAS, setSheetData, getSheetData } = require('./setup')

describe('refresh token primitives', () => {
  beforeEach(() => {
    resetGAS()
    loadGAS()
    setSheetData('_Người Dùng', [
      { ID: 1, Email: 'a@x.com', 'Tên đăng nhập': 'a', RefreshTokens: '', LastLogoutAt: 0 },
    ])
  })

  test('mintRefreshToken adds entry to user.RefreshTokens', () => {
    var token = mintRefreshToken('_Người Dùng', 1, { ua: 'Chrome', ipHash: 'abc', label: 'Laptop' })
    expect(typeof token).toBe('string')
    var users = getSheetData('_Người Dùng')
    var tokens = JSON.parse(users[0].RefreshTokens)
    expect(tokens.length).toBe(1)
    expect(tokens[0].token).toBe(token)
    expect(tokens[0].ua).toBe('Chrome')
    expect(tokens[0].label).toBe('Laptop')
  })

  test('lookupRefreshToken finds user + token entry', () => {
    var token = mintRefreshToken('_Người Dùng', 1, {})
    var found = lookupRefreshToken('_Người Dùng', token)
    expect(found.userId).toBe(1)
    expect(found.entry.token).toBe(token)
  })

  test('lookupRefreshToken returns null for unknown token', () => {
    mintRefreshToken('_Người Dùng', 1, {})
    expect(lookupRefreshToken('_Người Dùng', 'unknown')).toBeNull()
  })

  test('lookupRefreshToken returns null when token expired (lastUsedAt > 30d)', () => {
    var token = mintRefreshToken('_Người Dùng', 1, {})
    var users = getSheetData('_Người Dùng')
    var tokens = JSON.parse(users[0].RefreshTokens)
    tokens[0].lastUsedAt = Date.now() - 31 * 86400 * 1000
    setSheetData('_Người Dùng', [{ ...users[0], RefreshTokens: JSON.stringify(tokens) }])
    expect(lookupRefreshToken('_Người Dùng', token)).toBeNull()
  })

  test('rotateRefreshToken replaces entry, returns new token', () => {
    var oldToken = mintRefreshToken('_Người Dùng', 1, { label: 'Laptop' })
    var newToken = rotateRefreshToken('_Người Dùng', 1, oldToken)
    expect(newToken).not.toBe(oldToken)
    var users = getSheetData('_Người Dùng')
    var tokens = JSON.parse(users[0].RefreshTokens)
    expect(tokens.length).toBe(1)
    expect(tokens[0].token).toBe(newToken)
    expect(tokens[0].label).toBe('Laptop')
  })

  test('revokeRefreshToken removes specific entry', () => {
    var t1 = mintRefreshToken('_Người Dùng', 1, {})
    var t2 = mintRefreshToken('_Người Dùng', 1, {})
    revokeRefreshToken('_Người Dùng', 1, t1)
    var users = getSheetData('_Người Dùng')
    var tokens = JSON.parse(users[0].RefreshTokens)
    expect(tokens.length).toBe(1)
    expect(tokens[0].token).toBe(t2)
  })

  test('revokeAllRefreshTokens clears array', () => {
    mintRefreshToken('_Người Dùng', 1, {})
    mintRefreshToken('_Người Dùng', 1, {})
    revokeAllRefreshTokens('_Người Dùng', 1)
    var users = getSheetData('_Người Dùng')
    var tokens = JSON.parse(users[0].RefreshTokens || '[]')
    expect(tokens.length).toBe(0)
  })
})
