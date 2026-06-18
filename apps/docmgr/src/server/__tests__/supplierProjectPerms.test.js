require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, createSession } = require('./helpers')

const SUPPLIER_HEADERS = ['ID', 'Tên NCC viết tắt', 'Tên NCC đầy đủ', 'Địa chỉ', 'Mã số thuế', 'Điện thoại', 'Người đại diện', 'Số tài khoản', 'Tên ngân hàng', 'Lĩnh vực kinh doanh']
const PROJECT_HEADERS = ['ID', 'Tên dự án viết tắt', 'Tên dự án đầy đủ', 'Địa chỉ']

const vanthu = () => createSession(9, 'vanthu', 'vt@test.com', 'Văn thư')
const admin = () => createSession(1, 'admin', 'admin@test.com', 'admin')

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets() // Hồ Sơ needed: deleteRow override runs referential-integrity checks against it
  SpreadsheetApp._addSheet(SHEETS.NHA_CUNG_CAP, [SUPPLIER_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.DU_AN, [PROJECT_HEADERS])
})

describe('Văn thư — Nơi gửi (NCC) permissions: add/edit yes, delete no', () => {
  test('can ADD supplier', () => {
    expect(api_addNhaCungCap(vanthu(), { 'Tên NCC viết tắt': 'A' }).success).toBe(true)
  })

  test('can EDIT supplier', () => {
    const id = api_addNhaCungCap(admin(), { 'Tên NCC viết tắt': 'A' }).payload.ID
    expect(api_updateNhaCungCap(vanthu(), id, { 'Tên NCC viết tắt': 'B' }).success).toBe(true)
  })

  test('CANNOT delete supplier', () => {
    const id = api_addNhaCungCap(admin(), { 'Tên NCC viết tắt': 'A' }).payload.ID
    const r = api_deleteNhaCungCap(vanthu(), id)
    expect(r.success).toBe(false)
    expect(r.error).toContain('quản trị')
  })
})

describe('Văn thư — Nơi nhận (Dự án) permissions: add/edit yes, delete no', () => {
  test('can ADD + EDIT but CANNOT delete project', () => {
    const id = api_addDuAn(vanthu(), { 'Tên dự án viết tắt': 'P' }).payload.ID
    expect(id).toBeTruthy()
    expect(api_updateDuAn(vanthu(), id, { 'Tên dự án viết tắt': 'P2' }).success).toBe(true)
    const del = api_deleteDuAn(vanthu(), id)
    expect(del.success).toBe(false)
    expect(del.error).toContain('quản trị')
  })
})

describe('admin still has full control (regression)', () => {
  test('admin can delete supplier and project', () => {
    const sid = api_addNhaCungCap(admin(), { 'Tên NCC viết tắt': 'A' }).payload.ID
    expect(api_deleteNhaCungCap(admin(), sid).success).toBe(true)
    const pid = api_addDuAn(admin(), { 'Tên dự án viết tắt': 'P' }).payload.ID
    expect(api_deleteDuAn(admin(), pid).success).toBe(true)
  })
})
