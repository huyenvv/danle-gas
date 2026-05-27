require('./setup.js')
const { resetAll, setupAllSheets, seedUser, seedDept, seedAssignment, createAdminSession } = require('./helpers')

var adminToken

beforeEach(() => {
  resetAll()
  setupAllSheets()
  seedUser(1, 'admin', 'admin@test.com', { quyen: 'Quản trị', name: 'Admin' })
  seedUser(2, 'huyenvv', 'huyenvv@test.com', { name: 'Huyên' })
  seedUser(3, 'user3', 'user3@test.com', { name: 'User 3' })
  seedDept(10, 'Phòng Kế Toán')
  seedDept(11, 'Phòng Tài Chính')
  adminToken = createAdminSession(1, 'admin', 'admin@test.com')
})

// ── Empty operations ─────────────────────────────────────────────────────────

describe('batchSaveAssignments — empty operations', () => {
  test('returns success immediately without added/removed counts', () => {
    var result = batchSaveAssignments(adminToken, { adds: [], removes: [] })
    expect(result.success).toBe(true)
    expect(result.added).toBeUndefined()
    expect(result.removed).toBeUndefined()
  })

  test('omitted adds/removes defaults to empty (no error)', () => {
    var result = batchSaveAssignments(adminToken, {})
    expect(result.success).toBe(true)
  })
})

// ── Adds only ────────────────────────────────────────────────────────────────

describe('batchSaveAssignments — adds only', () => {
  test('creates a dept assignment and returns correct count', () => {
    var result = batchSaveAssignments(adminToken, {
      adds: [{ userId: 2, chucVu: 'Nhân viên', phongBanId: 10 }],
      removes: []
    })
    expect(result.success).toBe(true)
    expect(result.added).toBe(1)
    expect(result.removed).toBe(0)
    invalidateSheetCache(SHEETS.PHAN_BO)
    var rows = getSheetData(SHEETS.PHAN_BO)
    var match = rows.find(function(a) { return String(a['UserID']) === '2' && a['Chức vụ'] === 'Nhân viên' })
    expect(match).toBeTruthy()
  })

  test('creates a company-scoped assignment (no phongBanId)', () => {
    var result = batchSaveAssignments(adminToken, {
      adds: [{ userId: 2, chucVu: 'Giám đốc' }],
      removes: []
    })
    expect(result.added).toBe(1)
    invalidateSheetCache(SHEETS.PHAN_BO)
    var rows = getSheetData(SHEETS.PHAN_BO)
    var match = rows.find(function(a) { return String(a['UserID']) === '2' && a['Chức vụ'] === 'Giám đốc' })
    expect(match).toBeTruthy()
    expect(match['PhongBanID']).toBe('')
  })

  test('adds multiple assignments in one call', () => {
    var result = batchSaveAssignments(adminToken, {
      adds: [
        { userId: 2, chucVu: 'Nhân viên', phongBanId: 10 },
        { userId: 3, chucVu: 'Nhân viên', phongBanId: 11 }
      ],
      removes: []
    })
    expect(result.added).toBe(2)
  })

  test('company-scoped add strips supplied phongBanId', () => {
    batchSaveAssignments(adminToken, {
      adds: [{ userId: 2, chucVu: 'Phó GĐ', phongBanId: 10 }],
      removes: []
    })
    invalidateSheetCache(SHEETS.PHAN_BO)
    var rows = getSheetData(SHEETS.PHAN_BO)
    var match = rows.find(function(a) { return String(a['UserID']) === '2' && a['Chức vụ'] === 'Phó GĐ' })
    expect(match['PhongBanID']).toBe('')
  })
})

// ── Removes only ─────────────────────────────────────────────────────────────

describe('batchSaveAssignments — removes only', () => {
  test('deletes existing assignment and returns correct count', () => {
    seedAssignment(100, 2, 'Nhân viên', 10)
    var result = batchSaveAssignments(adminToken, { adds: [], removes: [100] })
    expect(result.success).toBe(true)
    expect(result.removed).toBe(1)
    expect(result.added).toBe(0)
    invalidateSheetCache(SHEETS.PHAN_BO)
    var rows = getSheetData(SHEETS.PHAN_BO)
    var match = rows.find(function(a) { return String(a['ID']) === '100' })
    expect(match).toBeUndefined()
  })

  test('removes multiple assignments', () => {
    seedAssignment(100, 2, 'Nhân viên', 10)
    seedAssignment(101, 3, 'Nhân viên', 11)
    var result = batchSaveAssignments(adminToken, { adds: [], removes: [100, 101] })
    expect(result.removed).toBe(2)
  })

  test('throws when remove targets non-existent assignment', () => {
    expect(() => batchSaveAssignments(adminToken, { adds: [], removes: [999] })).toThrow('Không tìm thấy')
  })
})

// ── Mixed operations (removes before adds) ───────────────────────────────────

describe('batchSaveAssignments — mixed operations', () => {
  test('removes run before adds so post-remove state is used for validation', () => {
    // Trưởng phòng max=1 in dept 10; existing one for user2
    seedAssignment(100, 2, 'Trưởng phòng', 10)
    // Remove user2's Trưởng phòng and add user3's in same call — should succeed
    var result = batchSaveAssignments(adminToken, {
      removes: [100],
      adds: [{ userId: 3, chucVu: 'Trưởng phòng', phongBanId: 10 }]
    })
    expect(result.added).toBe(1)
    expect(result.removed).toBe(1)
  })

  test('returns both added and removed counts', () => {
    seedAssignment(100, 2, 'Nhân viên', 10)
    var result = batchSaveAssignments(adminToken, {
      removes: [100],
      adds: [{ userId: 3, chucVu: 'Nhân viên', phongBanId: 11 }]
    })
    expect(result.added).toBe(1)
    expect(result.removed).toBe(1)
  })
})

// ── Validation errors ────────────────────────────────────────────────────────

describe('batchSaveAssignments — validation', () => {
  test('throws on invalid chucVu', () => {
    expect(() => batchSaveAssignments(adminToken, {
      adds: [{ userId: 2, chucVu: 'Không tồn tại', phongBanId: 10 }]
    })).toThrow('không hợp lệ')
  })

  test('throws when dept-scoped chucVu has no phongBanId', () => {
    expect(() => batchSaveAssignments(adminToken, {
      adds: [{ userId: 2, chucVu: 'Nhân viên' }]
    })).toThrow('yêu cầu phòng ban')
  })

  test('throws when Giám đốc max=1 would be exceeded', () => {
    seedAssignment(100, 2, 'Giám đốc', '')
    expect(() => batchSaveAssignments(adminToken, {
      adds: [{ userId: 3, chucVu: 'Giám đốc' }]
    })).toThrow('tối đa')
  })

  test('throws when Trưởng phòng max=1 in same dept would be exceeded', () => {
    seedAssignment(100, 2, 'Trưởng phòng', 10)
    expect(() => batchSaveAssignments(adminToken, {
      adds: [{ userId: 3, chucVu: 'Trưởng phòng', phongBanId: 10 }]
    })).toThrow('tối đa')
  })

  test('Trưởng phòng max=1 is per-dept (different dept is allowed)', () => {
    seedAssignment(100, 2, 'Trưởng phòng', 10)
    var result = batchSaveAssignments(adminToken, {
      adds: [{ userId: 3, chucVu: 'Trưởng phòng', phongBanId: 11 }]
    })
    expect(result.added).toBe(1)
  })

  test('throws on duplicate assignment (same user, role, dept)', () => {
    seedAssignment(100, 2, 'Nhân viên', 10)
    expect(() => batchSaveAssignments(adminToken, {
      adds: [{ userId: 2, chucVu: 'Nhân viên', phongBanId: 10 }]
    })).toThrow('đã tồn tại')
  })

  test('throws when user already has a different role in same dept', () => {
    seedAssignment(100, 2, 'Nhân viên', 10)
    expect(() => batchSaveAssignments(adminToken, {
      adds: [{ userId: 2, chucVu: 'Phó phòng', phongBanId: 10 }]
    })).toThrow('đã có vị trí')
  })
})

// ── Auth ─────────────────────────────────────────────────────────────────────

describe('batchSaveAssignments — auth', () => {
  test('throws for non-admin caller', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    expect(() => batchSaveAssignments(userToken, {
      adds: [{ userId: 3, chucVu: 'Nhân viên', phongBanId: 10 }]
    })).toThrow()
  })
})
