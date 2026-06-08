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

// Assignment create/validation is covered by batchSaveAssignments.test.js.
// These cover the getUsers derivation across multiple assignments.
describe('getUsers derivation — multiple assignments', () => {
  test('user with multiple assignments gets highest-rank position', () => {
    seedAssignment(1, 2, 'Nhân viên', 2)
    seedAssignment(2, 2, 'Trưởng phòng', 1)
    var user = getUsers(adminToken).find(function(u) { return String(u['ID']) === '2' })
    // Trưởng phòng (rank 60) > Nhân viên (rank 10)
    expect(user['Chức vụ']).toBe('Trưởng phòng')
    expect(user['Phòng ban']).toBe('Kỹ thuật')
  })
})

// ── batchSaveAssignments removes → derived fields ───────────────────────────

describe('batchSaveAssignments removes — derived fields', () => {
  test('removing the only assignment clears derived fields', () => {
    seedAssignment(1, 2, 'Trưởng phòng', 1)
    batchSaveAssignments(adminToken, { removes: [1] })

    invalidateSheetCache(SHEETS.PHAN_BO)
    expect(getSheetData(SHEETS.PHAN_BO)).toHaveLength(0)

    var user = getUsers(adminToken).find(function(u) { return String(u['ID']) === '2' })
    expect(user['Chức vụ']).toBe('')
    expect(user['Phòng ban']).toBe('')
  })

  test('removing one of multiple assignments keeps the best', () => {
    seedAssignment(1, 2, 'Trưởng phòng', 1)
    seedAssignment(2, 2, 'Nhân viên', 2)
    batchSaveAssignments(adminToken, { removes: [1] })

    var user = getUsers(adminToken).find(function(u) { return String(u['ID']) === '2' })
    expect(user['Chức vụ']).toBe('Nhân viên')
    expect(user['Phòng ban']).toBe('Kinh doanh')
  })
})

// ── getUsers derives position from _Phân Bổ ──────────────────────────────────

describe('getUsers derivation', () => {
  test('empty Chức vụ + Phòng ban when no assignments exist', () => {
    var user = getUsers(adminToken).find(function(u) { return String(u['ID']) === '3' })
    expect(user['Chức vụ']).toBe('')
    expect(user['Phòng ban']).toBe('')
  })

  test('sets correct dept name from phongBanId', () => {
    seedAssignment(1, 3, 'Nhân viên', 2)
    var user = getUsers(adminToken).find(function(u) { return String(u['ID']) === '3' })
    expect(user['Chức vụ']).toBe('Nhân viên')
    expect(user['Phòng ban']).toBe('Kinh doanh')
  })

  test('company-level assignment sets empty phongBan', () => {
    seedAssignment(1, 2, 'Giám đốc', '')
    var user = getUsers(adminToken).find(function(u) { return String(u['ID']) === '2' })
    expect(user['Chức vụ']).toBe('Giám đốc')
    expect(user['Phòng ban']).toBe('')
  })
})

// ── deletePhongBan cascade ──────────────────────────────────────────────────

describe('deletePhongBan', () => {
  test('throws when the dept still has members', () => {
    seedAssignment(1, 2, 'Trưởng phòng', 1)
    expect(() => deletePhongBan(adminToken, 1)).toThrow('còn nhân viên')
  })

  test('deletes an empty dept', () => {
    deletePhongBan(adminToken, 2) // dept 2 has no assignments
    invalidateSheetCache(SHEETS.PHONG_BAN)
    var depts = getSheetData(SHEETS.PHONG_BAN)
    expect(depts.find(function(d) { return String(d['ID']) === '2' })).toBeUndefined()
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
    var added = addUser(adminToken, { 'Email': 'newuser@test.com', 'Tên nhân viên': 'New' })
    var user = getUsers(adminToken).find(function(u) { return String(u['ID']) === String(added.ID) })
    expect(user['Phòng ban']).toBe('')
    expect(user['Chức vụ']).toBe('')
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

// _getDeptRole is a docmgr-only helper (see apps/docmgr auth.test.js) — not part of SSO Portal.

// ── POSITIONS constant ──────────────────────────────────────────────────────

describe('POSITIONS constant', () => {
  test('has correct structure', () => {
    expect(POSITIONS.length).toBe(8) // 7 chức vụ + 'admin'
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

  test('api_batchSaveAssignments wraps batchSaveAssignments', () => {
    var res = api_batchSaveAssignments(adminToken, { adds: [{ userId: 2, chucVu: 'Nhân viên', phongBanId: 1 }] })
    expect(res.success).toBe(true)
    expect(res.payload.added).toBe(1)
  })

  test('api wrappers return error on failure', () => {
    var res = api_batchSaveAssignments(adminToken, { adds: [{ userId: 2, chucVu: 'FAKE' }] })
    expect(res.success).toBe(false)
    expect(res.error).toContain('không hợp lệ')
  })
})
