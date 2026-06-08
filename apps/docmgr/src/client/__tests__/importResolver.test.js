import { groupAndResolve, resolveCategoryPath } from '../utils/importResolver'

const lookups = {
  danhMuc: [
    { ID: 1, 'Tên danh mục': 'Công văn', 'Danh mục cha': '' },
    { ID: 2, 'Tên danh mục': 'Đến', 'Danh mục cha': 1 },
    { ID: 3, 'Tên danh mục': 'Nội bộ', 'Danh mục cha': 2 },
  ],
  users: [
    { ID: 100, 'Email': 'a@test.com' },
    { ID: 200, 'Email': 'b@test.com' },
  ],
}

function row(over) {
  return Object.assign({
    tenHoSo: 'HĐ A', tenFile: 'a.pdf', link: 'http://drive/a', gId: 'gid-a', mimeType: 'application/pdf',
    size: 10, danhMuc: 'Công văn / Đến', rowIndex: 2,
    soHoSo: '', ngayBanHanh: '', ngayKetThuc: '', ghiChu: '', noiLuu: '',
    duAn: '', nhaCungCap: '', phuTrach: '', nguoiPhoiHop: '', giaTriHD: 0,
  }, over)
}

describe('resolveCategoryPath', () => {
  test('resolves nested path to leaf ID', () => {
    expect(resolveCategoryPath('Công văn / Đến / Nội bộ', lookups.danhMuc)).toEqual({ id: 3, name: 'Công văn / Đến / Nội bộ' })
  })
  test('errors on missing segment', () => {
    const r = resolveCategoryPath('Công văn / Sai', lookups.danhMuc)
    expect(r.error).toContain('không tồn tại')
  })
})

describe('groupAndResolve', () => {
  test('groups rows by Tên hồ sơ, gathers files, resolves category', () => {
    const { groups } = groupAndResolve([
      row(),
      row({ tenFile: 'b.pdf', gId: 'gid-b', rowIndex: 3 }),
    ], lookups)
    expect(groups.length).toBe(1)
    expect(groups[0].files.length).toBe(2)
    expect(groups[0].files[0].link).toBe('http://drive/a')
    expect(groups[0].docData['Danh mục']).toBe(2)
    expect(groups[0].errors).toEqual([])
  })

  test('resolves Phụ trách + Người phối hợp emails to user IDs', () => {
    const { groups } = groupAndResolve([
      row({ phuTrach: 'a@test.com', nguoiPhoiHop: 'b@test.com, missing@test.com' }),
    ], lookups)
    expect(groups[0].docData['Phụ trách']).toBe('100')
    expect(groups[0].docData['Người phối hợp']).toEqual(['200'])
    expect(groups[0].warnings.some(w => w.includes('missing@test.com'))).toBe(true)
  })

  test('flags missing G_ID and bad category as errors', () => {
    const { groups } = groupAndResolve([
      row({ gId: '', danhMuc: 'Không tồn tại' }),
    ], lookups)
    expect(groups[0].errors.length).toBeGreaterThanOrEqual(2)
  })

  test('warns on doc-level conflict between rows', () => {
    const { groups } = groupAndResolve([
      row({ soHoSo: 'S1' }),
      row({ soHoSo: 'S2', gId: 'gid-b', rowIndex: 3 }),
    ], lookups)
    expect(groups[0].warnings.some(w => w.includes('Số hồ sơ'))).toBe(true)
  })

  test('rows without Tên hồ sơ become orphan errors', () => {
    const { groups, orphanErrors } = groupAndResolve([row({ tenHoSo: '' })], lookups)
    expect(groups.length).toBe(0)
    expect(orphanErrors.length).toBe(1)
  })

  test('deduplicates repeated G_ID within a group, keeping first', () => {
    const { groups } = groupAndResolve([
      row({ gId: 'dup', rowIndex: 2 }),
      row({ gId: 'dup', tenFile: 'again.pdf', rowIndex: 3 }),
    ], lookups)
    expect(groups[0].files.length).toBe(1)
    expect(groups[0].warnings.some(w => w.includes('trùng'))).toBe(true)
  })
})
