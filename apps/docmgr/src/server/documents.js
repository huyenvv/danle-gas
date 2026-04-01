// ===== Documents module =====

function getDocuments(token, filters) {
  var session = requireAuth(token)
  filters = filters || {}

  var docs = getSheetData(SHEETS.HO_SO)

  // Permission filter: viewer only sees own documents
  if (session.role !== 'Quản trị viên' && session.role !== 'Biên tập viên') {
    docs = docs.filter(function(d) { return d['Người tạo'] === session.userId })
  }

  // Status filter
  if (filters.trangThai) {
    docs = docs.filter(function(d) { return d['Trạng thái'] === filters.trangThai })
  }

  // Category filter
  if (filters.danhMucId) {
    docs = docs.filter(function(d) { return String(d['Danh mục']) === String(filters.danhMucId) })
  }

  // Document type filter
  if (filters.loaiHoSoId) {
    docs = docs.filter(function(d) { return String(d['Loại hồ sơ']) === String(filters.loaiHoSoId) })
  }

  // Year filter
  if (filters.nam) {
    docs = docs.filter(function(d) {
      if (!d['Ngày ký']) return false
      return new Date(d['Ngày ký']).getFullYear() === Number(filters.nam)
    })
  }

  // Search keyword
  if (filters.keyword) {
    var kw = filters.keyword.toLowerCase()
    docs = docs.filter(function(d) {
      return (
        (d['Tên hồ sơ'] || '').toLowerCase().indexOf(kw) !== -1 ||
        (d['Số hợp đồng'] || '').toLowerCase().indexOf(kw) !== -1 ||
        (d['Đơn vị/ Trường'] || '').toLowerCase().indexOf(kw) !== -1
      )
    })
  }

  // Sort newest first
  docs.sort(function(a, b) {
    var ta = a['Ngày tạo'] ? new Date(a['Ngày tạo']).getTime() : 0
    var tb = b['Ngày tạo'] ? new Date(b['Ngày tạo']).getTime() : 0
    return tb - ta
  })

  return { data: docs }
}

function createDocument(token, data, fileInfo) {
  var session = requireAuth(token)

  // Require at minimum: Tên hồ sơ and Danh mục
  if (!data['Tên hồ sơ']) throw new Error('Tên hồ sơ là bắt buộc')
  if (!data['Danh mục']) throw new Error('Danh mục là bắt buộc')

  var fileId = ''
  var fileName = ''
  var fileUrl = ''

  // Upload file if provided
  if (fileInfo && fileInfo.base64Data) {
    var catName = _resolveCategoryName(data['Danh mục'])
    var year = new Date().getFullYear().toString()
    var result = uploadFile(fileInfo.base64Data, fileInfo.mimeType, fileInfo.fileName, [catName, year])
    fileId = result.fileId
    fileName = result.fileName
    fileUrl = result.url
  }

  var record = {
    'Tên hồ sơ': data['Tên hồ sơ'],
    'Danh mục': data['Danh mục'],
    'Loại hồ sơ': data['Loại hồ sơ'] || '',
    'Số hợp đồng': data['Số hợp đồng'] || '',
    'Đơn vị/ Trường': data['Đơn vị/ Trường'] || '',
    'Ngày ký': data['Ngày ký'] || '',
    'Ngày hiệu lực': data['Ngày hiệu lực'] || '',
    'Ngày hết hạn': data['Ngày hết hạn'] || '',
    'Giá trị HĐ': data['Giá trị HĐ'] || 0,
    'Giá trị thực hiện': data['Giá trị thực hiện'] || 0,
    'Chênh lệch': _calcDiff(data['Giá trị HĐ'], data['Giá trị thực hiện']),
    'Trạng thái': data['Trạng thái'] || 'Hiệu lực',
    'Ghi chú': data['Ghi chú'] || '',
    'File ID': fileId,
    'Tên file': fileName,
    'URL file': fileUrl,
    'Người tạo': session.userId,
    'Người cập nhật': session.userId,
  }

  var added = addRow(SHEETS.HO_SO, record)
  return { data: added }
}

function updateDocument(token, id, data, fileInfo) {
  var session = requireAuth(token)

  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(id) })
  if (!doc) throw new Error('Không tìm thấy hồ sơ')

  // Permission: viewer can only edit own docs
  if (session.role !== 'Quản trị viên' && session.role !== 'Biên tập viên') {
    if (String(doc['Người tạo']) !== String(session.userId)) {
      throw new Error('Bạn không có quyền chỉnh sửa hồ sơ này')
    }
  }

  var updates = {}

  var textFields = [
    'Tên hồ sơ', 'Danh mục', 'Loại hồ sơ', 'Số hợp đồng',
    'Đơn vị/ Trường', 'Ngày ký', 'Ngày hiệu lực', 'Ngày hết hạn',
    'Trạng thái', 'Ghi chú'
  ]
  textFields.forEach(function(f) {
    if (data[f] !== undefined) updates[f] = data[f]
  })

  // Recalc diff when value fields change
  var giaTriHD = data['Giá trị HĐ'] !== undefined ? data['Giá trị HĐ'] : doc['Giá trị HĐ']
  var giaTriTH = data['Giá trị thực hiện'] !== undefined ? data['Giá trị thực hiện'] : doc['Giá trị thực hiện']
  if (data['Giá trị HĐ'] !== undefined) updates['Giá trị HĐ'] = data['Giá trị HĐ']
  if (data['Giá trị thực hiện'] !== undefined) updates['Giá trị thực hiện'] = data['Giá trị thực hiện']
  if (data['Giá trị HĐ'] !== undefined || data['Giá trị thực hiện'] !== undefined) {
    updates['Chênh lệch'] = _calcDiff(giaTriHD, giaTriTH)
  }

  // Replace file if new file provided
  if (fileInfo && fileInfo.base64Data) {
    // Delete old file
    if (doc['File ID']) deleteFile(doc['File ID'])
    var catName = _resolveCategoryName(updates['Danh mục'] || doc['Danh mục'])
    var year = new Date().getFullYear().toString()
    var result = uploadFile(fileInfo.base64Data, fileInfo.mimeType, fileInfo.fileName, [catName, year])
    updates['File ID'] = result.fileId
    updates['Tên file'] = result.fileName
    updates['URL file'] = result.url
  }

  updates['Người cập nhật'] = session.userId

  var updated = updateRow(SHEETS.HO_SO, id, updates)
  return { data: updated }
}

function deleteDocument(token, id) {
  var session = requireAuth(token)
  requireAdmin(token)

  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(id) })
  if (!doc) throw new Error('Không tìm thấy hồ sơ')

  // Delete associated Drive file
  if (doc['File ID']) deleteFile(doc['File ID'])

  deleteRow(SHEETS.HO_SO, id)
  return { success: true }
}

function getDocumentStats(token) {
  requireAuth(token)

  var docs = getSheetData(SHEETS.HO_SO)

  var total = docs.length
  var byStatus = {}
  var totalValue = 0
  var totalExecuted = 0

  docs.forEach(function(d) {
    var s = d['Trạng thái'] || 'Không rõ'
    byStatus[s] = (byStatus[s] || 0) + 1
    totalValue += Number(d['Giá trị HĐ']) || 0
    totalExecuted += Number(d['Giá trị thực hiện']) || 0
  })

  return {
    total: total,
    byStatus: byStatus,
    totalValue: totalValue,
    totalExecuted: totalExecuted,
    totalDiff: totalValue - totalExecuted,
  }
}

// ── private helpers ──────────────────────────────────────────────────────────

function _calcDiff(hdVal, thVal) {
  return (Number(hdVal) || 0) - (Number(thVal) || 0)
}

function _resolveCategoryName(categoryId) {
  if (!categoryId) return 'Khác'
  var cats = getSheetData(SHEETS.DANH_MUC)
  var cat = cats.find(function(c) { return String(c['ID']) === String(categoryId) })
  return cat ? cat['Tên danh mục'] : 'Khác'
}
