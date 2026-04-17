// ===== SSO cross-app token validation =====

var SSO_TOKEN_TTL = 86400 // 24 hours in seconds

/**
 * Validate SSO token against parent sheet's _Người Dùng.
 * Returns user object if valid, null otherwise.
 */
function ssoValidateToken(email, token) {
  var parentId = ssoGetParentSheetId()
  if (!parentId) return null

  var ss = SpreadsheetApp.openById(parentId)
  var sheet = ss.getSheetByName('_Người Dùng')
  if (!sheet || sheet.getLastRow() < 2) return null

  var data = sheet.getDataRange().getValues()
  var headers = data[0]
  var emailCol = headers.indexOf('Email')
  var tokenCol = headers.indexOf('SSO_Token')
  var expiryCol = headers.indexOf('SSO_Expiry')
  if (emailCol === -1 || tokenCol === -1 || expiryCol === -1) return null

  var nowMs = new Date().getTime()

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][emailCol] || '').toLowerCase()
    var rowToken = String(data[i][tokenCol] || '')
    var rowExpiry = Number(data[i][expiryCol]) || 0

    if (rowEmail === email.toLowerCase() && rowToken === token && rowExpiry > nowMs) {
      var user = {}
      headers.forEach(function(h, col) { user[h] = data[i][col] })
      return user
    }
  }
  return null
}

/**
 * Read parent sheet ID from ScriptProperties.
 */
function ssoGetParentSheetId() {
  return getConfig('SSO_PARENT_SHEET_ID') || ''
}

/**
 * Store parent sheet ID — only accepts first write, rejects changes.
 */
function ssoStoreParentSheetId(sheetId) {
  if (!sheetId) return
  var current = getConfig('SSO_PARENT_SHEET_ID')
  if (current && current !== sheetId) return // reject change
  if (!current) {
    setConfig('SSO_PARENT_SHEET_ID', sheetId)
  }
}

/**
 * Validate password against security policy.
 * Returns error message string or empty string if valid.
 */
function validatePasswordPolicy(password) {
  if (!password || password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự'
  if (!/[A-Z]/.test(password)) return 'Mật khẩu phải có ít nhất 1 chữ hoa (A-Z)'
  if (!/[a-z]/.test(password)) return 'Mật khẩu phải có ít nhất 1 chữ thường (a-z)'
  if (!/[0-9]/.test(password)) return 'Mật khẩu phải có ít nhất 1 số (0-9)'
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%^&*...)'
  return ''
}
