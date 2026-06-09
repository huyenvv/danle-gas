require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, seedUser, createSession } = require('./helpers')

let directorToken

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
  setConfig('ROOT_FOLDER_ID', 'root123')

  seedUser(1, 'director', 'd@test.com', 'Giám đốc')
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([1, 'Hợp đồng', '', '', '', '', ''])
  invalidateSheetCache(SHEETS.DANH_MUC)

  directorToken = createSession(1, 'director', 'd@test.com', 'Giám đốc')

  // A source file living anywhere in the owner's Drive
  DriveApp._files['srcA'] = { id: 'srcA', name: 'Báo cáo.pdf', mimeType: 'application/pdf', size: 1234 }
  DriveApp._files['srcB'] = { id: 'srcB', name: 'Bảng lương.xlsx', mimeType: 'application/vnd.ms-excel', size: 5678 }
})

// Seed a non-full-access user, optionally with the "Được chọn từ Drive" flag set.
function seedStaff(id, username, role, withFlag) {
  SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push(
    [SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.length, id, username, APP_ID, role, '', '', '', withFlag ? 'TRUE' : '']
  )
  invalidateSheetCache(SHEETS.APP_ROLES)
}

describe('_checkPickDrivePermission', () => {
  test('full-access roles pass without the flag', () => {
    expect(() => _checkPickDrivePermission({ role: 'Giám đốc', userId: 1 })).not.toThrow()
    expect(() => _checkPickDrivePermission({ role: 'admin', userId: 9 })).not.toThrow()
    expect(() => _checkPickDrivePermission({ role: 'Văn thư', userId: 9 })).not.toThrow()
    expect(() => _checkPickDrivePermission({ role: 'Quản trị viên', userId: 9 })).not.toThrow()
  })

  test('non-full-access without flag is rejected', () => {
    seedStaff(2, 'staff', 'Nhân viên', false)
    expect(() => _checkPickDrivePermission({ role: 'Nhân viên', userId: 2 })).toThrow('không có quyền')
  })

  test('non-full-access with flag passes', () => {
    seedStaff(3, 'staff2', 'Nhân viên', true)
    expect(() => _checkPickDrivePermission({ role: 'Nhân viên', userId: 3 })).not.toThrow()
  })
})

describe('copyDriveFilesToCategory', () => {
  test('copies a file into the category folder and returns its metadata', () => {
    const results = copyDriveFilesToCategory(['srcA'], 1)
    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(true)
    expect(results[0].fileInfo.fileName).toBe('Báo cáo.pdf')
    expect(results[0].fileInfo.mimeType).toBe('application/pdf')
    expect(results[0].fileInfo.size).toBe(1234)
    expect(results[0].fileInfo.fileId).toContain('copy_srcA')
    // The copy is shared like a normal upload
    const copyId = results[0].fileInfo.fileId
    expect(DriveApp._files[copyId].sharing.access).toBe('ANYONE_WITH_LINK')
  })

  test('a missing/unreadable file fails for that file only, others succeed', () => {
    const results = copyDriveFilesToCategory(['srcA', 'ghost', 'srcB'], 1)
    expect(results.map(r => r.ok)).toEqual([true, false, true])
    expect(results[1].error).toBeTruthy()
  })
})

describe('copyDriveFiles (full flow)', () => {
  test('no draftId creates a Nháp row and attaches both copies', () => {
    const res = copyDriveFiles(directorToken, ['srcA', 'srcB'], 1, null)
    expect(res.draftId).toBe(1)
    expect(res.results.every(r => r.ok)).toBe(true)
    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs).toHaveLength(1)
    expect(docs[0]['Tình trạng']).toBe('Nháp')
    expect(JSON.parse(docs[0]['Tệp đính kèm'])).toHaveLength(2)
  })

  test('draftId=edit attaches no row', () => {
    const res = copyDriveFiles(directorToken, ['srcA'], 1, 'edit')
    expect(res.draftId).toBeUndefined()
    invalidateSheetCache(SHEETS.HO_SO)
    expect(getSheetData(SHEETS.HO_SO)).toHaveLength(0)
  })

  test('throws without categoryId', () => {
    expect(() => copyDriveFiles(directorToken, ['srcA'], null, null)).toThrow('Danh mục')
  })

  test('throws with empty file list', () => {
    expect(() => copyDriveFiles(directorToken, [], 1, null)).toThrow('Chưa chọn file')
  })

  test('rejects a user without the permission', () => {
    seedStaff(2, 'staff', 'Nhân viên', false)
    const staffToken = createSession(2, 'staff', 'staff@test.com', 'Nhân viên')
    expect(() => copyDriveFiles(staffToken, ['srcA'], 1, null)).toThrow('không có quyền')
  })
})
