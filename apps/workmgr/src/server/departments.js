// ===== Department (Phòng/Ban) business logic =====
// Replaces projects.js. Each department gets its own task sheet (CV_<ID>).

/**
 * Get all departments. All logged-in users can view the dept list
 * (for cross-view filtering); edit/delete is gated separately.
 */
function getDepartments(token, filters) {
  requireAuth(token)
  return getSheetData(SHEETS.PHONG_BAN)
}

/**
 * Create a new department and its task sheet. Only Admin/GĐ.
 */
function createDepartment(token, data) {
  var session = requireAuth(token)
  if (!canManageDept(session)) throw new Error('Chỉ Admin hoặc Giám đốc được tạo phòng ban')

  data['Người tạo'] = session.userId
  data['Ngày tạo'] = new Date().toISOString()

  var result = addRow(SHEETS.PHONG_BAN, data)

  // Create the per-department task sheet
  var sheetName = ensureDepartmentTaskSheet(result.ID)
  updateRow(SHEETS.PHONG_BAN, result.ID, { 'Sheet Name': sheetName })
  result['Sheet Name'] = sheetName

  logActivity(session, 'Tạo phòng ban', 'Phòng Ban', result.ID, data['Tên phòng ban'])

  return result
}

/**
 * Update a department.
 */
function updateDepartment(token, id, data) {
  var session = requireAuth(token)
  if (!canManageDept(session)) throw new Error('Chỉ Admin hoặc Giám đốc được sửa phòng ban')

  var result = updateRow(SHEETS.PHONG_BAN, id, data)

  logActivity(session, 'Cập nhật phòng ban', 'Phòng Ban', id, data['Tên phòng ban'] || '')

  return result
}

/**
 * Delete a department (only if its task sheet is empty).
 */
function _deleteDepartment(token, id) {
  var session = requireAuth(token)
  if (!canManageDept(session)) throw new Error('Chỉ Admin hoặc Giám đốc được xóa phòng ban')

  // Check if department has tasks
  var depts = getSheetData(SHEETS.PHONG_BAN)
  var dept = depts.find(function(d) { return String(d['ID']) === String(id) })
  var name = dept ? dept['Tên phòng ban'] : String(id)

  if (dept && dept['Sheet Name']) {
    try {
      var taskData = getSheetData(dept['Sheet Name'])
      if (taskData.length > 0) {
        throw new Error('Không thể xóa vì phòng ban còn ' + taskData.length + ' công việc')
      }
    } catch(e) {
      if (e.message.indexOf('Không thể xóa') === 0) throw e
    }
  }

  var result = _coreDeleteRow(SHEETS.PHONG_BAN, id)

  logActivity(session, 'Xóa phòng ban', 'Phòng Ban', id, name)

  return result
}

/**
 * Get dashboard statistics across all departments.
 * Result is cached per (user, filters) for DASHBOARD_CACHE_TTL seconds.
 * Cache key includes the version of PHONG_BAN sheet so structural changes
 * (new dept, etc) bust the cache; mutations of task sheets aren't tracked
 * here — rely on the short TTL for freshness.
 */
var DASHBOARD_CACHE_TTL = 60 // seconds

function _stableStringify(obj) {
  if (!obj || typeof obj !== 'object') return JSON.stringify(obj)
  var keys = Object.keys(obj).sort()
  var out = {}
  keys.forEach(function(k) { out[k] = obj[k] })
  return JSON.stringify(out)
}

function getDashboardStats(token, filters) {
  var session = requireAuth(token)
  filters = filters || {}

  // Use the task-index version as a fast cache buster: any task write invalidates _TaskIndex,
  // bumping its version, so stale dashboard entries die immediately.
  var deptVersion = getDataVersion(SHEETS.PHONG_BAN)
  var idxVersion = getDataVersion(TASK_INDEX_SHEET)
  var cacheKey = 'dash_' + session.userId + '_d' + deptVersion + '_i' + idxVersion + '_' + _stableStringify(filters)
  var cached = cacheGet(cacheKey)
  if (cached) return cached

  var depts = getSheetData(SHEETS.PHONG_BAN)

  // Cross-view: everyone sees stats across all depts. Optionally filter to one dept.
  var visibleDepts = depts
  if (filters.departmentId) {
    visibleDepts = depts.filter(function(d) { return String(d['ID']) === String(filters.departmentId) })
  }
  var deptNameById = {}
  depts.forEach(function(d) { deptNameById[String(d['ID'])] = d['Tên phòng ban'] })
  var visibleDeptIds = visibleDepts.reduce(function(acc, d) { acc[String(d['ID'])] = true; return acc }, {})

  // Time period for stat counts (does not affect overdue/upcoming lists).
  var period = filters.period || 'all'
  var now = new Date()
  var periodStart = null
  if (period === 'week') {
    periodStart = new Date(now); periodStart.setDate(now.getDate() - 7)
  } else if (period === 'month') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (period === 'year') {
    periodStart = new Date(now.getFullYear(), 0, 1)
  }

  // Read from _TaskIndex when available; fall back to scanning dept sheets.
  // Index has the metadata we need (no descriptions, comments, subtasks) so
  // it stays small even with many depts.
  var allTasks = []
  try {
    ensureTaskIndexSheet()
    var indexRows = getSheetData(TASK_INDEX_SHEET)
    if (indexRows && indexRows.length > 0) {
      indexRows.forEach(function(r) {
        if (!visibleDeptIds[String(r['Phòng ban ID'])]) return
        r._deptId = r['Phòng ban ID']
        r._deptName = deptNameById[String(r['Phòng ban ID'])] || ''
        allTasks.push(r)
      })
    } else {
      // Index empty — fall back to scan
      visibleDepts.forEach(function(d) {
        var sheetName = d['Sheet Name']
        if (!sheetName) return
        try {
          var tasks = getSheetData(sheetName)
          tasks.forEach(function(t) { t._deptId = d['ID']; t._deptName = d['Tên phòng ban'] })
          allTasks = allTasks.concat(tasks)
        } catch(e) {}
      })
    }
  } catch(e) {
    Logger.log('Dashboard index read failed, falling back: ' + e.message)
    visibleDepts.forEach(function(d) {
      var sheetName = d['Sheet Name']
      if (!sheetName) return
      try {
        var tasks = getSheetData(sheetName)
        tasks.forEach(function(t) { t._deptId = d['ID']; t._deptName = d['Tên phòng ban'] })
        allTasks = allTasks.concat(tasks)
      } catch(e2) {}
    })
  }

  // Tasks counted for stat widgets (period-filtered by creation date when period set)
  var statTasks = allTasks
  if (periodStart) {
    statTasks = allTasks.filter(function(t) {
      var d = t['Ngày tạo'] ? new Date(t['Ngày tạo']) : null
      return d && !isNaN(d.getTime()) && d >= periodStart
    })
  }

  // Member count
  var allUsers = []
  try { allUsers = (getAllData().users || []) } catch(e) {}

  // Task & priority stats over statTasks
  var taskStats = { todo: 0, inProgress: 0, review: 0, completed: 0 }
  var priorityStats = { high: 0, medium: 0, low: 0 }
  statTasks.forEach(function(t) {
    var s = t['Trạng thái']
    if (s === 'Cần Làm') taskStats.todo++
    else if (s === 'Đang Thực Hiện') taskStats.inProgress++
    else if (s === 'Chờ Duyệt') taskStats.review++
    else if (s === 'Hoàn Thành') taskStats.completed++
    var p = t['Mức độ ưu tiên']
    if (p === 'Cao') priorityStats.high++
    else if (p === 'Trung Bình') priorityStats.medium++
    else if (p === 'Thấp') priorityStats.low++
  })

  // Overdue / upcoming computed over allTasks (period doesn't apply)
  var overdueDeptId = filters.overdueDeptId || ''
  var overdueMonth = filters.overdueMonth || ''  // YYYY-MM string
  var upcomingDeptId = filters.upcomingDeptId || ''
  var upcomingDays = Number(filters.upcomingDays) || 7
  var upcomingMs = upcomingDays * 24 * 60 * 60 * 1000

  var overdueTasks = []
  var upcomingTasks = []
  allTasks.forEach(function(t) {
    var s = t['Trạng thái']
    if (!t['Ngày hết hạn'] || s === 'Hoàn Thành') return
    var deadline = new Date(t['Ngày hết hạn'])
    if (isNaN(deadline.getTime())) return

    if (deadline < now) {
      if (overdueDeptId && String(t._deptId) !== String(overdueDeptId)) return
      if (overdueMonth) {
        var m = deadline.getFullYear() + '-' + String(deadline.getMonth() + 1).padStart(2, '0')
        if (m !== overdueMonth) return
      }
      overdueTasks.push(t)
    } else if (deadline.getTime() - now.getTime() <= upcomingMs) {
      if (upcomingDeptId && String(t._deptId) !== String(upcomingDeptId)) return
      upcomingTasks.push(t)
    }
  })

  // Per-department distribution — for Admin/GĐ and PGĐ
  var deptDistribution = []
  var isAdmin = session.role === 'admin' || session.role === 'Quản trị viên' || session.role === 'Giám đốc'
  var isPGD = depts.some(function(d) { return String(d['PGĐ phụ trách ID']) === String(session.userId) })
  if (isAdmin || isPGD) {
    var deptMap = {}
    statTasks.forEach(function(t) {
      var dId = t._deptId
      if (!deptMap[dId]) deptMap[dId] = { id: dId, name: t._deptName, todo: 0, inProgress: 0, completed: 0 }
      var s = t['Trạng thái']
      if (s === 'Cần Làm') deptMap[dId].todo++
      else if (s === 'Đang Thực Hiện') deptMap[dId].inProgress++
      else if (s === 'Hoàn Thành') deptMap[dId].completed++
    })
    for (var key in deptMap) deptDistribution.push(deptMap[key])
  }

  var result = {
    totalDepartments: visibleDepts.length,
    totalTasks: statTasks.length,
    totalMembers: allUsers.length,
    totalCompleted: taskStats.completed,
    totalOverdue: overdueTasks.length,
    taskStats: taskStats,
    priorityStats: priorityStats,
    overdueTasks: overdueTasks.slice(0, 20),
    upcomingTasks: upcomingTasks.slice(0, 20),
    deptDistribution: deptDistribution,
  }
  cachePut(cacheKey, result, DASHBOARD_CACHE_TTL)
  return result
}
