require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, seedUser, createSession } = require('./helpers')

let directorToken

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
  setConfig('ROOT_FOLDER_ID', 'root123')

  seedUser(1, 'director', 'd@test.com', 'Giám đốc')
  // Categories: Hợp đồng (1) → Hợp đồng XD (2, child of 1)
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([1, 'Hợp đồng', '', '', ''])
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([2, 'Hợp đồng XD', '', '', 1])
  invalidateSheetCache(SHEETS.DANH_MUC)

  directorToken = createSession(1, 'director', 'd@test.com', 'Giám đốc')

  // Drive folder tree mirroring the categories, all under ROOT_FOLDER_ID:
  //   root123 / Hợp đồng (fHD) / Hợp đồng XD (fHDXD)
  //   root123 / Linh tinh (fRand)   — no matching category
  //   otherRoot / Ngoài (fOut)      — outside the app tree
  DriveApp._files['root123']  = { id: 'root123', name: 'root', isFolder: true }
  DriveApp._files['fHD']      = { id: 'fHD', name: 'Hợp đồng', isFolder: true, parentId: 'root123' }
  DriveApp._files['fHDXD']    = { id: 'fHDXD', name: 'Hợp đồng XD', isFolder: true, parentId: 'fHD' }
  DriveApp._files['fRand']    = { id: 'fRand', name: 'Linh tinh', isFolder: true, parentId: 'root123' }
  DriveApp._files['fOut']     = { id: 'fOut', name: 'Ngoài', isFolder: true } // no parent → outside

  DriveApp._files['fileA']    = { id: 'fileA', name: 'HĐ-A.pdf', mimeType: 'application/pdf', size: 100, parentId: 'fHD' }
  DriveApp._files['fileB']    = { id: 'fileB', name: 'HĐ-XD-B.pdf', mimeType: 'application/pdf', size: 200, parentId: 'fHDXD' }
  DriveApp._files['fileRand'] = { id: 'fileRand', name: 'Tạp.pdf', mimeType: 'application/pdf', size: 300, parentId: 'fRand' }
  DriveApp._files['fileRoot'] = { id: 'fileRoot', name: 'Goc.pdf', mimeType: 'application/pdf', size: 400, parentId: 'root123' }
  DriveApp._files['fileOut']  = { id: 'fileOut', name: 'Ngoai.pdf', mimeType: 'application/pdf', size: 500, parentId: 'fOut' }
})

function seedStaff(id, username, role, driveFlag) {
  SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push(
    [SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.length, id, username, APP_ID, role, '', '', '', driveFlag ? 'TRUE' : '', '']
  )
  invalidateSheetCache(SHEETS.APP_ROLES)
}

describe('_checkPickDrivePermission', () => {
  test('full-access roles pass without the flag', () => {
    expect(() => _checkPickDrivePermission({ role: 'Giám đốc', userId: 1 })).not.toThrow()
    expect(() => _checkPickDrivePermission({ role: 'Văn thư', userId: 9 })).not.toThrow()
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

describe('_resolveCategoryForFile', () => {
  test('file in a category folder → that category', () => {
    expect(String(_resolveCategoryForFile('fileA'))).toBe('1')
  })
  test('file in a nested sub-category folder → the leaf category', () => {
    expect(String(_resolveCategoryForFile('fileB'))).toBe('2')
  })
  test('file in a folder with no matching category → null', () => {
    expect(_resolveCategoryForFile('fileRand')).toBeNull()
  })
  test('file directly in ROOT (no category) → null', () => {
    expect(_resolveCategoryForFile('fileRoot')).toBeNull()
  })
  test('file outside the app tree → null', () => {
    expect(_resolveCategoryForFile('fileOut')).toBeNull()
  })
})

describe('linkDriveFiles', () => {
  test('no category chosen → derives it, links (no copy), creates draft', () => {
    const res = linkDriveFiles(directorToken, ['fileA'], null, null)
    expect(String(res.categoryId)).toBe('1')
    expect(res.results[0].ok).toBe(true)
    expect(res.results[0].fileInfo.fileId).toBe('fileA')   // same id → NOT copied
    expect(res.results[0].fileInfo.linked).toBe(true)
    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs).toHaveLength(1)
    expect(String(docs[0]['Danh mục'])).toBe('1')
    expect(JSON.parse(docs[0]['Tệp đính kèm'])[0].linked).toBe(true)
  })

  test('sets ANYONE_WITH_LINK sharing on the original file', () => {
    linkDriveFiles(directorToken, ['fileA'], null, null)
    expect(DriveApp._files['fileA'].sharing.access).toBe('ANYONE_WITH_LINK')
  })

  test('chosen category matching the file → ok', () => {
    expect(() => linkDriveFiles(directorToken, ['fileA'], 1, null)).not.toThrow()
  })

  test('chosen category NOT matching the file → error', () => {
    expect(() => linkDriveFiles(directorToken, ['fileA'], 2, null)).toThrow('danh mục đã chọn')
  })

  test('multiple files in different categories → error', () => {
    expect(() => linkDriveFiles(directorToken, ['fileA', 'fileB'], null, null)).toThrow('nhiều danh mục')
  })

  test('file outside any app category → error to create category first', () => {
    expect(() => linkDriveFiles(directorToken, ['fileRand'], null, null)).toThrow('không nằm trong danh mục')
  })
})

// Guard 1-file-1-hồ-sơ (cùng _FileIndex) ĐÃ BỎ → link file đã thuộc hồ sơ khác KHÔNG còn chặn.
describe('linkDriveFiles — không còn chặn file trùng', () => {
  test('link file đã thuộc hồ sơ khác → KHÔNG throw', () => {
    linkDriveFiles(directorToken, ['fileA'], null, null)             // draft 1 dùng fileA
    expect(() => linkDriveFiles(directorToken, ['fileA'], null, null)).not.toThrow()  // draft 2 vẫn link được
  })
})

describe('_shouldTrashFile', () => {
  test('linked Drive file is never trashed', () => {
    expect(_shouldTrashFile({ linked: true }, 'Nháp')).toBe(false)
    expect(_shouldTrashFile({ linked: true }, 'Hoàn thành')).toBe(false)
  })
  test('machine upload trashed only in Nháp', () => {
    expect(_shouldTrashFile({ fileId: 'x' }, 'Nháp')).toBe(true)
    expect(_shouldTrashFile({ fileId: 'x' }, 'Hoàn thành')).toBe(false)
    expect(_shouldTrashFile({ fileId: 'x' }, 'Chờ duyệt')).toBe(false)
  })
})
