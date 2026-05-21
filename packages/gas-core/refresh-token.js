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
  var label = (meta && meta.label) || ''
  var entry = {
    token: token,
    createdAt: now,
    lastUsedAt: now,
    ua: (meta && meta.ua) || '',
    ipHash: (meta && meta.ipHash) || '',
    label: label,
  }
  // Per-device-type: keep tokens with different labels, replace same label
  // Allows 1 mobile + 1 desktop simultaneously
  var users = getSheetData(sheetName)
  var user = users.find(function(u) { return String(u['ID']) === String(userId) })
  var existing = user ? _parseRefreshTokens(user['RefreshTokens']) : []
  var kept = label ? existing.filter(function(t) { return t.label && t.label !== label }) : []
  // Purge expired while we're at it
  kept = kept.filter(function(t) { return now - t.lastUsedAt <= REFRESH_TOKEN_TTL_MS })
  kept.push(entry)
  _writeRefreshTokens(sheetName, userId, kept)
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

// Touch lastUsedAt without rotating the token value.
// Avoids cross-tab races where two tabs resume the same RT — both get the same token back.
// Skips the sheet write if the token was touched recently (threshold below).
var TOUCH_THRESHOLD_MS = 60 * 60 * 1000 // 1h — sliding window granularity

function touchRefreshToken(sheetName, userId, token) {
  var users = getSheetData(sheetName)
  var user = users.find(function(u) { return String(u['ID']) === String(userId) })
  if (!user) throw new Error('User not found: ' + userId)
  var tokens = _parseRefreshTokens(user['RefreshTokens'])
  var idx = -1
  for (var i = 0; i < tokens.length; i++) {
    if (tokens[i].token === token) { idx = i; break }
  }
  if (idx === -1) throw new Error('TOKEN_NOT_FOUND')
  var now = new Date().getTime()
  if (now - (Number(tokens[idx].lastUsedAt) || 0) > TOUCH_THRESHOLD_MS) {
    tokens[idx].lastUsedAt = now
    _writeRefreshTokens(sheetName, userId, tokens)
  }
  return token
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
