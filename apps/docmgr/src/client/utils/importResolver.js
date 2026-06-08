// Client-side grouping + lookup resolution for bulk import.
// Takes flat rows (from api_parseImportFile) + lookups (from api_getInitialData),
// groups rows by "Tên hồ sơ", resolves all references to IDs, and flags errors/warnings.
// Output groups feed directly into api_bulkImportDocuments.

// Document-level fields taken from the first row of each group.
const DOC_FIELDS = [
  { key: 'soHoSo', label: 'Số hồ sơ' },
  { key: 'ngayBanHanh', label: 'Ngày ban hành' },
  { key: 'ngayKetThuc', label: 'Ngày kết thúc' },
  { key: 'ghiChu', label: 'Ghi chú' },
  { key: 'noiLuu', label: 'Nơi lưu hồ sơ cứng' },
  { key: 'duAn', label: 'Dự án (Phòng ban)' },
  { key: 'nhaCungCap', label: 'Nhà cung cấp' },
  { key: 'phuTrach', label: 'Phụ trách' },
  { key: 'nguoiPhoiHop', label: 'Người phối hợp' },
  { key: 'giaTriHD', label: 'Giá trị HĐ' },
  { key: 'danhMuc', label: 'Danh mục' },
]

function norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase()
}

// Resolve a hierarchical category path ("Cha / Con / Cháu") to the leaf category ID.
// Returns { id, name } on success, or { error } if any segment is missing.
export function resolveCategoryPath(path, danhMuc) {
  const parts = String(path || '').split('/').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return { error: 'Danh mục trống' }

  let parentId = '' // root has empty "Danh mục cha"
  let leaf = null
  for (let i = 0; i < parts.length; i++) {
    const match = danhMuc.find(c =>
      norm(c['Tên danh mục']) === norm(parts[i]) &&
      String(c['Danh mục cha'] || '') === String(parentId)
    )
    if (!match) {
      return { error: `Danh mục "${parts.slice(0, i + 1).join(' / ')}" không tồn tại` }
    }
    leaf = match
    parentId = String(match['ID'])
  }
  return { id: leaf['ID'], name: parts.join(' / ') }
}

// Resolve an email to a user ID using lookups.users (case-insensitive).
function resolveEmail(email, users) {
  const e = norm(email)
  if (!e) return null
  const u = users.find(x => norm(x['Email']) === e)
  return u ? String(u['ID']) : null
}

// Main entry: group flat rows → resolved import groups.
export function groupAndResolve(rows, lookups) {
  const danhMuc = lookups.danhMuc || []
  const users = lookups.users || []

  const groupMap = new Map() // tenHoSo → group accumulator
  const orphanErrors = []

  rows.forEach(row => {
    const tenHoSo = String(row.tenHoSo || '').trim()
    if (!tenHoSo) {
      orphanErrors.push({
        group: '(không tên)',
        message: `Dòng ${row.rowIndex}: thiếu Tên hồ sơ — bỏ qua`,
        rowIndices: [row.rowIndex],
      })
      return
    }
    if (!groupMap.has(tenHoSo)) groupMap.set(tenHoSo, { tenHoSo, rows: [] })
    groupMap.get(tenHoSo).rows.push(row)
  })

  const groups = []
  groupMap.forEach(acc => {
    const first = acc.rows[0]
    const warnings = []
    const errors = []
    const rowIndices = acc.rows.map(r => r.rowIndex)

    // Warn on document-level conflicts between rows in the same group.
    acc.rows.slice(1).forEach(r => {
      DOC_FIELDS.forEach(f => {
        const a = String(first[f.key] == null ? '' : first[f.key]).trim()
        const b = String(r[f.key] == null ? '' : r[f.key]).trim()
        if (a !== b) {
          warnings.push(`Dòng ${r.rowIndex}: "${f.label}" khác dòng đầu (dùng giá trị dòng ${first.rowIndex})`)
        }
      })
    })

    // Resolve category
    const cat = resolveCategoryPath(first.danhMuc, danhMuc)
    if (cat.error) errors.push(cat.error)

    // Build files from every row; flag rows with missing G_ID, skip duplicate G_ID
    const files = []
    const seenFileIds = new Set()
    acc.rows.forEach(r => {
      if (!r.gId) {
        errors.push(`Dòng ${r.rowIndex}: thiếu G_ID`)
        return
      }
      if (seenFileIds.has(r.gId)) {
        warnings.push(`Dòng ${r.rowIndex}: G_ID trùng — bỏ qua file lặp`)
        return
      }
      seenFileIds.add(r.gId)
      files.push({
        fileId: r.gId,
        fileName: r.tenFile || '',
        mimeType: r.mimeType || '',
        size: r.size || 0,
        link: r.link || '',
      })
    })

    // Resolve Phụ trách (single email → userId)
    let phuTrach = ''
    if (first.phuTrach) {
      const uid = resolveEmail(first.phuTrach, users)
      if (uid) phuTrach = uid
      else warnings.push(`Phụ trách "${first.phuTrach}" không tìm thấy trong hệ thống — để trống`)
    }

    // Resolve Người phối hợp (comma-separated emails → userIds)
    const nguoiPhoiHop = []
    if (first.nguoiPhoiHop) {
      String(first.nguoiPhoiHop).split(',').map(s => s.trim()).filter(Boolean).forEach(em => {
        const uid = resolveEmail(em, users)
        if (uid) nguoiPhoiHop.push(uid)
        else warnings.push(`Người phối hợp "${em}" không tìm thấy — bỏ qua`)
      })
    }

    groups.push({
      tenHoSo: acc.tenHoSo,
      danhMucPath: first.danhMuc || '',
      categoryName: cat.name || first.danhMuc || '',
      rowIndices,
      warnings,
      errors,
      fileCount: files.length,
      docData: {
        'Tên hồ sơ': acc.tenHoSo,
        'Danh mục': cat.id || '',
        'Số hồ sơ': first.soHoSo || '',
        'Ngày ban hành': first.ngayBanHanh || '',
        'Ngày kết thúc': first.ngayKetThuc || '',
        'Ghi chú': first.ghiChu || '',
        'Nơi lưu hồ sơ cứng': first.noiLuu || '',
        'Dự án (Phòng ban)': first.duAn || '',
        'Nhà cung cấp (Nơi ban hành)': first.nhaCungCap || '',
        'Phụ trách': phuTrach,
        'Người phối hợp': nguoiPhoiHop,
        'Giá trị HĐ': first.giaTriHD || 0,
      },
      files,
    })
  })

  return { groups, orphanErrors }
}
