// ===== App-specific sheet operations =====
// Core CRUD (getSheetData, addRow, updateRow, deleteRow, batchWrite, etc.) provided by gas-core/sheets-crud.js
// This file adds: referential integrity checks, getAllData, and user resolution from SSO parent.

var REFERENCE_MAP = {}

var PARENT_USERS_CACHE_KEY = 'sso_parent_users'
var PARENT_USERS_CACHE_TTL = 300 // 5 minutes — parent sheet read is the slowest part of getAllData

function _getParentUsersMap() {
  var cached = cacheGet(PARENT_USERS_CACHE_KEY)
  if (cached) return cached

  var map = {}
  try {
    var parentId = ssoGetParentSheetId()
    if (!parentId) return map
    var parentSs = SpreadsheetApp.openById(parentId)
    var parentSheet = parentSs.getSheetByName('_Người Dùng')
    if (!parentSheet) return map
    var parentUsers = rowsToObjects(parentSheet.getDataRange().getValues())
    parentUsers.forEach(function(u) {
      map[String(u['ID'])] = {
        name: u['Tên nhân viên'] || u['Tên đăng nhập'] || '',
        email: u['Email'] || '',
      }
    })
    cachePut(PARENT_USERS_CACHE_KEY, map, PARENT_USERS_CACHE_TTL)
  } catch(e) {
    Logger.log('_getParentUsersMap error: ' + e.message)
  }
  return map
}

var SSO_DEPTS_CACHE_KEY = 'sso_depts'
var SSO_DEPTS_CACHE_TTL = 300

function _getSSODepartments() {
  var cached = cacheGet(SSO_DEPTS_CACHE_KEY)
  if (cached) return cached

  var parentId = ssoGetParentSheetId()
  if (!parentId) return []

  try {
    var parentSs = SpreadsheetApp.openById(parentId)

    var pbSheet = parentSs.getSheetByName('_Phòng Ban')
    if (!pbSheet) return []
    var depts = rowsToObjects(pbSheet.getDataRange().getValues())

    var phanBoSheet = parentSs.getSheetByName('_Phân Bổ')
    var assignments = phanBoSheet ? rowsToObjects(phanBoSheet.getDataRange().getValues()) : []

    var result = depts.map(function(dept) {
      var deptId = String(dept['ID'])
      var deptAssignments = assignments.filter(function(a) { return String(a['PhongBanID']) === deptId })

      var tpIds = [], ppIds = [], nptIds = [], memberIds = []
      deptAssignments.forEach(function(a) {
        var uid = String(a['UserID'])
        memberIds.push(uid)
        if (a['Chức vụ'] === 'Trưởng phòng') tpIds.push(uid)
        else if (a['Chức vụ'] === 'Phó phòng') ppIds.push(uid)
        else if (a['Chức vụ'] === 'Người phụ trách') nptIds.push(uid)
      })

      return {
        ID: dept['ID'],
        'Tên phòng ban': dept['Tên phòng ban'] || '',
        'Mô tả': dept['Mô tả'] || '',
        'Trưởng phòng ID': tpIds.join(','),
        'Phó phòng ID': ppIds.join(','),
        'PGĐ phụ trách ID': nptIds.join(','),
        'Thành viên': memberIds.join(','),
        'Đơn vị quản lý': dept['Đơn vị thuộc sự quản lý'] || '',
        'Sheet Name': TASK_SHEET_PREFIX + dept['ID'],
      }
    })

    cachePut(SSO_DEPTS_CACHE_KEY, result, SSO_DEPTS_CACHE_TTL)
    return result
  } catch(e) {
    Logger.log('_getSSODepartments error: ' + e.message)
    return []
  }
}

/**
 * Get all lookup data for client initialization.
 */
function getAllData() {
  var roles = getSheetData(SHEETS.APP_ROLES)
  var parentInfoMap = _getParentUsersMap()

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
    phongBan: _getSSODepartments(),
    nhan:     getSheetData(SHEETS.NHAN),
    users:    users,
  }
}

/**
 * Resolve a user ID to display name via parent SSO sheet.
 */
function resolveUserName(userId) {
  if (!userId) return ''
  var map = _getParentUsersMap()
  var entry = map[String(userId)]
  return entry ? entry.name : String(userId)
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
