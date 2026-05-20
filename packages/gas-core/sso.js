// ===== SSO helpers =====

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
