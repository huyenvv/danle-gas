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

  test('mintAccessToken sweeps expired token backups (GC)', () => {
    loadGAS()
    const props = PropertiesService.getScriptProperties()
    props.setProperty('at_bk_expired', JSON.stringify({ s: {}, e: 1 }))
    props.setProperty('at_bk_future', JSON.stringify({ s: {}, e: Date.now() + 1e9 }))
    mintAccessToken({ userId: 'gc1' }) // triggers throttled GC (no prior gc timestamp)
    expect(props.getProperty('at_bk_expired')).toBeNull()
    expect(props.getProperty('at_bk_future')).not.toBeNull()
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
    // cachePut caps TTL at CACHE_MAX_TTL (21600) when ACCESS_TOKEN_TTL exceeds it
    const expectedTtl = Math.min(ACCESS_TOKEN_TTL, CACHE_MAX_TTL)
    expect(putSpy).toHaveBeenCalledWith('at_' + token, expect.anything(), expectedTtl)
    putSpy.mockRestore()
  })
})
