// ===== License Server (GAS Web App — Container-bound) =====
//
// Script sống bên trong Google Sheet (Extensions > Apps Script)
// Google Sheet DB với 3 tabs: Whitelist | Audit Logs | Admins
// Deploy: Execute as User accessing / Anyone with Google account
//
// Admins tab:
//   Email | Password Hash | Role (owner/admin) | Ngày thêm
//   Owner: auto-login, full access (manage admins + whitelist)
//   Admin: password required, whitelist + logs only
//
// Whitelist tab:
//   Email | App | Ngày thêm | Thêm bởi | Ghi chú
//   App: match activation request's app param (* or empty = all)
//
// Script Properties:
//   SECRET_SALT — same as main app
//
// Session: UserProperties (24h TTL)

// ── Constants ────────────────────────────────────────────────────────────────

var TAB_WHITELIST = 'Whitelist'
var TAB_LOGS      = 'Audit Logs'
var TAB_ADMINS    = 'Admins'

var WL_HEADERS  = ['Email', 'App', 'Ngày thêm', 'Thêm bởi', 'Ghi chú']
var LOG_HEADERS = ['Thời gian', 'Email', 'Hành động', 'Chi tiết', 'IP/User']
var ADM_HEADERS = ['Email', 'Password Hash', 'Role', 'Ngày thêm']

// ── CSS ──────────────────────────────────────────────────────────────────────

var CSS = '<style>'
  + '*{box-sizing:border-box;margin:0;padding:0}'
  + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f0f2f5;color:#1a1a2e;min-height:100vh}'
  + '.container{max-width:720px;margin:0 auto;padding:24px 16px}'
  + '.card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);padding:24px;margin-bottom:20px}'
  + '.header{text-align:center;padding:32px 0 16px}'
  + '.header h1{font-size:22px;color:#1a56db;margin-bottom:4px}'
  + '.header p{color:#6b7280;font-size:13px}'
  + '.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}'
  + '.badge-blue{background:#dbeafe;color:#1d4ed8}'
  + '.badge-green{background:#dcfce7;color:#15803d}'
  + '.badge-red{background:#fee2e2;color:#dc2626}'
  + '.badge-gray{background:#f3f4f6;color:#6b7280}'
  + 'table{width:100%;border-collapse:collapse;font-size:13px}'
  + 'th{text-align:left;padding:10px 12px;background:#f8fafc;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #e2e8f0}'
  + 'td{padding:10px 12px;border-bottom:1px solid #f1f5f9}'
  + 'tr:hover td{background:#f8fafc}'
  + '.btn{padding:8px 16px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;transition:all .15s}'
  + '.btn-primary{background:#1a56db;color:#fff}.btn-primary:hover{background:#1e40af}'
  + '.btn-danger{background:#fee2e2;color:#dc2626}.btn-danger:hover{background:#fecaca}'
  + '.btn-secondary{background:#f3f4f6;color:#374151;text-decoration:none;display:inline-block}.btn-secondary:hover{background:#e5e7eb}'
  + '.btn-sm{padding:4px 10px;font-size:12px;border-radius:6px}'
  + 'input[type=email],input[type=text],input[type=password],select{padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;width:100%;outline:none;transition:border .15s}'
  + 'input:focus,select:focus{border-color:#1a56db;box-shadow:0 0 0 3px rgba(26,86,219,.1)}'
  + '.form-row{display:flex;gap:8px;margin-top:16px}'
  + '.form-row input{flex:1}'
  + '.alert{padding:12px 16px;border-radius:8px;font-size:13px;margin-bottom:16px}'
  + '.alert-success{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}'
  + '.alert-error{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}'
  + '.alert-warn{background:#fffbeb;color:#b45309;border:1px solid #fde68a}'
  + '.tabs{display:flex;gap:4px;margin-bottom:20px;border-bottom:2px solid #e5e7eb;padding-bottom:0}'
  + '.tab{padding:8px 16px;font-size:13px;font-weight:500;color:#6b7280;text-decoration:none;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s}'
  + '.tab:hover{color:#1a56db}'
  + '.tab.active{color:#1a56db;border-bottom-color:#1a56db}'
  + '.filter-bar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}'
  + '.filter-bar input,.filter-bar select{width:auto;flex:1;min-width:140px}'
  + '.empty{text-align:center;padding:32px;color:#9ca3af}'
  + '.stat{display:inline-block;margin-right:16px;font-size:13px;color:#6b7280}'
  + '.stat b{color:#1a1a2e}'
  + '.confirm-box{text-align:center;padding:20px}'
  + '.confirm-box h3{color:#dc2626;margin-bottom:8px}'
  + '.confirm-box p{color:#6b7280;margin-bottom:20px}'
  + '.redirect-box{text-align:center;padding:48px 24px}'
  + '.redirect-box .icon{font-size:48px;margin-bottom:16px}'
  + '.redirect-box h2{color:#1a56db;margin-bottom:8px}'
  + '.redirect-box p{color:#6b7280;font-size:14px}'
  + '.redirect-box .email{font-weight:600;color:#1a1a2e}'
  + '.redirect-box .token{font-family:monospace;font-size:11px;color:#9ca3af;margin-top:12px;word-break:break-all}'
  + '.spinner{display:inline-block;width:20px;height:20px;border:2px solid #e5e7eb;border-top-color:#1a56db;border-radius:50%;animation:spin 1s linear infinite;margin-right:8px;vertical-align:middle}'
  + '@keyframes spin{to{transform:rotate(360deg)}}'
  + '</style>'

// ── Entry Points ─────────────────────────────────────────────────────────────

function doGet(e) {
  var p = e && e.parameter ? e.parameter : {}

  // Activation flow (không cần login admin)
  if (p.scriptId && p.callback) {
    return _handleActivation(p)
  }

  // Logout
  if (p.action === 'logout') {
    _logout()
    return _loggedOutPage()
  }

  // Check admin
  var adminInfo = _getAdminInfo()
  if (!adminInfo) return _accessDeniedPage()

  // Owner auto-login
  if (adminInfo.role === 'owner' && !_isLoggedIn()) {
    _login()
  }

  // Admin needs password login
  if (!_isLoggedIn()) return _loginPage(adminInfo.email, '')

  var tab = p.tab || 'whitelist'
  return _renderPage(tab, p.msg || '', p.search || '', adminInfo)
}

function doPost(e) {
  var p = e && e.parameter ? e.parameter : {}
  var action  = p.action || ''

  // Login action (password-based, for admins only)
  if (action === 'login') {
    var adminInfo = _getAdminInfo()
    if (!adminInfo) return _accessDeniedPage()
    if (adminInfo.role === 'owner') {
      _login()
      _writeLog(adminInfo.email, 'Đăng nhập', 'owner auto')
      return _renderPage('whitelist', '✅ Đăng nhập thành công!', '', adminInfo)
    }
    var password = (p.password || '').trim()
    if (!adminInfo.passwordHash || _hashPassword(password) !== adminInfo.passwordHash) {
      _writeLog(adminInfo.email, 'Login thất bại', 'Sai mật khẩu')
      return _loginPage(adminInfo.email, '❌ Mật khẩu không đúng.')
    }
    _login()
    _writeLog(adminInfo.email, 'Đăng nhập', '')
    return _renderPage('whitelist', '✅ Đăng nhập thành công!', '', adminInfo)
  }

  // Các action khác cần đã login
  var adminInfo = _getAdminInfo()
  if (!adminInfo) return _accessDeniedPage()
  if (adminInfo.role === 'owner' && !_isLoggedIn()) _login()
  if (!_isLoggedIn()) return _loginPage(adminInfo.email, '⚠️ Phiên đăng nhập hết hạn.')

  var email   = (p.email || '').trim().toLowerCase()
  var confirm = p.confirm || ''
  var note    = (p.note || '').trim()
  var app     = (p.app || '').trim()

  if (action === 'add' && email) {
    if (_emailExistsForApp(email, app)) {
      return _renderPage('whitelist', '⚠️ Email <b>' + email + '</b>' + (app ? ' (app: ' + app + ')' : '') + ' đã có trong danh sách.', '', adminInfo)
    }
    _addEmail(email, app, adminInfo.email, note)
    _writeLog(adminInfo.email, 'Thêm email', email + (app ? ' [' + app + ']' : '') + (note ? ' (' + note + ')' : ''))
    return _renderPage('whitelist', '✅ Đã thêm: ' + email, '', adminInfo)
  }

  if (action === 'confirm-remove' && email) {
    return _confirmRemovePage(email)
  }

  if (action === 'remove' && email && confirm === 'yes') {
    _removeEmail(email, p.removeApp || '')
    _writeLog(adminInfo.email, 'Xóa email', email)
    return _renderPage('whitelist', '✅ Đã xóa: ' + email, '', adminInfo)
  }

  // Admin management (owner only)
  if (adminInfo.role !== 'owner') {
    return _renderPage('whitelist', '⚠️ Chỉ owner mới có quyền quản lý admin.', '', adminInfo)
  }

  if (action === 'add-admin' && email) {
    if (_adminExists(email)) {
      return _renderPage('admins', '⚠️ Admin <b>' + email + '</b> đã tồn tại.', '', adminInfo)
    }
    var newPassword = (p.password || '').trim()
    if (!newPassword) {
      return _renderPage('admins', '⚠️ Vui lòng nhập mật khẩu cho admin mới.', '', adminInfo)
    }
    _addAdmin(email, _hashPassword(newPassword), 'admin')
    _writeLog(adminInfo.email, 'Thêm admin', email)
    return _renderPage('admins', '✅ Đã thêm admin: ' + email, '', adminInfo)
  }

  if (action === 'confirm-remove-admin' && email) {
    return _confirmRemoveAdminPage(email)
  }

  if (action === 'remove-admin' && email && confirm === 'yes') {
    _removeAdmin(email)
    _writeLog(adminInfo.email, 'Xóa admin', email)
    return _renderPage('admins', '✅ Đã xóa admin: ' + email, '', adminInfo)
  }

  return _renderPage('whitelist', '', '', adminInfo)
}

// ── Activation Flow ──────────────────────────────────────────────────────────

function _handleActivation(params) {
  var scriptId    = params.scriptId || ''
  var callbackUrl = params.callback || ''
  var app         = params.app || ''
  var ver         = params.ver || ''

  // Validate callback URL (XSS prevention)
  if (!_isValidCallback(callbackUrl)) {
    return _silentRedirect(callbackUrl ? callbackUrl : '', 'denied')
  }

  var userEmail = Session.getActiveUser().getEmail()
  if (!userEmail) {
    return _silentRedirect(callbackUrl, 'nouser')
  }

  if (!_emailExistsForApp(userEmail.toLowerCase(), app)) {
    _writeLog(userEmail, 'Kích hoạt bị từ chối', 'scriptId=' + scriptId + ' app=' + app)
    return _silentRedirect(callbackUrl, 'denied')
  }

  var salt = PropertiesService.getScriptProperties().getProperty('SECRET_SALT')
  if (!salt) {
    return _silentRedirect(callbackUrl, 'error')
  }

  var token = _sha256(scriptId + app + salt)
  var sep = callbackUrl.indexOf('?') >= 0 ? '&' : '?'
  var redirectTo = callbackUrl + sep + 'activate=' + encodeURIComponent(token)

  _writeLog(userEmail, 'Kích hoạt thành công', 'scriptId=' + scriptId + ' app=' + app + ' ver=' + ver)

  return _silentRedirect(redirectTo, '')
}

// ── Session (UserProperties) ─────────────────────────────────────────────────

var SESSION_KEY = 'license_admin_session'
var SESSION_TTL = 24 * 60 * 60 * 1000 // 24 giờ

function _isLoggedIn() {
  try {
    var raw = PropertiesService.getUserProperties().getProperty(SESSION_KEY)
    if (!raw) return false
    var data = JSON.parse(raw)
    if (Date.now() - data.time > SESSION_TTL) {
      PropertiesService.getUserProperties().deleteProperty(SESSION_KEY)
      return false
    }
    return true
  } catch(e) { return false }
}

function _login() {
  PropertiesService.getUserProperties().setProperty(SESSION_KEY,
    JSON.stringify({ loggedIn: true, time: Date.now() }))
}

function _logout() {
  try {
    var admin = _getAdminEmail()
    if (admin) _writeLog(admin, 'Đăng xuất', '')
  } catch(e) {}
  PropertiesService.getUserProperties().deleteProperty(SESSION_KEY)
}

// ── Sheet Access (container-bound) ───────────────────────────────────────────

function _getSS() {
  return SpreadsheetApp.getActiveSpreadsheet()
}

function _getOrCreateTab(ss, name, headers) {
  var sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
    sheet.appendRow(headers)
    sheet.getRange('1:1').setFontWeight('bold')
    sheet.setFrozenRows(1)
  }
  return sheet
}

function _getTab(name, headers) {
  return _getOrCreateTab(_getSS(), name, headers)
}

// ── Whitelist CRUD ───────────────────────────────────────────────────────────

function _getAllEmails() {
  var sheet = _getTab(TAB_WHITELIST, WL_HEADERS)
  var last = sheet.getLastRow()
  if (last <= 1) return []
  var data = sheet.getRange(2, 1, last - 1, WL_HEADERS.length).getValues()
  return data.map(function(r) {
    return { email: String(r[0]).trim().toLowerCase(), app: String(r[1] || '').trim(), date: r[2], addedBy: r[3] || '', note: r[4] || '' }
  }).filter(function(r) { return r.email !== '' })
}

function _emailExists(email) {
  return _getAllEmails().some(function(r) { return r.email === email.toLowerCase() })
}

function _emailExistsForApp(email, app) {
  var list = _getAllEmails()
  email = email.toLowerCase()
  app = (app || '').toLowerCase()
  return list.some(function(r) {
    if (r.email !== email) return false
    var rApp = (r.app || '').toLowerCase()
    return rApp === '' || rApp === '*' || rApp === app
  })
}

function _addEmail(email, app, addedBy, note) {
  var sheet = _getTab(TAB_WHITELIST, WL_HEADERS)
  var now = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm')
  sheet.appendRow([email.toLowerCase(), app || '*', now, addedBy, note])
}

function _removeEmail(email) {
  var sheet = _getTab(TAB_WHITELIST, WL_HEADERS)
  var last = sheet.getLastRow()
  if (last <= 1) return
  var col = sheet.getRange(2, 1, last - 1, 1).getValues()
  for (var i = col.length - 1; i >= 0; i--) {
    if (String(col[i][0]).trim().toLowerCase() === email.toLowerCase()) {
      sheet.deleteRow(i + 2)
      return
    }
  }
}

// ── Admin CRUD ───────────────────────────────────────────────────────────────

function _getAllAdmins() {
  var sheet = _getTab(TAB_ADMINS, ADM_HEADERS)
  var last = sheet.getLastRow()
  if (last <= 1) return []
  var data = sheet.getRange(2, 1, last - 1, ADM_HEADERS.length).getValues()
  return data.map(function(r) {
    return {
      email: String(r[0]).trim().toLowerCase(),
      passwordHash: String(r[1] || '').trim(),
      role: String(r[2] || 'admin').trim().toLowerCase(),
      date: r[3]
    }
  }).filter(function(r) { return r.email !== '' })
}

function _adminExists(email) {
  return _getAllAdmins().some(function(r) { return r.email === email.toLowerCase() })
}

function _addAdmin(email, passwordHash, role) {
  var sheet = _getTab(TAB_ADMINS, ADM_HEADERS)
  var now = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm')
  sheet.appendRow([email.toLowerCase(), passwordHash || '', role || 'admin', now])
}

function _removeAdmin(email) {
  var sheet = _getTab(TAB_ADMINS, ADM_HEADERS)
  var last = sheet.getLastRow()
  if (last <= 1) return
  var col = sheet.getRange(2, 1, last - 1, 1).getValues()
  for (var i = col.length - 1; i >= 0; i--) {
    if (String(col[i][0]).trim().toLowerCase() === email.toLowerCase()) {
      sheet.deleteRow(i + 2)
      return
    }
  }
}

function _getAdminInfo() {
  var user = Session.getActiveUser().getEmail()
  if (!user) return null
  user = user.toLowerCase()
  var admins = _getAllAdmins()
  for (var i = 0; i < admins.length; i++) {
    if (admins[i].email === user) return admins[i]
  }
  return null
}

// ── Audit Logs ───────────────────────────────────────────────────────────────

function _writeLog(user, action, detail) {
  var sheet = _getTab(TAB_LOGS, LOG_HEADERS)
  var now = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss')
  sheet.appendRow([now, user, action, detail || '', ''])
}

function _getRecentLogs(limit) {
  var sheet = _getTab(TAB_LOGS, LOG_HEADERS)
  var last = sheet.getLastRow()
  if (last <= 1) return []
  var count = Math.min(limit || 50, last - 1)
  var startRow = last - count + 1
  var data = sheet.getRange(startRow, 1, count, LOG_HEADERS.length).getValues()
  return data.map(function(r) {
    return { time: r[0], email: r[1], action: r[2], detail: r[3], ip: r[4] }
  }).reverse()
}

// ── Utilities ────────────────────────────────────────────────────────────────

function _sha256(input) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8)
  return bytes.map(function(b) {
    var h = (b < 0 ? b + 256 : b).toString(16)
    return h.length === 1 ? '0' + h : h
  }).join('')
}

function _hashPassword(password) {
  var salt = PropertiesService.getScriptProperties().getProperty('SECRET_SALT') || ''
  return _sha256(password + salt)
}

function _escapeJs(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/</g, '\\x3c')
    .replace(/>/g, '\\x3e')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

function _isValidCallback(url) {
  return typeof url === 'string' && url.indexOf('https://script.google.com/') === 0
}

function _silentRedirect(url, errorCode) {
  if (errorCode && url) {
    var sep = url.indexOf('?') >= 0 ? '&' : '?'
    url = url + sep + 'lr=' + encodeURIComponent(errorCode)
  }
  if (!url) {
    return HtmlService.createHtmlOutput('<html><body></body></html>')
  }
  return HtmlService.createHtmlOutput(
    '<html><head><script>window.top.location.replace("' + _escapeJs(url) + '")</script></head><body></body></html>'
  )
}

// ── UI Rendering ─────────────────────────────────────────────────────────────

function _loginPage(email, errMsg) {
  var url = ScriptApp.getService().getUrl()
  var msgHtml = errMsg ? '<div class="alert alert-error">' + errMsg + '</div>' : ''

  return HtmlService.createHtmlOutput(
    '<html><head><meta charset="UTF-8">' + CSS + '</head>'
    + '<body><div class="container">'
    + '<div class="card" style="text-align:center;padding:48px 32px;max-width:400px;margin:60px auto">'
    + '<div style="font-size:48px;margin-bottom:16px">🔑</div>'
    + '<h2 style="margin-bottom:4px">License Server</h2>'
    + '<p style="color:#6b7280;margin-bottom:24px">Quản lý danh sách kích hoạt</p>'
    + msgHtml
    + '<div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:20px">'
    + '<p style="font-size:12px;color:#6b7280">Đăng nhập với</p>'
    + '<p style="font-weight:600">' + email + '</p></div>'
    + '<form method="post" action="' + url + '">'
    + '<input type="hidden" name="action" value="login">'
    + '<input type="password" name="password" placeholder="Nhập mật khẩu" required style="margin-bottom:16px">'
    + '<button type="submit" class="btn btn-primary" style="width:100%">Đăng nhập</button>'
    + '</form></div></div></body></html>'
  ).setTitle('Đăng nhập — License Server')
}

function _loggedOutPage() {
  var url = ScriptApp.getService().getUrl()
  return HtmlService.createHtmlOutput(
    '<html><head><meta charset="UTF-8">' + CSS + '</head>'
    + '<body><div class="container">'
    + '<div class="card" style="text-align:center;padding:48px 32px;max-width:400px;margin:60px auto">'
    + '<div style="font-size:48px;margin-bottom:16px">👋</div>'
    + '<h2 style="margin-bottom:8px">Đã đăng xuất</h2>'
    + '<p style="color:#6b7280;margin-bottom:24px">Phiên làm việc đã kết thúc.</p>'
    + '<a href="' + url + '" class="btn btn-primary" style="text-decoration:none">Đăng nhập lại</a>'
    + '</div></div></body></html>'
  ).setTitle('Đã đăng xuất')
}

function _accessDeniedPage() {
  return HtmlService.createHtmlOutput(
    '<html><head><meta charset="UTF-8">' + CSS + '</head>'
    + '<body><div class="container"><div class="card" style="text-align:center;padding:48px">'
    + '<div style="font-size:48px;margin-bottom:16px">🔒</div>'
    + '<h2 style="margin-bottom:8px">Truy cập bị từ chối</h2>'
    + '<p style="color:#6b7280">Bạn không có quyền truy cập. Liên hệ quản trị viên.</p>'
    + '</div></div></body></html>'
  ).setTitle('License Server')
}

function _errorPage(msg) {
  return HtmlService.createHtmlOutput(
    '<html><head><meta charset="UTF-8">' + CSS + '</head>'
    + '<body><div class="container"><div class="card" style="text-align:center;padding:48px 24px">'
    + '<div style="font-size:48px;margin-bottom:16px">🚫</div>'
    + '<h2 style="color:#dc2626;margin-bottom:12px">Không thể kích hoạt</h2>'
    + '<p style="color:#6b7280">' + msg + '</p>'
    + '</div></div></body></html>'
  ).setTitle('Lỗi kích hoạt')
}

function _confirmRemovePage(email) {
  var url = ScriptApp.getService().getUrl()
  return HtmlService.createHtmlOutput(
    '<html><head><meta charset="UTF-8">' + CSS + '</head>'
    + '<body><div class="container"><div class="card confirm-box">'
    + '<h3>⚠️ Xác nhận xóa email</h3>'
    + '<p>Bạn có chắc muốn xóa <b>' + email + '</b> khỏi whitelist?</p>'
    + '<div style="display:flex;gap:10px;justify-content:center">'
    + '<form method="post" action="' + url + '"><input type="hidden" name="action" value="remove"><input type="hidden" name="email" value="' + email + '"><input type="hidden" name="confirm" value="yes"><button type="submit" class="btn btn-danger">Xóa</button></form>'
    + '<a href="' + url + '" class="btn btn-secondary">Hủy</a>'
    + '</div></div></div></body></html>'
  ).setTitle('Xác nhận xóa')
}

function _confirmRemoveAdminPage(email) {
  var url = ScriptApp.getService().getUrl()
  return HtmlService.createHtmlOutput(
    '<html><head><meta charset="UTF-8">' + CSS + '</head>'
    + '<body><div class="container"><div class="card confirm-box">'
    + '<h3>⚠️ Xác nhận xóa admin</h3>'
    + '<p>Bạn có chắc muốn xóa admin <b>' + email + '</b>?</p>'
    + '<div style="display:flex;gap:10px;justify-content:center">'
    + '<form method="post" action="' + url + '"><input type="hidden" name="action" value="remove-admin"><input type="hidden" name="email" value="' + email + '"><input type="hidden" name="confirm" value="yes"><button type="submit" class="btn btn-danger">Xóa</button></form>'
    + '<a href="' + url + '?tab=admins" class="btn btn-secondary">Hủy</a>'
    + '</div></div></div></body></html>'
  ).setTitle('Xác nhận xóa admin')
}

function _renderPage(tab, msg, search, adminInfo) {
  var admin = adminInfo.email
  var isOwner = adminInfo.role === 'owner'
  var url = ScriptApp.getService().getUrl()

  // Non-owner cannot access admins tab
  if (tab === 'admins' && !isOwner) tab = 'whitelist'

  var msgHtml = ''
  if (msg) {
    var cls = msg.indexOf('❌') >= 0 ? 'alert-error' : (msg.indexOf('⚠️') >= 0 ? 'alert-warn' : 'alert-success')
    msgHtml = '<div class="alert ' + cls + '">' + msg + '</div>'
  }

  var tabsHtml = '<div class="tabs">'
    + '<a class="tab' + (tab === 'whitelist' ? ' active' : '') + '" href="' + url + '?tab=whitelist">📋 Whitelist</a>'
    + '<a class="tab' + (tab === 'logs' ? ' active' : '') + '" href="' + url + '?tab=logs">📝 Audit Logs</a>'
    + (isOwner ? '<a class="tab' + (tab === 'admins' ? ' active' : '') + '" href="' + url + '?tab=admins">👤 Admins</a>' : '')
    + '</div>'

  var content = ''
  if (tab === 'whitelist') content = _renderWhitelist(url, admin, search)
  else if (tab === 'logs') content = _renderLogs(url, search)
  else if (tab === 'admins') content = _renderAdmins(url, admin)

  return HtmlService.createHtmlOutput(
    '<html><head><meta charset="UTF-8">' + CSS + '</head>'
    + '<body><div class="container">'
    + '<div class="header"><h1>🔑 License Server</h1>'
    + '<p>Đăng nhập: ' + admin + ' &nbsp; <a href="' + url + '?action=logout" style="color:#dc2626;font-size:12px;text-decoration:none">Đăng xuất ↗</a></p>'
    + '</div>'
    + '<div class="card">'
    + tabsHtml + msgHtml + content
    + '</div></div></body></html>'
  ).setTitle('License Server')
}

function _renderWhitelist(url, admin, search) {
  var list = []
  var err = ''
  try { list = _getAllEmails() } catch(e) { err = e.message }
  if (err) return '<div class="alert alert-error">' + err + '</div>'

  var filtered = list
  if (search) {
    var s = search.toLowerCase()
    filtered = list.filter(function(r) {
      return r.email.indexOf(s) >= 0 || (r.note && r.note.toLowerCase().indexOf(s) >= 0)
    })
  }

  var filterHtml = '<form method="get" action="' + url + '" class="filter-bar">'
    + '<input type="hidden" name="tab" value="whitelist">'
    + '<input type="text" name="search" placeholder="🔍 Tìm email hoặc ghi chú..." value="' + (search || '') + '">'
    + '<button type="submit" class="btn btn-primary btn-sm">Tìm</button>'
    + (search ? '<a href="' + url + '?tab=whitelist" class="btn btn-secondary btn-sm">Xóa lọc</a>' : '')
    + '</form>'

  var stats = '<div style="margin-bottom:12px">'
    + '<span class="stat">Tổng: <b>' + list.length + '</b></span>'
    + (search ? '<span class="stat">Kết quả: <b>' + filtered.length + '</b></span>' : '')
    + '</div>'

  var rows = ''
  if (!filtered.length) {
    rows = '<tr><td colspan="5" class="empty">Không có dữ liệu</td></tr>'
  } else {
    filtered.forEach(function(item, i) {
      rows += '<tr>'
        + '<td>' + (i + 1) + '</td>'
        + '<td><b>' + item.email + '</b></td>'
        + '<td><span class="badge badge-blue">' + (item.app || '*') + '</span></td>'
        + '<td style="font-size:12px;color:#6b7280">' + (item.date || '') + '</td>'
        + '<td style="font-size:12px;color:#6b7280">' + (item.note || '') + '</td>'
        + '<td style="text-align:center">'
        + '<form method="post" action="' + url + '" style="display:inline">'
        + '<input type="hidden" name="action" value="confirm-remove">'
        + '<input type="hidden" name="email" value="' + item.email + '">'
        + '<button type="submit" class="btn btn-danger btn-sm">✕</button>'
        + '</form></td></tr>'
    })
  }

  var table = '<table><tr><th>#</th><th>Email</th><th>App</th><th>Ngày thêm</th><th>Ghi chú</th><th style="width:50px"></th></tr>' + rows + '</table>'

  var addForm = '<form method="post" action="' + url + '" style="margin-top:20px">'
    + '<div class="form-row">'
    + '<input type="email" name="email" placeholder="email@example.com" required>'
    + '<input type="text" name="app" placeholder="App (vd: docmgr)" style="max-width:140px">'
    + '<input type="text" name="note" placeholder="Ghi chú" style="max-width:160px">'
    + '<input type="hidden" name="action" value="add">'
    + '<button type="submit" class="btn btn-primary">Thêm</button>'
    + '</div></form>'

  return filterHtml + stats + table + addForm
}

function _renderLogs(url, search) {
  var logs = []
  try { logs = _getRecentLogs(100) } catch(e) { return '<div class="alert alert-error">' + e.message + '</div>' }

  var filtered = logs
  if (search) {
    var s = search.toLowerCase()
    filtered = logs.filter(function(r) {
      return (r.email && r.email.toLowerCase().indexOf(s) >= 0)
        || (r.action && r.action.toLowerCase().indexOf(s) >= 0)
        || (r.detail && r.detail.toLowerCase().indexOf(s) >= 0)
    })
  }

  var filterHtml = '<form method="get" action="' + url + '" class="filter-bar">'
    + '<input type="hidden" name="tab" value="logs">'
    + '<input type="text" name="search" placeholder="🔍 Tìm theo email, hành động..." value="' + (search || '') + '">'
    + '<button type="submit" class="btn btn-primary btn-sm">Tìm</button>'
    + (search ? '<a href="' + url + '?tab=logs" class="btn btn-secondary btn-sm">Xóa lọc</a>' : '')
    + '</form>'

  var rows = ''
  if (!filtered.length) {
    rows = '<tr><td colspan="4" class="empty">Chưa có log nào</td></tr>'
  } else {
    filtered.forEach(function(log) {
      var badgeCls = 'badge-gray'
      if (log.action.indexOf('thành công') >= 0 || log.action.indexOf('Thêm') >= 0) badgeCls = 'badge-green'
      else if (log.action.indexOf('từ chối') >= 0 || log.action.indexOf('Xóa') >= 0) badgeCls = 'badge-red'

      rows += '<tr>'
        + '<td style="font-size:12px;color:#6b7280;white-space:nowrap">' + (log.time || '') + '</td>'
        + '<td>' + (log.email || '') + '</td>'
        + '<td><span class="badge ' + badgeCls + '">' + (log.action || '') + '</span></td>'
        + '<td style="font-size:12px;color:#6b7280;max-width:200px;overflow:hidden;text-overflow:ellipsis">' + (log.detail || '') + '</td>'
        + '</tr>'
    })
  }

  return filterHtml
    + '<div style="margin-bottom:12px"><span class="stat">Hiển thị: <b>' + filtered.length + '</b> / ' + logs.length + ' logs gần nhất</span></div>'
    + '<table><tr><th>Thời gian</th><th>Email</th><th>Hành động</th><th>Chi tiết</th></tr>' + rows + '</table>'
}

function _renderAdmins(url, currentAdmin) {
  var admins = []
  try { admins = _getAllAdmins() } catch(e) { return '<div class="alert alert-error">' + e.message + '</div>' }

  var rows = ''
  if (!admins.length) {
    rows = '<tr><td colspan="5" class="empty">Chưa có admin nào</td></tr>'
  } else {
    admins.forEach(function(a, i) {
      var isSelf = (a.email === currentAdmin)
      var roleBadge = a.role === 'owner'
        ? '<span class="badge badge-green">owner</span>'
        : '<span class="badge badge-gray">admin</span>'
      rows += '<tr>'
        + '<td>' + (i + 1) + '</td>'
        + '<td><b>' + a.email + '</b>' + (isSelf ? ' <span class="badge badge-blue">Bạn</span>' : '') + '</td>'
        + '<td>' + roleBadge + '</td>'
        + '<td style="font-size:12px;color:#6b7280">' + (a.date || '') + '</td>'
        + '<td style="text-align:center">'
        + (isSelf || a.role === 'owner' ? '' : '<form method="post" action="' + url + '" style="display:inline"><input type="hidden" name="action" value="confirm-remove-admin"><input type="hidden" name="email" value="' + a.email + '"><button type="submit" class="btn btn-danger btn-sm">✕</button></form>')
        + '</td></tr>'
    })
  }

  return '<table><tr><th>#</th><th>Email</th><th>Role</th><th>Ngày thêm</th><th style="width:50px"></th></tr>' + rows + '</table>'
    + '<form method="post" action="' + url + '" style="margin-top:20px">'
    + '<div class="form-row">'
    + '<input type="email" name="email" placeholder="admin@example.com" required>'
    + '<input type="password" name="password" placeholder="Mật khẩu" required style="max-width:160px">'
    + '<input type="hidden" name="action" value="add-admin">'
    + '<button type="submit" class="btn btn-primary">Thêm admin</button>'
    + '</div></form>'
    + '<p style="color:#9ca3af;font-size:12px;margin-top:12px">💡 Chỉ Owner mới quản lý được admin. Admin mới cần mật khẩu để đăng nhập.</p>'
}

// ── Node.js export (cho local debug — GAS bỏ qua) ───────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { doGet: doGet, doPost: doPost, _hashPassword: _hashPassword }
}
