// ===== 012/014: Truy vấn doc list phía nguồn (gviz tq) =====
// Cô lập gọi gviz ở đây (1 "seam"). App code khác chỉ gọi _queryDocPage()/_getDocById().
// Map cột lấy từ DOC_COLS_DEF (config.js) — HARDCODE, không đọc header sống.
// Guard _assertDocColsOrder() (config.js) chặn lệch cột khi nâng SCHEMA_V.

// ───── Hằng số ─────
var DOC_QUERY_FULL_ROLES = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
// Cột kiểu ngày trong doc list — caller dùng để biết ô nào cần đổi 'Date(...)' → chuỗi.
var DOC_DATE_COLS = ['Ngày ban hành', 'Ngày kết thúc', 'Ngày cập nhật']

// ════════════ API công khai (documents.js / test gọi) ════════════

// Lấy đúng 1 trang (≤100) hồ sơ đã lọc/sắp/phân trang ở nguồn. Trả { data, page, hasNext }.
// Server trả ĐÚNG trang được hỏi (rỗng nếu vượt tổng) — KHÔNG tự snap. Client lo UX phân trang:
// reset về trang 1 khi đổi filter + chặn nút Next theo hasNext.
function _queryDocPage(ctx, opts) {
  opts = opts || {}
  var page = Math.max(1, parseInt(opts.page, 10) || 1)
  var descendantIds = opts.danhMucId ? Object.keys(_categoryDescendantSet(opts.danhMucId)) : null
  if (descendantIds && descendantIds.length > 300) {
    Logger.log('[docQuery] WARNING tập danh mục lớn (' + descendantIds.length + ') — URL tq có thể vượt giới hạn')
  }
  var res = _fetchDocPage(ctx, opts, descendantIds, page)
  return { data: res.data, page: page, hasNext: res.hasNext }
}

// 014: Đọc-điểm MỘT hồ sơ theo ID — đọc trực tiếp sheet SỐNG (TextFinder định vị dòng → đọc 1 dòng).
// KHÔNG dùng gviz (gviz có độ trễ → vi phạm read-after-write) và KHÔNG cache. Trả object hoặc null.
function _getDocById(id) {
  var sheet = getSheet(SHEETS.HO_SO)
  var rowIdx = _findRowIndexById(sheet, id)
  if (rowIdx === -1) return null
  var lastCol = sheet.getLastColumn()
  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
  var row = sheet.getRange(rowIdx, 1, 1, lastCol).getValues()[0]
  return rowsToObjects([header, row])[0] || null
}

// 014: Gọi gviz có retry hữu hạn (FR-007) — thử lại khi lỗi/thả response; hết lần thử thì NÉM,
// TUYỆT ĐỐI không fallback đọc-toàn-bộ-sheet. Trả table { cols, rows }.
function _gvizQueryWithRetry(tq, attempts) {
  attempts = attempts || 2
  var lastErr
  for (var i = 0; i < attempts; i++) {
    try { return _fetchGvizTable(tq) } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('Lỗi truy vấn nguồn')
}

// 014/G1: Đếm + lấy tối đa 3 tên hồ sơ tham chiếu tới (recordName HOẶC id) ở 1 cột của Hồ Sơ,
// QUA gviz (KHÔNG đọc toàn bộ sheet). Dùng cho kiểm tra ràng buộc trước khi xoá Danh Mục/Dự Án/NCC
// (Const. VI). Trả { count, sampleDocuments }. matchBy:
//   'id'   → cột lưu ID số (Danh mục): khớp '=' chính xác (kèm biến thể chuỗi cho cột lẫn kiểu).
//   'name' → cột lưu tên (Dự Án/NCC), có thể là giá trị ĐƠN hoặc MẢNG JSON ["A","B"]:
//            khớp đơn (<col> = 'v') HOẶC khớp phần tử mảng (<col> matches '.*"v".*') — neo theo dấu
//            nháy JSON nên KHÔNG dính chuỗi con (tìm "Dự án" không khớp phần tử "Dự án A").
// gviz lỗi sau retry → NÉM (fail-closed: chặn xoá khi chưa kiểm chứng được — FR-007).
function _countDocRefs(targetColumn, matchBy, recordName, id) {
  var b = _gvizQueryBuilder(_docColLetters())
  var L = b.col(targetColumn)
  if (!L) throw new Error('Không tìm thấy cột tham chiếu: ' + targetColumn)
  var terms = []
  if (matchBy === 'id') {
    var s = String(id == null ? '' : id)
    if (s !== '') terms.push(/^\d+$/.test(s) ? '(' + L + ' = ' + s + ' or ' + L + ' = ' + b.lit(s) + ')' : L + ' = ' + b.lit(s))
  } else {
    ;[recordName, id].forEach(function (v) {
      if (v === null || v === undefined || v === '') return
      var sv = String(v)
      terms.push(L + ' = ' + b.lit(sv))                                 // khớp đơn
      terms.push(L + ' matches ' + b.lit('.*"' + _reEscape(sv) + '".*')) // khớp phần tử mảng JSON
    })
  }
  if (!terms.length) return { count: 0, sampleDocuments: [] }
  var tq = b.select(b.col('Tên hồ sơ')).where(terms.join(' or ')).build()
  var docs = _gvizRowsToDocs(_gvizQueryWithRetry(tq))
  return { count: docs.length, sampleDocuments: docs.slice(0, 3).map(function (d) { return d['Tên hồ sơ'] || '' }) }
}

// {tên cột → chữ cái} suy 1 lần từ DOC_COLS_DEF (config.js). gviz tham chiếu cột theo CHỮ CÁI.
var _docColLettersMemo = null
function _resetDocColLetters() { _docColLettersMemo = null }
function _docColLetters() {
  if (_docColLettersMemo) return _docColLettersMemo
  var m = {}
  for (var i = 0; i < DOC_COLS_DEF.length; i++) m[DOC_COLS_DEF[i][1]] = DOC_COLS_DEF[i][0]
  return (_docColLettersMemo = m)
}

// 014: Builder gviz query (chainable, ES5 — không class). Gom select/where/order/limit/group,
// tự escape literal + tra chữ-cái-cột theo tên (col). Dùng cho cả doc list lẫn thống kê.
function _gvizQueryBuilder(cols) {
  var _sel = '*', _where = [], _order = [], _limit = null, _offset = null, _group = null
  var api = {
    col: function (n) { return cols[n] },                 // tên cột → chữ cái
    lit: function (v) { return _gvizLit(v) },                // literal (tự chọn dấu bọc ' hoặc ")
    select:  function (s) { _sel = s; return api },
    where:   function (c) { if (c) _where.push(c); return api },
    orderBy: function (n, d) { _order.push(cols[n] + ' ' + (d || 'asc')); return api },
    groupBy: function (n) { _group = cols[n]; return api },
    limit:   function (n) { _limit = n; return api },
    offset:  function (n) { _offset = n; return api },
    build: function () {
      var q = 'select ' + _sel
      if (_where.length) q += ' where ' + _where.join(' and ')
      if (_group) q += ' group by ' + _group
      if (_order.length) q += ' order by ' + _order.join(', ')
      if (_limit != null) q += ' limit ' + _limit
      if (_offset != null) q += ' offset ' + _offset
      return q
    },
  }
  return api
}

// ════════════ Dựng query doc list (private) ════════════

// Dựng câu truy vấn tq cho 1 trang doc list (page 1-based).
function _buildDocListQuery(ctx, opts, descendantIds, page, cols) {
  opts = opts || {}
  var b = _gvizQueryBuilder(cols || _docColLetters())
  var offset = (Math.max(1, page) - 1) * DOC_PAGE_SIZE
  return b
    .where(_clauseDraftGuard(b, ctx))
    .where(_clauseViewToken(b, ctx))
    .where(_clauseCategory(b, descendantIds))
    .where(_clauseKeyword(b, opts.keyword))
    .orderBy('Hạng ưu tiên', 'asc').orderBy('Ngày cập nhật', 'desc').orderBy('ID', 'desc')
    .limit(DOC_PAGE_SIZE + 1).offset(offset)
    .build()
}

// Từng mệnh đề WHERE của doc list — trả clause string hoặc null (b = builder; dùng col()/lit()).
// Guard Nháp (FR-012a): áp MỌI vai trò; `is null` để KHÔNG loại hồ sơ Tình trạng rỗng.
function _clauseDraftGuard(b, ctx) {
  var L = b.col('Tình trạng')
  return '(' + L + " != 'Nháp' or " + L + ' is null or ' + b.col('Người tạo') + ' = ' + b.lit(ctx.username) + ')'
}
// Quyền xem mức tài liệu (FR-014): full quyền bỏ token; thường lọc theo session.userId.
function _clauseViewToken(b, ctx) {
  if (DOC_QUERY_FULL_ROLES.indexOf(ctx.role) !== -1) return null
  if (ctx.userId == null || String(ctx.userId) === '') return 'false'
  return b.col('Token xem') + ' contains ' + _gvizLit('|' + ctx.userId + '|')
}
// Lọc danh mục đệ quy (FR-008): gviz không có IN → chuỗi OR; id thuần số khớp cả số lẫn chuỗi.
function _clauseCategory(b, ids) {
  if (!ids || !ids.length) return null
  var C = b.col('Danh mục')
  var terms = ids.map(function (id) {
    var s = String(id)
    return /^\d+$/.test(s) ? '(' + C + ' = ' + s + ' or ' + C + ' = ' + b.lit(s) + ')' : C + ' = ' + b.lit(s)
  })
  return '(' + terms.join(' or ') + ')'
}
// Tìm kiếm toàn tập (FR-016/016b): so trên blob đã chuẩn hóa bỏ dấu.
function _clauseKeyword(b, keyword) {
  if (!keyword) return null
  var kw = _viNormalize(keyword)
  return kw ? b.col('Blob tìm kiếm') + ' contains ' + b.lit(kw) : null
}

// ════════════ gviz I/O + parse (private, caller→callee) ════════════

// 1 lần fetch: dựng tq → gọi gviz → map → cắt đúng page size (+ suy hasNext).
function _fetchDocPage(ctx, opts, descendantIds, page) {
  var tq = _buildDocListQuery(ctx, opts, descendantIds, page, _docColLetters())
  var docs = _gvizRowsToDocs(_fetchGvizTable(tq))
  return { data: docs.slice(0, DOC_PAGE_SIZE), hasNext: docs.length > DOC_PAGE_SIZE }
}

// Gọi endpoint gviz/tq của spreadsheet hiện hành với OAuth Bearer.
// `_cb` (cache-buster, UUID mỗi lần gọi) → URL luôn khác → gviz KHÔNG trả bản HTTP-cache cũ
// (giảm staleness; gviz bỏ qua tham số lạ). Không bỏ được trễ do nhân bản phía Google.
function _fetchGvizTable(tq) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName(SHEETS.HO_SO)
  var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() +
    '/gviz/tq?gid=' + sheet.getSheetId() + '&headers=1&_cb=' + Utilities.getUuid() +
    '&tq=' + encodeURIComponent(tq)
  var resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  })
  if (resp.getResponseCode() !== 200) {
    throw new Error('Lỗi tải danh sách (mã ' + resp.getResponseCode() + ')')
  }
  return _parseGvizResponse(resp.getContentText())
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

// table {cols:[{label}], rows:[{c:[{v}]}]} → mảng object hồ sơ theo nhãn cột.
// Cột ngày (DOC_DATE_COLS) được đổi Date(...) → chuỗi; còn lại giữ thô.
function _gvizRowsToDocs(table) {
  table = table || {}
  var cols = table.cols || []
  var labels = cols.map(function (c) { return c && c.label ? c.label : '' })
  // Fallback: nếu gviz không trả nhãn (headers tắt) → dùng thứ tự cố định.
  var useFallback = labels.join('') === ''
  return (table.rows || []).map(function (row) {
    var cells = (row && row.c) || []
    var obj = {}
    var n = useFallback ? HO_SO_HEADERS.length : labels.length
    for (var i = 0; i < n; i++) {
      var key = useFallback ? HO_SO_HEADERS[i] : labels[i]
      if (!key) continue
      var raw = _gvizCellValue(cells[i])
      obj[key] = DOC_DATE_COLS.indexOf(key) !== -1 ? _gvizDateToStr(raw) : raw
    }
    return obj
  })
}

// Giá trị THÔ của ô gviz (null → ''). KHÔNG tự convert — caller quyết cột nào cần (vd cột ngày).
function _gvizCellValue(cell) {
  return cell && cell.v != null ? cell.v : ''
}

// gviz mã hoá ô ngày là "Date(y,m,d[,h,mi,s])" (tháng 0-based). Đổi → 'YYYY-MM-DD' (tránh lệch
// múi giờ) hoặc 'YYYY-MM-DD HH:MM:SS'. Không phải dạng Date(...) → trả nguyên giá trị.
function _gvizDateToStr(v) {
  if (typeof v !== 'string') return v
  var m = v.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/)
  if (!m) return v
  var base = m[1] + '-' + _pad2(Number(m[2]) + 1) + '-' + _pad2(m[3])
  return m[4] === undefined ? base : base + ' ' + _pad2(m[4]) + ':' + _pad2(m[5]) + ':' + _pad2(m[6])
}

function _pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n }

// Literal chuỗi cho gviz Query Language: chuỗi bọc bằng ' HOẶC " — gviz KHÔNG escape kiểu doubling
// ('') như SQL. Chọn dấu bọc mà chuỗi KHÔNG chứa (có ' → bọc "; có " → bọc '); chứa cả hai → bỏ '
// (hiếm; an toàn cho contains/matches). Tránh PARSE_ERROR khi từ khoá/giá trị có dấu nháy (vd "full'").
function _gvizLit(v) {
  var s = String(v == null ? '' : v)
  if (s.indexOf("'") === -1) return "'" + s + "'"   // không có ' → bọc '
  if (s.indexOf('"') === -1) return '"' + s + '"'   // có ' (không ") → bọc "
  // chứa CẢ ' lẫn " — gviz không biểu diễn được → bỏ ' rồi bọc ' (giữ " cấu trúc cho `matches`;
  // mất chính xác phần ' nhưng KHÔNG vỡ cú pháp). Hiếm gặp (vd tên dự án "O'Brien" trong mảng JSON).
  return "'" + s.replace(/'/g, '') + "'"
}

// Escape ký tự đặc biệt regex (gviz `matches` dùng cú pháp preg/PCRE; khớp TOÀN BỘ chuỗi, không
// global — nên caller bọc '.*' hai đầu). Dùng cho so khớp phần tử mảng JSON.
function _reEscape(s) { return String(s == null ? '' : s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
