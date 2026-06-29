require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, seedUser, createSession } = require('./helpers')

// Covers the file-trashing policy across document statuses & sources:
//   trash a Drive file ONLY when it's a machine upload AND the doc is in Nháp.
//   Linked Drive files are never trashed; non-Nháp deletes leave files orphaned.

let adminToken, creatorToken

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([1, 'Hợp đồng', '', '', ''])
  invalidateSheetCache(SHEETS.DANH_MUC)

  seedUser(5, 'admin', 'a@test.com', 'admin')
  seedUser(6, 'creator', 'c@test.com', 'Nhân viên')
  adminToken = createSession(5, 'admin', 'a@test.com', 'admin')
  creatorToken = createSession(6, 'creator', 'c@test.com', 'Nhân viên')
})

// A machine-uploaded attachment (no linked flag) and a linked Drive attachment.
function machine(id) { return { fileId: id, fileName: id + '.pdf', mimeType: 'application/pdf', size: 100 } }
function linked(id)  { return { fileId: id, fileName: id + '.pdf', mimeType: 'application/pdf', size: 100, linked: true } }

function regFiles(ids) {
  ids.forEach(id => { DriveApp._files[id] = { id, name: id + '.pdf', mimeType: 'application/pdf', size: 100, trashed: false } })
}

function makeDoc(status, fileInfos, creator) {
  const row = addRow(SHEETS.HO_SO, {
    'Tên hồ sơ': 'Doc ' + status,
    'Danh mục': 1,
    'Tình trạng': status,
    'Tệp đính kèm': JSON.stringify(fileInfos),
    'Tên file': fileInfos.map(f => f.fileName).join(', '),
    'Người tạo': creator || 'admin',
    'Người cập nhật': creator || 'admin',
  })
  invalidateSheetCache(SHEETS.HO_SO)
  return row['ID']
}

const trashed = id => DriveApp._files[id].trashed

// Every document status. Admin can delete in any of them.
const ALL_STATUSES = [
  'Nháp', 'Chờ duyệt', 'Chờ xử lý', 'Đang xử lý',
  'Hoàn thành', 'Từ chối', 'Từ chối kết quả', 'YC Phát hành',
]

describe('deleteDocument — trashing policy across ALL statuses', () => {
  test.each(ALL_STATUSES)('[%s]: machine file trashed only if Nháp; linked never trashed', (status) => {
    regFiles(['m', 'L'])
    const id = makeDoc(status, [machine('m'), linked('L')])
    deleteDocument(adminToken, id)
    expect(trashed('m')).toBe(status === 'Nháp')   // machine: trash only in Nháp, else orphaned
    expect(trashed('L')).toBe(false)               // linked: never trashed, any status
  })
})

describe('cancelDraft — Nháp only', () => {
  test('trashes machine file, keeps linked file', () => {
    regFiles(['m3', 'L3'])
    const id = makeDoc('Nháp', [machine('m3'), linked('L3')], 'creator')
    cancelDraft(creatorToken, id)
    expect(trashed('m3')).toBe(true)
    expect(trashed('L3')).toBe(false)
  })
})

describe('updateDocument — removing files (keepFileIds)', () => {
  test('Nháp: removed machine file trashed, removed linked file kept', () => {
    regFiles(['m4', 'L4'])
    const id = makeDoc('Nháp', [machine('m4'), linked('L4')])
    updateDocument(adminToken, id, {}, [], [], 'none')   // keep nothing → remove both
    expect(trashed('m4')).toBe(true)
    expect(trashed('L4')).toBe(false)
  })

  test('Non-Nháp: removed machine file left orphaned', () => {
    regFiles(['m5', 'L5'])
    const id = makeDoc('Hoàn thành', [machine('m5'), linked('L5')])
    updateDocument(adminToken, id, {}, [], [], 'none')   // keep nothing → remove both
    expect(trashed('m5')).toBe(false)
    expect(trashed('L5')).toBe(false)
  })

  test('Nháp: file kept in keepFileIds is not trashed', () => {
    regFiles(['m6'])
    const id = makeDoc('Nháp', [machine('m6')])
    updateDocument(adminToken, id, {}, [], ['m6'], 'none')   // keep m6
    expect(trashed('m6')).toBe(false)
  })
})

// US1 — đổi danh mục: di chuyển file theo, hoặc thất bại rõ ràng (fail-loud).
describe('updateDocument / finalizeDraft — đổi danh mục move fail-loud', () => {
  beforeEach(() => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([2, 'Công văn', '', '', ''])
    invalidateSheetCache(SHEETS.DANH_MUC)
  })

  test('updateDocument: move ok → hồ sơ đổi danh mục', () => {
    regFiles(['L'])                                  // file đăng ký Drive → moveTo no-op (thành công)
    const id = makeDoc('Hoàn thành', [linked('L')])
    updateDocument(adminToken, id, { 'Danh mục': 2 }, [], ['L'], 'none')
    const doc = getSheetData(SHEETS.HO_SO).find(d => String(d['ID']) === String(id))
    expect(String(doc['Danh mục'])).toBe('2')
  })

  test('updateDocument: move thất bại → throw & danh mục giữ nguyên (không lưu nửa vời)', () => {
    const id = makeDoc('Hoàn thành', [linked('GHOST')])   // GHOST không đăng ký Drive → moveFile ném
    expect(() => updateDocument(adminToken, id, { 'Danh mục': 2 }, [], ['GHOST'], 'none')).toThrow()
    const doc = getSheetData(SHEETS.HO_SO).find(d => String(d['ID']) === String(id))
    expect(String(doc['Danh mục'])).toBe('1')             // không đổi
  })

  test('finalizeDraft: move thất bại → throw & vẫn là Nháp', () => {
    const id = makeDoc('Nháp', [linked('GHOST2')], 'creator')
    expect(() => finalizeDraft(creatorToken, id, { 'Tên hồ sơ': 'X', 'Danh mục': 2 }, 'none')).toThrow()
    const doc = getSheetData(SHEETS.HO_SO).find(d => String(d['ID']) === String(id))
    expect(doc['Tình trạng']).toBe('Nháp')                // chưa hoàn tất
  })
})
