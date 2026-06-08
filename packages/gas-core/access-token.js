// ===== Access token — short-lived (30 min), cache + sheet =====

var ACCESS_TOKEN_TTL = 604800 // 7 days

var _AT_BK_GC_KEY = 'at_bk_last_gc'
var _AT_BK_GC_INTERVAL_MS = 3600000 // run GC at most hourly

// Sweep expired at_bk_* token backups so ScriptProperties doesn't grow unbounded.
// Throttled to once an hour so it costs nothing on the hot path; no trigger needed.
function _maybeCleanupTokenBackups() {
  try {
    var props = PropertiesService.getScriptProperties()
    var now = new Date().getTime()
    var last = Number(props.getProperty(_AT_BK_GC_KEY) || 0)
    if (now - last < _AT_BK_GC_INTERVAL_MS) return
    props.setProperty(_AT_BK_GC_KEY, String(now))
    var all = props.getProperties()
    for (var k in all) {
      if (k.indexOf('at_bk_') !== 0 || k === _AT_BK_GC_KEY) continue
      var expired = true
      try { expired = !(JSON.parse(all[k]).e > now) } catch(_) { expired = true }
      if (expired) props.deleteProperty(k)
    }
  } catch(_) {}
}

function mintAccessToken(sessionData, usersSheetName) {
  if (!sessionData) throw new Error('mintAccessToken: sessionData required')
  var token = generateUuid()
  var expiresAt = new Date().getTime() + ACCESS_TOKEN_TTL * 1000
  cachePut('at_' + token, sessionData, ACCESS_TOKEN_TTL)
  // Backup session for cache-miss fallback (cache caps at 6h, token lives up to 7d)
  try { PropertiesService.getScriptProperties().setProperty('at_bk_' + token, JSON.stringify({ s: sessionData, e: expiresAt })) } catch(_) {}
  _maybeCleanupTokenBackups()
  if (usersSheetName && sessionData.userId) {
    updateRow(usersSheetName, sessionData.userId, {
      'AccessToken': token,
      'AccessTokenExpiry': expiresAt,
    })
  }
  return token
}

function validateAccessToken(token) {
  if (!token) return null
  var session = cacheGet('at_' + token)
  if (session) {
    cachePut('at_' + token, session, ACCESS_TOKEN_TTL)
    return session
  }
  // Cache miss (expires after 6h) — fallback to PropertiesService backup
  try {
    var raw = PropertiesService.getScriptProperties().getProperty('at_bk_' + token)
    if (raw) {
      var backup = JSON.parse(raw)
      if (backup.e > new Date().getTime()) {
        cachePut('at_' + token, backup.s, ACCESS_TOKEN_TTL)
        return backup.s
      }
      // Expired — clean up
      PropertiesService.getScriptProperties().deleteProperty('at_bk_' + token)
    }
  } catch(_) {}
  return null
}

function validateAccessTokenCrossScript(parentSheetId, token) {
  if (!token || !parentSheetId) return null
  var ss = SpreadsheetApp.openById(parentSheetId)
  var sheet = ss.getSheetByName('_Người Dùng')
  if (!sheet) return null
  var data = sheet.getDataRange().getValues()
  var headers = data[0]
  var col = {
    id: headers.indexOf('ID'),
    username: headers.indexOf('Tên đăng nhập'),
    email: headers.indexOf('Email'),
    name: headers.indexOf('Tên nhân viên'),
    status: headers.indexOf('Trạng thái'),
    at: headers.indexOf('AccessToken'),
    exp: headers.indexOf('AccessTokenExpiry'),
  }
  if (col.at === -1) return null
  for (var i = 1; i < data.length; i++) {
    if (data[i][col.at] === token) {
      if (Number(data[i][col.exp]) < new Date().getTime()) return null
      if (data[i][col.status] === 'Locked') return null
      return {
        userId: data[i][col.id],
        username: data[i][col.username],
        email: data[i][col.email],
        name: data[i][col.name] || data[i][col.username] || '',
      }
    }
  }
  return null
}

function revokeAccessToken(token) {
  if (token) {
    cacheRemove('at_' + token)
    try { PropertiesService.getScriptProperties().deleteProperty('at_bk_' + token) } catch(_) {}
  }
}
