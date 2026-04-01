// ===== Sheet CRUD operations =====

function getSheetData(sheetName) {
  var cached = cacheGet('data_' + sheetName)
  if (cached) return cached

  var sheet = getSheet(sheetName)
  if (sheet.getLastRow() <= 1) {
    cachePut('data_' + sheetName, [])
    return []
  }
  var rows = sheet.getDataRange().getValues()
  var data = rowsToObjects(rows)
  cachePut('data_' + sheetName, data)
  return data
}

function getDataWithVersion(sheetName) {
  return { data: getSheetData(sheetName), version: getDataVersion(sheetName) }
}

function checkVersion(sheetName, clientVersion) {
  var serverVersion = getDataVersion(sheetName)
  return { changed: serverVersion !== clientVersion, version: serverVersion }
}

// ===== Write (public — acquire lock each call) =====

function addRow(sheetName, rowObject) {
  var lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    return _addRowUnlocked(sheetName, rowObject)
  } finally {
    lock.releaseLock()
  }
}

function updateRow(sheetName, id, updatedFields) {
  var lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    return _updateRowUnlocked(sheetName, id, updatedFields)
  } finally {
    lock.releaseLock()
  }
}

function deleteRow(sheetName, id) {
  var lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    return _deleteRowUnlocked(sheetName, id)
  } finally {
    lock.releaseLock()
  }
}

function batchWrite(sheetName, operations) {
  var lock = LockService.getScriptLock()
  lock.waitLock(15000)
  try {
    operations.forEach(function(op) {
      if (op.type === 'add') {
        _addRowUnlocked(sheetName, op.data)
      } else if (op.type === 'update') {
        _updateRowUnlocked(sheetName, op.id, op.data)
      } else if (op.type === 'delete') {
        _deleteRowUnlocked(sheetName, op.id)
      }
    })
    invalidateSheetCache(sheetName)
    return { success: true, count: operations.length }
  } finally {
    lock.releaseLock()
  }
}

// ===== Write (private unlocked — must be called inside a lock) =====

function _addRowUnlocked(sheetName, rowObject) {
  var sheet = getSheet(sheetName)
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
  if (!rowObject['ID']) rowObject['ID'] = getNextId(sheetName)
  var row = objectToRow(headers, rowObject)
  sheet.appendRow(row)
  invalidateSheetCache(sheetName)
  return rowObject
}

function _updateRowUnlocked(sheetName, id, updatedFields) {
  var sheet = getSheet(sheetName)
  var data = sheet.getDataRange().getValues()
  var headers = data[0]
  var idCol = headers.indexOf('ID')
  if (idCol === -1) throw new Error('Sheet không có cột ID')

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      headers.forEach(function(h, col) {
        if (updatedFields.hasOwnProperty(h)) {
          sheet.getRange(i + 1, col + 1).setValue(updatedFields[h])
        }
      })
      invalidateSheetCache(sheetName)
      return true
    }
  }
  throw new Error('Không tìm thấy bản ghi ID: ' + id)
}

function _deleteRowUnlocked(sheetName, id) {
  var sheet = getSheet(sheetName)
  var data = sheet.getDataRange().getValues()
  var headers = data[0]
  var idCol = headers.indexOf('ID')
  if (idCol === -1) throw new Error('Sheet không có cột ID')

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1)
      invalidateSheetCache(sheetName)
      return true
    }
  }
  throw new Error('Không tìm thấy bản ghi ID: ' + id)
}
