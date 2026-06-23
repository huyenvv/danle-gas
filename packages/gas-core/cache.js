// ===== CacheService wrapper =====
var CACHE_TTL = 600 // 10 minutes
var CACHE_MAX_TTL = 21600 // GAS hard limit: 6 hours
// Chunk size in characters. CacheService caps each value at 100KB (bytes); UTF-8
// is up to 4 bytes/char, so 20000 chars ≤ 80KB stays safely under the limit.
var CACHE_CHUNK_SIZE = 20000

function _getCache() {
  return CacheService.getScriptCache()
}

function cacheGet(key) {
  var val = _getCache().get(key)
  if (val == null) return null
  // Chunked value: manifest "{__chunks__:n}" → reassemble from key.0 … key.(n-1).
  if (val.charAt(0) === '{' && val.indexOf('__chunks__') !== -1) {
    try {
      var meta = JSON.parse(val)
      if (meta && meta.__chunks__) {
        var keys = []
        for (var i = 0; i < meta.__chunks__; i++) keys.push(key + '.' + i)
        var parts = _getCache().getAll(keys)
        var str = ''
        for (var j = 0; j < meta.__chunks__; j++) {
          var p = parts[key + '.' + j]
          if (p == null) return null // a chunk expired → treat whole entry as a miss
          str += p
        }
        try { return JSON.parse(str) } catch(e) { return str }
      }
    } catch (e) { /* not a manifest — fall through to plain parse */ }
  }
  try { return JSON.parse(val) } catch(e) { return val }
}

function cachePut(key, value, ttl) {
  var t = ttl || CACHE_TTL
  if (t > CACHE_MAX_TTL) t = CACHE_MAX_TTL
  var str = JSON.stringify(value)
  try {
    if (str.length <= CACHE_CHUNK_SIZE) {
      _getCache().put(key, str, t)
      return
    }
    // Too big for one cache entry — split into <100KB chunks and store a manifest
    // under `key`, the pieces under `key.0` … `key.(n-1)`.
    var n = Math.ceil(str.length / CACHE_CHUNK_SIZE)
    var map = {}
    map[key] = JSON.stringify({ __chunks__: n })
    for (var i = 0; i < n; i++) {
      map[key + '.' + i] = str.substring(i * CACHE_CHUNK_SIZE, (i + 1) * CACHE_CHUNK_SIZE)
    }
    _getCache().putAll(map, t)
  } catch (e) {
    // Last-resort safety: if caching still fails, skip it — callers re-read the
    // source (e.g. getSheetData re-reads the sheet) instead of crashing.
    Logger.log('cachePut skip "' + key + '": ' + e.message)
  }
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
