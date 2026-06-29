// ===== App-specific sheet names & initialization =====
// Base helpers (getConfig, setConfig, getSheet, _hashPassword, etc.) provided by gas-core/config-base.js
// Users are managed by SSO Portal (parent app). This app only manages local authorization (_Phân Quyền).

var SHEETS = {
  APP_ROLES: '_Phân Quyền',
  DANH_MUC: 'Danh Mục',
  NHOM: 'Nhóm',
  DU_AN: 'Dự Án',
  NHA_CUNG_CAP: 'Nhà Cung Cấp',
  HO_SO: 'Hồ Sơ',
  NHAT_KY: '_Nhật Ký',
  CHUA_DOC: '_Chưa Đọc',   // có record = CHƯA đọc; no record = đã đọc (tên cũ '_Đã Đọc' ngược nghĩa)
  COMMENTS: '_Bình Luận',
}

var APP_ID = 'docmgr'

// ===== Cột sheet "Hồ Sơ" — NGUỒN SỰ THẬT DUY NHẤT (thứ tự + chữ cái gviz) =====
// Mỗi dòng = [chữ cái cột, tên cột] theo đúng thứ tự trái→phải của sheet. gviz tham chiếu
// cột theo CHỮ CÁI nên hardcode tại đây để mắt thường soi nhanh. ĐỔI CỘT → sửa DUY NHẤT mảng này.
// Guard _assertDocColsOrder() kiểm header thật khớp mảng này khi nâng SCHEMA_V.
var DOC_COLS_DEF = [
  ['A',  'ID'],
  ['B',  'Tên hồ sơ'],
  ['C',  'Danh mục'],
  ['D',  'Ngày ban hành'],
  ['E',  'Ngày kết thúc'],
  ['F',  'Tệp đính kèm'],
  ['G',  'Tên file'],
  ['H',  'Số hồ sơ'],
  ['I',  'Dự án (Phòng ban)'],
  ['J',  'Nhà cung cấp (Nơi ban hành)'],
  ['K',  'Giá trị HĐ'],
  ['L',  'Tình trạng'],
  ['M',  'Phụ trách'],
  ['N',  'Người phối hợp'],
  ['O',  'Ghi chú'],
  ['P',  'Nơi lưu hồ sơ cứng'],
  ['Q',  'Ngày cập nhật'],
  ['R',  'Người tạo'],
  ['S',  'Người cập nhật'],
  ['T',  'Lịch sử phát hành'],
  ['U',  'Lý do từ chối'],
  ['V',  'Khẩn'],
  ['W',  'Nội dung giao việc'],
  ['X',  'Người được xem'],
  ['Y',  'Nội dung phối hợp'],
  ['Z',  'Hạng ưu tiên'],
  ['AA', 'Token xem'],
  ['AB', 'Blob tìm kiếm'],
  ['AC', 'Người kiểm soát'],
]
// Thứ tự tên cột (suy từ DOC_COLS_DEF) — dùng cho _ensureAllTabsExist + guard.
var HO_SO_HEADERS = DOC_COLS_DEF.map(function (p) { return p[1] })

// ===== First-run initialization =====
var _initDone = false
function ensureInitialized() {
  if (_initDone) return
  var props = PropertiesService.getScriptProperties()
  if (props.getProperty('SCHEMA_V') === '16') {
    // File đã ở schema 16 → vẫn cần backfill 1 lần (idempotent qua cờ riêng).
    try { _backfillDocViewers() } catch (e) { Logger.log('backfillDocViewers on init error: ' + e.message) }
    try { backfillDocDerived() } catch (e) { Logger.log('backfillDocDerived on init error: ' + e.message) }
    try { _migrateDaDocUserIdEmails() } catch (e) { Logger.log('migrateDaDocUserIdEmails on init error: ' + e.message) }
    _initDone = true; return
  }
  var central = getCentralSheet()
  _migrateDaDocSheetName(central)                   // 014: đổi tab '_Đã Đọc' (ngược nghĩa) → '_Chưa Đọc' TRƯỚC khi tạo tab
  _ensureAllTabsExist(central)                      // tạo tab / thêm cột còn thiếu (nhẹ) — gồm 3 cột tính sẵn (012)
  invalidateSheetCache(SHEETS.HO_SO)
  // 014: cột Hồ Sơ được hardcode (DOC_COLS_DEF) → kiểm header thật khớp từng vị trí, lệch thì throw.
  _assertDocColsOrder()
  // Lưu version NGAY sau bước nhẹ, TRƯỚC việc nặng (backfill) — nếu set sau mà request hết giờ
  // thì cờ không kịp lưu → mỗi lần doGet lại chạy lại → timeout vĩnh viễn.
  props.setProperty('SCHEMA_V', '16')
  // FR-013: snapshot quyền danh mục vào tài liệu cũ rỗng (sau khi tab/cột sẵn sàng).
  try { _backfillDocViewers() } catch (e) { Logger.log('backfillDocViewers on init error: ' + e.message) }
  // 012 (FR-007): nạp 3 cột tính sẵn (Hạng ưu tiên / Token xem / Blob tìm kiếm) cho hồ sơ cũ.
  try { backfillDocDerived() } catch (e) { Logger.log('backfillDocDerived on init error: ' + e.message) }
  // 014: chuẩn hoá UserID cũ (email/username) → userId trong _Chưa Đọc.
  try { _migrateDaDocUserIdEmails() } catch (e) { Logger.log('migrateDaDocUserIdEmails on init error: ' + e.message) }
  _initDone = true
}

// 014: tab '_Đã Đọc' tên NGƯỢC nghĩa (có record = CHƯA đọc) → đổi thành '_Chưa Đọc'.
// Idempotent: chỉ đổi khi tab cũ còn và tab mới chưa có. Chạy TRƯỚC _ensureAllTabsExist
// để không tạo tab '_Chưa Đọc' rỗng mới (giữ nguyên trạng thái chưa-đọc cũ).
function _migrateDaDocSheetName(ss) {
  var old = ss.getSheetByName('_Đã Đọc')
  if (old && !ss.getSheetByName(SHEETS.CHUA_DOC)) old.setName(SHEETS.CHUA_DOC)
}

// 014: chuyển UserID là EMAIL/username cũ → userId thật trong _Chưa Đọc (dữ liệu trước khi chuẩn hoá).
// KHÔNG nạp cả sheet: chỉ đọc CỘT UserID, map qua _getDocUserIdMap (cần sheet cha SSO để map email),
// ghi lại cột 1 lần. Idempotent qua cờ; chờ tới khi biết sheet cha mới chạy (nếu không sẽ thử lần sau).
function _migrateDaDocUserIdEmails() {
  var props = PropertiesService.getScriptProperties()
  if (props.getProperty('DADOC_USERID_MIGRATED') === '1') return
  if (!ssoGetParentSheetId()) return        // chưa biết sheet cha → chưa map được email; thử lại lần sau
  var sheet = getSheet(SHEETS.CHUA_DOC)
  var lastRow = sheet.getLastRow()
  if (lastRow > 1) {
    var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    var col = header.indexOf('UserID')
    if (col !== -1) {
      var range = sheet.getRange(2, col + 1, lastRow - 1, 1)   // CHỈ cột UserID (không nạp cả sheet)
      var vals = range.getValues()
      var map = _getDocUserIdMap()
      var changed = 0
      for (var i = 0; i < vals.length; i++) {
        var v = String(vals[i][0] == null ? '' : vals[i][0])
        if (!v) continue
        var uid = map[v]
        if (uid != null && String(uid) !== v) { vals[i][0] = String(uid); changed++ }
      }
      if (changed) { range.setValues(vals); invalidateSheetCache(SHEETS.CHUA_DOC) }
    }
  }
  props.setProperty('DADOC_USERID_MIGRATED', '1')
}

// 014: header sheet Hồ Sơ phải khớp DOC_COLS_DEF từng vị trí — nếu lệch, gviz đọc nhầm cột.
// Chạy 1 lần khi nâng SCHEMA_V (sau _ensureAllTabsExist). Lệch → throw để admin sửa thứ tự cột.
// Cột dư ở cuối (sheet > DOC_COLS_DEF) được bỏ qua (gviz chỉ đọc A..AC).
function _assertDocColsOrder() {
  var sheet = getSheet(SHEETS.HO_SO)
  if (!sheet || sheet.getLastColumn() === 0) return
  var hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
  for (var i = 0; i < HO_SO_HEADERS.length; i++) {
    var got = hdr[i] == null ? '' : String(hdr[i])
    if (got !== HO_SO_HEADERS[i]) {
      throw new Error('Sheet "' + SHEETS.HO_SO + '" đang sai thứ tự cột.\n\n' +
        'Cột ' + DOC_COLS_DEF[i][0] + ' phải là "' + HO_SO_HEADERS[i] +
        '" (nhưng hiện tại đang là "' + (got || '(trống)') +
        '"). Vui lòng xem lại thứ tự cột cho đúng rồi mở lại ứng dụng.')
    }
  }
}

function _ensureAllTabsExist(ss) {
  var tabDefs = [
    { name: SHEETS.APP_ROLES,     headers: ['ID', 'UserID', 'Tên đăng nhập', 'AppID', 'Quyền', 'Được tạo hồ sơ', 'Được tạo danh mục con', 'Được tạo danh mục cha', 'Được phát hành', 'Được chọn từ Drive', 'Được import', 'RefreshTokens'] },
    { name: SHEETS.DANH_MUC,      headers: ['ID', 'Tên danh mục', 'Icon', 'Mô tả', 'Danh mục cha', 'Người được xem', 'Nhóm được xem', 'Nơi lưu hồ sơ cứng'] },
    { name: SHEETS.NHOM,          headers: ['ID', 'Tên nhóm', 'Mô tả', 'Thành viên'] },
    { name: SHEETS.DU_AN,         headers: ['ID', 'Tên dự án viết tắt', 'Tên dự án đầy đủ', 'Địa chỉ', 'Điện thoại'] },
    { name: SHEETS.NHA_CUNG_CAP,  headers: ['ID', 'Tên NCC viết tắt', 'Tên NCC đầy đủ', 'Địa chỉ', 'Điện thoại'] },
    { name: SHEETS.HO_SO,         headers: HO_SO_HEADERS },
    { name: SHEETS.NHAT_KY,       headers: ['ID', 'Thời gian', 'Người dùng', 'Email', 'Hành động', 'Loại', 'Đối tượng', 'Chi tiết'] },
    { name: SHEETS.CHUA_DOC,      headers: ['ID', 'UserID', 'DocID', 'Thời gian'] },
    { name: SHEETS.COMMENTS,      headers: ['ID', 'DocID', 'UserID', 'Tên người dùng', 'Nội dung', 'Thời gian'] },
  ]

  tabDefs.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name)
    if (!sheet) {
      sheet = ss.insertSheet(def.name)
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers])
      sheet.setFrozenRows(1)
    }
  })
  // Add any missing columns to existing sheets (schema upgrades)
  ensureMissingColumns(ss, tabDefs)

  // Seed default categories if empty
  var catSheet = ss.getSheetByName(SHEETS.DANH_MUC)
  if (catSheet && catSheet.getLastRow() <= 1) {
    catSheet.appendRow([1, 'Hợp đồng', 'contract', 'Hợp đồng kinh tế', ''])
    catSheet.appendRow([2, 'Công văn', 'description', 'Công văn đến/đi', ''])
    catSheet.appendRow([3, 'Báo cáo', 'bar_chart', 'Báo cáo định kỳ', ''])
  }
}
