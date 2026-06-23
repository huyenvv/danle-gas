// ===== Xuất mục lục hồ sơ ra Excel (.xlsx) =====
// Chỉ-đọc: lấy hồ sơ (loại bỏ Nháp) theo danh mục (gồm danh mục con, đệ quy),
// sắp theo Số hồ sơ tăng dần, sinh 1 file .xlsx có sheet "Danh mục" với 8 cột
// (STT do hệ thống tự đánh số). Quyền được gác ở main.js (api_exportCatalog
// → _requireAdminOrVanThu). Mọi cột ngoài STT lấy nguyên từ dữ liệu hồ sơ.

var EXPORT_CATALOG_HEADERS = ['STT', 'Số hồ sơ', 'Tên hồ sơ', 'Ngày ban hành', 'Ghi chú', 'Danh mục', 'Nơi lưu hồ sơ cứng', 'Link google drive']

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

// Ô "Link google drive" cho Excel:
//  - 0 file  → rỗng
//  - 1 file  → công thức HYPERLINK (bấm được trong Excel)
//  - ≥2 file → các URL văn bản, mỗi link 1 dòng (Excel chỉ cho 1 hyperlink/ô)
// Dùng _parseFileInfos để hỗ trợ cả JSON array lẫn fileId chuỗi cũ.
function _exportFileLinkCell(doc) {
  var infos = _parseFileInfos(doc && doc['Tệp đính kèm'])
  if (!infos.length) return ''
  var urls = infos.map(function(f) {
    return 'https://drive.google.com/file/d/' + f.fileId + '/view'
  })
  if (urls.length === 1) return '=HYPERLINK("' + urls[0] + '","' + urls[0] + '")'
  return urls.join('\n')
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
      _formatDateDMY(doc['Ngày ban hành']),
      doc['Ghi chú'] || '',
      catPaths[String(doc['Danh mục'] || '')] || '',
      doc['Nơi lưu hồ sơ cứng'] || '',
      _exportFileLinkCell(doc),
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

    // Độ rộng cột (px) theo thứ tự header: STT, Số hồ sơ, Tên hồ sơ, Ngày ban hành,
    // Ghi chú, Danh mục, Nơi lưu hồ sơ cứng, Link google drive.
    var widths = [45, 110, 320, 120, 200, 280, 150, 320]
    for (var c = 0; c < widths.length; c++) sheet.setColumnWidth(c + 1, widths[c])
    // Cột Link google drive: bật xuống dòng để hồ sơ nhiều link hiển thị mỗi link 1 dòng.
    sheet.getRange(1, EXPORT_CATALOG_HEADERS.length, all.length, 1).setWrap(true)
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
