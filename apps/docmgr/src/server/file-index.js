// ===== File ownership index (_FileIndex) =====
// Bất biến: mỗi FileID thuộc tối đa một DocID. Nhờ đó, đổi danh mục (di chuyển
// file) luôn an toàn — không hồ sơ nào khác bị ảnh hưởng.
//
// Đồng bộ TỰ ĐỘNG qua override addRow/updateRow/deleteRow cho sheet HO_SO
// (app-override pattern). Mọi đường gắn/gỡ file của hồ sơ (tạo, liên kết/upload
// nháp, cập nhật, import, xoá, huỷ) đều giữ index đúng mà KHÔNG cần gọi thủ công
// — một tính năng mới ghi file qua CRUD chuẩn sẽ tự được đồng bộ.
//
// Quyết định "1 file 1 hồ sơ" (policy reject/drop) nằm ở documents.js/import.js;
// file này chỉ lo bookkeeping + self-heal.

// Lấy (tạo nếu thiếu) sheet _FileIndex. Phòng thủ: override có thể chạy trước
// ensureInitialized, hoặc trong test chưa seed sheet này.
function _indexGetSheet() {
  var ss = getCentralSheet()
  var sheet = ss.getSheetByName(SHEETS.FILE_INDEX)
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.FILE_INDEX)
    sheet.getRange(1, 1).setValue('FileID')
    sheet.getRange(1, 2).setValue('DocID')
  }
  return sheet
}

// Đọc các row index (cached). Trả [] nếu sheet chưa tồn tại (chưa có file nào
// được gắn) — tránh getSheet ném khi index chưa được khởi tạo.
function _indexRows() {
  if (!getCentralSheet().getSheetByName(SHEETS.FILE_INDEX)) return []
  return getSheetData(SHEETS.FILE_INDEX)
}

// fileId → docId đang sở hữu, hoặc null. Đọc qua cache (sheet nhỏ, không quét HO_SO).
function _indexFindDoc(fileId) {
  if (!fileId) return null
  var rows = _indexRows()
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['FileID']) === String(fileId)) return rows[i]['DocID']
  }
  return null
}

// Đặt lại đúng tập file mà docId sở hữu = fileInfos. Xoá row của docId không còn
// trong tập, thêm row mới. Idempotent. Không đụng row của hồ sơ khác.
function _indexSetDocFiles(docId, fileInfos) {
  var lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    var sheet = _indexGetSheet()
    var newIds = []
    ;(fileInfos || []).forEach(function(f) {
      if (f && f.fileId && newIds.indexOf(String(f.fileId)) === -1) newIds.push(String(f.fileId))
    })
    var data = sheet.getDataRange().getValues() // [ [FileID, DocID], ... ] (row 0 = header)
    var existingForDoc = {}
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][1]) === String(docId)) {
        var fid = String(data[i][0])
        if (newIds.indexOf(fid) === -1) sheet.deleteRow(i + 1) // file đã bị gỡ khỏi doc
        else existingForDoc[fid] = true                        // giữ nguyên
      }
    }
    newIds.forEach(function(fid) {
      if (!existingForDoc[fid]) sheet.appendRow([fid, docId])
    })
    invalidateSheetCache(SHEETS.FILE_INDEX)
  } finally {
    lock.releaseLock()
  }
}

// Xoá toàn bộ row của docId (khi xoá/huỷ hồ sơ) → file trở lại orphaned.
function _indexRemoveDoc(docId) {
  var lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    var sheet = _indexGetSheet()
    var data = sheet.getDataRange().getValues()
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][1]) === String(docId)) sheet.deleteRow(i + 1)
    }
    invalidateSheetCache(SHEETS.FILE_INDEX)
  } finally {
    lock.releaseLock()
  }
}

// Self-heal: dựng lại toàn bộ _FileIndex từ nguồn sự thật (cột Tệp đính kèm của
// HO_SO). Dùng để backfill spreadsheet đã có dữ liệu, hoặc sửa sai lệch.
function rebuildFileIndex() {
  var lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    var sheet = _indexGetSheet()
    var data = sheet.getDataRange().getValues()
    for (var i = data.length - 1; i >= 1; i--) sheet.deleteRow(i + 1) // clear data rows
    var docs = getSheetData(SHEETS.HO_SO)
    var seen = {}
    var fileCount = 0
    docs.forEach(function(d) {
      _parseFileInfos(d['Tệp đính kèm']).forEach(function(f) {
        if (f && f.fileId && !seen[String(f.fileId)]) {
          seen[String(f.fileId)] = true
          sheet.appendRow([String(f.fileId), d['ID']])
          fileCount++
        }
      })
    })
    invalidateSheetCache(SHEETS.FILE_INDEX)
    return { docs: docs.length, files: fileCount }
  } finally {
    lock.releaseLock()
  }
}

// Diagnostic (dùng trong test): throw nếu _FileIndex lệch so với index suy từ HO_SO.
function _assertIndexMatchesDocs() {
  var expected = {}
  getSheetData(SHEETS.HO_SO).forEach(function(d) {
    _parseFileInfos(d['Tệp đính kèm']).forEach(function(f) {
      if (f && f.fileId && expected[String(f.fileId)] === undefined) expected[String(f.fileId)] = String(d['ID'])
    })
  })
  var actual = {}
  _indexRows().forEach(function(r) {
    actual[String(r['FileID'])] = String(r['DocID'])
  })
  var ek = Object.keys(expected)
  var ak = Object.keys(actual)
  if (ek.length !== ak.length) {
    throw new Error('FileIndex lệch: docs có ' + ek.length + ' file, index có ' + ak.length)
  }
  for (var i = 0; i < ek.length; i++) {
    if (actual[ek[i]] !== expected[ek[i]]) {
      throw new Error('FileIndex lệch tại file ' + ek[i] + ': doc kỳ vọng ' + expected[ek[i]] + ', index có ' + actual[ek[i]])
    }
  }
}

// ===== Đồng bộ tự động: override CRUD cho sheet HO_SO =====
// Theo Constitution II (app override). Nhánh khác HO_SO delegate nguyên trạng.

// Tên ref riêng (_fi*) — KHÔNG dùng _core* vì sheets.js đã chiếm tên đó cho
// override deleteRow + cascade ở documents/main (Constitution I: tránh đụng tên).
var _fiCoreAddRow = addRow
addRow = function (sheetName, rowObject) {
  var added = _fiCoreAddRow(sheetName, rowObject)
  if (sheetName === SHEETS.HO_SO) {
    _indexSetDocFiles(added['ID'], _parseFileInfos(rowObject['Tệp đính kèm']))
  }
  return added
}

var _fiCoreUpdateRow = updateRow
updateRow = function (sheetName, id, updatedFields) {
  var res = _fiCoreUpdateRow(sheetName, id, updatedFields)
  // Chỉ đồng bộ khi danh sách file thực sự được ghi (tránh chi phí khi đổi field khác).
  if (sheetName === SHEETS.HO_SO && updatedFields && updatedFields.hasOwnProperty('Tệp đính kèm')) {
    _indexSetDocFiles(id, _parseFileInfos(updatedFields['Tệp đính kèm']))
  }
  return res
}

var _fiCoreDeleteRow = deleteRow
deleteRow = function (sheetName, id) {
  if (sheetName === SHEETS.HO_SO) _indexRemoveDoc(id)
  return _fiCoreDeleteRow(sheetName, id)
}
