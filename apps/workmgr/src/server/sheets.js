// ===== App-specific sheet operations =====
// Core CRUD (getSheetData, addRow, updateRow, deleteRow, batchWrite, etc.) provided by gas-core/sheets-crud.js
// This file adds: referential integrity checks, getAllData, and user resolution from SSO parent.

var REFERENCE_MAP = {}
REFERENCE_MAP[SHEETS.DU_AN] = { targetSheet: SHEETS.CONG_VIEC, targetColumn: 'Dự án ID' }

/**
 * Get all lookup data for client initialization.
 */
function getAllData() {
  // Read authorized users from local _Phân Quyền (users are managed by SSO Portal)
  var roles = getSheetData(SHEETS.APP_ROLES)

  // Cross-reference parent SSO sheet to get Tên nhân viên + Email
  var parentInfoMap = {}
  try {
    var parentId = ssoGetParentSheetId()
    if (parentId) {
      var parentSs = SpreadsheetApp.openById(parentId)
      var parentSheet = parentSs.getSheetByName('_Người Dùng')
      if (parentSheet) {
        var parentUsers = rowsToObjects(parentSheet.getDataRange().getValues())
        parentUsers.forEach(function(u) {
          parentInfoMap[String(u['ID'])] = {
            name: u['Tên nhân viên'] || u['Tên đăng nhập'] || '',
            email: u['Email'] || '',
          }
        })
      }
    }
  } catch(e) { Logger.log('getAllData parentInfoMap error: ' + e.message) }

  var users = roles.filter(function(r) { return r['AppID'] === APP_ID }).map(function(r) {
    var info = parentInfoMap[String(r['UserID'])] || {}
    return {
      ID: r['UserID'],
      'Tên đăng nhập': r['Tên đăng nhập'] || '',
      'Tên nhân viên': info.name || r['Tên đăng nhập'] || '',
      'Email': info.email || '',
      'Quyền': r['Quyền'],
    }
  })

  return {
    duAn:   getSheetData(SHEETS.DU_AN),
    nhan:   getSheetData(SHEETS.NHAN),
    users:  users,
  }
}

/**
 * Resolve a user ID to display name via parent SSO sheet.
 */
function resolveUserName(userId) {
  if (!userId) return ''
  try {
    var parentId = ssoGetParentSheetId()
    if (!parentId) return String(userId)
    var parentSs = SpreadsheetApp.openById(parentId)
    var parentSheet = parentSs.getSheetByName('_Người Dùng')
    if (!parentSheet) return String(userId)
    var parentUsers = rowsToObjects(parentSheet.getDataRange().getValues())
    var user = parentUsers.find(function(u) { return String(u['ID']) === String(userId) })
    return user ? (user['Tên nhân viên'] || user['Tên đăng nhập'] || String(userId)) : String(userId)
  } catch(e) {
    return String(userId)
  }
}

// Override gas-core deleteRow to add referential integrity check
var _coreDeleteRow = deleteRow
deleteRow = function(sheetName, id) {
  var ref = REFERENCE_MAP[sheetName]
  if (ref) {
    var check = checkReferences(sheetName, id)
    if (check.inUse) {
      throw new Error(
        'Không thể xóa vì đang được sử dụng bởi ' + check.count + ' công việc: ' +
        check.sampleItems.join(', ')
      )
    }
  }
  return _coreDeleteRow(sheetName, id)
}

// ===== Referential integrity =====
function checkReferences(sheetName, id) {
  var ref = REFERENCE_MAP[sheetName]
  if (!ref) return { inUse: false, count: 0, sampleItems: [] }

  var targetData = getSheetData(ref.targetSheet)
  var matches = targetData.filter(function(row) {
    return String(row[ref.targetColumn]) === String(id)
  })

  return {
    inUse: matches.length > 0,
    count: matches.length,
    sampleItems: matches.slice(0, 3).map(function(r) { return r['Tiêu đề'] || String(r['ID']) }),
  }
}
