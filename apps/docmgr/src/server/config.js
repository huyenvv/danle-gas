// ===== App-specific sheet names & initialization =====
// Base helpers (getConfig, setConfig, getSheet, _hashPassword, etc.) provided by gas-core/config-base.js

var SHEETS = {
  USERS: '_Người Dùng',
  APP_ROLES: '_Phân Quyền',
  APPS: '_Ứng Dụng',
  SYS: '_Hệ Thống',
  DANH_MUC: 'Danh Mục',
  PHONG_BAN: 'Phòng Ban',
  DU_AN: 'Dự Án',
  NHA_CUNG_CAP: 'Nhà Cung Cấp',
  HO_SO: 'Hồ Sơ',
}

var APP_ID = 'docmgr'

// ===== First-run initialization =====
function ensureInitialized() {
  var central = getCentralSheet()
  var usersSheet = central.getSheetByName(SHEETS.USERS)

  _ensureAllTabsExist(central)

  if (!usersSheet || usersSheet.getLastRow() <= 1) {
    _seedAdminUser(central)
  }
}

function _ensureAllTabsExist(ss) {
  var tabDefs = [
    { name: SHEETS.USERS,         headers: ['ID', 'Tên đăng nhập', 'Mật khẩu', 'Email', 'Trạng thái', 'MustChangePass', 'Đăng nhập cuối'] },
    { name: SHEETS.APP_ROLES,     headers: ['UserID', 'AppID', 'Quyền', 'Phân quyền chi tiết'] },
    { name: SHEETS.APPS,          headers: ['AppID', 'Tên App', 'Webapp URL', 'Mô tả', 'API Secret', 'Trạng thái'] },
    { name: SHEETS.DANH_MUC,      headers: ['ID', 'Tên danh mục', 'Icon', 'Màu sắc', 'Mô tả'] },
    { name: SHEETS.PHONG_BAN,     headers: ['ID', 'Tên phòng ban', 'Mô tả'] },
    { name: SHEETS.DU_AN,         headers: ['ID', 'Tên dự án viết tắt', 'Tên dự án đầy đủ', 'Địa chỉ'] },
    { name: SHEETS.NHA_CUNG_CAP,  headers: ['ID', 'Tên NCC viết tắt', 'Tên NCC đầy đủ', 'Địa chỉ', 'Mã số thuế', 'Điện thoại', 'Người đại diện', 'Số tài khoản', 'Tên ngân hàng', 'Lĩnh vực kinh doanh'] },
    { name: SHEETS.HO_SO,         headers: ['ID', 'Tên hồ sơ', 'Danh mục', 'Phòng ban', 'Ngày ban hành', 'Ngày kết thúc', 'File ID', 'Tên file', 'Loại file', 'Kích thước', 'Mô tả', 'Số hồ sơ', 'Dự án', 'Nhà cung cấp', 'Giá trị HĐ', 'Giá trị thực hiện', 'Chênh lệch', 'Tình trạng', 'Phụ trách', 'Ngày cập nhật'] },
  ]

  tabDefs.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name)
    if (!sheet) {
      sheet = ss.insertSheet(def.name)
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers])
      sheet.setFrozenRows(1)
      if (def.name === SHEETS.SYS) sheet.hideSheet()
    }
  })
}

function _seedAdminUser(ss) {
  var usersSheet = ss.getSheetByName(SHEETS.USERS)
  var rolesSheet = ss.getSheetByName(SHEETS.APP_ROLES)
  var appsSheet  = ss.getSheetByName(SHEETS.APPS)

  var passwordHash = _hashPassword('admin', 'admin123')

  usersSheet.appendRow([1, 'admin', passwordHash, '', 'Active', 'TRUE', ''])
  rolesSheet.appendRow([1, APP_ID, 'admin', ''])

  if (appsSheet.getLastRow() <= 1) {
    var url = ''
    try { url = ScriptApp.getService().getUrl() } catch(e) {}
    appsSheet.appendRow([APP_ID, 'Quản lý Tài liệu', url, '', '', 'Active'])
  }

  var catSheet = ss.getSheetByName(SHEETS.DANH_MUC)
  if (catSheet && catSheet.getLastRow() <= 1) {
    catSheet.appendRow([1, 'Hợp đồng', '📄', '#3b82f6', 'Hợp đồng kinh tế'])
    catSheet.appendRow([2, 'Công văn', '📋', '#10b981', 'Công văn đến/đi'])
    catSheet.appendRow([3, 'Báo cáo', '📊', '#f59e0b', 'Báo cáo định kỳ'])
  }
}
