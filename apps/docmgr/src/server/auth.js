// ===== App-specific auth — login with column mappings, lock/unlock =====
// Core auth (validateSession, requireAuth, requireAdmin, changePassword, etc.) provided by gas-core/auth-core.js

/**
 * Default permission sets when Phân quyền chi tiết is empty.
 * Returns full JSON permissions object.
 */
var DEFAULT_PERMS = {
  'Quản trị viên': null, // null = bypass (full access)
  'admin':         null,
  'Giám đốc':      null,
  'Biên tập viên': {
    hoSo:       { c: true,  r: true,  u: true,  d: false },
    danhMuc:    { c: false, r: true,  u: false, d: false },
    phongBan:   { c: false, r: true,  u: false, d: false },
    nhaCungCap: { c: false, r: true,  u: false, d: false },
    duAn:       { c: false, r: true,  u: false, d: false },
    user:       { c: false, r: false, u: false, d: false },
    caiDat:     { c: false, r: false, u: false, d: false },
    allowedCategories: [],
  },
  'Văn thư': {
    hoSo:       { c: true,  r: true,  u: true,  d: false },
    danhMuc:    { c: false, r: true,  u: false, d: false },
    phongBan:   { c: false, r: true,  u: false, d: false },
    nhaCungCap: { c: false, r: true,  u: false, d: false },
    duAn:       { c: false, r: true,  u: false, d: false },
    user:       { c: false, r: false, u: false, d: false },
    caiDat:     { c: false, r: false, u: false, d: false },
    allowedCategories: [],
  },
  'Trưởng phòng': {
    hoSo:       { c: true,  r: true,  u: true,  d: false },
    danhMuc:    { c: false, r: true,  u: false, d: false },
    phongBan:   { c: false, r: true,  u: false, d: false },
    nhaCungCap: { c: false, r: true,  u: false, d: false },
    duAn:       { c: false, r: true,  u: false, d: false },
    user:       { c: false, r: false, u: false, d: false },
    caiDat:     { c: false, r: false, u: false, d: false },
    allowedCategories: [],
  },
  'Nhân viên': {
    hoSo:       { c: false, r: true,  u: false, d: false },
    danhMuc:    { c: false, r: true,  u: false, d: false },
    phongBan:   { c: false, r: true,  u: false, d: false },
    nhaCungCap: { c: false, r: true,  u: false, d: false },
    duAn:       { c: false, r: true,  u: false, d: false },
    user:       { c: false, r: false, u: false, d: false },
    caiDat:     { c: false, r: false, u: false, d: false },
    allowedCategories: [],
  },
  'Xem': {
    hoSo:       { c: false, r: true,  u: false, d: false },
    danhMuc:    { c: false, r: true,  u: false, d: false },
    phongBan:   { c: false, r: true,  u: false, d: false },
    nhaCungCap: { c: false, r: true,  u: false, d: false },
    duAn:       { c: false, r: true,  u: false, d: false },
    user:       { c: false, r: false, u: false, d: false },
    caiDat:     { c: false, r: false, u: false, d: false },
    allowedCategories: [],
  },
}

var FULL_ADMIN_PERMS = {
  hoSo:       { c: true, r: true, u: true, d: true },
  danhMuc:    { c: true, r: true, u: true, d: true },
  phongBan:   { c: true, r: true, u: true, d: true },
  nhaCungCap: { c: true, r: true, u: true, d: true },
  duAn:       { c: true, r: true, u: true, d: true },
  user:       { c: true, r: true, u: true, d: true },
  caiDat:     { c: true, r: true, u: true, d: true },
  allowedCategories: [],
}

/**
 * Build permissions object for a user.
 * appRole — row from APP_ROLES sheet.
 * Returns full permissions JSON (never null).
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

function autoLogin() {
  var email = Session.getActiveUser().getEmail()
  if (!email) throw new Error('Không thể xác định tài khoản Google. Vui lòng mở lại ứng dụng.')

  var central = getCentralSheet()
  var users = rowsToObjects(central.getSheetByName(SHEETS.USERS).getDataRange().getValues())
  var user = users.find(function(u) {
    return u['Email'] && u['Email'].toString().toLowerCase() === email.toLowerCase()
  })

  if (!user) throw new Error('Email ' + email + ' chưa được cấp quyền truy cập. Liên hệ quản trị viên.')
  if (user['Trạng thái'] === 'Locked') throw new Error('Tài khoản đã bị khóa. Liên hệ quản trị viên.')

  var roles = rowsToObjects(central.getSheetByName(SHEETS.APP_ROLES).getDataRange().getValues())
  var appRole = roles.find(function(r) {
    return String(r['UserID']) === String(user['ID']) && r['AppID'] === APP_ID
  })
  if (!appRole) throw new Error('Tài khoản chưa được phân quyền cho ứng dụng này. Liên hệ quản trị viên.')

  updateRow(SHEETS.USERS, user['ID'], { 'Đăng nhập cuối': now() })

  var depts = []
  try {
    var deptVal = user['Phòng ban']
    if (deptVal && typeof deptVal === 'string' && deptVal.charAt(0) === '[') {
      depts = JSON.parse(deptVal)
    } else if (deptVal) {
      depts = [deptVal]
    }
  } catch(e) {}

  var token = generateUuid()
  var sessionData = {
    userId: user['ID'],
    username: user['Tên đăng nhập'],
    email: email,
    role: appRole['Quyền'],
    mustChangePass: false,
    departments: depts,
    permissions: getPermissions(appRole),
  }
  cachePut('sess_' + token, sessionData, SESSION_TTL)

  return { token: token, user: sessionData }
}

function login(username, password) {
  var central = getCentralSheet()
  var users = rowsToObjects(central.getSheetByName(SHEETS.USERS).getDataRange().getValues())
  var user = users.find(function(u) { return u['Tên đăng nhập'] === username })

  if (!user) throw new Error('Tên đăng nhập hoặc mật khẩu không đúng')
  if (user['Trạng thái'] === 'Locked') throw new Error('Tài khoản đã bị khóa. Liên hệ quản trị viên.')
  if (!_verifyPassword(username, password, user['Mật khẩu'])) throw new Error('Tên đăng nhập hoặc mật khẩu không đúng')

  var roles = rowsToObjects(central.getSheetByName(SHEETS.APP_ROLES).getDataRange().getValues())
  var appRole = roles.find(function(r) {
    return String(r['UserID']) === String(user['ID']) && r['AppID'] === APP_ID
  })
  if (!appRole) throw new Error('Tài khoản chưa được cấp quyền cho ứng dụng này')

  updateRow(SHEETS.USERS, user['ID'], { 'Đăng nhập cuối': now() })

  var depts = []
  try {
    var deptVal = user['Phòng ban']
    if (deptVal && typeof deptVal === 'string' && deptVal.charAt(0) === '[') {
      depts = JSON.parse(deptVal)
    } else if (deptVal) {
      depts = [deptVal]
    }
  } catch(e) {}

  var token = generateUuid()
  var sessionData = {
    userId: user['ID'],
    username: user['Tên đăng nhập'],
    email: user['Email'],
    role: appRole['Quyền'],
    mustChangePass: user['MustChangePass'] === 'TRUE' || user['MustChangePass'] === true,
    departments: depts,
    permissions: getPermissions(appRole),
  }
  cachePut('sess_' + token, sessionData, SESSION_TTL)

  return { token: token, user: sessionData }
}

// ===== Lock / Unlock =====
function lockUser(token, targetUserId) {
  var session = requireAdmin(token)
  if (String(session.userId) === String(targetUserId)) throw new Error('Không thể tự khóa tài khoản của mình')
  updateRow(SHEETS.USERS, targetUserId, { 'Trạng thái': 'Locked' })
  return { success: true }
}

function unlockUser(token, targetUserId) {
  requireAdmin(token)
  updateRow(SHEETS.USERS, targetUserId, { 'Trạng thái': 'Active' })
  return { success: true }
}
