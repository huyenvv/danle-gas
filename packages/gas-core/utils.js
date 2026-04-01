// ===== Utility helpers =====

function generateUuid() {
  return Utilities.getUuid()
}

function getNextId(sheetName) {
  var data = _getSheetRawValues(sheetName)
  if (data.length <= 1) return 1
  var ids = data.slice(1).map(function(row) { return parseInt(row[0]) || 0 })
  return Math.max.apply(null, ids) + 1
}

function _getSheetRawValues(sheetName) {
  var sheet = getSheet(sheetName)
  if (sheet.getLastRow() < 1) return []
  return sheet.getDataRange().getValues()
}

function rowsToObjects(rows) {
  if (!rows || rows.length < 1) return []
  var headers = rows[0]
  return rows.slice(1).map(function(row) {
    var obj = {}
    headers.forEach(function(h, i) {
      obj[h] = row[i] !== undefined ? row[i] : ''
    })
    return obj
  })
}

function objectToRow(headers, obj) {
  return headers.map(function(h) {
    return obj[h] !== undefined ? obj[h] : ''
  })
}

function formatDate(date) {
  if (!date) return ''
  if (date instanceof Date) {
    return Utilities.formatDate(date, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy')
  }
  return String(date)
}

function now() {
  return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss')
}
