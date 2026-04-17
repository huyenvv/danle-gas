// ===== App-specific sheet operations =====
// Core CRUD (getSheetData, addRow, updateRow, deleteRow, batchWrite, etc.) provided by gas-core/sheets-crud.js
// This file adds: referential integrity checks, getAllData, and overrides deleteRow/batchWrite with ref checks.

var REFERENCE_MAP = {}
REFERENCE_MAP[SHEETS.DANH_MUC]     = { targetSheet: SHEETS.HO_SO, targetColumn: 'Danh mục' }
REFERENCE_MAP[SHEETS.PHONG_BAN]    = { targetSheet: SHEETS.HO_SO, targetColumn: 'Phòng ban' }
REFERENCE_MAP[SHEETS.DU_AN]        = { targetSheet: SHEETS.HO_SO, targetColumn: 'Dự án' }
REFERENCE_MAP[SHEETS.NHA_CUNG_CAP] = { targetSheet: SHEETS.HO_SO, targetColumn: 'Nhà cung cấp' }

function getAllData() {
  // Read authorized users from local _Phân Quyền (users are managed by SSO Portal)
  var roles = getSheetData(SHEETS.APP_ROLES)
  var users = roles.filter(function(r) { return r['AppID'] === APP_ID }).map(function(r) {
    return {
      ID: r['UserID'],
      'Tên đăng nhập': r['Tên đăng nhập'] || '',
      'Phòng ban': '',
      'Quyền': r['Quyền'],
    }
  })
  return {
    danhMuc:     getSheetData(SHEETS.DANH_MUC),
    phongBan:    getSheetData(SHEETS.PHONG_BAN),
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
  var recordName = sourceRecord ? (sourceRecord['Tên danh mục'] || sourceRecord['Tên phòng ban'] || sourceRecord['Tên dự án viết tắt'] || sourceRecord['Tên NCC viết tắt'] || sourceRecord['Tên đăng nhập'] || String(id)) : String(id)

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
