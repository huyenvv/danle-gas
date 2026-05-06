// ===== App-specific sheet names & initialization =====
// Base helpers (getConfig, setConfig, getSheet, _hashPassword, etc.) provided by gas-core/config-base.js
// Users are managed by SSO Portal (parent app). This app only manages local authorization (_Phân Quyền).

var SHEETS = {
  APP_ROLES:   '_Phân Quyền',
  DU_AN:       'Dự Án',
  CONG_VIEC:   'Công Việc',
  BINH_LUAN:   '_Bình Luận',
  HOAT_DONG:   '_Hoạt Động',
  NHAN:        'Nhãn',
  NHAT_KY:     '_Nhật Ký',
}

var APP_ID = 'workmgr'

// ===== Status & priority constants =====
var PROJECT_STATUSES = ['Lên Kế Hoạch', 'Đang Thực Hiện', 'Hoàn Thành', 'Tạm Dừng', 'Đã Hủy']
var TASK_STATUSES = ['Cần Làm', 'Đang Thực Hiện', 'Đang Xem Xét', 'Hoàn Thành']
var PRIORITIES = ['Cao', 'Trung Bình', 'Thấp']

// ===== First-run initialization =====
function ensureInitialized() {
  var central = getCentralSheet()
  _ensureAllTabsExist(central)
}

function _ensureAllTabsExist(ss) {
  var tabDefs = [
    { name: SHEETS.APP_ROLES,  headers: ['ID', 'UserID', 'Tên đăng nhập', 'AppID', 'Quyền', 'Phân quyền chi tiết'] },
    { name: SHEETS.DU_AN,      headers: ['ID', 'Tên dự án', 'Mô tả', 'Trạng thái', 'Mức độ ưu tiên', 'Ngân sách', 'Chi phí thực tế', 'Ngày bắt đầu', 'Ngày kết thúc', 'Ngày hoàn thành', 'Leader ID', 'Thành viên', 'Tiến độ', 'Người tạo', 'Ngày tạo', 'Ghi chú'] },
    { name: SHEETS.CONG_VIEC,  headers: ['ID', 'Tiêu đề', 'Mô tả', 'Dự án ID', 'Người thực hiện ID', 'Người giao ID', 'Trạng thái', 'Mức độ ưu tiên', 'Ngày bắt đầu', 'Ngày hết hạn', 'Ngày hoàn thành', 'Chi phí ước tính', 'Chi phí thực tế', 'Nhãn', 'Tiến độ', 'Người tạo', 'Ngày tạo', 'Ghi chú'] },
    { name: SHEETS.BINH_LUAN,  headers: ['ID', 'Mã đối tượng', 'Loại đối tượng', 'UserID', 'Tên người dùng', 'Nội dung', 'Thời gian'] },
    { name: SHEETS.HOAT_DONG,  headers: ['ID', 'Loại', 'Mô tả', 'Đối tượng', 'Mã đối tượng', 'UserID', 'Tên người dùng', 'Thời gian'] },
    { name: SHEETS.NHAN,       headers: ['ID', 'Tên nhãn', 'Màu sắc'] },
    { name: SHEETS.NHAT_KY,    headers: ['ID', 'Thời gian', 'Người dùng', 'Email', 'Hành động', 'Loại', 'Đối tượng', 'Chi tiết'] },
  ]

  tabDefs.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name)
    if (!sheet) {
      sheet = ss.insertSheet(def.name)
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers])
      sheet.setFrozenRows(1)
    }
  })
  ensureMissingColumns(ss, tabDefs)

  // Seed default labels if empty
  var labelSheet = ss.getSheetByName(SHEETS.NHAN)
  if (labelSheet && labelSheet.getLastRow() <= 1) {
    var defaultLabels = [
      [1, 'Bug', '#e53935'],
      [2, 'Feature', '#43a047'],
      [3, 'Design', '#fb8c00'],
      [4, 'UI/UX', '#8e24aa'],
      [5, 'Backend', '#1e88e5'],
      [6, 'Frontend', '#00acc1'],
      [7, 'API', '#5e35b1'],
      [8, 'Testing', '#3949ab'],
      [9, 'DevOps', '#546e7a'],
      [10, 'Urgent', '#c62828'],
    ]
    defaultLabels.forEach(function(row) {
      labelSheet.appendRow(row)
    })
  }
}
