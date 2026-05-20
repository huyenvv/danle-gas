const { loadGAS, resetGAS } = require('./setup')

describe('access token primitives', () => {
  beforeEach(() => resetGAS())

  test('mintAccessToken returns opaque UUID + caches session', () => {
    loadGAS()
    const token = mintAccessToken({ userId: 'u1', email: 'a@x.com', role: 'admin' })
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(10)
    const session = validateAccessToken(token)
    expect(session.userId).toBe('u1')
    expect(session.email).toBe('a@x.com')
  })

  test('validateAccessToken returns null for unknown token', () => {
    loadGAS()
    expect(validateAccessToken('nope')).toBeNull()
  })

  test('revokeAccessToken kills the token', () => {
    loadGAS()
    const token = mintAccessToken({ userId: 'u1' })
    revokeAccessToken(token)
    expect(validateAccessToken(token)).toBeNull()
  })

  test('validateAccessToken slides cache TTL on read', () => {
    loadGAS()
    const token = mintAccessToken({ userId: 'u1' })
    const cache = CacheService.getScriptCache()
    const putSpy = jest.spyOn(cache, 'put')
    validateAccessToken(token)
    expect(putSpy).toHaveBeenCalledWith('at_' + token, expect.anything(), ACCESS_TOKEN_TTL)
    putSpy.mockRestore()
  })
})
