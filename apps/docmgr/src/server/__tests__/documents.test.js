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

  test('saves Khẩn=TRUE when provided', () => {
    const result = createDocument(directorToken, {
      'Tên hồ sơ': 'Urgent Doc',
      'Danh mục': 1,
      'Khẩn': 'TRUE',
    }, null)
    expect(result.data['Khẩn']).toBe('TRUE')
  })

  test('Khẩn defaults to empty when not provided', () => {
    const result = createDocument(directorToken, {
      'Tên hồ sơ': 'Normal Doc',
      'Danh mục': 1,
    }, null)
    expect(result.data['Khẩn']).toBe('')
  })
})

describe('createDocument — numeric fields', () => {
  test('handles numeric Dự án (Phòng ban) without crashing', () => {
    const result = createDocument(directorToken, {
      'Tên hồ sơ': 'HĐ Numeric',
      'Danh mục': 1,
      'Dự án (Phòng ban)': 123,
    }, null)
    expect(result.data['Dự án (Phòng ban)']).toBe('123')
  })

  test('handles numeric Nhà cung cấp (Nơi ban hành) without crashing', () => {
    const result = createDocument(directorToken, {
      'Tên hồ sơ': 'HĐ Numeric NCC',
      'Danh mục': 1,
      'Nhà cung cấp (Nơi ban hành)': 456,
    }, null)
    expect(result.data['Nhà cung cấp (Nơi ban hành)']).toBe('456')
  })

  test('handles empty/null values for string-trimmed fields', () => {
    const result = createDocument(directorToken, {
      'Tên hồ sơ': 'HĐ Empty',
      'Danh mục': 1,
      'Dự án (Phòng ban)': null,
      'Nhà cung cấp (Nơi ban hành)': undefined,
    }, null)
    expect(result.data['Dự án (Phòng ban)']).toBe('')
    expect(result.data['Nhà cung cấp (Nơi ban hành)']).toBe('')
  })
})

describe('updateDocument — Khẩn', () => {
  test('can toggle Khẩn on existing document', () => {
    createDocument(directorToken, { 'Tên hồ sơ': 'Doc A', 'Danh mục': 1 }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    updateDocument(directorToken, 1, { 'Khẩn': 'TRUE' }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs[0]['Khẩn']).toBe('TRUE')
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

  test('VT trinhDuyetLai with updateData saves edits and transitions in one call', () => {
    transitionDocument(directorToken, 1, 'tuChoi', { lyDoTuChoi: 'Thiếu file' })
    invalidateSheetCache(SHEETS.HO_SO)
    const result = transitionDocument(vanThuToken, 1, 'trinhDuyetLai', {}, {
      formData: { 'Ghi chú': 'Đã bổ sung file' },
      fileInfos: [],
      keepFileIds: [],
    })
    expect(result.data['Tình trạng']).toBe('Chờ duyệt')
    expect(result.data['Lý do từ chối']).toBe('')
    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs[0]['Ghi chú']).toBe('Đã bổ sung file')
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

describe('transitionDocument — acceptance gate', () => {
  let staffToken

  beforeEach(() => {
    seedUser(3, 'staff1', 's@test.com', 'Nhân viên')
    staffToken = createSession(3, 'staff1', 's@test.com', 'Nhân viên')

    // Create doc, giao viec, nhan viec → Đang xử lý
    createDocument(directorToken, { 'Tên hồ sơ': 'Gate Doc', 'Danh mục': 1, 'Tình trạng': 'Chờ duyệt' }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    transitionDocument(directorToken, 1, 'giaoViec', { 'Phụ trách': 'staff1', 'Người phối hợp': [] })
    invalidateSheetCache(SHEETS.HO_SO)
    transitionDocument(staffToken, 1, 'nhanViec', {})
    invalidateSheetCache(SHEETS.HO_SO)
  })

  test('hoanThanh changes status to Chờ xác nhận HT (not Hoàn thành)', () => {
    const result = transitionDocument(staffToken, 1, 'hoanThanh', {})
    expect(result.data['Tình trạng']).toBe('Chờ xác nhận HT')
  })

  test('xacNhanHT changes status to Hoàn thành (no notification)', () => {
    transitionDocument(staffToken, 1, 'hoanThanh', {})
    invalidateSheetCache(SHEETS.HO_SO)
    const result = transitionDocument(directorToken, 1, 'xacNhanHT', {})
    expect(result.data['Tình trạng']).toBe('Hoàn thành')
  })

  test('tuChoiKetQua changes status to Từ chối kết quả and saves reason', () => {
    transitionDocument(staffToken, 1, 'hoanThanh', {})
    invalidateSheetCache(SHEETS.HO_SO)
    const result = transitionDocument(directorToken, 1, 'tuChoiKetQua', { lyDoTuChoi: 'Chưa đủ' })
    expect(result.data['Tình trạng']).toBe('Từ chối kết quả')
    expect(result.data['Lý do từ chối']).toBe('Chưa đủ')
  })

  test('tuChoiKetQua without reason throws', () => {
    transitionDocument(staffToken, 1, 'hoanThanh', {})
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => transitionDocument(directorToken, 1, 'tuChoiKetQua', {})).toThrow('lý do')
  })

  test('hoanThanhLai from Từ chối kết quả → Chờ xác nhận HT and clears reason', () => {
    transitionDocument(staffToken, 1, 'hoanThanh', {})
    invalidateSheetCache(SHEETS.HO_SO)
    transitionDocument(directorToken, 1, 'tuChoiKetQua', { lyDoTuChoi: 'Thiếu' })
    invalidateSheetCache(SHEETS.HO_SO)
    const result = transitionDocument(staffToken, 1, 'hoanThanhLai', {})
    expect(result.data['Tình trạng']).toBe('Chờ xác nhận HT')
    expect(result.data['Lý do từ chối']).toBe('')
  })

  test('hoanThanhLai with updateData saves edits + transitions', () => {
    transitionDocument(staffToken, 1, 'hoanThanh', {})
    invalidateSheetCache(SHEETS.HO_SO)
    transitionDocument(directorToken, 1, 'tuChoiKetQua', { lyDoTuChoi: 'Sai' })
    invalidateSheetCache(SHEETS.HO_SO)
    const result = transitionDocument(staffToken, 1, 'hoanThanhLai', {}, {
      formData: { 'Ghi chú': 'Đã sửa' }, fileInfos: [], keepFileIds: [],
    })
    expect(result.data['Tình trạng']).toBe('Chờ xác nhận HT')
    invalidateSheetCache(SHEETS.HO_SO)
    expect(getSheetData(SHEETS.HO_SO)[0]['Ghi chú']).toBe('Đã sửa')
  })

  test('full loop: PT hoanThanh → GĐ tuChoiKetQua → PT hoanThanhLai → GĐ xacNhanHT', () => {
    transitionDocument(staffToken, 1, 'hoanThanh', {})
    invalidateSheetCache(SHEETS.HO_SO)
    transitionDocument(directorToken, 1, 'tuChoiKetQua', { lyDoTuChoi: 'Chưa xong' })
    invalidateSheetCache(SHEETS.HO_SO)
    transitionDocument(staffToken, 1, 'hoanThanhLai', {})
    invalidateSheetCache(SHEETS.HO_SO)
    const result = transitionDocument(directorToken, 1, 'xacNhanHT', {})
    expect(result.data['Tình trạng']).toBe('Hoàn thành')
  })
})

describe('transitionDocument — luuTru', () => {
  beforeEach(() => {
    createDocument(directorToken, {
      'Tên hồ sơ': 'Archive Test Doc',
      'Danh mục': 1,
      'Tình trạng': 'Chờ duyệt',
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)
  })

  test('GĐ luuTru changes status from Chờ duyệt to Hoàn thành', () => {
    const result = transitionDocument(directorToken, 1, 'luuTru', {})
    expect(result.data['Tình trạng']).toBe('Hoàn thành')
  })

  test('VT cannot luuTru (wrong role)', () => {
    seedUser(3, 'vanthu', 'vt@test.com', 'Văn thư')
    const vanThuToken = createSession(3, 'vanthu', 'vt@test.com', 'Văn thư')
    expect(() => transitionDocument(vanThuToken, 1, 'luuTru', {})).toThrow('không có quyền')
  })

  test('luuTru fails when status is not Chờ duyệt', () => {
    createDocument(directorToken, {
      'Tên hồ sơ': 'Wrong Status Doc',
      'Danh mục': 1,
      'Tình trạng': 'Đang xử lý',
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => transitionDocument(directorToken, 2, 'luuTru', {})).toThrow('không thể')
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

describe('uploadFileEager', () => {
  beforeEach(() => {
    setConfig('ROOT_FOLDER_ID', 'root123')
  })

  test('no draftId creates Nháp row and returns draftId + fileInfo', () => {
    const result = uploadFileEager(directorToken, 'AQID', 'application/pdf', 'test.pdf', 1, null)
    expect(result.draftId).toBe(1)
    expect(result.fileInfo.fileName).toBe('test.pdf')
    expect(result.fileInfo.fileId).toBeTruthy()
    // Returns the draft row so the client can show it in the list without a reload
    expect(result.data['ID']).toBe(1)
    expect(result.data['Tình trạng']).toBe('Nháp')
    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs[0]['Tình trạng']).toBe('Nháp')
    expect(docs[0]['Người tạo']).toBe('director')
  })

  test('with draftId appends file to existing Nháp row', () => {
    const r1 = uploadFileEager(directorToken, 'AQID', 'application/pdf', 'file1.pdf', 1, null)
    invalidateSheetCache(SHEETS.HO_SO)
    const r2 = uploadFileEager(directorToken, 'AQID', 'image/png', 'file2.png', 1, r1.draftId)
    expect(r2.draftId).toBeUndefined()
    expect(r2.fileInfo.fileName).toBe('file2.png')
    // Returns the updated draft row (now with both files attached)
    expect(JSON.parse(r2.data['Tệp đính kèm'])).toHaveLength(2)
    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    const files = JSON.parse(docs[0]['Tệp đính kèm'])
    expect(files).toHaveLength(2)
  })

  test('draftId=edit uploads file only, no row changes', () => {
    const result = uploadFileEager(directorToken, 'AQID', 'application/pdf', 'edit.pdf', 1, 'edit')
    expect(result.fileInfo.fileName).toBe('edit.pdf')
    expect(result.draftId).toBeUndefined()
    invalidateSheetCache(SHEETS.HO_SO)
    expect(getSheetData(SHEETS.HO_SO)).toHaveLength(0)
  })

  test('throws without categoryId', () => {
    expect(() => uploadFileEager(directorToken, 'AQID', 'application/pdf', 'test.pdf', null, null)).toThrow('Danh mục')
  })
})

describe('chunked upload (large files)', () => {
  beforeEach(() => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    UrlFetchApp._nextResponse = { code: 200, headers: { Location: 'https://www.googleapis.com/upload/resume-uri' }, body: '{}' }
  })

  test('startResumableUpload returns uploadUri + accessToken', () => {
    const r = startResumableUpload(directorToken, 'video/mp4', 'big.mp4', 104857600, 1)
    expect(r.uploadUri).toBe('https://www.googleapis.com/upload/resume-uri')
    expect(r.accessToken).toBe('mock-oauth-token')
    // metadata sent to Drive includes the resolved folder + content length
    const sent = JSON.parse(UrlFetchApp._lastRequest.params.payload)
    expect(sent.name).toBe('big.mp4')
    expect(UrlFetchApp._lastRequest.params.headers['X-Upload-Content-Length']).toBe('104857600')
  })

  test('startResumableUpload throws without categoryId', () => {
    expect(() => startResumableUpload(directorToken, 'video/mp4', 'big.mp4', 100, null)).toThrow('Danh mục')
  })

  test('startResumableUpload throws when Drive init fails', () => {
    UrlFetchApp._nextResponse = { code: 403, headers: {}, body: 'denied' }
    expect(() => startResumableUpload(directorToken, 'video/mp4', 'big.mp4', 100, 1)).toThrow('phiên tải lên')
  })

  test('startResumableUpload throws when ROOT_FOLDER_ID not configured', () => {
    setConfig('ROOT_FOLDER_ID', '')
    expect(() => startResumableUpload(directorToken, 'video/mp4', 'big.mp4', 100, 1)).toThrow('thư mục Drive')
  })

  test('finalizeChunkedUpload resolves file id via status query, creates Nháp row + sets sharing', () => {
    // Server queries the resumable session → Drive returns the created file resource
    UrlFetchApp._nextResponse = { code: 200, headers: {}, body: '{"id":"drive-file-99"}' }
    DriveApp._files['drive-file-99'] = { id: 'drive-file-99', name: 'big.mp4' }
    const r = finalizeChunkedUpload(directorToken, 'https://upload-uri', 'big.mp4', 'video/mp4', 104857600, 1, null)
    expect(r.draftId).toBe(1)
    expect(r.fileInfo.fileId).toBe('drive-file-99')
    expect(r.fileInfo.size).toBe(104857600)
    expect(DriveApp._files['drive-file-99'].sharing.access).toBe('ANYONE_WITH_LINK')
    invalidateSheetCache(SHEETS.HO_SO)
    const files = JSON.parse(getSheetData(SHEETS.HO_SO)[0]['Tệp đính kèm'])
    expect(files[0].fileId).toBe('drive-file-99')
  })

  test('finalizeChunkedUpload appends to existing draft', () => {
    const r1 = uploadFileEager(directorToken, 'AQID', 'application/pdf', 'small.pdf', 1, null)
    invalidateSheetCache(SHEETS.HO_SO)
    UrlFetchApp._nextResponse = { code: 200, headers: {}, body: '{"id":"drive-file-big"}' }
    DriveApp._files['drive-file-big'] = { id: 'drive-file-big', name: 'big.mp4' }
    const r2 = finalizeChunkedUpload(directorToken, 'https://upload-uri', 'big.mp4', 'video/mp4', 200000000, 1, r1.draftId)
    expect(r2.draftId).toBeUndefined()
    invalidateSheetCache(SHEETS.HO_SO)
    const files = JSON.parse(getSheetData(SHEETS.HO_SO)[0]['Tệp đính kèm'])
    expect(files).toHaveLength(2)
  })

  test('finalizeChunkedUpload throws when upload not complete (308)', () => {
    UrlFetchApp._nextResponse = { code: 308, headers: { Range: 'bytes=0-5242879' }, body: '' }
    expect(() => finalizeChunkedUpload(directorToken, 'https://upload-uri', 'big.mp4', 'video/mp4', 104857600, 1, null)).toThrow('chưa hoàn tất')
  })
})

describe('finalizeDraft', () => {
  let draftId

  beforeEach(() => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    const r = uploadFileEager(directorToken, 'AQID', 'application/pdf', 'doc.pdf', 1, null)
    draftId = r.draftId
    invalidateSheetCache(SHEETS.HO_SO)
  })

  test('updates form data and changes status from Nháp', () => {
    const result = finalizeDraft(directorToken, draftId, {
      'Tên hồ sơ': 'Finalized Doc',
      'Danh mục': 1,
      'Tình trạng': 'Chờ duyệt',
    })
    expect(result.data['Tên hồ sơ']).toBe('Finalized Doc')
    expect(result.data['Tình trạng']).toBe('Chờ duyệt')
  })

  test('throws without Tên hồ sơ', () => {
    expect(() => finalizeDraft(directorToken, draftId, { 'Danh mục': 1 })).toThrow('bắt buộc')
  })

  test('throws on non-draft document', () => {
    createDocument(directorToken, { 'Tên hồ sơ': 'Normal', 'Danh mục': 1 }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => finalizeDraft(directorToken, 2, { 'Tên hồ sơ': 'X' })).toThrow('Nháp')
  })

  test('moves files when category changes', () => {
    SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push(
      [2, 'Công văn', '', '', '', '', '']
    )
    invalidateSheetCache(SHEETS.DANH_MUC)
    finalizeDraft(directorToken, draftId, {
      'Tên hồ sơ': 'Cat Change',
      'Danh mục': 2,
    })
    // moveFile was called (mock doesn't track, but no error = pass)
    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    expect(String(docs[0]['Danh mục'])).toBe('2')
  })
})

describe('cancelDraft', () => {
  beforeEach(() => {
    setConfig('ROOT_FOLDER_ID', 'root123')
  })

  test('deletes files and row', () => {
    const r = uploadFileEager(directorToken, 'AQID', 'application/pdf', 'temp.pdf', 1, null)
    invalidateSheetCache(SHEETS.HO_SO)
    const result = cancelDraft(directorToken, r.draftId)
    expect(result.success).toBe(true)
    invalidateSheetCache(SHEETS.HO_SO)
    expect(getSheetData(SHEETS.HO_SO)).toHaveLength(0)
  })

  test('throws on non-draft', () => {
    createDocument(directorToken, { 'Tên hồ sơ': 'Normal', 'Danh mục': 1 }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => cancelDraft(directorToken, 1)).toThrow('Nháp')
  })

  test('throws if not the creator', () => {
    const r = uploadFileEager(directorToken, 'AQID', 'application/pdf', 'temp.pdf', 1, null)
    invalidateSheetCache(SHEETS.HO_SO)
    seedUser(3, 'other', 'other@test.com', 'Giám đốc')
    const otherToken = createSession(3, 'other', 'other@test.com', 'Giám đốc')
    expect(() => cancelDraft(otherToken, r.draftId)).toThrow('người tạo')
  })
})

describe('deleteFiles', () => {
  beforeEach(() => {
    setConfig('ROOT_FOLDER_ID', 'root123')
  })

  test('trashes files without error', () => {
    const r = uploadFileEager(directorToken, 'AQID', 'application/pdf', 'del.pdf', 1, 'edit')
    const result = deleteFiles(directorToken, [r.fileInfo.fileId])
    expect(result.success).toBe(true)
  })

  test('handles empty array', () => {
    const result = deleteFiles(directorToken, [])
    expect(result.success).toBe(true)
  })
})

describe('updateDocument — eagerFileInfos', () => {
  beforeEach(() => {
    setConfig('ROOT_FOLDER_ID', 'root123')
  })

  test('merges eager files with kept files, no re-upload', () => {
    createDocument(directorToken, {
      'Tên hồ sơ': 'Eager Edit',
      'Danh mục': 1,
    }, [{ base64Data: 'AQID', mimeType: 'application/pdf', fileName: 'old.pdf', size: 100 }])
    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    const oldFiles = JSON.parse(docs[0]['Tệp đính kèm'])
    const keepIds = oldFiles.map(function(f) { return f.fileId })

    const eagerInfos = [{ fileId: 'eager-123', fileName: 'eager.pdf', mimeType: 'application/pdf', size: 200 }]
    updateDocument(directorToken, 1, { 'Ghi chú': 'Updated' }, [], keepIds, null, eagerInfos)
    invalidateSheetCache(SHEETS.HO_SO)

    const updated = getSheetData(SHEETS.HO_SO)
    const allFiles = JSON.parse(updated[0]['Tệp đính kèm'])
    expect(allFiles).toHaveLength(2)
    expect(allFiles[1].fileId).toBe('eager-123')
    expect(updated[0]['Ghi chú']).toBe('Updated')
  })
})

describe('getDocuments — Nháp visibility', () => {
  beforeEach(() => {
    setConfig('ROOT_FOLDER_ID', 'root123')
  })

  test('creator sees own Nháp doc', () => {
    uploadFileEager(directorToken, 'AQID', 'application/pdf', 'draft.pdf', 1, null)
    invalidateSheetCache(SHEETS.HO_SO)
    const result = getDocuments(directorToken, {})
    expect(result.data.some(d => d['Tình trạng'] === 'Nháp')).toBe(true)
  })

  test('other user does not see Nháp doc', () => {
    uploadFileEager(directorToken, 'AQID', 'application/pdf', 'draft.pdf', 1, null)
    invalidateSheetCache(SHEETS.HO_SO)
    seedUser(2, 'staff', 'staff@test.com', 'Nhân viên')
    const staffToken = createSession(2, 'staff', 'staff@test.com', 'Nhân viên')
    const result = getDocuments(staffToken, {})
    expect(result.data.some(d => d['Tình trạng'] === 'Nháp')).toBe(false)
  })

  test('filter by tinhTrang=Nháp returns only own drafts', () => {
    uploadFileEager(directorToken, 'AQID', 'application/pdf', 'draft.pdf', 1, null)
    invalidateSheetCache(SHEETS.HO_SO)
    const result = getDocuments(directorToken, { tinhTrang: 'Nháp' })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]['Tình trạng']).toBe('Nháp')
  })
})

describe('finalizeDraft — save as Nháp', () => {
  beforeEach(() => {
    setConfig('ROOT_FOLDER_ID', 'root123')
  })

  test('allows saving without Tên hồ sơ when status is Nháp', () => {
    const r = uploadFileEager(directorToken, 'AQID', 'application/pdf', 'doc.pdf', 1, null)
    invalidateSheetCache(SHEETS.HO_SO)
    const result = finalizeDraft(directorToken, r.draftId, {
      'Tình trạng': 'Nháp',
      'Ghi chú': 'work in progress',
    })
    expect(result.data['Tình trạng']).toBe('Nháp')
    expect(result.data['Ghi chú']).toBe('work in progress')
  })

  test('requires Tên hồ sơ when finalizing to non-Nháp status', () => {
    const r = uploadFileEager(directorToken, 'AQID', 'application/pdf', 'doc.pdf', 1, null)
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => finalizeDraft(directorToken, r.draftId, {
      'Tình trạng': 'Chờ duyệt',
    })).toThrow('bắt buộc')
  })
})

describe('_normalizeStatus — Nháp preserved', () => {
  test('Nháp status is not migrated away', () => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    uploadFileEager(directorToken, 'AQID', 'application/pdf', 'draft.pdf', 1, null)
    invalidateSheetCache(SHEETS.HO_SO)
    const result = getDocuments(directorToken, {})
    const draft = result.data.find(d => d['Tình trạng'] === 'Nháp')
    expect(draft).toBeTruthy()
    expect(draft['Tình trạng']).toBe('Nháp')
  })
})

describe('transitionDocument — ycPhatHanh', () => {
  let vanThuToken

  const PARENT_ID = 'parent-sso-sheet-id'

  function setupSSOParent() {
    SpreadsheetApp._addExternalSheet(PARENT_ID, '_Hệ Thống', [
      ['Key', 'Value'],
      ['MAIL_ENABLED', true],
      ['MAIL_SENDER_NAME', 'Test System'],
    ])
    SpreadsheetApp._addExternalSheet(PARENT_ID, '_Người Dùng', [
      ['ID', 'Tên đăng nhập', 'Email', 'Tên nhân viên', 'Trạng thái', 'Mật khẩu', 'Quyền'],
      [3, 'vanthu', 'vt@test.com', 'Nguyễn Văn Thư', 'Active', '', ''],
      [1, 'director', 'd@test.com', 'Trần Giám Đốc', 'Active', '', ''],
    ])
    PropertiesService.getScriptProperties().setProperty('SSO_PARENT_SHEET_ID', PARENT_ID)
  }

  beforeEach(() => {
    seedUser(3, 'vanthu', 'vt@test.com', 'Văn thư')
    vanThuToken = createSession(3, 'vanthu', 'vt@test.com', 'Văn thư')
    createDocument(vanThuToken, {
      'Tên hồ sơ': 'YC Phat Hanh Doc',
      'Danh mục': 1,
      'Tình trạng': 'Chờ duyệt',
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)
  })

  test('GĐ ycPhatHanh changes status to YC Phát hành and saves reason', () => {
    const result = transitionDocument(directorToken, 1, 'ycPhatHanh', {
      lyDoTuChoi: 'Cần phát hành gấp'
    })
    expect(result.data['Tình trạng']).toBe('YC Phát hành')
    expect(result.data['Lý do từ chối']).toBe('Cần phát hành gấp')
  })

  test('ycPhatHanh without reason throws error', () => {
    expect(() => transitionDocument(directorToken, 1, 'ycPhatHanh', {})).toThrow('lý do')
    expect(() => transitionDocument(directorToken, 1, 'ycPhatHanh', null)).toThrow('lý do')
  })

  test('ycPhatHanh marks unread for doc creator', () => {
    transitionDocument(directorToken, 1, 'ycPhatHanh', { lyDoTuChoi: 'Phát hành ngay' })
    invalidateSheetCache(SHEETS.DA_DOC)
    const unread = getSheetData(SHEETS.DA_DOC)
    const creatorUnread = unread.find(r => String(r['DocID']) === '1')
    expect(creatorUnread).toBeTruthy()
  })

  test('VT cannot ycPhatHanh (wrong role)', () => {
    expect(() => transitionDocument(vanThuToken, 1, 'ycPhatHanh', { lyDoTuChoi: 'test' })).toThrow('không có quyền')
  })

  test('ycPhatHanh fails when status is not Chờ duyệt', () => {
    // Transition to Hoàn thành first
    transitionDocument(directorToken, 1, 'luuTru', {})
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => transitionDocument(directorToken, 1, 'ycPhatHanh', { lyDoTuChoi: 'test' })).toThrow('không thể')
  })

  test('ycPhatHanh overwrites previous rejection reason', () => {
    // First reject, then transition back, then ycPhatHanh
    transitionDocument(directorToken, 1, 'tuChoi', { lyDoTuChoi: 'Lý do từ chối cũ' })
    invalidateSheetCache(SHEETS.HO_SO)
    transitionDocument(vanThuToken, 1, 'trinhDuyetLai', {})
    invalidateSheetCache(SHEETS.HO_SO)
    const result = transitionDocument(directorToken, 1, 'ycPhatHanh', { lyDoTuChoi: 'Phát hành đi' })
    expect(result.data['Lý do từ chối']).toBe('Phát hành đi')
  })

  test('publishDocument from YC Phát hành transitions status to Hoàn thành and clears reason', () => {
    setupSSOParent()
    transitionDocument(directorToken, 1, 'ycPhatHanh', { lyDoTuChoi: 'Phát hành gấp' })
    invalidateSheetCache(SHEETS.HO_SO)

    // VT publishes — need recipients
    publishDocument(vanThuToken, 1, [3], [])
    invalidateSheetCache(SHEETS.HO_SO)

    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs[0]['Tình trạng']).toBe('Hoàn thành')
    expect(docs[0]['Lý do từ chối']).toBe('')
  })

  test('publishDocument from Hoàn thành does NOT change status', () => {
    setupSSOParent()
    transitionDocument(directorToken, 1, 'luuTru', {})
    invalidateSheetCache(SHEETS.HO_SO)

    publishDocument(vanThuToken, 1, [3], [])
    invalidateSheetCache(SHEETS.HO_SO)

    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs[0]['Tình trạng']).toBe('Hoàn thành')
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
