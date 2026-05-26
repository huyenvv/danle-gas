// ===== Task index sheet =====
// A small denormalized table holding the minimal fields needed for filtering /
// aggregation. Lets dashboard + scope counts skip reading full task sheets when
// only metadata matters.
//
// Sync is best-effort (failures logged, not thrown) — admins can use
// api_rebuildTaskIndex to heal drift.

var TASK_INDEX_SHEET = '_TaskIndex'
var TASK_INDEX_HEADERS = [
  'ID', 'Phòng ban ID', 'Tiêu đề', 'Trạng thái', 'Mức độ ưu tiên',
  'Người thực hiện ID', 'Ngày hết hạn', 'Ngày hoàn thành', 'Ngày tạo'
]

function ensureTaskIndexSheet() {
  var ss = getCentralSheet()
  var sheet = ss.getSheetByName(TASK_INDEX_SHEET)
  if (!sheet) {
    sheet = ss.insertSheet(TASK_INDEX_SHEET)
    sheet.getRange(1, 1, 1, TASK_INDEX_HEADERS.length).setValues([TASK_INDEX_HEADERS])
    sheet.setFrozenRows(1)
  }
  return TASK_INDEX_SHEET
}

function _projectTaskForIndex(task, deptId) {
  return {
    'ID': task['ID'],
    'Phòng ban ID': deptId,
    'Tiêu đề': task['Tiêu đề'] || '',
    'Trạng thái': task['Trạng thái'] || '',
    'Mức độ ưu tiên': task['Mức độ ưu tiên'] || '',
    'Người thực hiện ID': task['Người thực hiện ID'] || '',
    'Ngày hết hạn': task['Ngày hết hạn'] || '',
    'Ngày hoàn thành': task['Ngày hoàn thành'] || '',
    'Ngày tạo': task['Ngày tạo'] || '',
  }
}

function indexUpsertTask(task, deptId) {
  if (!task || !task['ID']) return
  try {
    ensureTaskIndexSheet()
    var existing = getSheetData(TASK_INDEX_SHEET)
    var row = _projectTaskForIndex(task, deptId)
    var hit = existing.find(function(r) { return String(r['ID']) === String(task['ID']) })
    if (hit) updateRow(TASK_INDEX_SHEET, task['ID'], row)
    else addRow(TASK_INDEX_SHEET, row)
  } catch(e) {
    Logger.log('indexUpsertTask failed: ' + e.message)
  }
}

function indexRemoveTask(taskId) {
  if (!taskId) return
  try { _coreDeleteRow(TASK_INDEX_SHEET, taskId) } catch(e) {
    Logger.log('indexRemoveTask failed: ' + e.message)
  }
}

/**
 * Wipe and re-populate the index from all dept sheets. Run after schema
 * changes or to heal drift. Admin-only.
 */
function rebuildTaskIndex() {
  ensureTaskIndexSheet()
  var ss = getCentralSheet()
  var idx = ss.getSheetByName(TASK_INDEX_SHEET)
  if (idx.getLastRow() > 1) idx.deleteRows(2, idx.getLastRow() - 1)

  var depts = _getSSODepartments()
  var rows = []
  depts.forEach(function(d) {
    var sheetName = d['Sheet Name'] || (TASK_SHEET_PREFIX + d['ID'])
    try {
      var tasks = getSheetData(sheetName)
      tasks.forEach(function(t) {
        var p = _projectTaskForIndex(t, d['ID'])
        rows.push(TASK_INDEX_HEADERS.map(function(h) { return p[h] }))
      })
    } catch(e) { /* sheet may not exist */ }
  })

  if (rows.length > 0) {
    idx.getRange(2, 1, rows.length, TASK_INDEX_HEADERS.length).setValues(rows)
  }
  invalidateSheetCache(TASK_INDEX_SHEET)
  return { indexed: rows.length }
}
