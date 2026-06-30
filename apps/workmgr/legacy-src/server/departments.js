// ===== Department (Phòng/Ban) business logic =====
// Departments are managed in the SSO Portal parent sheet.
// This app reads them via _getSSODepartments() (defined in sheets.js).

/**
 * Get all departments from SSO parent sheet.
 */
function getDepartments(token, filters) {
  requireAuth(token)
  return _getSSODepartments()
}

/**
 * Get dashboard statistics across all departments.
 * Result is cached per (user, filters) for DASHBOARD_CACHE_TTL seconds.
 * Cache key includes the task-index version so task mutations bust the
 * cache; dept data comes from SSO parent via _getSSODepartments().
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
  var idxVersion = getDataVersion(TASK_INDEX_SHEET)
  var cacheKey = 'dash_' + session.userId + '_i' + idxVersion + '_' + _stableStringify(filters)
  var cached = cacheGet(cacheKey)
  if (cached) return cached

  var depts = _getSSODepartments()

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
  var isPGD = depts.some(function(d) { return String(d['PGĐ phụ trách ID'] || '').split(',').indexOf(String(session.userId)) !== -1 })
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
