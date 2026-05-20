// ===== SSO cross-app token validation =====

var SSO_TOKEN_TTL = 86400 // 24 hours in seconds
var SSO_VALIDATE_CACHE_TTL = 600 // 10 minutes — cross-script openById is expensive

/**
 * Cache key for a validated (email, token) pair. Includes parent sheet ID
 * to scope cache per portal in case multiple portals exist.
 */
function _ssoValidateCacheKey(parentId, email, token) {
  return 'ssoval_' + parentId + '_' + String(email).toLowerCase() + '_' + token
}

/**
 * Validate SSO token against parent sheet's _Người Dùng.
 * Returns user object if valid, null otherwise.
 *
 * Cached for SSO_VALIDATE_CACHE_TTL seconds to avoid repeated openById
 * + getDataRange on the parent sheet. Cache window is short enough that
 * a logout/expiry on the portal side propagates within ~10 minutes.
 */
function ssoValidateToken(email, token) {
  var parentId = ssoGetParentSheetId()
  if (!parentId) return null

  var cacheKey = _ssoValidateCacheKey(parentId, email, token)
  var cached = cacheGet(cacheKey)
  if (cached) return cached

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
      // Only cache up to min(remaining lifetime, configured TTL) — never serve a stale-expired token
      var remainingSec = Math.floor((rowExpiry - nowMs) / 1000)
      var ttl = Math.max(60, Math.min(SSO_VALIDATE_CACHE_TTL, remainingSec))
      cachePut(cacheKey, user, ttl)
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
