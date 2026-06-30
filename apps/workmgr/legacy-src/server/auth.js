// ===== App-specific auth — SSO session + local authorization =====
// Core auth (validateSession, requireAuth, requireAdmin, etc.) provided by gas-core/auth-core.js
// SSO validation (ssoValidateToken, ssoStoreParentSheetId) provided by gas-core/sso.js
// Authentication (login, password) is managed by SSO Portal (parent app).
// This app only handles authorization (roles, permissions).

/**
 * Default permission sets when Phân quyền chi tiết is empty.
 */
var DEFAULT_PERMS = {
  'Quản trị viên': null,
  'admin':         null,
  'Giám đốc':      null,
  'Trưởng phòng': {
    phongBan:      { c: true,  r: true,  u: true,  d: false },
    congViec:  { c: true,  r: true,  u: true,  d: true  },
    nhan:      { c: false, r: true,  u: false, d: false },
    user:      { c: false, r: false, u: false, d: false },
    caiDat:    { c: false, r: false, u: false, d: false },
  },
  'Nhân viên': {
    phongBan:      { c: false, r: true,  u: false, d: false },
    congViec:  { c: false, r: true,  u: true,  d: false },
    nhan:      { c: false, r: true,  u: false, d: false },
    user:      { c: false, r: false, u: false, d: false },
    caiDat:    { c: false, r: false, u: false, d: false },
  },
  'Xem': {
    phongBan:      { c: false, r: true,  u: false, d: false },
    congViec:  { c: false, r: true,  u: false, d: false },
    nhan:      { c: false, r: true,  u: false, d: false },
    user:      { c: false, r: false, u: false, d: false },
    caiDat:    { c: false, r: false, u: false, d: false },
  },
}

var FULL_ADMIN_PERMS = {
  phongBan:      { c: true, r: true, u: true, d: true },
  congViec:  { c: true, r: true, u: true, d: true },
  nhan:      { c: true, r: true, u: true, d: true },
  user:      { c: true, r: true, u: true, d: true },
  caiDat:    { c: true, r: true, u: true, d: true },
}

/**
 * Build permissions object for a user.
 * appRole — row from APP_ROLES sheet.
 */
function getPermissions(appRole) {
  var role = appRole ? appRole['Quyền'] : ''
  if (role === 'Quản trị viên' || role === 'admin' || role === 'Giám đốc') return FULL_ADMIN_PERMS

  var detail = appRole ? appRole['Phân quyền chi tiết'] : ''
  if (detail) {
    try {
      var parsed = JSON.parse(detail)
      return parsed
    } catch (e) { /* fall through to defaults */ }
  }

  return DEFAULT_PERMS[role] || DEFAULT_PERMS['Xem']
}

// ===== Department & task permission helpers =====
// Apply customer-defined rules:
// - Admin/GĐ: full access
// - PGĐ (Phó Giám đốc): manage depts they oversee (PGĐ phụ trách ID === userId)
// - Trưởng/Phó phòng: manage tasks in their own dept
// - Người thực hiện (assignee): can update own task progress/status (within Kanban limits)
// - All employees: can VIEW all tasks across all depts (cross-view) — only EDIT restricted

function _isAdminRole(role) {
  return role === 'admin' || role === 'Quản trị viên' || role === 'Giám đốc'
}

function _isPGDOfDept(session, dept) {
  if (!dept) return false
  return String(dept['PGĐ phụ trách ID'] || '').split(',').indexOf(String(session.userId)) !== -1
}

function _isLeaderOfDept(session, dept) {
  if (!dept) return false
  var uid = String(session.userId)
  return String(dept['Trưởng phòng ID'] || '').split(',').indexOf(uid) !== -1 ||
    String(dept['Phó phòng ID'] || '').split(',').indexOf(uid) !== -1
}

/**
 * Whether user can create/update/delete the dept itself (the row in PHONG_BAN).
 * Only Admin/GĐ per customer requirement (image 2.1).
 */
function canManageDept(session) {
  return _isAdminRole(session.role)
}

/**
 * Whether user can create/edit/delete tasks in this dept.
 * Admin/GĐ → any; PGĐ → depts they manage; Trưởng/Phó phòng → own dept.
 */
function canManageDeptTasks(session, dept) {
  if (_isAdminRole(session.role)) return true
  if (_isPGDOfDept(session, dept)) return true
  if (_isLeaderOfDept(session, dept)) return true
  return false
}

/**
 * Whether user can update task progress (Tiến độ %).
 * Leaders, PGĐ phụ trách, the assignee, or Admin/GĐ.
 */
function canUpdateTaskProgress(session, dept, task) {
  if (_isAdminRole(session.role)) return true
  if (_isPGDOfDept(session, dept)) return true
  if (_isLeaderOfDept(session, dept)) return true
  if (task && String(task['Người thực hiện ID']) === String(session.userId)) return true
  return false
}

/**
 * Whether user can move a task between Kanban columns.
 *  - Cần Làm → Đang Thực Hiện: assignee (+ leaders/admin)
 *  - Đang Thực Hiện → Chờ Duyệt: assignee (+ leaders/admin)
 *  - Chờ Duyệt → Hoàn Thành: leaders / PGĐ / Admin/GĐ only
 *  - Any other transition: leaders / admin override
 */
function canMoveTaskStatus(session, dept, task, fromStatus, toStatus) {
  if (_isAdminRole(session.role)) return true
  var isAssignee = task && String(task['Người thực hiện ID']) === String(session.userId)
  var isLeaderOrPGD = _isLeaderOfDept(session, dept) || _isPGDOfDept(session, dept)

  if (toStatus === 'Hoàn Thành') return isLeaderOrPGD
  if ((fromStatus === 'Cần Làm' && toStatus === 'Đang Thực Hiện') ||
      (fromStatus === 'Đang Thực Hiện' && toStatus === 'Chờ Duyệt')) {
    return isAssignee || isLeaderOrPGD
  }
  return isLeaderOrPGD
}

function _buildSessionFromRows(userRow, roleRow) {
  return {
    userId: userRow['ID'],
    username: userRow['Tên đăng nhập'],
    name: userRow['Tên nhân viên'] || userRow['Tên đăng nhập'] || '',
    email: userRow['Email'],
    role: roleRow['Quyền'],
    permissions: getPermissions(roleRow),
  }
}

/**
 * Build session data and mint access + refresh tokens for a user.
 * Called by api_ssoLogin and api_resume.
 */
function _mintTokensForUser(userRow, appRole, deviceType) {
  var sessionData = _buildSessionFromRows(userRow, appRole)

  var roles = getSheetData(SHEETS.APP_ROLES)
  var roleRow = roles.find(function(r) {
    return String(r['UserID']) === String(userRow['ID']) && r['AppID'] === APP_ID
  })
  var label = (deviceType === 'mobile') ? 'mobile' : 'desktop'

  // Revoke old access token for same device type
  var deviceAtKey = 'device_at_' + userRow['ID'] + '_' + label
  var oldAt = cacheGet(deviceAtKey)
  if (oldAt) revokeAccessToken(oldAt)

  var refreshToken = mintRefreshToken(SHEETS.APP_ROLES, roleRow['ID'], { label: label })
  var accessToken = mintAccessToken(sessionData)

  cachePut(deviceAtKey, accessToken, ACCESS_TOKEN_TTL)

  return { accessToken: accessToken, refreshToken: refreshToken, session: sessionData }
}
