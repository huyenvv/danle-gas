// ===== App-specific auth — SSO session + local authorization =====
// Core auth (validateSession, requireAuth, requireAdmin, etc.) provided by gas-core/auth-core.js
// Handoff consumption (consumeHandoffCrossScript) provided by gas-core/handoff.js
// Authentication (login, password, lock/unlock) is managed by SSO Portal (parent app).
// This app only handles authorization (roles, permissions).

/**
 * Default permission sets when Phân quyền chi tiết is empty.
 */
var DEFAULT_PERMS = {
  'Quản trị viên': null,
  'admin':         null,
  'Giám đốc':      null,
  'Văn thư': {
    hoSo:       { c: true,  r: true,  u: true,  d: false },
    danhMuc:    { c: false, r: true,  u: false, d: false },
    nhom:       { c: false, r: true,  u: false, d: false },
    nhaCungCap: { c: false, r: true,  u: false, d: false },
    duAn:       { c: false, r: true,  u: false, d: false },
    user:       { c: false, r: false, u: false, d: false },
    caiDat:     { c: false, r: false, u: false, d: false },
    allowedCategories: [],
  },
  'Trưởng phòng': {
    hoSo:       { c: false, r: true,  u: false, d: false },
    danhMuc:    { c: false, r: true,  u: false, d: false },
    nhom:       { c: false, r: true,  u: false, d: false },
    nhaCungCap: { c: false, r: true,  u: false, d: false },
    duAn:       { c: false, r: true,  u: false, d: false },
    user:       { c: false, r: false, u: false, d: false },
    caiDat:     { c: false, r: false, u: false, d: false },
    allowedCategories: [],
  },
  'Phó GĐ': {
    hoSo:       { c: false, r: true,  u: false, d: false },
    danhMuc:    { c: false, r: true,  u: false, d: false },
    nhom:       { c: false, r: true,  u: false, d: false },
    nhaCungCap: { c: false, r: true,  u: false, d: false },
    duAn:       { c: false, r: true,  u: false, d: false },
    user:       { c: false, r: false, u: false, d: false },
    caiDat:     { c: false, r: false, u: false, d: false },
    allowedCategories: [],
  },
  'Phó phòng': {
    hoSo:       { c: false, r: true,  u: false, d: false },
    danhMuc:    { c: false, r: true,  u: false, d: false },
    nhom:       { c: false, r: true,  u: false, d: false },
    nhaCungCap: { c: false, r: true,  u: false, d: false },
    duAn:       { c: false, r: true,  u: false, d: false },
    user:       { c: false, r: false, u: false, d: false },
    caiDat:     { c: false, r: false, u: false, d: false },
    allowedCategories: [],
  },
  'Nhân viên': {
    hoSo:       { c: false, r: true,  u: false, d: false },
    danhMuc:    { c: false, r: true,  u: false, d: false },
    nhom:       { c: false, r: true,  u: false, d: false },
    nhaCungCap: { c: false, r: true,  u: false, d: false },
    duAn:       { c: false, r: true,  u: false, d: false },
    user:       { c: false, r: false, u: false, d: false },
    caiDat:     { c: false, r: false, u: false, d: false },
    allowedCategories: [],
  },
  'Xem': {
    hoSo:       { c: false, r: true,  u: false, d: false },
    danhMuc:    { c: false, r: true,  u: false, d: false },
    nhom:       { c: false, r: true,  u: false, d: false },
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
  nhom:       { c: true, r: true, u: true, d: true },
  nhaCungCap: { c: true, r: true, u: true, d: true },
  duAn:       { c: true, r: true, u: true, d: true },
  user:       { c: true, r: true, u: true, d: true },
  caiDat:     { c: true, r: true, u: true, d: true },
  allowedCategories: [],
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
