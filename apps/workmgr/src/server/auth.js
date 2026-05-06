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
    duAn:      { c: true,  r: true,  u: true,  d: false },
    congViec:  { c: true,  r: true,  u: true,  d: true  },
    nhan:      { c: false, r: true,  u: false, d: false },
    user:      { c: false, r: false, u: false, d: false },
    caiDat:    { c: false, r: false, u: false, d: false },
  },
  'Nhân viên': {
    duAn:      { c: false, r: true,  u: false, d: false },
    congViec:  { c: false, r: true,  u: true,  d: false },
    nhan:      { c: false, r: true,  u: false, d: false },
    user:      { c: false, r: false, u: false, d: false },
    caiDat:    { c: false, r: false, u: false, d: false },
  },
  'Xem': {
    duAn:      { c: false, r: true,  u: false, d: false },
    congViec:  { c: false, r: true,  u: false, d: false },
    nhan:      { c: false, r: true,  u: false, d: false },
    user:      { c: false, r: false, u: false, d: false },
    caiDat:    { c: false, r: false, u: false, d: false },
  },
}

var FULL_ADMIN_PERMS = {
  duAn:      { c: true, r: true, u: true, d: true },
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

/**
 * Create a local session from SSO-validated user + local app role.
 * Called by doGet after SSO token validation.
 */
function ssoCreateSession(user, appRole) {
  var perms = getPermissions(appRole)

  var token = generateUuid()
  var sessionData = {
    userId: user['ID'],
    username: user['Tên đăng nhập'],
    email: user['Email'],
    role: appRole['Quyền'],
    mustChangePass: false,
    permissions: perms,
  }
  cachePut('sess_' + token, sessionData, SESSION_TTL)
  return token
}
