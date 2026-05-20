// ===== Session epoch — bump LastLogoutAt to invalidate all tokens minted before =====

function isBeforeEpoch(sheetName, userId, tokenCreatedAt) {
  var users = getSheetData(sheetName)
  var user = users.find(function(u) { return String(u['ID']) === String(userId) })
  if (!user) return true // unknown user — treat as revoked
  var epoch = Number(user['LastLogoutAt']) || 0
  if (!epoch) return false
  return Number(tokenCreatedAt) < epoch
}

function bumpEpoch(sheetName, userId) {
  updateRow(sheetName, userId, { 'LastLogoutAt': new Date().getTime() })
}

// Cross-script variant — child app calls this with parent sheet ID to check parent's epoch.
// Result cached 5 min to reduce openById calls.
var EPOCH_CACHE_TTL = 300 // 5 min

function isBeforeEpochCrossScript(parentSheetId, parentSheetName, userId, tokenCreatedAt) {
  var cacheKey = 'epoch_' + parentSheetId + '_' + userId
  var cached = cacheGet(cacheKey)
  var epoch
  if (cached !== null && cached !== undefined) {
    epoch = Number(cached) || 0
  } else {
    try {
      var ss = SpreadsheetApp.openById(parentSheetId)
      var sheet = ss.getSheetByName(parentSheetName)
      if (!sheet) return true
      var data = sheet.getDataRange().getValues()
      var headers = data[0]
      var idCol = headers.indexOf('ID')
      var epochCol = headers.indexOf('LastLogoutAt')
      if (idCol === -1 || epochCol === -1) return false
      epoch = 0
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][idCol]) === String(userId)) {
          epoch = Number(data[i][epochCol]) || 0
          break
        }
      }
      cachePut(cacheKey, epoch, EPOCH_CACHE_TTL)
    } catch(e) {
      Logger.log('Epoch cross-script error: ' + e.message)
      return false // fail open — don't block on cross-script glitch
    }
  }
  if (!epoch) return false
  return Number(tokenCreatedAt) < epoch
}
