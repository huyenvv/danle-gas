// ===== App-specific sheet operations =====
// Core CRUD (getSheetData, addRow, updateRow, deleteRow, batchWrite, etc.) provided by gas-core/sheets-crud.js
// This file adds: referential integrity checks, getAllData, and overrides deleteRow/batchWrite with ref checks.

var REFERENCE_MAP = {}
REFERENCE_MAP[SHEETS.DANH_MUC]     = { targetSheet: SHEETS.HO_SO, targetColumn: 'Danh mục' }
REFERENCE_MAP[SHEETS.DU_AN]        = { targetSheet: SHEETS.HO_SO, targetColumn: 'Dự án (Phòng ban)' }
REFERENCE_MAP[SHEETS.NHA_CUNG_CAP] = { targetSheet: SHEETS.HO_SO, targetColumn: 'Nhà cung cấp (Nơi ban hành)' }

function getAllData(session) {
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
      'Phòng ban': '',
      'Quyền': r['Quyền'],
    }
  })
  var allCats = getSheetData(SHEETS.DANH_MUC)
  var allGroups = getSheetData(SHEETS.NHOM)

  // Filter categories by visibility permissions
  var CAT_EXEMPT_ROLES = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  var danhMuc = allCats
  if (session && CAT_EXEMPT_ROLES.indexOf(session.role) === -1) {
    var userIdStr = String(session.userId)
    var userGroupIds = []
    allGroups.forEach(function(g) {
      var members = _parseAssignees(g['Thành viên'])
      if (members.indexOf(userIdStr) !== -1 || members.indexOf(session.username) !== -1) {
        userGroupIds.push(String(g.ID))
      }
    })
    danhMuc = allCats.filter(function(c) {
      var allowedUsers = _parseAssignees(c['Người được xem'])
      var allowedGroups = _parseAssignees(c['Nhóm được xem'])
      if (allowedUsers.length === 0 && allowedGroups.length === 0) return true
      if (allowedUsers.indexOf(userIdStr) !== -1 || allowedUsers.indexOf(session.username) !== -1) return true
      for (var i = 0; i < userGroupIds.length; i++) {
        if (allowedGroups.indexOf(userGroupIds[i]) !== -1) return true
      }
      return false
    })
  }

  return {
    danhMuc:     danhMuc,
    nhom:        allGroups,
    duAn:        getSheetData(SHEETS.DU_AN),
    nhaCungCap:  getSheetData(SHEETS.NHA_CUNG_CAP),
    users:       users,
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
        'Không thể xóa vì đang được sử dụng bởi ' + check.count + ' hồ sơ: ' +
        check.sampleDocuments.join(', ')
      )
    }
  }
  // Extra check: category self-reference (child categories)
  if (sheetName === SHEETS.DANH_MUC) {
    var allCats = getSheetData(SHEETS.DANH_MUC)
    var childCats = allCats.filter(function(c) { return String(c['Danh mục cha']) === String(id) })
    if (childCats.length > 0) {
      throw new Error('Không thể xóa vì có ' + childCats.length + ' danh mục con đang sử dụng danh mục này làm cha.')
    }
  }
  return _coreDeleteRow(sheetName, id)
}

// Override gas-core batchWrite to add referential integrity check on deletes
var _coreBatchWrite = batchWrite
batchWrite = function(sheetName, operations) {
  // Pre-check all deletes for referential integrity
  operations.forEach(function(op) {
    if (op.type === 'delete') {
      var ref = REFERENCE_MAP[sheetName]
      if (ref) {
        var check = checkReferences(sheetName, op.id)
        if (check.inUse) {
          throw new Error(
            'Không thể xóa ID ' + op.id + ' vì đang được sử dụng bởi ' + check.count + ' hồ sơ'
          )
        }
      }
    }
  })
  return _coreBatchWrite(sheetName, operations)
}

// ===== Referential integrity =====
function checkReferences(sheetName, id) {
  var ref = REFERENCE_MAP[sheetName]
  if (!ref) return { inUse: false, count: 0, sampleDocuments: [] }

  var sourceData = getSheetData(sheetName)
  var sourceRecord = sourceData.find(function(r) { return String(r['ID']) === String(id) })
  var recordName = sourceRecord ? (sourceRecord['Tên danh mục'] || sourceRecord['Tên dự án viết tắt'] || sourceRecord['Tên NCC viết tắt'] || sourceRecord['Tên đăng nhập'] || String(id)) : String(id)

  var targetData = getSheetData(ref.targetSheet)
  var matches = targetData.filter(function(row) {
    return String(row[ref.targetColumn]) === String(recordName) ||
           String(row[ref.targetColumn]) === String(id)
  })

  return {
    inUse: matches.length > 0,
    count: matches.length,
    sampleDocuments: matches.slice(0, 3).map(function(r) { return r['Tên hồ sơ'] || String(r['ID']) }),
  }
}
