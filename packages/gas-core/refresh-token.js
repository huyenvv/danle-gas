// ===== Refresh token — long-lived (30 days sliding), sheet-backed =====
// Per-device entries stored as JSON array in user row's RefreshTokens column.

var REFRESH_TOKEN_TTL_MS = 30 * 86400 * 1000 // 30 days sliding

function _parseRefreshTokens(raw) {
  if (!raw) return []
  try { return JSON.parse(raw) } catch(e) { return [] }
}

function _writeRefreshTokens(sheetName, userId, tokens) {
  updateRow(sheetName, userId, { 'RefreshTokens': JSON.stringify(tokens) })
}

function mintRefreshToken(sheetName, userId, meta) {
  var now = new Date().getTime()
  var token = generateUuid()
  var entry = {
    token: token,
    createdAt: now,
    lastUsedAt: now,
    ua: (meta && meta.ua) || '',
    ipHash: (meta && meta.ipHash) || '',
    label: (meta && meta.label) || '',
  }
  var users = getSheetData(sheetName)
  var user = users.find(function(u) { return String(u['ID']) === String(userId) })
  if (!user) throw new Error('User not found: ' + userId)
  var tokens = _parseRefreshTokens(user['RefreshTokens'])
  tokens.push(entry)
  _writeRefreshTokens(sheetName, userId, tokens)
  return token
}

function lookupRefreshToken(sheetName, token) {
  if (!token) return null
  var users = getSheetData(sheetName)
  var now = new Date().getTime()
  for (var i = 0; i < users.length; i++) {
    var tokens = _parseRefreshTokens(users[i]['RefreshTokens'])
    for (var j = 0; j < tokens.length; j++) {
      if (tokens[j].token === token) {
        if (now - tokens[j].lastUsedAt > REFRESH_TOKEN_TTL_MS) return null
        return { userId: users[i]['ID'], entry: tokens[j], user: users[i] }
      }
    }
  }
  return null
}

function rotateRefreshToken(sheetName, userId, oldToken) {
  var users = getSheetData(sheetName)
  var user = users.find(function(u) { return String(u['ID']) === String(userId) })
  if (!user) throw new Error('User not found: ' + userId)
  var tokens = _parseRefreshTokens(user['RefreshTokens'])
  var idx = -1
  for (var i = 0; i < tokens.length; i++) {
    if (tokens[i].token === oldToken) { idx = i; break }
  }
  if (idx === -1) throw new Error('TOKEN_NOT_FOUND')
  var now = new Date().getTime()
  var newToken = generateUuid()
  tokens[idx] = {
    token: newToken,
    createdAt: tokens[idx].createdAt,
    lastUsedAt: now,
    ua: tokens[idx].ua,
    ipHash: tokens[idx].ipHash,
    label: tokens[idx].label,
  }
  _writeRefreshTokens(sheetName, userId, tokens)
  return newToken
}

function revokeRefreshToken(sheetName, userId, token) {
  var users = getSheetData(sheetName)
  var user = users.find(function(u) { return String(u['ID']) === String(userId) })
  if (!user) return
  var tokens = _parseRefreshTokens(user['RefreshTokens'])
  tokens = tokens.filter(function(t) { return t.token !== token })
  _writeRefreshTokens(sheetName, userId, tokens)
}

function revokeAllRefreshTokens(sheetName, userId) {
  _writeRefreshTokens(sheetName, userId, [])
}
