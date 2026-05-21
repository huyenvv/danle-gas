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
}

var APP_ID = 'docmgr'

// ===== First-run initialization =====
var _initDone = false
function ensureInitialized() {
  if (_initDone) return
  var props = PropertiesService.getScriptProperties()
  if (props.getProperty('SCHEMA_V') === '2') { _initDone = true; return }
  var central = getCentralSheet()
  _ensureAllTabsExist(central)
  props.setProperty('SCHEMA_V', '2')
  _initDone = true
}

function _ensureAllTabsExist(ss) {
  var tabDefs = [
    { name: SHEETS.APP_ROLES,     headers: ['ID', 'UserID', 'Tên đăng nhập', 'AppID', 'Quyền', 'Phân quyền chi tiết', 'Được tạo hồ sơ', 'Được tạo danh mục con', 'RefreshTokens'] },
    { name: SHEETS.DANH_MUC,      headers: ['ID', 'Tên danh mục', 'Icon', 'Mô tả', 'Danh mục cha', 'Người được xem', 'Nhóm được xem', 'Nơi lưu hồ sơ cứng'] },
    { name: SHEETS.NHOM,          headers: ['ID', 'Tên nhóm', 'Mô tả', 'Thành viên'] },
    { name: SHEETS.DU_AN,         headers: ['ID', 'Tên dự án viết tắt', 'Tên dự án đầy đủ', 'Địa chỉ'] },
    { name: SHEETS.NHA_CUNG_CAP,  headers: ['ID', 'Tên NCC viết tắt', 'Tên NCC đầy đủ', 'Địa chỉ', 'Mã số thuế', 'Điện thoại', 'Người đại diện', 'Số tài khoản', 'Tên ngân hàng', 'Lĩnh vực kinh doanh'] },
    { name: SHEETS.HO_SO,         headers: ['ID', 'Tên hồ sơ', 'Danh mục', 'Ngày ban hành', 'Ngày kết thúc', 'File ID', 'Tên file', 'Loại file', 'Kích thước', 'Số hồ sơ', 'Dự án (Phòng ban)', 'Nhà cung cấp (Nơi ban hành)', 'Giá trị HĐ', 'Tình trạng', 'Phụ trách', 'Người phối hợp', 'Ghi chú', 'Nơi lưu hồ sơ cứng', 'Ngày cập nhật', 'Người tạo', 'Người cập nhật'] },
    { name: SHEETS.NHAT_KY,       headers: ['ID', 'Thời gian', 'Người dùng', 'Email', 'Hành động', 'Loại', 'Đối tượng', 'Chi tiết'] },
    { name: SHEETS.DA_DOC,        headers: ['ID', 'UserID', 'DocID', 'Thời gian'] },
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
