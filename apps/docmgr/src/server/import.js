// ===== Bulk import — parse uploaded Excel + create documents =====
// Two server entry points (wrapped as api_* in main.js):
//   parseImportFile(token, base64, fileName) → reads xlsx, returns flat rows
//   bulkImportDocuments(token, payload)      → creates HO_SO rows from resolved groups
// Excel parsing uses Drive Advanced Service to convert .xlsx → Google Sheet,
// then SpreadsheetApp reads the values. Temp file is trashed after reading.

var IMPORT_ROLES = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
var IMPORT_SOURCE_TAB = 'FileMoi'

function _importCheckRole(session) {
  // Full-access roles always allowed; others need the "Được import" flag.
  if (IMPORT_ROLES.indexOf(session.role) !== -1) return
  var roles = getSheetData(SHEETS.APP_ROLES)
  var appRole = roles.find(function (r) { return String(r['UserID']) === String(session.userId) && r['AppID'] === APP_ID })
  var allowed = appRole && (appRole['Được import'] === 'TRUE' || appRole['Được import'] === true)
  if (!allowed) throw new Error('Bạn không có quyền import')
}

// Normalize a header cell: drop parenthetical annotations, trim, lowercase.
// "Tên file (tự động lấy)" → "tên file";  "G_ID (Tự động)" → "g_id"
function _importNormalizeHeader(h) {
  if (h === null || h === undefined) return ''
  return String(h).replace(/\(.*?\)/g, '').trim().toLowerCase()
}

// normalize(header) → ImportRow field key. Headers not listed here are ignored.
var _IMPORT_HEADER_MAP = {
  'tên hồ sơ': 'tenHoSo',
  'tên file': 'tenFile',
  'link': 'link',
  'số hồ sơ': 'soHoSo',
  'ngày ban hành': 'ngayBanHanh',
  'ngày kết thúc': 'ngayKetThuc',
  'ghi chú': 'ghiChu',
  'nơi lưu hồ sơ cứng': 'noiLuu',
  'dự án': 'duAn',
  'nhà cung cấp': 'nhaCungCap',
  'phụ trách': 'phuTrach',
  'người phối hợp': 'nguoiPhoiHop',
  'giá trị hđ': 'giaTriHD',
  'g_id': 'gId',
  'mimetype': 'mimeType',
  'size': 'size',
  'danh mục': 'danhMuc',
}

// Convert a 2D values matrix (incl. header row) → array of ImportRow objects.
// Pure function (no GAS calls) so it can be unit-tested directly.
function _mapImportRows(values) {
  if (!values || values.length < 2) return []

  var header = values[0]
  // column index → field key (only mapped headers)
  var colMap = []
  for (var c = 0; c < header.length; c++) {
    var key = _IMPORT_HEADER_MAP[_importNormalizeHeader(header[c])]
    colMap.push(key || null)
  }

  var rows = []
  for (var r = 1; r < values.length; r++) {
    var raw = values[r]
    // Skip fully empty rows
    var hasValue = false
    for (var k = 0; k < raw.length; k++) {
      if (raw[k] !== '' && raw[k] !== null && raw[k] !== undefined) { hasValue = true; break }
    }
    if (!hasValue) continue

    var row = { rowIndex: r + 1 } // 1-based Excel row (header is row 1)
    for (var c2 = 0; c2 < colMap.length; c2++) {
      var field = colMap[c2]
      if (!field) continue
      var val = raw[c2]
      if (field === 'size' || field === 'giaTriHD') {
        row[field] = (val === '' || val === null || val === undefined) ? 0 : Number(val) || 0
      } else {
        row[field] = (val === null || val === undefined) ? '' : String(val).trim()
      }
    }
    rows.push(row)
  }
  return rows
}

// Convert an xlsx blob → Google Sheet, read the FileMoi tab, return rows as JSON.
// Shared by parseImportFile (OS upload) and parseImportFileFromDrive (Drive pick).
function _parseImportBlob(blob, fileName) {
  var ssId = null
  try {
    // Drive Advanced Service: convert xlsx → Google Sheet
    var converted = Drive.Files.insert(
      { title: (fileName || 'import') + ' (import tạm)', mimeType: MimeType.GOOGLE_SHEETS },
      blob,
      { convert: true }
    )
    ssId = converted.id

    var ss = SpreadsheetApp.openById(ssId)
    var sheet = ss.getSheetByName(IMPORT_SOURCE_TAB) || ss.getSheets()[0]
    if (!sheet) throw new Error('File không đúng định dạng')

    var values = sheet.getDataRange().getValues()
    var rows = _mapImportRows(values)
    if (rows.length === 0) throw new Error('File không có dữ liệu')
    if (rows.length > 1000) throw new Error('File quá lớn (tối đa 1000 dòng, hiện ' + rows.length + ')')

    return { success: true, rows: rows, totalRows: rows.length, fileName: fileName || '' }
  } finally {
    // Always clean up the temp converted file
    if (ssId) {
      try { DriveApp.getFileById(ssId).setTrashed(true) } catch (e) { Logger.log('parseImportFile cleanup error: ' + e.message) }
    }
  }
}

// Read the uploaded xlsx (base64) and return its rows as JSON.
function parseImportFile(token, base64Data, fileName) {
  var session = requireAuth(token)
  _importCheckRole(session)

  if (!base64Data) throw new Error('File không đúng định dạng')

  var bytes = Utilities.base64Decode(base64Data)
  var blob = Utilities.newBlob(bytes, MimeType.MICROSOFT_EXCEL, fileName || 'import.xlsx')
  return _parseImportBlob(blob, fileName)
}

// Read an xlsx picked from the deploy owner's Drive (by fileId) and return its rows.
function parseImportFileFromDrive(token, fileId) {
  var session = requireAuth(token)
  _importCheckRole(session)

  if (!fileId) throw new Error('Chưa chọn file')
  var file = DriveApp.getFileById(fileId)
  return _parseImportBlob(file.getBlob(), file.getName())
}

// Create HO_SO rows from pre-resolved groups (client already resolved lookups).
function bulkImportDocuments(token, payload) {
  var session = requireAuth(token)
  _importCheckRole(session)

  var groups = (payload && payload.groups) || []
  if (groups.length === 0) throw new Error('Không có dữ liệu để import')

  var cats = getSheetData(SHEETS.DANH_MUC)
  var catIds = {}
  cats.forEach(function (c) { catIds[String(c['ID'])] = true })

  var created = 0
  var totalFiles = 0
  var errors = []
  var warnings = []

  groups.forEach(function (g) {
    var doc = (g && g.docData) || {}
    var files = (g && g.files) || []
    var name = doc['Tên hồ sơ'] || ''
    var rowIndices = g.rowIndices || []

    try {
      if (!name) throw new Error('Tên hồ sơ không được để trống')
      if (!doc['Danh mục'] || !catIds[String(doc['Danh mục'])]) {
        throw new Error('Danh mục không tồn tại')
      }
      var validFiles = files.filter(function (f) { return f && f.fileId })
      if (validFiles.length === 0) throw new Error('Không có file đính kèm')

      var fileNameCol = validFiles.map(function (f) { return f.fileName || '' }).join(', ')

      var record = {
        'Tên hồ sơ': name,
        'Danh mục': doc['Danh mục'],
        'Số hồ sơ': doc['Số hồ sơ'] || '',
        'Dự án (Phòng ban)': String(doc['Dự án (Phòng ban)'] || '').trim(),
        'Nhà cung cấp (Nơi ban hành)': String(doc['Nhà cung cấp (Nơi ban hành)'] || '').trim(),
        'Ngày ban hành': doc['Ngày ban hành'] || '',
        'Ngày kết thúc': doc['Ngày kết thúc'] || '',
        'Giá trị HĐ': doc['Giá trị HĐ'] || 0,
        'Tình trạng': 'Hoàn thành',
        'Tệp đính kèm': JSON.stringify(validFiles),
        'Tên file': fileNameCol,
        'Phụ trách': _buildAssignees(doc['Phụ trách'], null),
        'Người phối hợp': _buildAssignees(doc['Người phối hợp'], null),
        'Ghi chú': doc['Ghi chú'] || '',
        'Nơi lưu hồ sơ cứng': doc['Nơi lưu hồ sơ cứng'] || '',
        'Ngày cập nhật': new Date().toISOString(),
        'Người tạo': session.username,
        'Người cập nhật': session.username,
        'Khẩn': '',
      }

      addRow(SHEETS.HO_SO, record)
      created++
      totalFiles += validFiles.length

      if (g.warnings && g.warnings.length) {
        g.warnings.forEach(function (w) {
          warnings.push({ group: name, message: w, rowIndices: rowIndices })
        })
      }
    } catch (e) {
      errors.push({ group: name || '(không tên)', message: e.message, rowIndices: rowIndices })
    }
  })

  invalidateSheetCache(SHEETS.HO_SO)
  logAudit(session, 'Import', 'Hồ sơ', created + ' hồ sơ', JSON.stringify({ created: created, totalFiles: totalFiles, errors: errors.length }))

  return { success: true, created: created, totalFiles: totalFiles, errors: errors, warnings: warnings }
}
