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
  DA_DOC: '_Đã Đọc',
  COMMENTS: '_Bình Luận',
  FILE_INDEX: '_FileIndex',
}

var APP_ID = 'docmgr'

// ===== First-run initialization =====
var _initDone = false
function ensureInitialized() {
  if (_initDone) return
  var props = PropertiesService.getScriptProperties()
  if (props.getProperty('SCHEMA_V') === '12') {
    // File đã ở schema 12 → vẫn cần backfill snapshot 1 lần (FR-013, idempotent qua cờ riêng).
    try { _backfillDocViewers() } catch (e) { Logger.log('backfillDocViewers on init error: ' + e.message) }
    _initDone = true; return
  }
  var prevSchema = props.getProperty('SCHEMA_V')   // null = file chưa từng khởi tạo
  var central = getCentralSheet()
  _ensureAllTabsExist(central)                      // tạo tab / thêm cột còn thiếu (nhẹ)
  invalidateSheetCache(SHEETS.HO_SO)
  // Lưu version NGAY sau bước nhẹ, TRƯỚC việc nặng — nếu set sau rebuildFileIndex mà
  // request hết giờ thì cờ không kịp lưu → mỗi lần doGet lại chạy lại → timeout vĩnh viễn.
  props.setProperty('SCHEMA_V', '12')
  // Backfill _FileIndex chỉ cần cho file CHƯA từng khởi tạo. File đã có schema cũ thì
  // index đã dựng từ trước → KHÔNG chạy lại (rebuild quét toàn bộ hồ sơ, rất nặng).
  if (!prevSchema) {
    try { rebuildFileIndex() } catch (e) { Logger.log('rebuildFileIndex on init error: ' + e.message) }
  }
  // FR-013: snapshot quyền danh mục vào tài liệu cũ rỗng (sau khi tab/cột sẵn sàng).
  try { _backfillDocViewers() } catch (e) { Logger.log('backfillDocViewers on init error: ' + e.message) }
  _initDone = true
}

function _ensureAllTabsExist(ss) {
  var tabDefs = [
    { name: SHEETS.APP_ROLES,     headers: ['ID', 'UserID', 'Tên đăng nhập', 'AppID', 'Quyền', 'Được tạo hồ sơ', 'Được tạo danh mục con', 'Được tạo danh mục cha', 'Được phát hành', 'Được chọn từ Drive', 'Được import', 'RefreshTokens'] },
    { name: SHEETS.DANH_MUC,      headers: ['ID', 'Tên danh mục', 'Icon', 'Mô tả', 'Danh mục cha', 'Người được xem', 'Nhóm được xem', 'Nơi lưu hồ sơ cứng'] },
    { name: SHEETS.NHOM,          headers: ['ID', 'Tên nhóm', 'Mô tả', 'Thành viên'] },
    { name: SHEETS.DU_AN,         headers: ['ID', 'Tên dự án viết tắt', 'Tên dự án đầy đủ', 'Địa chỉ', 'Điện thoại'] },
    { name: SHEETS.NHA_CUNG_CAP,  headers: ['ID', 'Tên NCC viết tắt', 'Tên NCC đầy đủ', 'Địa chỉ', 'Điện thoại'] },
    { name: SHEETS.HO_SO,         headers: ['ID', 'Tên hồ sơ', 'Danh mục', 'Ngày ban hành', 'Ngày kết thúc', 'Tệp đính kèm', 'Tên file', 'Số hồ sơ', 'Dự án (Phòng ban)', 'Nhà cung cấp (Nơi ban hành)', 'Giá trị HĐ', 'Tình trạng', 'Phụ trách', 'Người phối hợp', 'Ghi chú', 'Nơi lưu hồ sơ cứng', 'Ngày cập nhật', 'Người tạo', 'Người cập nhật', 'Lịch sử phát hành', 'Lý do từ chối', 'Khẩn', 'Nội dung giao việc', 'Nội dung phối hợp', 'Người được xem'] },
    { name: SHEETS.NHAT_KY,       headers: ['ID', 'Thời gian', 'Người dùng', 'Email', 'Hành động', 'Loại', 'Đối tượng', 'Chi tiết'] },
    { name: SHEETS.DA_DOC,        headers: ['ID', 'UserID', 'DocID', 'Thời gian'] },
    { name: SHEETS.COMMENTS,      headers: ['ID', 'DocID', 'UserID', 'Tên người dùng', 'Nội dung', 'Thời gian'] },
    { name: SHEETS.FILE_INDEX,    headers: ['FileID', 'DocID'] },
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
