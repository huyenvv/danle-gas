require('./setup.js')
const { resetAll, setupAllSheets, seedUser, seedDept, seedAssignment, createAdminSession } = require('./helpers')

var adminToken

beforeEach(() => {
  resetAll()
  setupAllSheets()
  seedUser(1, 'admin@test.com', 'admin@test.com', { quyen: 'Quản trị', name: 'Admin' })
  seedUser(2, 'huyenvv', 'huyenvv@test.com', { name: 'Vũ Văn Huyên' })
  seedUser(3, 'nva', 'nva@test.com', { name: 'Nguyễn Văn A' })
  seedUser(4, 'ttb', 'ttb@test.com', { name: 'Trần Thị B' })
  seedDept(1, 'Kỹ thuật')
  seedDept(2, 'Kinh doanh')
  adminToken = createAdminSession(1, 'admin@test.com', 'admin@test.com')
})

// ── getOrgStructure ─────────────────────────────────────────────────────────

describe('getOrgStructure', () => {
  test('returns assignments, departments, positions, users', () => {
    seedAssignment(1, 2, 'Trưởng phòng', 1)
    var result = getOrgStructure(adminToken)
    expect(result.assignments).toHaveLength(1)
    expect(result.departments).toHaveLength(2)
    expect(result.positions).toEqual(POSITIONS)
    expect(result.users.length).toBeGreaterThanOrEqual(4)
  })

  test('returns empty assignments when none exist', () => {
    var result = getOrgStructure(adminToken)
    expect(result.assignments).toHaveLength(0)
  })

  test('throws for non-admin', () => {
    var userToken = mintAccessToken({ userId: 2, username: 'huyenvv', email: 'huyenvv@test.com', role: 'user' })
    expect(() => getOrgStructure(userToken)).toThrow()
  })
})

// ── saveAssignment ──────────────────────────────────────────────────────────

describe('saveAssignment', () => {
  test('creates a dept-level assignment', () => {
    var result = saveAssignment(adminToken, { userId: 2, chucVu: 'Trưởng phòng', phongBanId: 1 })
    expect(result.ID).toBeDefined()
    expect(result['UserID']).toBe('2')
    expect(result['Chức vụ']).toBe('Trưởng phòng')
    expect(result['PhongBanID']).toBe(1)
  })

  test('creates a company-level assignment (no dept)', () => {
    var result = saveAssignment(adminToken, { userId: 2, chucVu: 'Giám đốc' })
    expect(result['PhongBanID']).toBe('')
  })

  test('syncs user Chức vụ + Phòng ban after assignment', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Trưởng phòng', phongBanId: 1 })
    invalidateSheetCache(SHEETS.USERS)
    var users = getSheetData(SHEETS.USERS)
    var user = users.find(function(u) { return String(u['ID']) === '2' })
    expect(user['Chức vụ']).toBe('Trưởng phòng')
    expect(user['Phòng ban']).toBe('Kỹ thuật')
  })

  test('user with multiple assignments gets highest-rank position', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Nhân viên', phongBanId: 2 })
    saveAssignment(adminToken, { userId: 2, chucVu: 'Trưởng phòng', phongBanId: 1 })
    invalidateSheetCache(SHEETS.USERS)
    var users = getSheetData(SHEETS.USERS)
    var user = users.find(function(u) { return String(u['ID']) === '2' })
    // Trưởng phòng (rank 70) > Nhân viên (rank 10)
    expect(user['Chức vụ']).toBe('Trưởng phòng')
    expect(user['Phòng ban']).toBe('Kỹ thuật')
  })

  test('rejects invalid position', () => {
    expect(() => saveAssignment(adminToken, { userId: 2, chucVu: 'Thượng đế' })).toThrow('Chức vụ không hợp lệ')
  })

  test('rejects dept position without phongBanId', () => {
    expect(() => saveAssignment(adminToken, { userId: 2, chucVu: 'Trưởng phòng' })).toThrow('yêu cầu phòng ban')
  })

  test('enforces max=1 for Giám đốc', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Giám đốc' })
    expect(() => saveAssignment(adminToken, { userId: 3, chucVu: 'Giám đốc' })).toThrow('tối đa 1')
  })

  test('enforces max=1 Trưởng phòng per dept', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Trưởng phòng', phongBanId: 1 })
    expect(() => saveAssignment(adminToken, { userId: 3, chucVu: 'Trưởng phòng', phongBanId: 1 })).toThrow('tối đa 1')
  })

  test('allows Trưởng phòng in different depts', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Trưởng phòng', phongBanId: 1 })
    var result = saveAssignment(adminToken, { userId: 3, chucVu: 'Trưởng phòng', phongBanId: 2 })
    expect(result.ID).toBeDefined()
  })

  test('rejects duplicate assignment', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Nhân viên', phongBanId: 1 })
    expect(() => saveAssignment(adminToken, { userId: 2, chucVu: 'Nhân viên', phongBanId: 1 })).toThrow('đã tồn tại')
  })

  test('rejects same user with two positions in same dept', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Nhân viên', phongBanId: 1 })
    expect(() => saveAssignment(adminToken, { userId: 2, chucVu: 'Phó phòng', phongBanId: 1 })).toThrow('đã có vị trí trong phòng ban này')
  })

  test('allows same user in different depts', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Trưởng phòng', phongBanId: 1 })
    var result = saveAssignment(adminToken, { userId: 2, chucVu: 'Phó phòng', phongBanId: 2 })
    expect(result.ID).toBeDefined()
  })

  test('allows unlimited Phó GĐ (max=-1)', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Phó GĐ' })
    saveAssignment(adminToken, { userId: 3, chucVu: 'Phó GĐ' })
    var assignments = getSheetData(SHEETS.PHAN_BO)
    var phoGd = assignments.filter(function(a) { return a['Chức vụ'] === 'Phó GĐ' })
    expect(phoGd).toHaveLength(2)
  })

  test('company-level ignores phongBanId', () => {
    var result = saveAssignment(adminToken, { userId: 2, chucVu: 'Văn thư', phongBanId: 1 })
    expect(result['PhongBanID']).toBe('')
  })

  test('throws for non-admin', () => {
    var userToken = mintAccessToken({ userId: 2, username: 'huyenvv', email: 'huyenvv@test.com', role: 'user' })
    expect(() => saveAssignment(userToken, { userId: 3, chucVu: 'Nhân viên', phongBanId: 1 })).toThrow()
  })
})

// ── removeAssignment ────────────────────────────────────────────────────────

describe('removeAssignment', () => {
  test('removes an assignment and syncs user fields', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Trưởng phòng', phongBanId: 1 })
    var assignments = getSheetData(SHEETS.PHAN_BO)
    var aid = assignments[0].ID

    removeAssignment(adminToken, aid)

    invalidateSheetCache(SHEETS.PHAN_BO)
    expect(getSheetData(SHEETS.PHAN_BO)).toHaveLength(0)

    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '2' })
    expect(user['Chức vụ']).toBe('')
    expect(user['Phòng ban']).toBe('')
  })

  test('removing one of multiple assignments keeps the best', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Trưởng phòng', phongBanId: 1 })
    saveAssignment(adminToken, { userId: 2, chucVu: 'Nhân viên', phongBanId: 2 })

    // Remove TP assignment
    invalidateSheetCache(SHEETS.PHAN_BO)
    var assignments = getSheetData(SHEETS.PHAN_BO)
    var tpAssignment = assignments.find(function(a) { return a['Chức vụ'] === 'Trưởng phòng' })
    removeAssignment(adminToken, tpAssignment.ID)

    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '2' })
    expect(user['Chức vụ']).toBe('Nhân viên')
    expect(user['Phòng ban']).toBe('Kinh doanh')
  })

  test('throws for non-existent assignment', () => {
    expect(() => removeAssignment(adminToken, 999)).toThrow('Không tìm thấy phân bổ')
  })
})

// ── _syncUsersFromStructure ─────────────────────────────────────────────────

describe('_syncUsersFromStructure', () => {
  test('clears user fields when no assignments exist', () => {
    // Pre-set some values
    seedUser(5, 'user5', 'user5@test.com', { chucVu: 'Nhân viên', phongBan: 'Kỹ thuật' })
    _syncUsersFromStructure()
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '5' })
    expect(user['Chức vụ']).toBe('')
    expect(user['Phòng ban']).toBe('')
  })

  test('sets correct dept name from phongBanId', () => {
    seedAssignment(1, 3, 'Nhân viên', 2)
    _syncUsersFromStructure()
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '3' })
    expect(user['Chức vụ']).toBe('Nhân viên')
    expect(user['Phòng ban']).toBe('Kinh doanh')
  })

  test('company-level assignment sets empty phongBan', () => {
    seedAssignment(1, 2, 'Giám đốc', '')
    _syncUsersFromStructure()
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '2' })
    expect(user['Chức vụ']).toBe('Giám đốc')
    expect(user['Phòng ban']).toBe('')
  })
})

// ── deletePhongBan cascade ──────────────────────────────────────────────────

describe('deletePhongBan cascade', () => {
  test('cascade-deletes assignments when dept is deleted', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Trưởng phòng', phongBanId: 1 })
    saveAssignment(adminToken, { userId: 3, chucVu: 'Nhân viên', phongBanId: 1 })
    saveAssignment(adminToken, { userId: 4, chucVu: 'Nhân viên', phongBanId: 2 })

    deletePhongBan(adminToken, 1)

    invalidateSheetCache(SHEETS.PHAN_BO)
    var remaining = getSheetData(SHEETS.PHAN_BO)
    expect(remaining).toHaveLength(1)
    expect(remaining[0]['PhongBanID']).toBe(2)
  })

  test('syncs user fields after cascade delete', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Trưởng phòng', phongBanId: 1 })
    deletePhongBan(adminToken, 1)

    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '2' })
    expect(user['Chức vụ']).toBe('')
    expect(user['Phòng ban']).toBe('')
  })
})

// ── addPhongBan (simplified) ────────────────────────────────────────────────

describe('addPhongBan simplified', () => {
  test('creates dept with name only', () => {
    var result = addPhongBan(adminToken, { 'Tên phòng ban': 'Marketing' })
    expect(result['Tên phòng ban']).toBe('Marketing')
    expect(result.ID).toBeDefined()
  })

  test('rejects empty name', () => {
    expect(() => addPhongBan(adminToken, { 'Tên phòng ban': '' })).toThrow('bắt buộc')
  })

  test('rejects duplicate name', () => {
    expect(() => addPhongBan(adminToken, { 'Tên phòng ban': 'Kỹ thuật' })).toThrow('đã tồn tại')
  })
})

// ── getPhongBan (simplified) ────────────────────────────────────────────────

describe('getPhongBan simplified', () => {
  test('returns only ID and name', () => {
    var result = getPhongBan(adminToken)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ ID: 1, 'Tên phòng ban': 'Kỹ thuật' })
  })
})

// ── addUser (no Phòng ban / Chức vụ) ────────────────────────────────────────

describe('addUser without org fields', () => {
  test('creates user with empty Phòng ban and Chức vụ', () => {
    var result = addUser(adminToken, { 'Email': 'newuser@test.com', 'Tên nhân viên': 'New' })
    expect(result['Phòng ban']).toBe('')
    expect(result['Chức vụ']).toBe('')
  })
})

// ── updateUser (blocks Phòng ban / Chức vụ edits) ───────────────────────────

describe('updateUser blocks org fields', () => {
  test('ignores Phòng ban and Chức vụ in update', () => {
    updateUser(adminToken, 2, { 'Phòng ban': 'Should-Be-Ignored', 'Chức vụ': 'Should-Be-Ignored', 'Tên nhân viên': 'Updated Name' })
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '2' })
    expect(user['Tên nhân viên']).toBe('Updated Name')
    expect(user['Phòng ban']).toBe('')  // unchanged from seed
    expect(user['Chức vụ']).toBe('')    // unchanged from seed
  })
})

// ── portalSync includes assignments ─────────────────────────────────────────

describe('portalSync', () => {
  test('admin sync includes assignments', () => {
    seedAssignment(1, 2, 'Nhân viên', 1)
    var result = portalSync(adminToken)
    expect(result.assignments).toBeDefined()
    expect(result.assignments).toHaveLength(1)
    expect(result.phongBan).toBeDefined()
    expect(result.apps).toBeDefined()
  })

  test('non-admin sync does not include assignments', () => {
    var userToken = mintAccessToken({ userId: 2, username: 'huyenvv', email: 'huyenvv@test.com', role: 'user' })
    var result = portalSync(userToken)
    expect(result.assignments).toBeUndefined()
    expect(result.apps).toBeDefined()
  })
})

// ── _getDeptRole (gas-core cross-script) ────────────────────────────────────

describe('_getDeptRole reads _Phân Bổ', () => {
  test('returns best role from assignments', () => {
    seedAssignment(1, 2, 'Trưởng phòng', 1)
    seedAssignment(2, 2, 'Phó phòng', 2)
    var ss = SpreadsheetApp.getActiveSpreadsheet()
    var role = _getDeptRole(ss, 2)
    expect(role).toBe('Trưởng phòng')
  })

  test('returns empty for user with no assignments', () => {
    var ss = SpreadsheetApp.getActiveSpreadsheet()
    var role = _getDeptRole(ss, 99)
    expect(role).toBe('')
  })

  test('returns single role for user with one assignment', () => {
    seedAssignment(1, 3, 'Nhân viên', 1)
    var ss = SpreadsheetApp.getActiveSpreadsheet()
    var role = _getDeptRole(ss, 3)
    expect(role).toBe('Nhân viên')
  })
})

// ── POSITIONS constant ──────────────────────────────────────────────────────

describe('POSITIONS constant', () => {
  test('has correct structure', () => {
    expect(POSITIONS.length).toBe(7)
    POSITIONS.forEach(function(p) {
      expect(p).toHaveProperty('code')
      expect(p).toHaveProperty('rank')
      expect(p).toHaveProperty('scope')
      expect(p).toHaveProperty('max')
      expect(['company', 'dept']).toContain(p.scope)
    })
  })

  test('Giám đốc has max=1', () => {
    var gd = POSITIONS.find(function(p) { return p.code === 'Giám đốc' })
    expect(gd.max).toBe(1)
    expect(gd.scope).toBe('company')
  })

  test('Trưởng phòng has max=1 per dept', () => {
    var tp = POSITIONS.find(function(p) { return p.code === 'Trưởng phòng' })
    expect(tp.max).toBe(1)
    expect(tp.scope).toBe('dept')
  })

  test('_getPositionRank returns correct values', () => {
    expect(_getPositionRank('admin')).toBe(100)
    expect(_getPositionRank('Giám đốc')).toBe(90)
    expect(_getPositionRank('Nhân viên')).toBe(10)
    expect(_getPositionRank('unknown')).toBe(0)
  })
})

// ── API wrappers ────────────────────────────────────────────────────────────

describe('API wrappers', () => {
  test('api_getOrgStructure wraps getOrgStructure', () => {
    var res = api_getOrgStructure(adminToken)
    expect(res.success).toBe(true)
    expect(res.payload.positions).toBeDefined()
  })

  test('api_saveAssignment wraps saveAssignment', () => {
    var res = api_saveAssignment(adminToken, { userId: 2, chucVu: 'Nhân viên', phongBanId: 1 })
    expect(res.success).toBe(true)
    expect(res.payload.ID).toBeDefined()
  })

  test('api_removeAssignment wraps removeAssignment', () => {
    saveAssignment(adminToken, { userId: 2, chucVu: 'Nhân viên', phongBanId: 1 })
    invalidateSheetCache(SHEETS.PHAN_BO)
    var assignments = getSheetData(SHEETS.PHAN_BO)
    var res = api_removeAssignment(adminToken, assignments[0].ID)
    expect(res.success).toBe(true)
  })

  test('api wrappers return error on failure', () => {
    var res = api_saveAssignment(adminToken, { userId: 2, chucVu: 'FAKE' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('không hợp lệ')
  })
})
