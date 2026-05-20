const { loadGAS, resetGAS, setSheetData, getSheetData } = require('./setup')

describe('handoff tokens', () => {
  beforeEach(() => {
    resetGAS()
    loadGAS()
    // Initialize _Handoffs with headers so addRow can find columns
    setSheetData('_Handoffs', [
      { ID: '', Token: '', UserID: '', AppID: '', CreatedAt: '', ExpiresAt: '', Consumed: '' }
    ])
    // Re-initialize as empty (no data rows) by replacing with header-only sheet
    SpreadsheetApp._addSheet('_Handoffs', [['ID', 'Token', 'UserID', 'AppID', 'CreatedAt', 'ExpiresAt', 'Consumed']])
    if (typeof invalidateSheetCache === 'function') invalidateSheetCache('_Handoffs')
  })

  test('mintHandoff appends row with userId/appId/exp', () => {
    var token = mintHandoff(1, 'docmgr')
    expect(typeof token).toBe('string')
    var rows = getSheetData('_Handoffs')
    expect(rows.length).toBe(1)
    expect(String(rows[0].UserID)).toBe('1')
    expect(rows[0].AppID).toBe('docmgr')
    expect(rows[0].Consumed).toBe('FALSE')
    expect(Number(rows[0].ExpiresAt)).toBeGreaterThan(Date.now())
  })

  test('consumeHandoff returns userId + marks consumed', () => {
    var token = mintHandoff(1, 'docmgr')
    var result = consumeHandoff(token, 'docmgr')
    expect(result.userId).toBeDefined()
    var rows = getSheetData('_Handoffs')
    expect(String(rows[0].Consumed)).toBe('TRUE')
  })

  test('consumeHandoff fails on second use (single-use)', () => {
    var token = mintHandoff(1, 'docmgr')
    consumeHandoff(token, 'docmgr')
    expect(() => consumeHandoff(token, 'docmgr')).toThrow('HANDOFF_INVALID')
  })

  test('consumeHandoff fails on wrong appId', () => {
    var token = mintHandoff(1, 'docmgr')
    expect(() => consumeHandoff(token, 'workmgr')).toThrow('HANDOFF_INVALID')
  })

  test('consumeHandoff fails on expired token', () => {
    var token = mintHandoff(1, 'docmgr')
    var rows = getSheetData('_Handoffs')
    var row = rows[0]
    // Replace with expired ExpiresAt, preserving all other fields including ID
    setSheetData('_Handoffs', [{ ...row, ExpiresAt: Date.now() - 1000 }])
    expect(() => consumeHandoff(token, 'docmgr')).toThrow('HANDOFF_INVALID')
  })

  test('consumeHandoff fails on unknown token', () => {
    expect(() => consumeHandoff('unknown', 'docmgr')).toThrow('HANDOFF_INVALID')
  })
})
