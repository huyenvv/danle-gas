// ===== App-specific sheet names & initialization =====
// Base helpers (getConfig, setConfig, getSheet, _hashPassword, etc.) provided by gas-core/config-base.js
// Users are managed by SSO Portal (parent app). This app only manages local authorization (_Phân Quyền).

var SHEETS = {
  APP_ROLES:   '_Phân Quyền',
  PHONG_BAN:   'Phòng Ban',
  BINH_LUAN:   '_Bình Luận',
  HOAT_DONG:   '_Hoạt Động',
  NHAN:        'Nhãn',
  NHAT_KY:     '_Nhật Ký',
  LICH:        'Lịch',
}

// Schedule statuses (workflow):
//   Chờ TP   → registered by employee, awaiting Trưởng phòng confirmation
//   Chờ GĐ   → confirmed by TP (or registered by TP), awaiting GĐ approval
//   Đã duyệt → approved by GĐ
//   Từ chối  → rejected
var SCHEDULE_STATUSES = ['Chờ TP', 'Chờ GĐ', 'Đã duyệt', 'Từ chối']
var SCHEDULE_TYPES = ['Công tác', 'Họp']

var APP_ID = 'workmgr'

// ===== Status & priority constants =====
var TASK_STATUSES = ['Cần Làm', 'Đang Thực Hiện', 'Chờ Duyệt', 'Hoàn Thành']
var PRIORITIES = ['Cao', 'Trung Bình', 'Thấp']

// Prefix for per-department task sheets (e.g. "CV_PB001")
var TASK_SHEET_PREFIX = 'CV_'

// Headers for per-department task sheets
var TASK_HEADERS = ['ID', 'Tiêu đề', 'Mô tả', 'Phòng ban ID', 'Người thực hiện ID', 'Người giao ID', 'Trạng thái', 'Mức độ ưu tiên', 'Ngày bắt đầu', 'Ngày hết hạn', 'Ngày hoàn thành', 'Nhãn', 'Tiến độ', 'Người phối hợp', 'Subtasks', 'Người tạo', 'Ngày tạo', 'Ghi chú']

// ===== First-run initialization =====
function ensureInitialized() {
  var central = getCentralSheet()
  _ensureAllTabsExist(central)
}

function _ensureAllTabsExist(ss) {
  var tabDefs = [
    { name: SHEETS.APP_ROLES,  headers: ['ID', 'UserID', 'Tên đăng nhập', 'AppID', 'Quyền', 'Phân quyền chi tiết'] },
    { name: SHEETS.PHONG_BAN,  headers: ['ID', 'Tên phòng ban', 'Mô tả', 'Trưởng phòng ID', 'Phó phòng ID', 'PGĐ phụ trách ID', 'Thành viên', 'Đơn vị quản lý', 'Sheet Name', 'Người tạo', 'Ngày tạo', 'Ghi chú'] },
    { name: SHEETS.BINH_LUAN,  headers: ['ID', 'Mã đối tượng', 'Loại đối tượng', 'UserID', 'Tên người dùng', 'Nội dung', 'Thời gian'] },
    { name: SHEETS.HOAT_DONG,  headers: ['ID', 'Loại', 'Mô tả', 'Đối tượng', 'Mã đối tượng', 'UserID', 'Tên người dùng', 'Thời gian'] },
    { name: SHEETS.NHAN,       headers: ['ID', 'Tên nhãn', 'Màu sắc'] },
    { name: SHEETS.NHAT_KY,    headers: ['ID', 'Thời gian', 'Người dùng', 'Email', 'Hành động', 'Loại', 'Đối tượng', 'Chi tiết'] },
    { name: SHEETS.LICH,       headers: ['ID', 'Loại', 'Nội dung', 'Thời gian bắt đầu', 'Thời gian kết thúc', 'Địa điểm', 'Người chủ trì ID', 'Thành phần', 'Ghi chú', 'Link họp', 'File đính kèm', 'Trạng thái', 'Lý do từ chối', 'Người đăng ký ID', 'Phòng ban ID', 'Ngày đăng ký', 'Người duyệt ID', 'Ngày duyệt'] },
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

/**
 * Create a task sheet for a department if it doesn't exist.
 * Returns the sheet name (e.g. "CV_PB001").
 */
function ensureDepartmentTaskSheet(deptId) {
  var sheetName = TASK_SHEET_PREFIX + deptId
  var ss = getCentralSheet()
  var sheet = ss.getSheetByName(sheetName)
  if (!sheet) {
    sheet = ss.insertSheet(sheetName)
    sheet.getRange(1, 1, 1, TASK_HEADERS.length).setValues([TASK_HEADERS])
    sheet.setFrozenRows(1)
  }
  return sheetName
}

/**
 * Get all department task sheet names from the Phòng Ban registry.
 */
function getAllDeptTaskSheetNames() {
  var depts = getSheetData(SHEETS.PHONG_BAN)
  return depts.map(function(d) { return d['Sheet Name'] || (TASK_SHEET_PREFIX + d['ID']) }).filter(Boolean)
}
