// Smoke test: verifies the full gas-core + workmgr server bundle loads in the correct
// order without errors, that key entry points exist, and that security-critical behaviour
// holds. This is the safety net that catches gas-core changes silently breaking workmgr.
const { resetGAS } = require('./setup.js')

describe('workmgr server bundle — smoke', () => {
  test('gas-core primitives are loaded', () => {
    expect(typeof getSheetData).toBe('function')
    expect(typeof addRow).toBe('function')
    expect(typeof deleteRow).toBe('function')       // overridden in workmgr/sheets.js
    expect(typeof requireAuth).toBe('function')
    expect(typeof requireAdmin).toBe('function')
    expect(typeof mintAccessToken).toBe('function')
    expect(typeof validateAccessTokenCrossScript).toBe('function')
    expect(typeof ssoGetParentSheetId).toBe('function')
  })

  test('app config globals are defined', () => {
    expect(typeof SHEETS).toBe('object')
    expect(typeof APP_ID).toBe('string')
  })

  test('GAS entry points are defined', () => {
    var entryPoints = [
      'doGet', 'api_ssoLogin', 'api_resume', 'api_logout',
      'api_getAllData', 'api_getTasks', 'api_createTask', 'api_updateTask',
      'api_deleteTask', 'api_getUsers', 'api_updateUser',
    ]
    entryPoints.forEach(function(fn) {
      expect(typeof global[fn]).toBe('function')
    })
  })

  test('removed gas-core symbols are NOT present (handoff/rotateRefreshToken)', () => {
    expect(typeof global.mintHandoff).toBe('undefined')
    expect(typeof global.consumeHandoffCrossScript).toBe('undefined')
    expect(typeof global.rotateRefreshToken).toBe('undefined')
  })

  test('api_ssoLogin rejects a parentSheetId that does not match the pinned parent', () => {
    resetGAS()
    ssoStoreParentSheetId('real-parent-id')
    var res = api_ssoLogin('fake-parent-id', 'sometoken', 'desktop')
    expect(res.success).toBe(false)
    expect(res.error).toBe('INVALID_SSO')
  })
})
