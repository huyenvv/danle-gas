// ===== License module =====

var LICENSE_KEY = 'LICENSE_ACTIVATED'
var LICENSE_TOKEN_KEY = 'LICENSE_TOKEN'

// Build-time injected (encoded) — replaced by bundle-server.js
var __ENCODED_LICENSE_URL = '__ENCODED_LICENSE_URL__'
var __ENCODED_SECRET_SALT = '__ENCODED_SECRET_SALT__'
var __APP_ID = '__APP_ID__'
var __APP_VERSION = '__APP_VERSION__'

function _decode(enc) {
  var b64 = enc.split('').reverse().join('')
  var bytes = Utilities.base64Decode(b64)
  return Utilities.newBlob(bytes).getDataAsString()
}

function _verifyToken() {
  var token = getConfig(LICENSE_TOKEN_KEY)
  if (!token) return false

  var salt = _decode(__ENCODED_SECRET_SALT)
  if (!salt) return false

  var expected = _sha256(ScriptApp.getScriptId() + __APP_ID + salt)
  return token === expected
}

function checkLicense() {
  if (getConfig(LICENSE_KEY) !== 'true') return false

  // Re-verify stored token against current scriptId + salt
  if (!_verifyToken()) {
    // Token invalid or missing — revoke
    setConfig(LICENSE_KEY, '')
    setConfig(LICENSE_TOKEN_KEY, '')
    return false
  }
  return true
}

function activateWithToken(tokenParam) {
  if (checkLicense()) return { activated: true, alreadyActivated: true }

  var salt = _decode(__ENCODED_SECRET_SALT)
  if (!salt) throw new Error('Configuration error')

  var scriptId = ScriptApp.getScriptId()
  var expected = _sha256(scriptId + __APP_ID + salt)

  if (tokenParam !== expected) throw new Error('Invalid token')

  setConfig(LICENSE_KEY, 'true')
  setConfig(LICENSE_TOKEN_KEY, tokenParam)

  return { activated: true }
}

function getLicenseServerUrl() {
  return _decode(__ENCODED_LICENSE_URL)
}

function getActivationRedirectUrl() {
  var serverUrl = getLicenseServerUrl()
  if (!serverUrl) throw new Error('License server not configured')

  var scriptId = ScriptApp.getScriptId()
  var callbackUrl = ScriptApp.getService().getUrl()

  return serverUrl
    + '?scriptId=' + encodeURIComponent(scriptId)
    + '&callback=' + encodeURIComponent(callbackUrl)
    + '&app=' + encodeURIComponent(__APP_ID)
    + '&ver=' + encodeURIComponent(__APP_VERSION)
}

// ── private ──────────────────────────────────────────────────────────────────

function _sha256(input) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    input,
    Utilities.Charset.UTF_8
  )
  return bytes.map(function(b) {
    var hex = (b < 0 ? b + 256 : b).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}
