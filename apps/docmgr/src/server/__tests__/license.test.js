require('./setup.js')

// Encode helper — reverse of _decode: base64-encode then reverse
function _encode(str) {
  return Buffer.from(str).toString('base64').split('').reverse().join('')
}

function reset() {
  SpreadsheetApp._reset()
  CacheService.getScriptCache()._reset()
  PropertiesService._reset()
  // Reset build-time placeholders to empty (unset)
  __ENCODED_SECRET_SALT = '__ENCODED_SECRET_SALT__'
  __ENCODED_LICENSE_URL = '__ENCODED_LICENSE_URL__'
}

beforeEach(() => reset())

describe('activateWithToken', () => {
  test('activates when token matches SHA256(scriptId + salt)', () => {
    __ENCODED_SECRET_SALT = _encode('testsalt')
    const expected = _sha256(ScriptApp.getScriptId() + 'testsalt')
    const result = activateWithToken(expected)
    expect(result.activated).toBe(true)
    expect(checkLicense()).toBe(true)
  })

  test('throws on wrong token', () => {
    __ENCODED_SECRET_SALT = _encode('testsalt')
    expect(() => activateWithToken('bad-token')).toThrow('Invalid token')
  })

  test('idempotent — already activated returns success', () => {
    __ENCODED_SECRET_SALT = _encode('testsalt')
    const expected = _sha256(ScriptApp.getScriptId() + 'testsalt')
    activateWithToken(expected)
    const result2 = activateWithToken(expected)
    expect(result2.alreadyActivated).toBe(true)
  })
})

describe('checkLicense', () => {
  test('returns false when not activated', () => {
    expect(checkLicense()).toBe(false)
  })

  test('returns true after proper activation', () => {
    __ENCODED_SECRET_SALT = _encode('testsalt')
    const token = _sha256(ScriptApp.getScriptId() + 'testsalt')
    activateWithToken(token)
    expect(checkLicense()).toBe(true)
  })

  test('returns false when flag set manually without valid token', () => {
    __ENCODED_SECRET_SALT = _encode('testsalt')
    setConfig('LICENSE_ACTIVATED', 'true')
    // No token stored — should revoke
    expect(checkLicense()).toBe(false)
    // Flag should be cleared
    expect(getConfig('LICENSE_ACTIVATED')).toBeFalsy()
  })

  test('returns false when token is tampered', () => {
    __ENCODED_SECRET_SALT = _encode('testsalt')
    setConfig('LICENSE_ACTIVATED', 'true')
    setConfig('LICENSE_TOKEN', 'fake-token-value')
    expect(checkLicense()).toBe(false)
    expect(getConfig('LICENSE_ACTIVATED')).toBeFalsy()
    expect(getConfig('LICENSE_TOKEN')).toBeFalsy()
  })
})

describe('getActivationRedirectUrl', () => {
  test('throws when LICENSE_SERVER_URL not set', () => {
    __ENCODED_LICENSE_URL = _encode('')
    expect(() => getActivationRedirectUrl()).toThrow('License server not configured')
  })

  test('returns URL with scriptId and callback params', () => {
    __ENCODED_LICENSE_URL = _encode('https://license.example.com')
    const url = getActivationRedirectUrl()
    expect(url).toContain('scriptId=')
    expect(url).toContain('callback=')
  })
})
