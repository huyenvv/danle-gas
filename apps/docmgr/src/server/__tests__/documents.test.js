require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, CAT_HEADERS, seedUser, createSession } = require('./helpers')

let directorToken

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()

  seedUser(1, 'director', 'd@test.com', 'Giám đốc')
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push(
    [1, 'Hợp đồng', '', '', '', '', '']
  )
  invalidateSheetCache(SHEETS.DANH_MUC)

  directorToken = createSession(1, 'director', 'd@test.com', 'Giám đốc')
})

describe('createDocument', () => {
  test('creates document and returns record with ID', () => {
    const result = createDocument(directorToken, {
      'Tên hồ sơ': 'HĐ Mua sắm',
      'Danh mục': 1,
      'Phụ trách': 1,
    }, null)
    expect(result.data['ID']).toBe(1)
    // Phụ trách is now a JSON array string (single person)
    const assignees = JSON.parse(result.data['Phụ trách'])
    expect(assignees.map(String)).toContain('1')
  })

  test('throws without Tên hồ sơ', () => {
    expect(() => createDocument(directorToken, { 'Danh mục': 1 }, null)).toThrow('bắt buộc')
  })

  test('default Tình trạng is Chờ duyệt', () => {
    const result = createDocument(directorToken, {
      'Tên hồ sơ': 'HĐ Test',
      'Danh mục': 1,
    }, null)
    expect(result.data['Tình trạng']).toBe('Chờ duyệt')
  })
})

describe('getDocuments', () => {
  beforeEach(() => {
    createDocument(directorToken, { 'Tên hồ sơ': 'Doc A', 'Danh mục': 1, 'Tình trạng': 'Đang xử lý' }, null)
    createDocument(directorToken, { 'Tên hồ sơ': 'Doc B', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành' }, null)
    invalidateSheetCache(SHEETS.HO_SO)
  })

  test('returns all docs for director', () => {
    const result = getDocuments(directorToken, {})
    expect(result.data).toHaveLength(2)
  })

  test('filters by trangThai', () => {
    const result = getDocuments(directorToken, { tinhTrang: 'Hoàn thành' })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]['Tên hồ sơ']).toBe('Doc B')
  })

  test('filters by keyword', () => {
    const result = getDocuments(directorToken, { keyword: 'doc a' })
    expect(result.data).toHaveLength(1)
  })

  test('nhan vien sees docs from open categories and categories assigned directly or via group', () => {
    seedUser(2, 'staff', 'staff@test.com', 'Nhân viên')
    const staffToken = createSession(2, 'staff', 'staff@test.com', 'Nhân viên')

    SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push(
      [2, 'Direct', '', '', '', JSON.stringify(['2']), '', ''],
      [3, 'Grouped', '', '', '', '', JSON.stringify(['1']), ''],
      [4, 'Restricted', '', '', '', JSON.stringify(['999']), JSON.stringify(['9']), '']
    )
    SpreadsheetApp._sheets[SHEETS.NHOM]._rows.push(
      [1, 'Team A', '', JSON.stringify(['2'])]
    )
    invalidateSheetCache(SHEETS.DANH_MUC)
    invalidateSheetCache(SHEETS.NHOM)

    createDocument(directorToken, { 'Tên hồ sơ': 'Open Doc', 'Danh mục': 1 }, null)
    createDocument(directorToken, { 'Tên hồ sơ': 'Direct Doc', 'Danh mục': 2 }, null)
    createDocument(directorToken, { 'Tên hồ sơ': 'Group Doc', 'Danh mục': 3 }, null)
    createDocument(directorToken, { 'Tên hồ sơ': 'Blocked Doc', 'Danh mục': 4 }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    const result = getDocuments(staffToken, {})
    expect(result.data.map(d => d['Tên hồ sơ']).sort()).toEqual(['Direct Doc', 'Doc A', 'Doc B', 'Group Doc', 'Open Doc'])
  })

  test('truong phong follows the same category visibility rule as nhan vien', () => {
    seedUser(3, 'manager', 'manager@test.com', 'Trưởng phòng')
    const managerToken = createSession(3, 'manager', 'manager@test.com', 'Trưởng phòng')

    SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push(
      [2, 'Open 2', '', '', '', '', '', ''],
      [3, 'Direct Manager', '', '', '', JSON.stringify(['3']), '', ''],
      [4, 'Blocked Manager', '', '', '', JSON.stringify(['999']), JSON.stringify(['9']), '']
    )
    invalidateSheetCache(SHEETS.DANH_MUC)

    createDocument(directorToken, { 'Tên hồ sơ': 'Open Manager Doc', 'Danh mục': 2 }, null)
    createDocument(directorToken, { 'Tên hồ sơ': 'Direct Manager Doc', 'Danh mục': 3 }, null)
    createDocument(directorToken, { 'Tên hồ sơ': 'Blocked Manager Doc', 'Danh mục': 4 }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    const result = getDocuments(managerToken, {})
    expect(result.data.map(d => d['Tên hồ sơ']).sort()).toEqual(['Direct Manager Doc', 'Doc A', 'Doc B', 'Open Manager Doc'])
  })
})

describe('updateDocument', () => {
  test('updates text fields and Ghi chú', () => {
    createDocument(directorToken, {
      'Tên hồ sơ': 'Hợp đồng A',
      'Danh mục': 1,
      'Giá trị HĐ': 100,
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    updateDocument(directorToken, 1, { 'Ghi chú': 'Test note', 'Giá trị HĐ': 200 }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs[0]['Ghi chú']).toBe('Test note')
    expect(docs[0]['Giá trị HĐ']).toBe(200)
  })
})

describe('transitionDocument', () => {
  test('giaoViec returns updated document data for modal refresh', () => {
    createDocument(directorToken, {
      'Tên hồ sơ': 'Workflow Doc',
      'Danh mục': 1,
      'Tình trạng': 'Chờ duyệt',
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    const result = transitionDocument(directorToken, 1, 'giaoViec', {
      'Phụ trách': 'staff1',
      'Người phối hợp': ['staff2'],
    })

    expect(result.data['Tình trạng']).toBe('Chờ xử lý')
    expect(result.data['Người cập nhật']).toBe('director')
    expect(result.data['Phụ trách']).toBe(JSON.stringify(['staff1']))
    expect(result.data['Người phối hợp']).toBe(JSON.stringify(['staff2']))
  })
})

describe('transitionDocument — tuChoi', () => {
  let vanThuToken

  beforeEach(() => {
    seedUser(3, 'vanthu', 'vt@test.com', 'Văn thư')
    vanThuToken = createSession(3, 'vanthu', 'vt@test.com', 'Văn thư')
    createDocument(vanThuToken, {
      'Tên hồ sơ': 'Reject Test Doc',
      'Danh mục': 1,
      'Tình trạng': 'Chờ duyệt',
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)
  })

  test('GĐ tuChoi changes status to Từ chối and saves reason', () => {
    const result = transitionDocument(directorToken, 1, 'tuChoi', {
      lyDoTuChoi: 'Thiếu chữ ký'
    })
    expect(result.data['Tình trạng']).toBe('Từ chối')
    expect(result.data['Lý do từ chối']).toBe('Thiếu chữ ký')
  })

  test('tuChoi without reason throws error', () => {
    expect(() => transitionDocument(directorToken, 1, 'tuChoi', {})).toThrow('Vui lòng nhập lý do từ chối')
    expect(() => transitionDocument(directorToken, 1, 'tuChoi', null)).toThrow('Vui lòng nhập lý do từ chối')
  })

  test('tuChoi marks unread for doc creator', () => {
    transitionDocument(directorToken, 1, 'tuChoi', { lyDoTuChoi: 'Sai thông tin' })
    invalidateSheetCache(SHEETS.DA_DOC)
    const unread = getSheetData(SHEETS.DA_DOC)
    expect(unread.length).toBeGreaterThan(0)
    // Creator is 'vanthu' — should have unread record
    const creatorUnread = unread.find(r => String(r['DocID']) === '1')
    expect(creatorUnread).toBeTruthy()
  })

  test('VT trinhDuyetLai changes status back to Chờ duyệt and clears reason', () => {
    transitionDocument(directorToken, 1, 'tuChoi', { lyDoTuChoi: 'Thiếu file' })
    invalidateSheetCache(SHEETS.HO_SO)
    const result = transitionDocument(vanThuToken, 1, 'trinhDuyetLai', {})
    expect(result.data['Tình trạng']).toBe('Chờ duyệt')
    expect(result.data['Lý do từ chối']).toBe('')
  })

  test('VT cannot tuChoi (wrong role)', () => {
    expect(() => transitionDocument(vanThuToken, 1, 'tuChoi', { lyDoTuChoi: 'test' })).toThrow('không có quyền')
  })

  test('VT cannot publish Từ chối doc via updateDocument', () => {
    transitionDocument(directorToken, 1, 'tuChoi', { lyDoTuChoi: 'Sai' })
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => updateDocument(vanThuToken, 1, { 'Ghi chú': 'fix' }, null, null, 'publish')).toThrow('phát hành')
  })

  test('VT cannot set Hoàn thành on Từ chối doc via updateDocument', () => {
    transitionDocument(directorToken, 1, 'tuChoi', { lyDoTuChoi: 'Sai' })
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => updateDocument(vanThuToken, 1, { 'Tình trạng': 'Hoàn thành' }, null)).toThrow('lưu tài liệu')
  })
})

describe('deleteDocument', () => {
  let adminToken

  beforeEach(() => {
    seedUser(2, 'admin', 'a@test.com', 'admin')
    adminToken = createSession(2, 'admin', 'a@test.com', 'admin')
    createDocument(directorToken, { 'Tên hồ sơ': 'To Delete', 'Danh mục': 1 }, null)
    invalidateSheetCache(SHEETS.HO_SO)
  })

  test('admin can delete document', () => {
    const result = deleteDocument(adminToken, 1)
    expect(result.success).toBe(true)
    invalidateSheetCache(SHEETS.HO_SO)
    expect(getSheetData(SHEETS.HO_SO)).toHaveLength(0)
  })

  test('removes the row from sheet', () => {
    createDocument(directorToken, { 'Tên hồ sơ': 'Keep', 'Danh mục': 1 }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    deleteDocument(adminToken, 1)
    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs).toHaveLength(1)
    expect(docs[0]['Tên hồ sơ']).toBe('Keep')
  })

  test('throws when document not found', () => {
    expect(() => deleteDocument(adminToken, 999)).toThrow('Không tìm thấy')
  })

  test('non-admin cannot delete', () => {
    expect(() => deleteDocument(directorToken, 1)).toThrow()
  })
})

describe('getDocumentStats', () => {
  test('returns correct totals and breakdown', () => {
    createDocument(directorToken, {
      'Tên hồ sơ': 'A', 'Danh mục': 1, 'Tình trạng': 'Chờ duyệt',
      'Giá trị HĐ': 100,
    }, null)
    createDocument(directorToken, {
      'Tên hồ sơ': 'B', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành',
      'Giá trị HĐ': 200,
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    const stats = getDocumentStats(directorToken)
    expect(stats.total).toBe(2)
    expect(stats.byStatus['Chờ duyệt']).toBe(1)
    expect(stats.byStatus['Hoàn thành']).toBe(1)
    expect(stats.totalValue).toBe(300)
  })
})
