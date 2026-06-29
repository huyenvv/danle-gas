// ===== App-specific auth — SSO session + local authorization =====
// Core auth (validateSession, requireAuth, requireAdmin, etc.) provided by gas-core/auth-core.js
// Authentication (login, password, lock/unlock) is managed by SSO Portal (parent app).
// This app only handles authorization (roles, permissions).

var _ROLE_RANK = {
  'Giám đốc': 6,
  'Phó GĐ': 5,
  'Trưởng phòng': 4,
  'Phó phòng': 3,
  'Người phụ trách': 3,
  'Văn thư': 2,
  'Nhân viên': 1,
}

// Chức vụ thuộc bộ máy quản trị hệ thống, không phải vai trò trong bộ máy công ty → loại khi lấy vai trò.
var _DEPT_ROLE_EXCLUDE = { 'admin': true, 'Quản trị viên': true }

function _buildDeptMap(parentSs) {
  var map = {}
  var sheet = parentSs.getSheetByName('_Phòng Ban')
  if (!sheet) return map
  var data = sheet.getDataRange().getValues()
  var headers = data[0]
  var colId = headers.indexOf('ID')
  var colName = headers.indexOf('Tên phòng ban')
  if (colId === -1 || colName === -1) return map
  for (var i = 1; i < data.length; i++) map[String(data[i][colId])] = data[i][colName]
  return map
}

// Chức vụ cao nhất trong bộ máy công ty (loại admin) + phòng ban tương ứng, từ SSO _Phân Bổ.
// Thứ tự: Giám đốc > Phó GĐ > Trưởng phòng > Phó phòng/Người phụ trách > Văn thư > Nhân viên.
function _getDeptInfo(parentSs, userId) {
  var out = { role: '', phongBan: '' }
  var sheet = parentSs.getSheetByName('_Phân Bổ')
  if (!sheet) return out
  var data = sheet.getDataRange().getValues()
  var headers = data[0]
  var colUid = headers.indexOf('UserID')
  var colRole = headers.indexOf('Chức vụ')
  var colPb = headers.indexOf('PhongBanID')
  if (colUid === -1 || colRole === -1) return out
  var deptMap = _buildDeptMap(parentSs)
  var bestRank = -1
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colUid]) !== String(userId)) continue
    var r = data[i][colRole]
    if (!r || _DEPT_ROLE_EXCLUDE[r]) continue
    var rank = _ROLE_RANK[r] || 0
    if (rank > bestRank) {
      bestRank = rank
      out.role = r
      out.phongBan = (colPb !== -1 && data[i][colPb]) ? (deptMap[String(data[i][colPb])] || '') : ''
    }
  }
  return out
}

// Như _getDeptInfo nhưng cho MỌI user trong MỘT lần đọc (tránh N+1: trước đây gửi mail nhiều người
// thì mỗi người đọc lại cả _Phân Bổ + _Phòng Ban). Trả map userId(chuỗi) → {role, phongBan} (rank cao nhất).
function _buildDeptInfoMap(parentSs) {
  var out = {}
  var sheet = parentSs.getSheetByName('_Phân Bổ')
  if (!sheet) return out
  var data = sheet.getDataRange().getValues()
  if (data.length < 2) return out
  var headers = data[0]
  var colUid = headers.indexOf('UserID')
  var colRole = headers.indexOf('Chức vụ')
  var colPb = headers.indexOf('PhongBanID')
  if (colUid === -1 || colRole === -1) return out
  var deptMap = _buildDeptMap(parentSs)
  var bestRank = {}
  for (var i = 1; i < data.length; i++) {
    var uid = String(data[i][colUid])
    var r = data[i][colRole]
    if (!r || _DEPT_ROLE_EXCLUDE[r]) continue
    var rank = _ROLE_RANK[r] || 0
    if (bestRank[uid] == null || rank > bestRank[uid]) {
      bestRank[uid] = rank
      out[uid] = { role: r, phongBan: (colPb !== -1 && data[i][colPb]) ? (deptMap[String(data[i][colPb])] || '') : '' }
    }
  }
  return out
}

function _getDeptRole(parentSs, userId) {
  return _getDeptInfo(parentSs, userId).role || null
}
