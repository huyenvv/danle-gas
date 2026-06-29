// ===== Sheet CRUD operations =====

/**
 * Batch-read multiple sheets in a single Sheets API v4 call.
 * Returns an object keyed by sheet name, each value is an array of row-objects.
 * Uses cache: skips cached sheets, only fetches uncached ones.
 * @param {string[]} sheetNames - Array of sheet tab names
 * @param {SpreadsheetApp.Spreadsheet} [ss] - Optional spreadsheet (defaults to app sheet)
 * @return {Object} { sheetName: [{col: val, ...}, ...], ... }
 */
/**
 * Add any missing column headers to existing sheets.
 * Only appends — never reorders or removes existing columns.
 * Call after _ensureAllTabsExist() to handle schema upgrades on existing sheets.
 * @param {SpreadsheetApp.Spreadsheet} ss
 * @param {Array<{name: string, headers: string[]}>} tabDefs
 */
function ensureMissingColumns(ss, tabDefs) {
  tabDefs.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name)
    if (!sheet) return
    var lastCol = sheet.getLastColumn()
    var existingHeaders = lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(function(h) { return h !== '' })
      : []
    def.headers.forEach(function(h) {
      if (existingHeaders.indexOf(h) === -1) {
        sheet.getRange(1, existingHeaders.length + 1).setValue(h)
        existingHeaders.push(h)
      }
    })
  })
}

function batchGetSheetData(sheetNames, ss) {
  ss = ss || getAppSheet()
  var result = {}
  var uncachedNames = []

  // Check cache first
  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i]
    var cached = cacheGet('data_' + name)
    if (cached) {
      result[name] = cached
    } else {
      uncachedNames.push(name)
    }
  }

  if (uncachedNames.length === 0) return result

  // Build A:ZZ ranges for uncached sheets
  var ranges = uncachedNames.map(function(name) {
    return "'" + name + "'!A:ZZ"
  })

  var response = Sheets.Spreadsheets.Values.batchGet(ss.getId(), { ranges: ranges })
  var valueRanges = response.valueRanges || []

  for (var j = 0; j < uncachedNames.length; j++) {
    var tabName = uncachedNames[j]
    var rows = (valueRanges[j] && valueRanges[j].values) || []
    var data = rowsToObjects(rows)
    cachePut('data_' + tabName, data)
    result[tabName] = data
  }

  return result
}

function getSheetData(sheetName) {
  var cached = cacheGet('data_' + sheetName)
  if (cached) return cached

  var sheet = getSheet(sheetName)
  if (sheet.getLastRow() <= 1) {
    cachePut('data_' + sheetName, [])
    return []
  }
  var rows = sheet.getDataRange().getValues()
  // Ensure header row defines the column count (getDataRange may exclude trailing empty columns)
  var headerCount = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0].filter(function(h) { return h !== '' && h != null }).length
  if (rows.length > 0 && rows[0].length < headerCount) {
    var fullHeader = sheet.getRange(1, 1, 1, headerCount).getValues()[0]
    rows[0] = fullHeader
  }
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

// Định vị dòng theo cột 'ID' KHÔNG nạp cả sheet: TextFinder chạy phía Google trên range cột ID.
// Trả số dòng tuyệt đối (1-based) hoặc -1 nếu không có. Ném nếu thiếu cột 'ID'.
function _findRowIndexById(sheet, id) {
  var lastRow = sheet.getLastRow()
  if (lastRow <= 1) return -1
  var lastCol = sheet.getLastColumn()
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
  var idCol = headers.indexOf('ID')
  if (idCol === -1) throw new Error('Sheet không có cột ID')
  var found = sheet.getRange(2, idCol + 1, lastRow - 1, 1)
    .createTextFinder(String(id)).matchEntireCell(true).findNext()
  return found ? found.getRow() : -1
}

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
  var rowIdx = _findRowIndexById(sheet, id)   // định vị dòng KHÔNG nạp cả sheet (TextFinder)
  if (rowIdx === -1) throw new Error('Không tìm thấy bản ghi ID: ' + id)
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
  headers.forEach(function(h, col) {
    if (updatedFields.hasOwnProperty(h)) {
      sheet.getRange(rowIdx, col + 1).setValue(updatedFields[h])
    }
  })
  invalidateSheetCache(sheetName)
  return true
}

function _deleteRowUnlocked(sheetName, id) {
  var sheet = getSheet(sheetName)
  var rowIdx = _findRowIndexById(sheet, id)   // định vị dòng KHÔNG nạp cả sheet (TextFinder)
  if (rowIdx === -1) throw new Error('Không tìm thấy bản ghi ID: ' + id)
  sheet.deleteRow(rowIdx)
  invalidateSheetCache(sheetName)
  return true
}
