require('./setup.js')
const { resetAll, setupAllSheets, seedUser, seedAssignment, createAdminSession } = require('./helpers')

var adminToken

beforeEach(() => {
  resetAll()
  setupAllSheets()
  seedUser(1, 'admin', 'admin@test.com', { quyen: 'Quản trị', name: 'Admin' })
  seedUser(2, 'huyenvv', 'huyenvv@test.com', { name: 'Huyên' })
  seedUser(3, 'user3', 'user3@test.com', { name: 'User 3', status: 'Locked' })
  adminToken = createAdminSession(1, 'admin', 'admin@test.com')
})

// ── getUsers ─────────────────────────────────────────────────────────────────

describe('getUsers', () => {
  test('admin sees regular users but not Quản trị accounts', () => {
    seedUser(4, 'other-admin', 'other-admin@test.com', {})
    seedAssignment(99, 4, 'admin', '') // admin status now derived from _Phân Bổ
    var users = getUsers(adminToken)
    var ids = users.map(function(u) { return String(u.ID) })
    expect(ids).toContain('2')
    expect(ids).toContain('3')
    expect(ids).not.toContain('4') // another admin hidden from admin
  })

  test('owner never appears in user list', () => {
    // Mock owner is 'owner@test.com'
    seedUser(5, 'owner', 'owner@test.com', {})
    var users = getUsers(adminToken)
    var emails = users.map(function(u) { return u['Email'] })
    expect(emails).not.toContain('owner@test.com')
  })

  test('returns required fields only (no password hash)', () => {
    var users = getUsers(adminToken)
    var user = users.find(function(u) { return String(u.ID) === '2' })
    expect(user['Tên đăng nhập']).toBeDefined()
    expect(user['Email']).toBeDefined()
    expect(user['Trạng thái']).toBeDefined()
    expect(user['Mật khẩu']).toBeUndefined()
  })

  test('throws for non-admin', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    expect(() => getUsers(userToken)).toThrow()
  })
})

// ── addUser ──────────────────────────────────────────────────────────────────

describe('addUser', () => {
  test('creates user with required fields', () => {
    var result = addUser(adminToken, { 'Email': 'new@test.com', 'Tên nhân viên': 'New User' })
    expect(result.ID).toBeDefined()
    expect(result['Email']).toBe('new@test.com')
    expect(result['Tên đăng nhập']).toBeTruthy()
  })

  test('auto-generates username from email prefix', () => {
    var result = addUser(adminToken, { 'Email': 'john.doe@test.com' })
    expect(result['Tên đăng nhập']).toBeTruthy()
  })

  test('new user has MustChangePass=TRUE', () => {
    var result = addUser(adminToken, { 'Email': 'new@test.com' })
    expect(result['MustChangePass']).toBe('TRUE')
  })

  test('new user status is Active', () => {
    var result = addUser(adminToken, { 'Email': 'new@test.com' })
    expect(result['Trạng thái']).toBe('Active')
  })

  test('throws when Email is missing', () => {
    expect(() => addUser(adminToken, { 'Tên nhân viên': 'No Email' })).toThrow('Email')
  })

  test('throws on duplicate email', () => {
    expect(() => addUser(adminToken, { 'Email': 'huyenvv@test.com' })).toThrow()
  })

  test('new user Phòng ban and Chức vụ are empty', () => {
    var added = addUser(adminToken, { 'Email': 'new@test.com' })
    var user = getUsers(adminToken).find(function(u) { return String(u['ID']) === String(added.ID) })
    expect(user['Phòng ban']).toBe('')
    expect(user['Chức vụ']).toBe('')
  })

  test('throws for non-admin', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    expect(() => addUser(userToken, { 'Email': 'x@test.com' })).toThrow()
  })

  test('non-owner admin cannot grant Quản trị', () => {
    expect(() => addUser(adminToken, { 'Email': 'adm@test.com', 'Quyền': 'Quản trị' })).toThrow('chủ sở hữu')
  })

  test('owner can grant Quản trị (creates admin assignment in _Phân Bổ)', () => {
    var ownerToken = mintAccessToken({ userId: 1, username: 'admin', email: 'admin@test.com', role: 'admin', isOwner: true }, SHEETS.USERS)
    var added = addUser(ownerToken, { 'Email': 'adm@test.com', 'Quyền': 'Quản trị' })
    var adminRows = getSheetData(SHEETS.PHAN_BO).filter(function(a) {
      return String(a['UserID']) === String(added.ID) && a['Chức vụ'] === 'admin'
    })
    expect(adminRows.length).toBe(1)
  })
})

// ── updateUser ───────────────────────────────────────────────────────────────

describe('updateUser', () => {
  test('updates allowed fields', () => {
    updateUser(adminToken, 2, { 'Tên nhân viên': 'Updated Name' })
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '2' })
    expect(user['Tên nhân viên']).toBe('Updated Name')
  })

  test('ignores Phòng ban and Chức vụ (managed by _Phân Bổ)', () => {
    updateUser(adminToken, 2, { 'Phòng ban': 'Ignore Me', 'Chức vụ': 'Ignore Me' })
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '2' })
    expect(user['Phòng ban']).toBe('')
    expect(user['Chức vụ']).toBe('')
  })

  test('throws for non-admin', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    expect(() => updateUser(userToken, 3, { 'Tên nhân viên': 'X' })).toThrow()
  })

  test('non-owner admin cannot grant Quản trị', () => {
    expect(() => updateUser(adminToken, 2, { 'Quyền': 'Quản trị' })).toThrow('chủ sở hữu')
  })

  test('owner can grant/revoke Quản trị via _Phân Bổ', () => {
    var ownerToken = mintAccessToken({ userId: 1, username: 'admin', email: 'admin@test.com', role: 'admin', isOwner: true }, SHEETS.USERS)
    updateUser(ownerToken, 2, { 'Quyền': 'Quản trị' })
    var adminRows = getSheetData(SHEETS.PHAN_BO).filter(function(a) {
      return String(a['UserID']) === '2' && a['Chức vụ'] === 'admin'
    })
    expect(adminRows.length).toBe(1)
  })
})

// ── portalLockUser ───────────────────────────────────────────────────────────

describe('portalLockUser', () => {
  test('sets user status to Locked', () => {
    portalLockUser(adminToken, 2)
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '2' })
    expect(user['Trạng thái']).toBe('Locked')
  })

  test('locked user cannot login', () => {
    portalLockUser(adminToken, 2)
    expect(() => login('huyenvv@test.com', 'Admin@@123', 'desktop')).toThrow('khóa')
  })

  test('throws when admin tries to lock themselves', () => {
    expect(() => portalLockUser(adminToken, 1)).toThrow('tự khóa')
  })

  test('throws when targeting owner account', () => {
    seedUser(5, 'owner', 'owner@test.com', {})
    expect(() => portalLockUser(adminToken, 5)).toThrow('chủ sở hữu')
  })

  test('throws for non-admin', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    expect(() => portalLockUser(userToken, 3)).toThrow()
  })
})

// ── portalUnlockUser ─────────────────────────────────────────────────────────

describe('portalUnlockUser', () => {
  test('sets user status to Active', () => {
    portalUnlockUser(adminToken, 3)
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '3' })
    expect(user['Trạng thái']).toBe('Active')
  })

  test('resets FailedLogins to 0', () => {
    portalUnlockUser(adminToken, 3)
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '3' })
    expect(Number(user['FailedLogins'])).toBe(0)
  })

  test('sets MustChangePass=TRUE on unlock', () => {
    portalUnlockUser(adminToken, 3)
    invalidateSheetCache(SHEETS.USERS)
    var user = getSheetData(SHEETS.USERS).find(function(u) { return String(u['ID']) === '3' })
    expect(user['MustChangePass']).toBe('TRUE')
  })

  test('unlocked user can login with default password', () => {
    portalUnlockUser(adminToken, 3)
    var result = login('user3@test.com', DEFAULT_PASSWORD, 'desktop')
    expect(result.user.username).toBe('user3')
  })

  test('throws for non-existent user', () => {
    expect(() => portalUnlockUser(adminToken, 999)).toThrow('Không tìm thấy')
  })

  test('throws for non-admin', () => {
    var userToken = login('huyenvv@test.com', 'Admin@@123', 'desktop').accessToken
    expect(() => portalUnlockUser(userToken, 3)).toThrow()
  })
})
