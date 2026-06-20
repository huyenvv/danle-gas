// ===== Xuất mục lục hồ sơ ra Excel (.xlsx) =====
// Chỉ-đọc: lấy hồ sơ (loại bỏ Nháp) theo danh mục (gồm danh mục con, đệ quy),
// sắp theo Số hồ sơ tăng dần, sinh 1 file .xlsx có sheet "Danh mục" với 7 cột
// (STT do hệ thống tự đánh số). Quyền được gác ở main.js (api_exportCatalog
// → _requireAdminOrVanThu). Mọi cột ngoài STT lấy nguyên từ dữ liệu hồ sơ.

var EXPORT_CATALOG_HEADERS = ['STT', 'Số hồ sơ', 'Tên hồ sơ', 'Ngày ban hành', 'Ghi chú', 'Danh mục', 'Nơi lưu hồ sơ cứng']

// Tập ID danh mục cần xuất = danh mục được chọn ∪ mọi hậu duệ (đệ quy theo 'Danh mục cha').
function _categoryDescendantSet(selectedId) {
  var set = {}
  if (!selectedId) return set
  var cats = getSheetData(SHEETS.DANH_MUC)
  var queue = [String(selectedId)]
  set[String(selectedId)] = true
  while (queue.length) {
    var parent = queue.shift()
    for (var i = 0; i < cats.length; i++) {
      var childId = String(cats[i]['ID'])
      if (String(cats[i]['Danh mục cha']) === parent && !set[childId]) {
        set[childId] = true
        queue.push(childId)
      }
    }
  }
  return set
}

// Map ID danh mục → tên (1 lần đọc, tránh tra cứu lặp).
function _categoryNameMap() {
  var map = {}
  var cats = getSheetData(SHEETS.DANH_MUC)
  for (var i = 0; i < cats.length; i++) map[String(cats[i]['ID'])] = cats[i]['Tên danh mục']
  return map
}

// Map ID danh mục → đường dẫn 'Cha / Hiện tại' (lần ngược 'Danh mục cha').
// Chỉ truy ngược tới danh mục được chọn (stopAtId) làm gốc, không lên tận root.
function _categoryPathMap(stopAtId) {
  var stop = stopAtId == null ? '' : String(stopAtId)
  var cats = getSheetData(SHEETS.DANH_MUC)
  var nameById = {}, parentById = {}
  for (var i = 0; i < cats.length; i++) {
    var id = String(cats[i]['ID'])
    nameById[id] = cats[i]['Tên danh mục']
    parentById[id] = String(cats[i]['Danh mục cha'] || '')
  }
  var map = {}
  for (var key in nameById) {
    var parts = []
    var cur = key
    var guard = {} // chặn vòng lặp nếu dữ liệu cha-con bị tham chiếu vòng
    while (cur && nameById[cur] != null && !guard[cur]) {
      guard[cur] = true
      parts.unshift(nameById[cur])
      if (cur === stop) break // dừng ở danh mục được chọn
      cur = parentById[cur]
    }
    map[key] = parts.join(' / ')
  }
  return map
}

// Định dạng Ngày ban hành → 'yyyy-MM-dd HH:mm'. Chấp nhận Date hoặc chuỗi.
function _formatExportDate(value) {
  if (!value) return ''
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
  }
  return String(value)
}

// So sánh Số hồ sơ tăng dần; rỗng xuống cuối; ổn định theo thứ tự ban đầu.
function _compareSoHoSo(a, b) {
  var sa = String(a.soHoSo == null ? '' : a.soHoSo).trim()
  var sb = String(b.soHoSo == null ? '' : b.soHoSo).trim()
  if (!sa && !sb) return a.idx - b.idx
  if (!sa) return 1
  if (!sb) return -1
  var la = sa.toLowerCase(), lb = sb.toLowerCase()
  if (la < lb) return -1
  if (la > lb) return 1
  return a.idx - b.idx
}

// Lọc + sắp + map → mảng dòng dữ liệu (KHÔNG gồm header), mỗi dòng đã có STT.
function _buildCatalogRows(categoryId) {
  var docs = getSheetData(SHEETS.HO_SO)
  var catSet = _categoryDescendantSet(categoryId)
  var catPaths = _categoryPathMap(categoryId)

  var picked = []
  for (var i = 0; i < docs.length; i++) {
    var d = docs[i]
    if (_normalizeStatus(d['Tình trạng']) === 'Nháp') continue
    if (!catSet[String(d['Danh mục'] || '')]) continue
    picked.push({ doc: d, soHoSo: d['Số hồ sơ'], idx: picked.length })
  }

  picked.sort(_compareSoHoSo)

  var rows = []
  for (var j = 0; j < picked.length; j++) {
    var doc = picked[j].doc
    rows.push([
      j + 1,
      doc['Số hồ sơ'] || '',
      doc['Tên hồ sơ'] || '',
      _formatExportDate(doc['Ngày ban hành']),
      doc['Ghi chú'] || '',
      catPaths[String(doc['Danh mục'] || '')] || '',
      doc['Nơi lưu hồ sơ cứng'] || '',
    ])
  }
  return rows
}

// Tên file an toàn: bỏ dấu tiếng Việt + ký tự đặc biệt.
function _slugifyForFile(name) {
  var s = String(name || '').trim()
  if (!s) return 'tat-ca'
  if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  s = s.replace(/đ/g, 'd').replace(/Đ/g, 'D')
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s || 'danh-muc'
}

// Xuất mục lục hồ sơ của MỘT danh mục (bắt buộc) + danh mục con.
// Trả { base64, fileName, mimeType, count }. Ném lỗi nếu thiếu danh mục hoặc không có hồ sơ hợp lệ.
function exportCatalog(token, categoryId) {
  if (!categoryId) throw new Error('Vui lòng chọn danh mục để xuất')
  var rows = _buildCatalogRows(categoryId)
  if (rows.length === 0) throw new Error('Không có hồ sơ để xuất')

  var catName = _categoryNameMap()[String(categoryId)] || ''
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd')
  var fileName = 'danh-muc-ho-so-' + _slugifyForFile(catName) + '-' + stamp + '.xlsx'

  var tempSs = SpreadsheetApp.create('tmp-export-danh-muc-' + stamp)
  var tempId = tempSs.getId()
  try {
    var sheet = tempSs.getSheets()[0]
    sheet.setName('Danh mục')
    var all = [EXPORT_CATALOG_HEADERS].concat(rows)
    sheet.getRange(1, 1, all.length, EXPORT_CATALOG_HEADERS.length).setValues(all)
    SpreadsheetApp.flush()

    var url = 'https://docs.google.com/spreadsheets/d/' + tempId + '/export?format=xlsx'
    var resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    })
    if (resp.getResponseCode() !== 200) {
      throw new Error('Không tạo được file Excel (mã ' + resp.getResponseCode() + ')')
    }
    return {
      base64: Utilities.base64Encode(resp.getBlob().getBytes()),
      fileName: fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      count: rows.length,
    }
  } finally {
    try { DriveApp.getFileById(tempId).setTrashed(true) } catch (e) { Logger.log('Trash temp export sheet error: ' + e.message) }
  }
}
