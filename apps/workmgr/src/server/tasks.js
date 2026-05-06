// ===== Task business logic =====
// Depends on: config.js (SHEETS), sheets.js, gas-core (getSheetData, addRow, updateRow, deleteRow)

/**
 * Get tasks with multiple filters.
 */
function getTasks(token, filters) {
  var session = requireAuth(token)
  filters = filters || {}
  var tasks = getSheetData(SHEETS.CONG_VIEC)

  // Filter by role — non-admin only sees tasks in their projects or assigned to them
  if (session.role !== 'admin' && session.role !== 'Quản trị viên' && session.role !== 'Giám đốc') {
    var uid = String(session.userId)
    var projects = getSheetData(SHEETS.DU_AN)
    var myProjectIds = projects.filter(function(p) {
      return String(p['Leader ID']) === uid ||
        String(p['Thành viên'] || '').split(',').some(function(m) { return m.trim() === uid })
    }).map(function(p) { return String(p['ID']) })

    tasks = tasks.filter(function(t) {
      return String(t['Người thực hiện ID']) === uid ||
        String(t['Người giao ID']) === uid ||
        myProjectIds.indexOf(String(t['Dự án ID'])) !== -1
    })
  }

  // Apply filters
  if (filters.projectId) {
    tasks = tasks.filter(function(t) { return String(t['Dự án ID']) === String(filters.projectId) })
  }
  if (filters.status) {
    tasks = tasks.filter(function(t) { return t['Trạng thái'] === filters.status })
  }
  if (filters.assigneeId) {
    tasks = tasks.filter(function(t) { return String(t['Người thực hiện ID']) === String(filters.assigneeId) })
  }
  if (filters.dateFrom) {
    var from = new Date(filters.dateFrom)
    tasks = tasks.filter(function(t) {
      var d = t['Ngày hết hạn'] ? new Date(t['Ngày hết hạn']) : null
      return d && d >= from
    })
  }
  if (filters.dateTo) {
    var to = new Date(filters.dateTo)
    to.setHours(23, 59, 59, 999)
    tasks = tasks.filter(function(t) {
      var d = t['Ngày bắt đầu'] ? new Date(t['Ngày bắt đầu']) : null
      return d && d <= to
    })
  }

  return tasks
}

/**
 * Create a new task.
 */
function createTask(token, data) {
  var session = requireAuth(token)
  var perms = session.permissions
  if (perms && perms.congViec && !perms.congViec.c) throw new Error('Không có quyền tạo công việc')

  data['Người tạo'] = session.userId
  data['Ngày tạo'] = new Date().toISOString()
  if (!data['Trạng thái']) data['Trạng thái'] = 'Cần Làm'
  if (!data['Mức độ ưu tiên']) data['Mức độ ưu tiên'] = 'Trung Bình'
  if (!data['Tiến độ']) data['Tiến độ'] = 0

  var result = addRow(SHEETS.CONG_VIEC, data)

  logActivity(session, 'Tạo công việc', 'Công Việc', result.ID, data['Tiêu đề'])

  return result
}

/**
 * Update a task.
 */
function updateTask(token, id, data) {
  var session = requireAuth(token)
  var perms = session.permissions

  // Non-admin can only edit their own tasks
  if (perms && perms.congViec && !perms.congViec.u) {
    throw new Error('Không có quyền cập nhật công việc')
  }
  if (session.role === 'Nhân viên') {
    var tasks = getSheetData(SHEETS.CONG_VIEC)
    var task = tasks.find(function(t) { return String(t['ID']) === String(id) })
    if (task && String(task['Người thực hiện ID']) !== String(session.userId)) {
      throw new Error('Bạn chỉ có thể sửa công việc được giao cho mình')
    }
  }

  // Auto-set completion date
  if (data['Trạng thái'] === 'Hoàn Thành' && !data['Ngày hoàn thành']) {
    data['Ngày hoàn thành'] = new Date().toISOString()
    if (!data['Tiến độ']) data['Tiến độ'] = 100
  }

  var result = updateRow(SHEETS.CONG_VIEC, id, data)

  logActivity(session, 'Cập nhật công việc', 'Công Việc', id, data['Tiêu đề'] || '')

  return result
}

/**
 * Quick status update for Kanban drag-and-drop.
 */
function updateTaskStatus(token, id, newStatus) {
  var session = requireAuth(token)

  var updateData = { 'Trạng thái': newStatus }

  // Auto-set completion date/progress when moving to done
  if (newStatus === 'Hoàn Thành') {
    updateData['Ngày hoàn thành'] = new Date().toISOString()
    updateData['Tiến độ'] = 100
  }

  var result = updateRow(SHEETS.CONG_VIEC, id, updateData)

  logActivity(session, 'Chuyển trạng thái', 'Công Việc', id, newStatus)

  return result
}

/**
 * Delete a task and cascade delete its comments.
 */
function _deleteTask(token, id) {
  var session = requireAuth(token)
  var perms = session.permissions
  if (perms && perms.congViec && !perms.congViec.d) throw new Error('Không có quyền xóa công việc')

  // Get task name before deletion for logging
  var tasks = getSheetData(SHEETS.CONG_VIEC)
  var task = tasks.find(function(t) { return String(t['ID']) === String(id) })
  var name = task ? task['Tiêu đề'] : String(id)

  // Cascade delete comments
  var comments = getSheetData(SHEETS.BINH_LUAN)
  var taskComments = comments.filter(function(c) {
    return String(c['Mã đối tượng']) === String(id) && c['Loại đối tượng'] === 'Công Việc'
  })
  taskComments.forEach(function(c) {
    try { _coreDeleteRow(SHEETS.BINH_LUAN, c['ID']) } catch(e) {}
  })

  var result = _coreDeleteRow(SHEETS.CONG_VIEC, id)

  logActivity(session, 'Xóa công việc', 'Công Việc', id, name)

  return result
}
