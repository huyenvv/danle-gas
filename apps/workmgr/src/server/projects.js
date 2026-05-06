// ===== Project business logic =====
// Depends on: config.js (SHEETS), sheets.js (getAllData, resolveUserName), gas-core (getSheetData, addRow, updateRow, deleteRow)

/**
 * Get projects filtered by user role.
 * Admins see all, members see only projects they lead or participate in.
 */
function getProjects(token, filters) {
  var session = requireAuth(token)
  filters = filters || {}
  var projects = getSheetData(SHEETS.DU_AN)

  // Filter by role — non-admin only sees their projects
  if (session.role !== 'admin' && session.role !== 'Quản trị viên' && session.role !== 'Giám đốc') {
    var uid = String(session.userId)
    projects = projects.filter(function(p) {
      if (String(p['Leader ID']) === uid) return true
      var members = String(p['Thành viên'] || '')
      return members.split(',').some(function(m) { return m.trim() === uid })
    })
  }

  // Filter by status
  if (filters.status) {
    projects = projects.filter(function(p) { return p['Trạng thái'] === filters.status })
  }

  return projects
}

/**
 * Create a new project.
 */
function createProject(token, data) {
  var session = requireAuth(token)
  var perms = session.permissions
  if (perms && perms.duAn && !perms.duAn.c) throw new Error('Không có quyền tạo dự án')

  data['Người tạo'] = session.userId
  data['Ngày tạo'] = new Date().toISOString()
  if (!data['Trạng thái']) data['Trạng thái'] = 'Lên Kế Hoạch'
  if (!data['Mức độ ưu tiên']) data['Mức độ ưu tiên'] = 'Trung Bình'
  if (!data['Tiến độ']) data['Tiến độ'] = 0

  var result = addRow(SHEETS.DU_AN, data)

  // Log activity
  logActivity(session, 'Tạo dự án', 'Dự Án', result.ID, data['Tên dự án'])

  return result
}

/**
 * Update an existing project.
 */
function updateProject(token, id, data) {
  var session = requireAuth(token)
  var perms = session.permissions
  if (perms && perms.duAn && !perms.duAn.u) throw new Error('Không có quyền cập nhật dự án')

  var result = updateRow(SHEETS.DU_AN, id, data)

  logActivity(session, 'Cập nhật dự án', 'Dự Án', id, data['Tên dự án'] || '')

  return result
}

/**
 * Delete a project (referential integrity handled by sheets.js override).
 */
function _deleteProject(token, id) {
  var session = requireAuth(token)
  var perms = session.permissions
  if (perms && perms.duAn && !perms.duAn.d) throw new Error('Không có quyền xóa dự án')

  // Get project name before deletion for logging
  var projects = getSheetData(SHEETS.DU_AN)
  var proj = projects.find(function(p) { return String(p['ID']) === String(id) })
  var name = proj ? proj['Tên dự án'] : String(id)

  var result = deleteRow(SHEETS.DU_AN, id)

  logActivity(session, 'Xóa dự án', 'Dự Án', id, name)

  return result
}

/**
 * Get dashboard statistics.
 */
function getDashboardStats(token) {
  var session = requireAuth(token)
  var projects = getSheetData(SHEETS.DU_AN)
  var tasks = getSheetData(SHEETS.CONG_VIEC)
  var activities = getSheetData(SHEETS.HOAT_DONG)

  // Filter by role
  if (session.role !== 'admin' && session.role !== 'Quản trị viên' && session.role !== 'Giám đốc') {
    var uid = String(session.userId)
    projects = projects.filter(function(p) {
      return String(p['Leader ID']) === uid ||
        String(p['Thành viên'] || '').split(',').some(function(m) { return m.trim() === uid })
    })
    var projectIds = projects.map(function(p) { return String(p['ID']) })
    tasks = tasks.filter(function(t) {
      return projectIds.indexOf(String(t['Dự án ID'])) !== -1 ||
        String(t['Người thực hiện ID']) === uid
    })
  }

  // Project stats
  var projectStats = { planning: 0, inProgress: 0, completed: 0, paused: 0, cancelled: 0 }
  projects.forEach(function(p) {
    var s = p['Trạng thái']
    if (s === 'Lên Kế Hoạch') projectStats.planning++
    else if (s === 'Đang Thực Hiện') projectStats.inProgress++
    else if (s === 'Hoàn Thành') projectStats.completed++
    else if (s === 'Tạm Dừng') projectStats.paused++
    else if (s === 'Đã Hủy') projectStats.cancelled++
  })

  // Task stats
  var taskStats = { todo: 0, inProgress: 0, review: 0, completed: 0 }
  var priorityStats = { high: 0, medium: 0, low: 0 }
  var now = new Date()
  var overdueTasks = []
  var upcomingTasks = []
  var sevenDaysMs = 7 * 24 * 60 * 60 * 1000

  tasks.forEach(function(t) {
    var s = t['Trạng thái']
    if (s === 'Cần Làm') taskStats.todo++
    else if (s === 'Đang Thực Hiện') taskStats.inProgress++
    else if (s === 'Đang Xem Xét') taskStats.review++
    else if (s === 'Hoàn Thành') taskStats.completed++

    var p = t['Mức độ ưu tiên']
    if (p === 'Cao') priorityStats.high++
    else if (p === 'Trung Bình') priorityStats.medium++
    else if (p === 'Thấp') priorityStats.low++

    if (t['Ngày hết hạn'] && s !== 'Hoàn Thành') {
      var deadline = new Date(t['Ngày hết hạn'])
      if (!isNaN(deadline.getTime())) {
        if (deadline < now) {
          overdueTasks.push(t)
        } else if (deadline.getTime() - now.getTime() <= sevenDaysMs) {
          upcomingTasks.push(t)
        }
      }
    }
  })

  // Budget
  var totalBudget = 0
  var totalActualCost = 0
  projects.forEach(function(p) {
    totalBudget += Number(p['Ngân sách']) || 0
    totalActualCost += Number(p['Chi phí thực tế']) || 0
  })

  // Weekly trend (last 4 weeks)
  var weeklyTrend = []
  for (var w = 3; w >= 0; w--) {
    var weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() - w * 7)
    weekStart.setHours(0, 0, 0, 0)
    var weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    var created = 0
    var completed = 0
    tasks.forEach(function(t) {
      var createdDate = t['Ngày tạo'] ? new Date(t['Ngày tạo']) : null
      var completedDate = t['Ngày hoàn thành'] ? new Date(t['Ngày hoàn thành']) : null
      if (createdDate && createdDate >= weekStart && createdDate <= weekEnd) created++
      if (completedDate && completedDate >= weekStart && completedDate <= weekEnd) completed++
    })

    var label = (weekStart.getDate()) + '/' + (weekStart.getMonth() + 1)
    weeklyTrend.push({ label: label, created: created, completed: completed })
  }

  // Recent activities
  var recentActivities = activities.slice().reverse().slice(0, 8)

  // Project progress list
  var projectProgress = projects.map(function(p) {
    return { id: p['ID'], name: p['Tên dự án'], progress: Number(p['Tiến độ']) || 0, status: p['Trạng thái'] }
  })

  return {
    totalProjects: projects.length,
    totalTasks: tasks.length,
    totalCompleted: taskStats.completed,
    totalOverdue: overdueTasks.length,
    totalBudget: totalBudget,
    totalActualCost: totalActualCost,
    projectStats: projectStats,
    taskStats: taskStats,
    priorityStats: priorityStats,
    overdueTasks: overdueTasks.slice(0, 10),
    upcomingTasks: upcomingTasks.slice(0, 10),
    weeklyTrend: weeklyTrend,
    recentActivities: recentActivities,
    projectProgress: projectProgress,
  }
}
