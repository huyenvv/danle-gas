// ===== App-specific auth — SSO session + local authorization =====
// Core auth (validateSession, requireAuth, requireAdmin, etc.) provided by gas-core/auth-core.js
// Authentication (login, password, lock/unlock) is managed by SSO Portal (parent app).
// This app only handles authorization (roles, permissions).

var _ROLE_RANK = {
  'Giám đốc': 5,
  'Phó GĐ': 4,
  'Trưởng phòng': 3,
  'Phó phòng': 2,
  'Người phụ trách': 2,
  'Nhân viên': 1,
}

function _getDeptRole(parentSs, userId) {
  var sheet = parentSs.getSheetByName('_Phân Bổ')
  if (!sheet) return null
  var data = sheet.getDataRange().getValues()
  var headers = data[0]
  var colUid = headers.indexOf('UserID')
  var colRole = headers.indexOf('Chức vụ')
  if (colUid === -1 || colRole === -1) return null
  var best = null
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colUid]) === String(userId)) {
      var r = data[i][colRole]
      if (r && (!best || (_ROLE_RANK[r] || 0) > (_ROLE_RANK[best] || 0))) best = r
    }
  }
  return best
}
