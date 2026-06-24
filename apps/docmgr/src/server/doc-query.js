// ===== 012: Truy vấn doc list phía nguồn (Google Visualization API / gviz tq) =====
// Cô lập toàn bộ phần gọi gviz ở đây (1 "seam" — sau này đổi sang adapter DataStore
// chỉ cần thay thân các hàm dưới). App code khác chỉ gọi _queryDocPage().

// Thứ tự cột sheet "Hồ Sơ" — PHẢI khớp config.js (_ensureAllTabsExist). gviz tham chiếu
// cột theo CHỮ CÁI (A, B, …); ta tính letter từ chỉ số trong mảng này.
var DOC_QUERY_HEADERS = [
  'ID', 'Tên hồ sơ', 'Danh mục', 'Ngày ban hành', 'Ngày kết thúc', 'Tệp đính kèm', 'Tên file',
  'Số hồ sơ', 'Dự án (Phòng ban)', 'Nhà cung cấp (Nơi ban hành)', 'Giá trị HĐ', 'Tình trạng',
  'Phụ trách', 'Người phối hợp', 'Ghi chú', 'Nơi lưu hồ sơ cứng', 'Ngày cập nhật', 'Người tạo',
  'Người cập nhật', 'Lịch sử phát hành', 'Lý do từ chối', 'Khẩn', 'Nội dung giao việc',
  'Nội dung phối hợp', 'Người được xem', 'Hạng ưu tiên', 'Token xem', 'Blob tìm kiếm',
]

var DOC_QUERY_FULL_ROLES = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']

// Chỉ số cột 0-based → chữ cái cột (0→A, 25→Z, 26→AA, 27→AB).
function _colLetter(i) {
  var n = i + 1, s = ''
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) }
  return s
}

// {tên cột → chữ cái} theo thứ tự HARDCODED (fallback cho test khi không có sheet).
function _docColsHardcoded() {
  var m = {}
  for (var i = 0; i < DOC_QUERY_HEADERS.length; i++) m[DOC_QUERY_HEADERS[i]] = _colLetter(i)
  return m
}

// {tên cột → chữ cái} đọc từ HÀNG TIÊU ĐỀ THẬT của sheet Hồ Sơ.
// BẮT BUỘC cho production: thứ tự cột thật có thể khác config.js (cột thêm dần),
// hardcode sẽ lệch chữ cái → query đọc nhầm cột.
// Cache 2 tầng: memo-request (biến module) → ScriptProperties 'DOC_COLS_MAP' (bền).
// Chỉ đọc header khi cache rỗng. Xoá cache khi cột đổi (migration tự xoá; hoặc gọi tay).
var DOC_COLS_PROP = 'DOC_COLS_MAP'
var _sheetColsMemo = null
function _resetSheetColsMemo() { _sheetColsMemo = null }
function _readDocColsFromHeader() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.HO_SO)
  var hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
  var m = {}
  for (var i = 0; i < hdr.length; i++) if (hdr[i] != null && hdr[i] !== '') m[String(hdr[i])] = _colLetter(i)
  return m
}
function _sheetCols() {
  if (_sheetColsMemo) return _sheetColsMemo
  var props = PropertiesService.getScriptProperties()
  var cached = props.getProperty(DOC_COLS_PROP)
  if (cached) { try { _sheetColsMemo = JSON.parse(cached); return _sheetColsMemo } catch (e) {} }
  var m = _readDocColsFromHeader()
  try { props.setProperty(DOC_COLS_PROP, JSON.stringify(m)) } catch (e) {}
  _sheetColsMemo = m
  return m
}
// Xoá cache map cột — gọi khi cột sheet thay đổi (migration hoặc sửa tay).
function _invalidateDocColsCache() {
  _sheetColsMemo = null
  try { PropertiesService.getScriptProperties().deleteProperty(DOC_COLS_PROP) } catch (e) {}
}
// Hàm public để chạy tay từ editor khi tự thêm/sửa/xoá cột sheet Hồ Sơ.
function clearDocColsCache() { _invalidateDocColsCache(); return DOC_COLS_PROP + ' đã xoá — lần query kế sẽ đọc lại header' }

// Escape chuỗi cho literal trong gviz query: nháy đơn → 2 nháy đơn.
function _gvizEscape(s) { return String(s == null ? '' : s).replace(/'/g, "''") }

// Dựng câu truy vấn tq cho 1 trang.
// ctx: { role, userId, username }; opts: { danhMucId, keyword }; descendantIds: [] | null; page: 1-based.
function _buildDocTq(ctx, opts, descendantIds, page, cols) {
  opts = opts || {}
  cols = cols || _docColsHardcoded()
  var L = cols['Tình trạng'], R = cols['Người tạo'], AA = cols['Token xem']
  var C = cols['Danh mục'], AB = cols['Blob tìm kiếm']
  var Z = cols['Hạng ưu tiên'], Q = cols['Ngày cập nhật'], A = cols['ID']

  var where = []
  // Guard Nháp — áp cho MỌI vai trò (FR-012a). `L is null` để KHÔNG loại hồ sơ
  // có Tình trạng rỗng (gviz coi `null != 'Nháp'` là null → bị loại nếu thiếu nhánh này).
  where.push('(' + L + " != 'Nháp' or " + L + ' is null or ' + R + " = '" + _gvizEscape(ctx.username) + "')")
  // Quyền xem mức tài liệu (FR-014): full quyền bỏ token; thường lọc theo userId.
  // Token đã map mọi định danh về userId khi ghi → query chỉ cần session.userId.
  if (DOC_QUERY_FULL_ROLES.indexOf(ctx.role) === -1) {
    where.push(ctx.userId != null && String(ctx.userId) !== ''
      ? AA + " contains '|" + _gvizEscape(String(ctx.userId)) + "|'"
      : 'false')
  }
  // Lọc danh mục đệ quy (FR-008). gviz KHÔNG có toán tử IN → dùng chuỗi OR.
  // Cột Danh mục có thể là số hoặc chuỗi → khớp cả hai dạng cho id thuần số.
  if (descendantIds && descendantIds.length) {
    var catTerms = descendantIds.map(function (id) {
      var s = String(id)
      if (/^\d+$/.test(s)) return '(' + C + ' = ' + s + ' or ' + C + " = '" + s + "')"
      return C + " = '" + _gvizEscape(s) + "'"
    })
    where.push('(' + catTerms.join(' or ') + ')')
  }
  // Tìm kiếm toàn tập (FR-016/016b) — so trên blob đã chuẩn hóa
  if (opts.keyword) {
    var kw = _viNormalize(opts.keyword)
    if (kw) where.push(AB + " contains '" + _gvizEscape(kw) + "'")
  }

  var offset = (Math.max(1, page) - 1) * DOC_PAGE_SIZE
  return 'select * where ' + where.join(' and ') +
    ' order by ' + Z + ' asc, ' + Q + ' desc, ' + A + ' desc' +
    ' limit ' + (DOC_PAGE_SIZE + 1) + ' offset ' + offset   // +1 để suy hasNext
}

// Cắt gói JSONP `google.visualization.Query.setResponse({...})` → object table { cols, rows }.
function _parseGvizResponse(body) {
  var text = String(body || '')
  var start = text.indexOf('{')
  var end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) throw new Error('Phản hồi truy vấn không hợp lệ')
  var obj
  try { obj = JSON.parse(text.substring(start, end + 1)) }
  catch (e) { throw new Error('Không phân tích được phản hồi truy vấn') }
  if (obj.status === 'error') {
    var msg = (obj.errors && obj.errors[0] && (obj.errors[0].detailed_message || obj.errors[0].message)) || 'lỗi truy vấn'
    throw new Error('Lỗi truy vấn nguồn: ' + msg)
  }
  return obj.table || { cols: [], rows: [] }
}

function _gviz2(n) { n = String(n); return n.length < 2 ? '0' + n : n }
// gviz trả ô ngày kiểu "Date(y,m,d[,h,mi,s])" (tháng 0-based) → chuỗi client hiểu được:
// date → 'YYYY-MM-DD' (tránh lệch múi giờ), datetime → 'YYYY-MM-DD HH:MM:SS'.
function _gvizCellValue(cell) {
  if (!cell || cell.v == null) return ''
  var v = cell.v
  if (typeof v === 'string') {
    var m = v.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/)
    if (m) {
      var base = m[1] + '-' + _gviz2(Number(m[2]) + 1) + '-' + _gviz2(m[3])
      if (m[4] === undefined) return base
      return base + ' ' + _gviz2(m[4]) + ':' + _gviz2(m[5]) + ':' + _gviz2(m[6])
    }
  }
  return v
}

// table {cols:[{label}], rows:[{c:[{v}]}]} → mảng object hồ sơ theo nhãn cột.
function _gvizRowsToDocs(table) {
  table = table || {}
  var cols = table.cols || []
  var labels = cols.map(function (c) { return c && c.label ? c.label : '' })
  // Fallback: nếu gviz không trả nhãn (headers tắt) → dùng thứ tự cố định.
  var useFallback = labels.join('') === ''
  return (table.rows || []).map(function (row) {
    var cells = (row && row.c) || []
    var obj = {}
    var n = useFallback ? DOC_QUERY_HEADERS.length : labels.length
    for (var i = 0; i < n; i++) {
      var key = useFallback ? DOC_QUERY_HEADERS[i] : labels[i]
      if (!key) continue
      obj[key] = _gvizCellValue(cells[i])
    }
    return obj
  })
}

// Gọi endpoint gviz/tq của spreadsheet hiện hành với OAuth Bearer.
function _fetchGvizTable(tq) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName(SHEETS.HO_SO)
  var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() +
    '/gviz/tq?gid=' + sheet.getSheetId() + '&headers=1&tq=' + encodeURIComponent(tq)
  var resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  })
  if (resp.getResponseCode() !== 200) {
    throw new Error('Lỗi tải danh sách (mã ' + resp.getResponseCode() + ')')
  }
  return _parseGvizResponse(resp.getContentText())
}

// Lấy đúng 1 trang (≤100) hồ sơ đã lọc/sắp/phân trang ở nguồn.
// Trả { data, page, hasNext } — hợp đồng giống 011 (FR-019).
function _queryDocPage(ctx, opts) {
  opts = opts || {}
  var page = Math.max(1, parseInt(opts.page, 10) || 1)
  var descendantIds = opts.danhMucId ? Object.keys(_categoryDescendantSet(opts.danhMucId)) : null
  if (descendantIds && descendantIds.length > 300) {
    Logger.log('[docQuery] WARNING tập danh mục lớn (' + descendantIds.length + ') — URL tq có thể vượt giới hạn')
  }

  var res = _runDocQueryPage(ctx, opts, descendantIds, page)
  // FR-011: trang vượt quá tổng → trả rỗng; tự về trang 1.
  if (page > 1 && res.data.length === 0) {
    page = 1
    res = _runDocQueryPage(ctx, opts, descendantIds, page)
  }
  return { data: res.data, page: page, hasNext: res.hasNext }
}

function _runDocQueryPage(ctx, opts, descendantIds, page) {
  var tq = _buildDocTq(ctx, opts, descendantIds, page, _sheetCols())
  var docs = _gvizRowsToDocs(_fetchGvizTable(tq))
  return { data: docs.slice(0, DOC_PAGE_SIZE), hasNext: docs.length > DOC_PAGE_SIZE }
}
