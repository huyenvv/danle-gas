// ===== Access token — short-lived (30 min), cache-only =====

var ACCESS_TOKEN_TTL = 1800 // 30 min

function mintAccessToken(sessionData) {
  if (!sessionData) throw new Error('mintAccessToken: sessionData required')
  var token = generateUuid()
  cachePut('at_' + token, sessionData, ACCESS_TOKEN_TTL)
  return token
}

function validateAccessToken(token) {
  if (!token) return null
  var session = cacheGet('at_' + token)
  if (!session) return null
  // Sliding TTL on read
  cachePut('at_' + token, session, ACCESS_TOKEN_TTL)
  return session
}

function revokeAccessToken(token) {
  if (token) cacheRemove('at_' + token)
}
