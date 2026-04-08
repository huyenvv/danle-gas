// ===== License Server SPA (Vanilla JS) =====
//
// Single-Page App in GAS
// Backend: Pure data APIs (JSON)
// Frontend: Vanilla JS + google.script.run callbacks (no reload)

// ── Constants ────────────────────────────────────────────────────────────────

var TAB_WHITELIST = 'Whitelist'
var TAB_LOGS      = 'Audit Logs'
var TAB_ADMINS    = 'Admins'

var WL_HEADERS  = ['Email', 'App', 'Ver', 'Ngày thêm', 'Thêm bởi', 'Ghi chú']
var LOG_HEADERS = ['Thời gian', 'Email', 'Hành động', 'Chi tiết', 'IP/User']
var ADM_HEADERS = ['Email', 'Password Hash', 'Role', 'Ngày thêm']

// ── Entry: doGet → Serve SPA ─────────────────────────────────────────────────

function doGet(e) {
  var p = e && e.parameter ? e.parameter : {}

  // Activation flow (không cần login admin)
  if (p.scriptId && p.callback) {
    return _handleActivation(p)
  }

  // Serve SPA (index.html with embedded JS) — no sheet ops here, keep fast
  return _html(_getIndexHtml()).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

function doPost(e) {
  // Legacy support: activation fallback (normally handled in doGet)
  var p = e && e.parameter ? e.parameter : {}
  if (p.scriptId && p.callback) {
    return _handleActivation(p)
  }
  return _html('{"error":"Invalid request"}')
}

// ── Activation Flow ──────────────────────────────────────────────────────────

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

function _handleActivation(params) {
  var scriptId    = params.scriptId || ''
  var callbackUrl = params.callback || ''
  var app         = params.app || ''
  var ver         = params.ver || ''

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

// ── Frontend: Load SPA HTML ──────────────────────────────────────────────────

function _getIndexHtml() {
  return _SPA_HTML
}

// ── Google Script Runtime APIs (exposed to client) ──────────────────────────

/**
 * @return {Object} {user: {email, role}, emails: [], logs: [], admins: []}
 */
function getInitData() {
  // Read admins ONCE (avoid redundant sheet reads for speed)
  var currentEmail = (Session.getActiveUser().getEmail() || '').toLowerCase()
  var admins = _getAllAdmins()

  // First run: auto-create owner
  if (admins.length === 0 && currentEmail) {
    _addAdmin(currentEmail, '', 'owner')
    admins = [{ email: currentEmail, passwordHash: '', role: 'owner', date: '' }]
  }

  var adminInfo = null
  for (var i = 0; i < admins.length; i++) {
    if (admins[i].email === currentEmail) { adminInfo = admins[i]; break }
  }

  if (!adminInfo) {
    return { user: null, needsLogin: false }
  }

  if (adminInfo.role === 'owner') {
    _login()
    return { user: { email: adminInfo.email, role: adminInfo.role }, needsLogin: false }
  }

  // Admin thường: cần nhập mật khẩu
  return { user: null, needsLogin: true }
}

/**
 * Load data (lazy — called after UI skeleton renders)
 * @return {Object} {emails: [], logs: [], admins: []}
 */
function loadData() {
  if (!_isLoggedIn()) {
    return { error: 'Phiên hết hạn. Vui lòng tải lại trang.' }
  }

  try {
    var wlRows = _getTabValues(TAB_WHITELIST, WL_HEADERS)
    var logRows = _getTabValues(TAB_LOGS, LOG_HEADERS)
    var admRows = _getTabValues(TAB_ADMINS, ADM_HEADERS)

    // Parse whitelist
    var emails = []
    for (var i = 1; i < wlRows.length; i++) {
      var r = wlRows[i]
      var email = String(r[0] || '').trim().toLowerCase()
      if (email) {
        emails.push({ email: email, app: String(r[1] || '').trim(), ver: String(r[2] || '').trim(), date: r[3] || '', addedBy: r[4] || '', note: r[5] || '' })
      }
    }

    // Parse logs (last 100, reversed)
    var logs = []
    var logStart = Math.max(1, logRows.length - 100)
    for (var j = logRows.length - 1; j >= logStart; j--) {
      var l = logRows[j]
      logs.push({ time: l[0] || '', email: l[1] || '', action: l[2] || '', detail: l[3] || '', ip: l[4] || '' })
    }

    // Parse admins (without passwordHash)
    var admins = []
    for (var k = 1; k < admRows.length; k++) {
      var a = admRows[k]
      var admEmail = String(a[0] || '').trim().toLowerCase()
      if (admEmail) {
        admins.push({ email: admEmail, role: String(a[2] || 'admin').trim().toLowerCase(), date: a[3] || '' })
      }
    }

    return { emails: emails, logs: logs, admins: admins }
  } catch(e) {
    return { error: 'loadData lỗi: ' + (e.message || String(e)) }
  }
}

function _getTabValues(name, headers) {
  var sheet = _getTab(name, headers)
  var last = sheet.getLastRow()
  if (last < 1) return []
  return sheet.getRange(1, 1, last, headers.length).getDisplayValues()
}

/**
 * Login with password
 * @return {Object} {success, user, error, emails, logs, admins}
 */
function onLogin(password) {
  var adminInfo = _getAdminInfo()
  if (!adminInfo) {
    return { success: false, error: 'Bạn không phải admin.' }
  }

  // Owner auto-logins in getInitData, but handle as fallback
  if (adminInfo.role === 'owner') {
    _login()
    return { success: true, user: { email: adminInfo.email, role: adminInfo.role } }
  }

  if (!adminInfo.passwordHash || _hashPassword(password) !== adminInfo.passwordHash) {
    _writeLog(adminInfo.email, 'Login thất bại', 'Sai mật khẩu')
    return { success: false, error: 'Mật khẩu không đúng.' }
  }

  _login()
  _writeLog(adminInfo.email, 'Đăng nhập', '')
  return { success: true, user: { email: adminInfo.email, role: adminInfo.role } }
}

/**
 * Add email to whitelist
 * @return {Object} {success, addedEmail, error, emails, logs}
 */
function onAddEmail(email, app, ver, note) {
  if (!_isLoggedIn()) {
    return { success: false, error: 'Phiên hết hạn. Vui lòng đăng nhập lại.' }
  }

  email = (email || '').trim().toLowerCase()
  app = (app || '').trim()
  ver = (ver || '').trim()
  note = (note || '').trim()

  if (!email) {
    return { success: false, error: 'Email không được để trống.' }
  }

  if (_exactEntryExists(email, app, ver)) {
    var detail = email + (app ? ' (app: ' + app + ')' : ' (tất cả app)') + (ver ? ' (ver: ' + ver + ')' : ' (tất cả ver)')
    return { success: false, error: detail + ' đã có trong danh sách.' }
  }

  var adminInfo = _getAdminInfo()
  _addEmail(email, app, ver, adminInfo.email, note)
  _writeLog(adminInfo.email, 'Thêm email', email + (app ? ' [' + app + ']' : '') + (ver ? ' [' + ver + ']' : '') + (note ? ' (' + note + ')' : ''))

  return {
    success: true,
    addedEmail: email,
    emails: _getAllEmails(),
    logs: _getRecentLogs(100)
  }
}

/**
 * Remove email from whitelist
 * @return {Object} {success, emails, logs}
 */
function onRemoveEmail(email) {
  if (!_isLoggedIn()) {
    return { success: false, error: 'Phiên hết hạn.' }
  }

  email = (email || '').trim().toLowerCase()
  var adminInfo = _getAdminInfo()
  _removeEmail(email)
  _writeLog(adminInfo.email, 'Xóa email', email)

  return {
    success: true,
    emails: _getAllEmails(),
    logs: _getRecentLogs(100)
  }
}

/**
 * Add admin (owner only)
 * @return {Object} {success, addedEmail, error, admins, logs}
 */
function onAddAdmin(email, password) {
  if (!_isLoggedIn()) {
    return { success: false, error: 'Phiên hết hạn.' }
  }

  var adminInfo = _getAdminInfo()
  if (adminInfo.role !== 'owner') {
    return { success: false, error: 'Chỉ owner mới có quyền này.' }
  }

  email = (email || '').trim().toLowerCase()
  if (!email) {
    return { success: false, error: 'Email không được để trống.' }
  }

  if (_adminExists(email)) {
    return { success: false, error: 'Admin ' + email + ' đã tồn tại.' }
  }

  if (!password) {
    return { success: false, error: 'Vui lòng nhập mật khẩu.' }
  }

  _addAdmin(email, _hashPassword(password), 'admin')
  _writeLog(adminInfo.email, 'Thêm admin', email)

  return {
    success: true,
    addedEmail: email,
    admins: _getAllAdmins(),
    logs: _getRecentLogs(100)
  }
}

/**
 * Remove admin (owner only)
 * @return {Object} {success, admins, logs}
 */
function onRemoveAdmin(email) {
  if (!_isLoggedIn()) {
    return { success: false, error: 'Phiên hết hạn.' }
  }

  var adminInfo = _getAdminInfo()
  if (adminInfo.role !== 'owner') {
    return { success: false, error: 'Chỉ owner mới có quyền này.' }
  }

  email = (email || '').trim().toLowerCase()
  _removeAdmin(email)
  _writeLog(adminInfo.email, 'Xóa admin', email)

  return {
    success: true,
    admins: _getAllAdmins(),
    logs: _getRecentLogs(100)
  }
}

/**
 * Logout
 */
function onLogout() {
  var adminInfo = _getAdminInfo()
  if (adminInfo) {
    _writeLog(adminInfo.email, 'Đăng xuất', '')
  }
  _logout()
  return { success: true }
}

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
  var data = sheet.getRange(2, 1, last - 1, WL_HEADERS.length).getDisplayValues()
  return data.map(function(r) {
    return { email: String(r[0]).trim().toLowerCase(), app: String(r[1] || '').trim(), ver: String(r[2] || '').trim(), date: r[3] || '', addedBy: r[4] || '', note: r[5] || '' }
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

function _exactEntryExists(email, app, ver) {
  var list = _getAllEmails()
  email = email.toLowerCase()
  var appNorm = (app || '*').toLowerCase()
  var verNorm = (ver || '*').toLowerCase()
  return list.some(function(r) {
    return r.email === email && (r.app || '*').toLowerCase() === appNorm && (r.ver || '*').toLowerCase() === verNorm
  })
}

function _addEmail(email, app, ver, addedBy, note) {
  var sheet = _getTab(TAB_WHITELIST, WL_HEADERS)
  var now = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm')
  sheet.appendRow([email.toLowerCase(), app || '*', ver || '*', now, addedBy, note])
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
  var data = sheet.getRange(2, 1, last - 1, ADM_HEADERS.length).getDisplayValues()
  return data.map(function(r) {
    return {
      email: String(r[0]).trim().toLowerCase(),
      passwordHash: String(r[1] || '').trim(),
      role: String(r[2] || 'admin').trim().toLowerCase(),
      date: r[3] || ''
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

function _ensureOwnerExists() {
  var admins = _getAllAdmins()
  // If no admins exist, auto-create owner for current user
  if (admins.length === 0) {
    var user = Session.getActiveUser().getEmail()
    if (user) {
      _addAdmin(user.toLowerCase(), '', 'owner')
    }
  }
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
  var data = sheet.getRange(startRow, 1, count, LOG_HEADERS.length).getDisplayValues()
  return data.map(function(r) {
    return { time: r[0] || '', email: r[1] || '', action: r[2] || '', detail: r[3] || '', ip: r[4] || '' }
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

// Wrapper: always allow embedding inside GAS iframe (removes X-Frame-Options restriction)
function _html(content) {
  return HtmlService.createHtmlOutput(content)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

function _silentRedirect(url, errorCode) {
  if (errorCode && url) {
    var sep = url.indexOf('?') >= 0 ? '&' : '?'
    url = url + sep + 'lr=' + encodeURIComponent(errorCode)
  }
  if (!url) {
    return _html('<html><body></body></html>')
  }
  var safeUrl = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  var isError = !!errorCode
  var icon = isError ? '❌' : '✅'
  var title = isError ? 'Kích hoạt thất bại' : 'Kích hoạt thành công'
  var msg = isError ? 'Không thể kích hoạt ứng dụng.' : 'Nhấn nút bên dưới để quay lại ứng dụng.'
  var btnText = isError ? 'Quay lại' : 'Tiếp tục →'

  return _html(
    '<html><head><meta charset="UTF-8"><base target="_top"><style>'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f0f2f5;display:flex;align-items:center;justify-content:center;min-height:100vh}'
    + '.box{text-align:center;background:#fff;padding:48px 32px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:400px}'
    + '.icon{font-size:48px;margin-bottom:16px}'
    + 'h2{color:#1a56db;margin-bottom:8px}'
    + 'p{color:#6b7280;margin-bottom:24px}'
    + '.btn{display:inline-block;padding:14px 32px;background:#1a56db;color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:500;transition:background .15s}'
    + '.btn:hover{background:#1e40af}'
    + '</style></head><body><div class="box">'
    + '<div class="icon">' + icon + '</div>'
    + '<h2>' + title + '</h2>'
    + '<p>' + msg + '</p>'
    + '<a class="btn" href="' + safeUrl + '">' + btnText + '</a>'
    + '</div></body></html>'
  )
}

// ── Embedded SPA HTML ────────────────────────────────────────────────────────

var _SPA_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>License Server</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f0f2f5;color:#1a1a2e;min-height:100vh}
    .container{max-width:720px;margin:0 auto;padding:24px 16px}
    .card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);padding:24px;margin-bottom:20px}
    .header{text-align:center;padding:32px 0 16px}
    .header h1{font-size:22px;color:#1a56db;margin-bottom:4px}
    .header p{color:#6b7280;font-size:13px}
    .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
    .badge-blue{background:#dbeafe;color:#1d4ed8}
    .badge-green{background:#dcfce7;color:#15803d}
    .badge-red{background:#fee2e2;color:#dc2626}
    .badge-gray{background:#f3f4f6;color:#6b7280}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;padding:10px 12px;background:#f8fafc;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #e2e8f0}
    td{padding:10px 12px;border-bottom:1px solid #f1f5f9}
    tr:hover td{background:#f8fafc}
    .btn{padding:8px 16px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;transition:all .15s}
    .btn-primary{background:#1a56db;color:#fff}.btn-primary:hover{background:#1e40af}
    .btn-danger{background:#fee2e2;color:#dc2626}.btn-danger:hover{background:#fecaca}
    .btn-secondary{background:#f3f4f6;color:#374151;text-decoration:none;display:inline-block;border:none;cursor:pointer}.btn-secondary:hover{background:#e5e7eb}
    .btn-sm{padding:4px 10px;font-size:12px;border-radius:6px}
    input[type=email],input[type=text],input[type=password],select{padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;width:100%;outline:none;transition:border .15s}
    input:focus,select:focus{border-color:#1a56db;box-shadow:0 0 0 3px rgba(26,86,219,.1)}
    .form-row{display:flex;gap:8px;margin-top:16px}
    .form-row input{flex:1}
    .alert{padding:12px 16px;border-radius:8px;font-size:13px;margin-bottom:16px}
    .alert-success{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
    .alert-error{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
    .alert-warn{background:#fffbeb;color:#b45309;border:1px solid #fde68a}
    .tabs{display:flex;gap:4px;margin-bottom:20px;border-bottom:2px solid #e5e7eb;padding-bottom:0}
    .tab{padding:8px 16px;font-size:13px;font-weight:500;color:#6b7280;text-decoration:none;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s;cursor:pointer;background:none;border:none}
    .tab:hover{color:#1a56db}
    .tab.active{color:#1a56db;border-bottom-color:#1a56db}
    .filter-bar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
    .filter-bar input,.filter-bar select{width:auto;flex:1;min-width:140px}
    .empty{text-align:center;padding:32px;color:#9ca3af}
    .stat{display:inline-block;margin-right:16px;font-size:13px;color:#6b7280}
    .stat b{color:#1a1a2e}
    .confirm-box{text-align:center;padding:20px}
    .confirm-box h3{color:#dc2626;margin-bottom:8px}
    .confirm-box p{color:#6b7280;margin-bottom:20px}
    .spinner{display:inline-block;width:16px;height:16px;border:2px solid #e5e7eb;border-top-color:#1a56db;border-radius:50%;animation:spin 1s linear infinite;margin-right:8px;vertical-align:middle}
    @keyframes spin{to{transform:rotate(360deg)}}
    .hidden{display:none}
    button:disabled,input:disabled,.btn:disabled{opacity:.5;cursor:not-allowed;pointer-events:none}
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    let state = {
      currentUser: null,
      currentTab: 'whitelist',
      emails: [],
      logs: [],
      admins: [],
      message: '',
      messageType: '',
      loading: false,
      loadingData: false,
      initializing: true,
      needsLogin: false,
      showConfirm: null,
      searchQuery: ''
    }

    window.addEventListener('load', function() {
      render() // show loading screen immediately
      google.script.run
        .withSuccessHandler(onInit)
        .withFailureHandler(onInitError)
        .getInitData()
    })

    function onInit(data) {
      data = data || {}
      state.initializing = false
      state.currentUser = data.user || null
      state.needsLogin = data.needsLogin || false
      state.message = ''
      state.messageType = ''

      if (state.currentUser) {
        // Show UI skeleton immediately, load data in background
        state.loadingData = true
        render()
        google.script.run
          .withSuccessHandler(onDataLoaded)
          .withFailureHandler(onDataError)
          .loadData()
      } else {
        render()
      }
    }

    function onDataLoaded(data) {
      data = data || {}
      if (data.error) {
        state.message = '⚠️ ' + data.error
        state.messageType = 'warn'
      } else {
        state.emails = data.emails || []
        state.logs = data.logs || []
        state.admins = data.admins || []
      }
      state.loadingData = false
      render()
    }

    function onDataError(err) {
      state.loadingData = false
      state.message = '❌ Không tải được dữ liệu: ' + (err && err.message ? err.message : String(err))
      state.messageType = 'error'
      render()
    }

    function onInitError(err) {
      state.initializing = false
      state.currentUser = null
      state.message = '❌ Không tải được dữ liệu khởi tạo. Vui lòng tải lại trang.'
      state.messageType = 'error'
      render()
      if (typeof console !== 'undefined' && console.error) {
        console.error('getInitData failed:', err)
      }
    }

    function render() {
      const app = document.getElementById('app')

      if (state.initializing) {
        app.innerHTML = \`
          <div class="container">
            <div class="card" style="text-align:center;padding:60px 32px;max-width:400px;margin:60px auto">
              <div style="font-size:48px;margin-bottom:16px">🔑</div>
              <h2 style="margin-bottom:12px;color:#1a56db">License Server</h2>
              <p style="color:#6b7280"><span class="spinner"></span>Đang kết nối...</p>
            </div>
          </div>
        \`
        return
      }

      if (!state.currentUser) {
        if (state.needsLogin) {
          app.innerHTML = loginPageHtml()
          document.querySelector('#login-form')?.addEventListener('submit', handleLoginForm)
        } else if (state.message) {
          app.innerHTML = '<div class="container">' +
            '<div class="card" style="text-align:center;padding:48px 32px;max-width:400px;margin:60px auto">' +
            '<div style="font-size:48px;margin-bottom:16px">🔑</div>' +
            '<h2 style="margin-bottom:12px;color:#1a56db">License Server</h2>' +
            '<div class="alert alert-' + state.messageType + '">' + state.message + '</div>' +
            '</div></div>'
        } else {
          app.innerHTML = '' // trang trắng cho người dùng thường
        }
        return
      }

      app.innerHTML = mainPageHtml()
      
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          state.currentTab = e.target.dataset.tab
          state.searchQuery = ''
          render()
        })
      })

      if (state.currentTab === 'whitelist') {
        document.getElementById('add-email-form')?.addEventListener('submit', handleAddEmail)
        document.getElementById('search-form')?.addEventListener('submit', handleSearch)
        document.getElementById('search')?.addEventListener('input', function() {
          var val = this.value, pos = this.selectionStart
          state.searchQuery = val
          render()
          var el = document.getElementById('search')
          if (el) { el.focus(); el.setSelectionRange(pos, pos) }
        })
        document.querySelectorAll('.remove-email-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            state.showConfirm = { type: 'remove-email', email: btn.dataset.email }
            render()
          })
        })
      }

      if (state.currentTab === 'logs') {
        document.getElementById('search-logs-form')?.addEventListener('submit', handleSearchLogs)
        document.getElementById('search-logs')?.addEventListener('input', function() {
          var val = this.value, pos = this.selectionStart
          state.searchQuery = val
          render()
          var el = document.getElementById('search-logs')
          if (el) { el.focus(); el.setSelectionRange(pos, pos) }
        })
      }

      if (state.currentTab === 'admins') {
        document.getElementById('add-admin-form')?.addEventListener('submit', handleAddAdmin)
        document.querySelectorAll('.remove-admin-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            state.showConfirm = { type: 'remove-admin', email: btn.dataset.email }
            render()
          })
        })
      }

      if (state.showConfirm) {
        document.getElementById('confirm-yes')?.addEventListener('click', handleConfirm)
        document.getElementById('confirm-no')?.addEventListener('click', () => {
          state.showConfirm = null
          render()
        })
      }

      document.getElementById('logout-btn')?.addEventListener('click', handleLogout)
    }

    function loginPageHtml() {
      return \`
        <div class="container">
          <div class="card" style="text-align:center;padding:48px 32px;max-width:400px;margin:60px auto">
            <div style="font-size:48px;margin-bottom:16px">🔑</div>
            <h2 style="margin-bottom:4px">License Server</h2>
            <p style="color:#6b7280;margin-bottom:24px">Quản lý danh sách kích hoạt</p>
            \${state.message ? \`<div class="alert alert-\${state.messageType}" style="text-align:left">\${state.message}</div>\` : ''}
            <form id="login-form" style="display:flex;flex-direction:column;gap:12px">
              <input type="password" id="password" placeholder="Nhập mật khẩu (owner có thể để trống)" \${state.loading ? 'disabled' : ''}>
              <button type="submit" class="btn btn-primary" \${state.loading ? 'disabled' : ''}>\${state.loading ? '<span class="spinner"></span>Đang xử lý...' : 'Đăng nhập'}</button>
            </form>
          </div>
        </div>
      \`
    }

    function mainPageHtml() {
      const isOwner = state.currentUser?.role === 'owner'
      let content = ''
      
      if (state.loadingData) {
        content = '<div class="empty"><span class="spinner"></span> \u0110ang t\u1ea3i d\u1eef li\u1ec7u...</div>'
      } else if (state.currentTab === 'whitelist') content = renderWhitelistTab()
      else if (state.currentTab === 'logs') content = renderLogsTab()
      else if (state.currentTab === 'admins' && isOwner) content = renderAdminsTab()
      
      return \`
        <div class="container">
          <div class="header">
            <h1>🔑 License Server</h1>
            <p>Đăng nhập: \${state.currentUser.email} &nbsp; <a href="#" id="logout-btn" style="color:#dc2626;font-size:12px;text-decoration:none">\${state.loading ? '<span class="spinner"></span>' : 'Đăng xuất ↗'}</a></p>
          </div>
          <div class="card">
            <div class="tabs">
              <button class="tab tab-btn \${state.currentTab === 'whitelist' ? 'active' : ''}" data-tab="whitelist">📋 Whitelist</button>
              <button class="tab tab-btn \${state.currentTab === 'logs' ? 'active' : ''}" data-tab="logs">📝 Audit Logs</button>
              \${isOwner ? \`<button class="tab tab-btn \${state.currentTab === 'admins' ? 'active' : ''}" data-tab="admins">👤 Admins</button>\` : ''}
            </div>
            \${state.message ? \`<div class="alert alert-\${state.messageType}">\${state.message}</div>\` : ''}
            \${state.showConfirm ? renderConfirmDialog() : content}
          </div>
        </div>
      \`
    }

    function renderWhitelistTab() {
      const filtered = state.emails.filter(e => 
        e.email.includes(state.searchQuery.toLowerCase()) || 
        (e.note && e.note.toLowerCase().includes(state.searchQuery.toLowerCase()))
      )
      
      return \`
        <form id="search-form" class="filter-bar" style="margin-bottom:16px">
          <input type="text" id="search" placeholder="🔍 Tìm email hoặc ghi chú..." value="\${state.searchQuery}">
          <button type="submit" class="btn btn-primary btn-sm">Tìm</button>
          \${state.searchQuery ? \`<button type="button" class="btn btn-secondary btn-sm" onclick="state.searchQuery='';render()">Xóa lọc</button>\` : ''}
        </form>
        <div style="margin-bottom:12px">
          <span class="stat">Tổng: <b>\${state.emails.length}</b></span>
          \${state.searchQuery ? \`<span class="stat">Kết quả: <b>\${filtered.length}</b></span>\` : ''}
        </div>
        <table>
          <tr><th>#</th><th>Email</th><th>App</th><th>Ver</th><th>Ngày thêm</th><th>Ghi chú</th><th style="width:50px"></th></tr>
          \${filtered.length === 0 
            ? '<tr><td colspan="7" class="empty">Không có dữ liệu</td></tr>'
            : filtered.map((e, i) => \`
              <tr>
                <td>\${i+1}</td>
                <td><b>\${e.email}</b></td>
                <td><span class="badge badge-blue">\${e.app || '*'}</span></td>
                <td><span class="badge badge-gray">\${e.ver || '*'}</span></td>
                <td style="font-size:12px;color:#6b7280">\${e.date}</td>
                <td style="font-size:12px;color:#6b7280">\${e.note}</td>
                <td style="text-align:center"><button class="btn btn-danger btn-sm remove-email-btn" data-email="\${e.email}" \${state.loading ? 'disabled' : ''}>✕</button></td>
              </tr>
            \`).join('')
          }
        </table>
        <form id="add-email-form" style="margin-top:20px">
          <div class="form-row">
            <input type="email" id="new-email" placeholder="email@example.com" required>
            <input type="text" id="new-app" placeholder="App (vd: docmgr)" style="max-width:140px">
            <input type="text" id="new-ver" placeholder="Ver (vd: 1.0)" style="max-width:100px">
            <input type="text" id="new-note" placeholder="Ghi chú" style="max-width:140px">
            <button type="submit" class="btn btn-primary" \${state.loading ? 'disabled' : ''}>\${state.loading ? '<span class="spinner"></span>' : 'Thêm'}</button>
          </div>
        </form>
      \`
    }

    function renderLogsTab() {
      const filtered = state.logs.filter(l =>
        (l.email && l.email.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
        (l.action && l.action.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
        (l.detail && l.detail.toLowerCase().includes(state.searchQuery.toLowerCase()))
      )
      
      return \`
        <form id="search-logs-form" class="filter-bar" style="margin-bottom:16px">
          <input type="text" id="search-logs" placeholder="🔍 Tìm theo email, hành động..." value="\${state.searchQuery}">
          <button type="submit" class="btn btn-primary btn-sm">Tìm</button>
          \${state.searchQuery ? \`<button type="button" class="btn btn-secondary btn-sm" onclick="state.searchQuery='';render()">Xóa lọc</button>\` : ''}
        </form>
        <div style="margin-bottom:12px"><span class="stat">Hiển thị: <b>\${filtered.length}</b> / \${state.logs.length} logs</span></div>
        <table>
          <tr><th>Thời gian</th><th>Email</th><th>Hành động</th><th>Chi tiết</th></tr>
          \${filtered.length === 0
            ? '<tr><td colspan="4" class="empty">Chưa có log nào</td></tr>'
            : filtered.map(l => {
              const badgeCls = l.action.includes('thành công') || l.action.includes('Thêm') ? 'badge-green' : 
                             l.action.includes('từ chối') || l.action.includes('Xóa') ? 'badge-red' : 'badge-gray'
              return \`
                <tr>
                  <td style="font-size:12px;color:#6b7280;white-space:nowrap">\${l.time}</td>
                  <td>\${l.email}</td>
                  <td><span class="badge \${badgeCls}">\${l.action}</span></td>
                  <td style="font-size:12px;color:#6b7280;max-width:200px;overflow:hidden;text-overflow:ellipsis">\${l.detail}</td>
                </tr>
              \`
            }).join('')
          }
        </table>
      \`
    }

    function renderAdminsTab() {
      return \`
        <table>
          <tr><th>#</th><th>Email</th><th>Role</th><th>Ngày thêm</th><th style="width:50px"></th></tr>
          \${state.admins.length === 0
            ? '<tr><td colspan="5" class="empty">Chưa có admin nào</td></tr>'
            : state.admins.map((a, i) => {
              const isSelf = a.email === state.currentUser.email
              const badgeCls = a.role === 'owner' ? 'badge-green' : 'badge-gray'
              return \`
                <tr>
                  <td>\${i+1}</td>
                  <td><b>\${a.email}</b>\${isSelf ? ' <span class="badge badge-blue">Bạn</span>' : ''}</td>
                  <td><span class="badge \${badgeCls}">\${a.role}</span></td>
                  <td style="font-size:12px;color:#6b7280">\${a.date}</td>
                  <td style="text-align:center">\${!isSelf && a.role !== 'owner' ? \`<button class="btn btn-danger btn-sm remove-admin-btn" data-email="\${a.email}" \${state.loading ? 'disabled' : ''}>✕</button>\` : ''}</td>
                </tr>
              \`
            }).join('')
          }
        </table>
        <form id="add-admin-form" style="margin-top:20px">
          <div class="form-row">
            <input type="email" id="new-admin-email" placeholder="admin@example.com" required>
            <input type="password" id="new-admin-pass" placeholder="Mật khẩu" required style="max-width:160px">
            <button type="submit" class="btn btn-primary" \${state.loading ? 'disabled' : ''}>\${state.loading ? '<span class="spinner"></span>' : 'Thêm admin'}</button>
          </div>
        </form>
        <p style="color:#9ca3af;font-size:12px;margin-top:12px">💡 Chỉ Owner mới quản lý được admin. Admin mới cần mật khẩu để đăng nhập.</p>
      \`
    }

    function renderConfirmDialog() {
      const c = state.showConfirm
      const title = c.type === 'remove-email' ? '⚠️ Xác nhận xóa email' : '⚠️ Xác nhận xóa admin'
      const text = c.type === 'remove-email' 
        ? \`Bạn có chắc muốn xóa <b>\${c.email}</b> khỏi whitelist?\`
        : \`Bạn có chắc muốn xóa admin <b>\${c.email}</b>?\`
      
      return \`
        <div class="confirm-box">
          <h3>\${title}</h3>
          <p>\${text}</p>
          <div style="display:flex;gap:10px;justify-content:center">
            <button id="confirm-yes" class="btn btn-danger" \${state.loading ? 'disabled' : ''}>\${state.loading ? '<span class="spinner"></span>Đang xóa...' : 'Xóa'}</button>
            <button id="confirm-no" class="btn btn-secondary" \${state.loading ? 'disabled' : ''}>Hủy</button>
          </div>
        </div>
      \`
    }

    function handleLoginForm(e) {
      e.preventDefault()
      const pass = (document.getElementById('password').value || '').trim()
      state.loading = true
      state.message = ''
      render()
      google.script.run
        .withSuccessHandler(onLoginSuccess)
        .withFailureHandler(onError)
        .onLogin(pass)
    }

    function onLoginSuccess(result) {
      state.loading = false
      result = result || {}
      if (result.success) {
        state.currentUser = result.user
        state.message = '✅ Đăng nhập thành công!'
        state.messageType = 'success'
        state.loadingData = true
        render()
        setTimeout(() => { state.message = ''; render() }, 2000)
        google.script.run
          .withSuccessHandler(onDataLoaded)
          .withFailureHandler(onDataError)
          .loadData()
      } else {
        state.message = '❌ ' + result.error
        state.messageType = 'error'
        render()
      }
    }

    function handleAddEmail(e) {
      e.preventDefault()
      const email = document.getElementById('new-email').value.toLowerCase()
      const app = document.getElementById('new-app').value.trim()
      const ver = document.getElementById('new-ver').value.trim()
      const note = document.getElementById('new-note').value.trim()
      state.loading = true
      state.message = ''
      render()
      google.script.run.withSuccessHandler(onAddEmailSuccess).withFailureHandler(onError).onAddEmail(email, app, ver, note)
    }

    function onAddEmailSuccess(result) {
      state.loading = false
      result = result || {}
      if (result.success) {
        state.emails = result.emails
        state.logs = result.logs
        state.message = '✅ Đã thêm: ' + result.addedEmail
        state.messageType = 'success'
        document.getElementById('new-email').value = ''
        document.getElementById('new-app').value = ''
        document.getElementById('new-ver').value = ''
        document.getElementById('new-note').value = ''
        render()
        setTimeout(() => { state.message = ''; render() }, 2000)
      } else {
        state.message = '⚠️ ' + result.error
        state.messageType = 'warn'
        render()
      }
    }

    function handleSearch(e) {
      e.preventDefault()
      state.searchQuery = document.getElementById('search').value
      render()
    }

    function handleSearchLogs(e) {
      e.preventDefault()
      state.searchQuery = document.getElementById('search-logs').value
      render()
    }

    function handleAddAdmin(e) {
      e.preventDefault()
      const email = document.getElementById('new-admin-email').value.toLowerCase()
      const pass = document.getElementById('new-admin-pass').value
      state.loading = true
      state.message = ''
      render()
      google.script.run.withSuccessHandler(onAddAdminSuccess).withFailureHandler(onError).onAddAdmin(email, pass)
    }

    function onAddAdminSuccess(result) {
      state.loading = false
      result = result || {}
      if (result.success) {
        state.admins = result.admins
        state.logs = result.logs
        state.message = '✅ Đã thêm admin: ' + result.addedEmail
        state.messageType = 'success'
        document.getElementById('new-admin-email').value = ''
        document.getElementById('new-admin-pass').value = ''
        render()
        setTimeout(() => { state.message = ''; render() }, 2000)
      } else {
        state.message = '⚠️ ' + result.error
        state.messageType = 'warn'
        render()
      }
    }

    function handleConfirm() {
      state.loading = true
      render()
      const c = state.showConfirm
      if (c.type === 'remove-email') {
        google.script.run.withSuccessHandler(onRemoveEmailSuccess).withFailureHandler(onError).onRemoveEmail(c.email)
      } else if (c.type === 'remove-admin') {
        google.script.run.withSuccessHandler(onRemoveAdminSuccess).withFailureHandler(onError).onRemoveAdmin(c.email)
      }
    }

    function onRemoveEmailSuccess(result) {
      state.loading = false
      result = result || {}
      if (result.success) {
        state.emails = result.emails
        state.logs = result.logs
        state.showConfirm = null
        state.message = '✅ Đã xóa'
        state.messageType = 'success'
        render()
        setTimeout(() => { state.message = ''; render() }, 2000)
      }
    }

    function onRemoveAdminSuccess(result) {
      state.loading = false
      result = result || {}
      if (result.success) {
        state.admins = result.admins
        state.logs = result.logs
        state.showConfirm = null
        state.message = '✅ Đã xóa admin'
        state.messageType = 'success'
        render()
        setTimeout(() => { state.message = ''; render() }, 2000)
      }
    }

    function handleLogout(e) {
      e.preventDefault()
      state.loading = true
      render()
      google.script.run.withSuccessHandler(onLogoutSuccess).withFailureHandler(onError).onLogout()
    }

    function onLogoutSuccess() {
      state.loading = false
      state.currentUser = null
      state.message = '👋 Đã đăng xuất'
      state.messageType = 'success'
      render()
      setTimeout(() => {
        state.message = ''
        state.searchQuery = ''
        state.currentTab = 'whitelist'
        render()
      }, 1000)
    }

    function onError(err) {
      state.loading = false
      state.message = '❌ Lỗi: ' + (err && err.message ? err.message : String(err))
      state.messageType = 'error'
      render()
    }
  </script>
</body>
</html>`

// ── Node.js export ──────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { doGet: doGet, doPost: doPost, loadData: loadData, _hashPassword: _hashPassword }
}
