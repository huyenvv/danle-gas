// ===== Session epoch — invalidate tokens minted before a "logout" timestamp =====
// Two layers:
//   - LastLogoutAt (column): global epoch. Used for "lock user" → kicks all devices.
//   - LogoutEpochs (column, JSON {desktop, mobile}): per-device-label epoch.
//     A logout on desktop only kicks desktop tokens; mobile session stays alive.

var EPOCH_CACHE_TTL = 60 // 1 min — small enough that a portal logout reaches child apps quickly

function _readLogoutEpochs(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) || {} } catch(e) { return {} }
}

function _maxEpoch(globalEpoch, deviceEpochs, label) {
  var g = Number(globalEpoch) || 0
  var d = label ? (Number(deviceEpochs[label]) || 0) : 0
  return g > d ? g : d
}

function isBeforeEpoch(sheetName, userId, tokenCreatedAt, label) {
  var users = getSheetData(sheetName)
  var user = users.find(function(u) { return String(u['ID']) === String(userId) })
  if (!user) return true // unknown user — treat as revoked
  var epoch = _maxEpoch(user['LastLogoutAt'], _readLogoutEpochs(user['LogoutEpochs']), label)
  if (!epoch) return false
  return Number(tokenCreatedAt) < epoch
}

// Global epoch — used by "lock user" to kick all devices at once.
function bumpEpoch(sheetName, userId) {
  updateRow(sheetName, userId, { 'LastLogoutAt': new Date().getTime() })
}

// Per-device epoch — used by logout / "new login same device-type kicks old".
// Falls back to global bump if label not provided.
function bumpEpochDevice(sheetName, userId, label) {
  if (!label) { bumpEpoch(sheetName, userId); return }
  var users = getSheetData(sheetName)
  var user = users.find(function(u) { return String(u['ID']) === String(userId) })
  if (!user) return
  var epochs = _readLogoutEpochs(user['LogoutEpochs'])
  epochs[label] = new Date().getTime()
  updateRow(sheetName, userId, { 'LogoutEpochs': JSON.stringify(epochs) })
}

// Cross-script variant — child app calls this with parent sheet ID to check parent's epoch.
function isBeforeEpochCrossScript(parentSheetId, parentSheetName, userId, tokenCreatedAt, label) {
  var cacheKey = 'epoch_' + parentSheetId + '_' + userId + (label ? '_' + label : '')
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
      var globalCol = headers.indexOf('LastLogoutAt')
      var deviceCol = headers.indexOf('LogoutEpochs')
      if (idCol === -1) return false
      var globalEpoch = 0, deviceEpochs = {}
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][idCol]) === String(userId)) {
          if (globalCol !== -1) globalEpoch = Number(data[i][globalCol]) || 0
          if (deviceCol !== -1) deviceEpochs = _readLogoutEpochs(data[i][deviceCol])
          break
        }
      }
      epoch = _maxEpoch(globalEpoch, deviceEpochs, label)
      cachePut(cacheKey, epoch, EPOCH_CACHE_TTL)
    } catch(e) {
      Logger.log('Epoch cross-script error: ' + e.message)
      return false // fail open — don't block on cross-script glitch
    }
  }
  if (!epoch) return false
  return Number(tokenCreatedAt) < epoch
}
