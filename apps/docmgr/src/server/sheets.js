// ===== App-specific sheet operations =====
// Core CRUD (getSheetData, addRow, updateRow, deleteRow, batchWrite, etc.) provided by gas-core/sheets-crud.js
// This file adds: referential integrity checks, getAllData, and overrides deleteRow/batchWrite with ref checks.

var REFERENCE_MAP = {}
REFERENCE_MAP[SHEETS.DANH_MUC]     = { targetSheet: SHEETS.HO_SO, targetColumn: 'Danh mục' }
REFERENCE_MAP[SHEETS.PHONG_BAN]    = { targetSheet: SHEETS.HO_SO, targetColumn: 'Phòng ban' }
REFERENCE_MAP[SHEETS.DU_AN]        = { targetSheet: SHEETS.HO_SO, targetColumn: 'Dự án' }
REFERENCE_MAP[SHEETS.NHA_CUNG_CAP] = { targetSheet: SHEETS.HO_SO, targetColumn: 'Nhà cung cấp' }
REFERENCE_MAP[SHEETS.USERS]        = { targetSheet: SHEETS.HO_SO, targetColumn: 'Phụ trách' }

function getAllData() {
  return {
    danhMuc:     getSheetData(SHEETS.DANH_MUC),
    phongBan:    getSheetData(SHEETS.PHONG_BAN),
    duAn:        getSheetData(SHEETS.DU_AN),
    nhaCungCap:  getSheetData(SHEETS.NHA_CUNG_CAP),
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
