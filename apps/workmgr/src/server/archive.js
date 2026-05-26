// ===== Task archive =====
// Hoàn Thành tasks older than ARCHIVE_MONTHS_OLD are moved from CV_<deptId>
// to CV_<deptId>_Archive. Active sheets stay small → queries stay fast.
// Trigger via api_runArchive (manual) or installable monthly cron.

var ARCHIVE_MONTHS_OLD = 3
var ARCHIVE_SUFFIX = '_Archive'

function getArchiveSheetName(deptId) {
  return TASK_SHEET_PREFIX + deptId + ARCHIVE_SUFFIX
}

function ensureArchiveSheet(deptId) {
  var name = getArchiveSheetName(deptId)
  var ss = getCentralSheet()
  var sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
    sheet.getRange(1, 1, 1, TASK_HEADERS.length).setValues([TASK_HEADERS])
    sheet.setFrozenRows(1)
  }
  return name
}

/**
 * Move Hoàn Thành tasks older than ARCHIVE_MONTHS_OLD from a dept's active
 * sheet to its archive sheet. Returns { moved: <count> }.
 */
function archiveCompletedTasksForDept(deptId) {
  var srcName = TASK_SHEET_PREFIX + deptId
  var ss = getCentralSheet()
  var src = ss.getSheetByName(srcName)
  if (!src) return { moved: 0 }

  var data = src.getDataRange().getValues()
  if (data.length <= 1) return { moved: 0 }

  var headers = data[0]
  var statusIdx = headers.indexOf('Trạng thái')
  var completedIdx = headers.indexOf('Ngày hoàn thành')
  if (statusIdx === -1 || completedIdx === -1) return { moved: 0 }

  var threshold = new Date()
  threshold.setMonth(threshold.getMonth() - ARCHIVE_MONTHS_OLD)

  var toArchive = []
  var rowsToDelete = []
  for (var i = 1; i < data.length; i++) {
    if (data[i][statusIdx] !== 'Hoàn Thành') continue
    var raw = data[i][completedIdx]
    if (!raw) continue
    var cd = new Date(raw)
    if (isNaN(cd.getTime()) || cd >= threshold) continue
    toArchive.push(data[i])
    rowsToDelete.push(i + 1) // 1-indexed sheet row
  }

  if (toArchive.length === 0) return { moved: 0 }

  var archiveName = ensureArchiveSheet(deptId)
  var archive = ss.getSheetByName(archiveName)
  archive.getRange(archive.getLastRow() + 1, 1, toArchive.length, headers.length).setValues(toArchive)

  // Delete from src bottom-up to preserve indices
  rowsToDelete.sort(function(a, b) { return b - a }).forEach(function(r) { src.deleteRow(r) })

  invalidateSheetCache(srcName)
  invalidateSheetCache(archiveName)

  return { moved: toArchive.length }
}

/**
 * Run archive across all departments. Called by monthly trigger.
 * MUST be a top-level function so ScriptApp.newTrigger can reference it.
 */
function archiveOldCompletedTasks() {
  var depts = _getSSODepartments()
  var results = []
  depts.forEach(function(d) {
    try {
      var r = archiveCompletedTasksForDept(d['ID'])
      results.push({ deptId: d['ID'], moved: r.moved })
    } catch(e) {
      results.push({ deptId: d['ID'], error: e.message })
    }
  })
  Logger.log('Archive sweep: ' + JSON.stringify(results))
  return results
}

/**
 * Idempotently install the monthly archive trigger (1st of month at 2 AM).
 * Calls ScriptApp; require admin in the api_ wrapper.
 */
function setupArchiveTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'archiveOldCompletedTasks') ScriptApp.deleteTrigger(t)
  })
  ScriptApp.newTrigger('archiveOldCompletedTasks')
    .timeBased()
    .onMonthDay(1)
    .atHour(2)
    .create()
  return { success: true }
}
