// ===== CacheService wrapper =====
var CACHE_TTL = 600 // 10 minutes
var CACHE_MAX_TTL = 21600 // GAS hard limit: 6 hours

function _getCache() {
  return CacheService.getScriptCache()
}

function cacheGet(key) {
  var val = _getCache().get(key)
  if (!val) return null
  try { return JSON.parse(val) } catch(e) { return val }
}

function cachePut(key, value, ttl) {
  var t = ttl || CACHE_TTL
  if (t > CACHE_MAX_TTL) t = CACHE_MAX_TTL
  _getCache().put(key, JSON.stringify(value), t)
}

function cacheRemove(key) {
  _getCache().remove(key)
}

// ===== Version counter for sheet data =====
function getDataVersion(sheetName) {
  return cacheGet('ver_' + sheetName) || 0
}

function incrementDataVersion(sheetName) {
  var next = (getDataVersion(sheetName) || 0) + 1
  cachePut('ver_' + sheetName, next, 86400) // 24h
  return next
}

function invalidateSheetCache(sheetName) {
  cacheRemove('data_' + sheetName)
  incrementDataVersion(sheetName)
}
