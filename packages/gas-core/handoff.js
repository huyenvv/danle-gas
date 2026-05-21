// ===== Handoff token — single-use, 60s TTL, sheet-backed =====
// Portal mints a handoff; child app consumes it once via cross-script read.

var HANDOFF_TOKEN_TTL_MS = 60 * 1000
var SHEET_HANDOFFS = '_Handoffs'

function mintHandoff(userId, appId) {
  var now = new Date().getTime()
  var token = generateUuid()
  addRow(SHEET_HANDOFFS, {
    'Token': token,
    'UserID': userId,
    'AppID': appId,
    'CreatedAt': now,
    'ExpiresAt': now + HANDOFF_TOKEN_TTL_MS,
    'Consumed': 'FALSE',
  })
  return token
}

function consumeHandoff(token, expectedAppId) {
  if (!token) throw new Error('HANDOFF_INVALID')
  var rows = getSheetData(SHEET_HANDOFFS)
  var row = rows.find(function(r) { return r['Token'] === token })
  if (!row) throw new Error('HANDOFF_INVALID')
  if (String(row['Consumed']) === 'TRUE') throw new Error('HANDOFF_INVALID')
  if (Number(row['ExpiresAt']) < new Date().getTime()) throw new Error('HANDOFF_INVALID')
  if (expectedAppId && row['AppID'] !== expectedAppId) throw new Error('HANDOFF_INVALID')
  updateRow(SHEET_HANDOFFS, row['ID'], { 'Consumed': 'TRUE' })
  return { userId: row['UserID'], appId: row['AppID'] }
}

// Cross-script variant — child calls this with parent sheet ID.
// Reads and marks consumed in the parent sheet.
function consumeHandoffCrossScript(parentSheetId, token, expectedAppId) {
  if (!token) throw new Error('HANDOFF_INVALID')
  var ss = SpreadsheetApp.openById(parentSheetId)
  var sheet = ss.getSheetByName(SHEET_HANDOFFS)
  if (!sheet) throw new Error('HANDOFF_INVALID')
  var data = sheet.getDataRange().getValues()
  var headers = data[0]
  var col = {
    id: headers.indexOf('ID'),
    token: headers.indexOf('Token'),
    userId: headers.indexOf('UserID'),
    appId: headers.indexOf('AppID'),
    exp: headers.indexOf('ExpiresAt'),
    consumed: headers.indexOf('Consumed'),
  }
  if (col.token === -1) throw new Error('HANDOFF_INVALID')
  for (var i = 1; i < data.length; i++) {
    if (data[i][col.token] === token) {
      if (String(data[i][col.consumed]) === 'TRUE') throw new Error('HANDOFF_INVALID')
      if (Number(data[i][col.exp]) < new Date().getTime()) throw new Error('HANDOFF_INVALID')
      if (expectedAppId && data[i][col.appId] !== expectedAppId) throw new Error('HANDOFF_INVALID')
      sheet.getRange(i + 1, col.consumed + 1).setValue('TRUE')
      return { userId: data[i][col.userId], appId: data[i][col.appId] }
    }
  }
  throw new Error('HANDOFF_INVALID')
}
