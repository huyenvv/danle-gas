const { loadGAS, resetGAS, setSheetData, getSheetData } = require('./setup')

describe('session epoch', () => {
  beforeEach(() => {
    resetGAS()
    loadGAS()
  })

  test('isBeforeEpoch returns true when token createdAt < user.LastLogoutAt', () => {
    setSheetData('_Người Dùng', [
      { ID: 1, Email: 'a@x.com', LastLogoutAt: 2000 },
    ])
    expect(isBeforeEpoch('_Người Dùng', 1, 1000)).toBe(true)
    expect(isBeforeEpoch('_Người Dùng', 1, 3000)).toBe(false)
  })

  test('isBeforeEpoch returns false when LastLogoutAt missing or zero', () => {
    setSheetData('_Người Dùng', [
      { ID: 1, Email: 'a@x.com', LastLogoutAt: '' },
    ])
    expect(isBeforeEpoch('_Người Dùng', 1, 1000)).toBe(false)
  })

  test('bumpEpoch sets user.LastLogoutAt to >= now', () => {
    setSheetData('_Người Dùng', [
      { ID: 1, Email: 'a@x.com', LastLogoutAt: 0 },
    ])
    var before = Date.now()
    bumpEpoch('_Người Dùng', 1)
    var users = getSheetData('_Người Dùng')
    expect(Number(users[0].LastLogoutAt)).toBeGreaterThanOrEqual(before)
  })
})
