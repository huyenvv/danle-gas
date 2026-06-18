require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, createSession } = require('./helpers')

// Seed a local _Phân Quyền row with explicit category-creation flags.
// ROLE_HEADERS idx: 5=tạo hồ sơ, 6=tạo danh mục con, 7=phát hành, 8=chọn Drive, 9=import, 10=tạo danh mục cha
function seedRole(userId, role, canSubCat, canRootCat) {
  SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push(
    [1, userId, 'vanthu', APP_ID, role, '', canSubCat ? 'TRUE' : '', '', '', '', canRootCat ? 'TRUE' : '']
  )
  invalidateSheetCache(SHEETS.APP_ROLES)
}

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
})

describe('api_addCategory — Văn thư + "Được tạo danh mục con"', () => {
  test('Văn thư WITH the permission can create a subcategory', () => {
    seedRole(9, 'Văn thư', true)
    const token = createSession(9, 'vanthu', 'vt@test.com', 'Văn thư')
    const r = api_addCategory(token, { 'Tên danh mục': 'Con', 'Danh mục cha': '1' })
    expect(r.success).toBe(true)
  })

  test('Văn thư WITH the permission still CANNOT create a root category', () => {
    seedRole(9, 'Văn thư', true)
    const token = createSession(9, 'vanthu', 'vt@test.com', 'Văn thư')
    const r = api_addCategory(token, { 'Tên danh mục': 'Gốc' }) // no 'Danh mục cha'
    expect(r.success).toBe(false)
    expect(r.error).toContain('không có quyền')
  })

  test('Văn thư WITHOUT the permission cannot create any category', () => {
    seedRole(9, 'Văn thư', false)
    const token = createSession(9, 'vanthu', 'vt@test.com', 'Văn thư')
    const r = api_addCategory(token, { 'Tên danh mục': 'Con', 'Danh mục cha': '1' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('không có quyền')
  })

  test('admin can create a root category', () => {
    const token = createSession(1, 'admin', 'admin@test.com', 'admin')
    const r = api_addCategory(token, { 'Tên danh mục': 'Gốc' })
    expect(r.success).toBe(true)
  })
})

describe('api_addCategory — Văn thư + "Được tạo danh mục cha"', () => {
  test('Văn thư WITH the root permission can create a root category', () => {
    seedRole(9, 'Văn thư', false, true)
    const token = createSession(9, 'vanthu', 'vt@test.com', 'Văn thư')
    const r = api_addCategory(token, { 'Tên danh mục': 'Gốc' }) // no 'Danh mục cha'
    expect(r.success).toBe(true)
  })

  test('root permission ALSO allows creating a subcategory (cha bao hàm con)', () => {
    seedRole(9, 'Văn thư', false, true)
    const token = createSession(9, 'vanthu', 'vt@test.com', 'Văn thư')
    const r = api_addCategory(token, { 'Tên danh mục': 'Con', 'Danh mục cha': '1' })
    expect(r.success).toBe(true)
  })

  test('a user with BOTH permissions can create root and sub', () => {
    seedRole(9, 'Văn thư', true, true)
    const token = createSession(9, 'vanthu', 'vt@test.com', 'Văn thư')
    expect(api_addCategory(token, { 'Tên danh mục': 'Gốc' }).success).toBe(true)
    expect(api_addCategory(token, { 'Tên danh mục': 'Con', 'Danh mục cha': '1' }).success).toBe(true)
  })
})
