// ===== Task business logic =====
// Tasks are stored in per-department sheets (CV_<deptId>).
// Depends on: config.js (SHEETS, TASK_SHEET_PREFIX), departments.js, gas-core

/**
 * Get the task sheet name for a department, looking it up from the registry.
 */
function _getTaskSheetName(deptId) {
  var depts = getSheetData(SHEETS.PHONG_BAN)
  var dept = depts.find(function(d) { return String(d['ID']) === String(deptId) })
  if (!dept) throw new Error('Phòng ban không tồn tại: ' + deptId)
  return dept['Sheet Name'] || ensureDepartmentTaskSheet(deptId)
}

/**
 * Check if user belongs to a department (member, leader, phó phòng, or PGĐ).
 */
function _userBelongsToDept(dept, userId) {
  var uid = String(userId)
  if (String(dept['Trưởng phòng ID']) === uid) return true
  if (String(dept['Phó phòng ID']) === uid) return true
  if (String(dept['PGĐ phụ trách ID']) === uid) return true
  var members = String(dept['Thành viên'] || '')
  return members.split(',').some(function(m) { return m.trim() === uid })
}

/**
 * Check if user is a leader/manager of a department.
 */
function _isLeaderOfDept(dept, userId) {
  var uid = String(userId)
  return String(dept['Trưởng phòng ID']) === uid ||
    String(dept['Phó phòng ID']) === uid ||
    String(dept['PGĐ phụ trách ID']) === uid
}

/**
 * Get tasks with filters. Reads from per-department sheets.
 * If departmentId is specified, reads that sheet only.
 * Otherwise reads all visible department sheets (cross-department view).
 */
function getTasks(token, filters) {
  var session = requireAuth(token)
  filters = filters || {}
  var depts = getSheetData(SHEETS.PHONG_BAN)
  var allTasks = []

  function readDept(d) {
    var sheets = [d['Sheet Name'] || (TASK_SHEET_PREFIX + d['ID'])]
    if (filters.includeArchive) sheets.push(getArchiveSheetName(d['ID']))
    sheets.forEach(function(sn) {
      if (!sn) return
      try {
        var tasks = getSheetData(sn)
        tasks.forEach(function(t) { t['Phòng ban ID'] = d['ID'] })
        allTasks = allTasks.concat(tasks)
      } catch(e) { /* sheet may not exist */ }
    })
  }

  if (filters.departmentId) {
    var dept = depts.find(function(d) { return String(d['ID']) === String(filters.departmentId) })
    if (dept) readDept(dept)
  } else {
    // Cross-view: everyone can read all
    depts.forEach(readDept)
  }

  // Apply filters
  if (filters.status) {
    allTasks = allTasks.filter(function(t) { return t['Trạng thái'] === filters.status })
  }
  if (filters.assigneeId) {
    allTasks = allTasks.filter(function(t) { return String(t['Người thực hiện ID']) === String(filters.assigneeId) })
  }
  if (filters.priority) {
    allTasks = allTasks.filter(function(t) { return t['Mức độ ưu tiên'] === filters.priority })
  }
  if (filters.search) {
    var q = String(filters.search).toLowerCase()
    allTasks = allTasks.filter(function(t) {
      return (String(t['Tiêu đề'] || '').toLowerCase().indexOf(q) !== -1) ||
             (String(t['ID'] || '').toLowerCase().indexOf(q) !== -1)
    })
  }
  if (filters.dateFrom) {
    var from = new Date(filters.dateFrom)
    allTasks = allTasks.filter(function(t) {
      var d = t['Ngày hết hạn'] ? new Date(t['Ngày hết hạn']) : null
      return d && d >= from
    })
  }
  if (filters.dateTo) {
    var to = new Date(filters.dateTo)
    to.setHours(23, 59, 59, 999)
    allTasks = allTasks.filter(function(t) {
      var d = t['Ngày bắt đầu'] ? new Date(t['Ngày bắt đầu']) : null
      return d && d <= to
    })
  }

  // Pagination is opt-in: only when filters.limit is provided. Without it we
  // return the raw array (backward compatible for Kanban/Timeline/etc).
  if (filters.limit) {
    var limit = Math.max(1, Number(filters.limit) || 50)
    var offset = Math.max(0, Number(filters.offset) || 0)
    // Sort: newest first by Ngày tạo (stable enough)
    allTasks.sort(function(a, b) {
      var av = a['Ngày tạo'] ? new Date(a['Ngày tạo']).getTime() : 0
      var bv = b['Ngày tạo'] ? new Date(b['Ngày tạo']).getTime() : 0
      return bv - av
    })
    var slice = allTasks.slice(offset, offset + limit)
    return { rows: slice, total: allTasks.length, hasMore: offset + slice.length < allTasks.length }
  }

  return allTasks
}

/**
 * Look up a department row by ID.
 */
function _getDeptById(deptId) {
  var depts = getSheetData(SHEETS.PHONG_BAN)
  return depts.find(function(d) { return String(d['ID']) === String(deptId) })
}

/**
 * Create a new task in the department's sheet.
 */
function createTask(token, data) {
  var session = requireAuth(token)

  var deptId = data['Phòng ban ID']
  if (!deptId) throw new Error('Phải chọn phòng ban')

  var dept = _getDeptById(deptId)
  if (!dept) throw new Error('Phòng ban không tồn tại: ' + deptId)
  if (!canManageDeptTasks(session, dept)) throw new Error('Không có quyền tạo công việc trong phòng ban này')

  var sheetName = _getTaskSheetName(deptId)

  data['Người tạo'] = session.userId
  data['Ngày tạo'] = new Date().toISOString()
  if (!data['Trạng thái']) data['Trạng thái'] = 'Cần Làm'
  if (!data['Mức độ ưu tiên']) data['Mức độ ưu tiên'] = 'Trung Bình'
  if (!data['Tiến độ']) data['Tiến độ'] = 0

  var result = addRow(sheetName, data)

  indexUpsertTask(Object.assign({}, data, { ID: result.ID }), deptId)
  logActivity(session, 'Tạo công việc', 'Công Việc', result.ID, data['Tiêu đề'])

  return result
}

/**
 * Update a task in its department sheet.
 * Full edit (any field) requires canManageDeptTasks.
 * Assignees can update progress-only via updateTaskProgress.
 */
function updateTask(token, id, data) {
  var session = requireAuth(token)

  var deptId = data['Phòng ban ID']
  if (!deptId) throw new Error('Thiếu phòng ban ID')

  var dept = _getDeptById(deptId)
  if (!dept) throw new Error('Phòng ban không tồn tại: ' + deptId)
  if (!canManageDeptTasks(session, dept)) {
    throw new Error('Không có quyền cập nhật công việc trong phòng ban này')
  }

  var sheetName = _getTaskSheetName(deptId)

  // Auto-set completion date
  if (data['Trạng thái'] === 'Hoàn Thành' && !data['Ngày hoàn thành']) {
    data['Ngày hoàn thành'] = new Date().toISOString()
    if (!data['Tiến độ']) data['Tiến độ'] = 100
  }

  var result = updateRow(sheetName, id, data)

  indexUpsertTask(Object.assign({ ID: id }, data), deptId)
  logActivity(session, 'Cập nhật công việc', 'Công Việc', id, data['Tiêu đề'] || '')

  return result
}

/**
 * Update a task's progress (Tiến độ %) only — permitted for assignees and leaders.
 */
function updateTaskProgress(token, id, departmentId, progress) {
  var session = requireAuth(token)

  if (!departmentId) throw new Error('Thiếu phòng ban ID')
  var dept = _getDeptById(departmentId)
  if (!dept) throw new Error('Phòng ban không tồn tại: ' + departmentId)

  var sheetName = _getTaskSheetName(departmentId)
  var tasks = getSheetData(sheetName)
  var task = tasks.find(function(t) { return String(t['ID']) === String(id) })
  if (!task) throw new Error('Không tìm thấy công việc: ' + id)

  if (!canUpdateTaskProgress(session, dept, task)) {
    throw new Error('Chỉ Trưởng/Phó phòng hoặc người thực hiện được sửa tiến độ')
  }

  var p = Math.max(0, Math.min(100, Number(progress) || 0))
  var result = updateRow(sheetName, id, { 'Tiến độ': p })

  logActivity(session, 'Cập nhật tiến độ', 'Công Việc', id, p + '%')

  return result
}

/**
 * Quick status update for Kanban drag-and-drop, with permission rules:
 *  - Cần Làm → Đang Thực Hiện: assignee (+ leaders/admin)
 *  - Đang Thực Hiện → Chờ Duyệt: assignee (+ leaders/admin)
 *  - Chờ Duyệt → Hoàn Thành: leaders/PGĐ/Admin/GĐ only
 */
function updateTaskStatus(token, id, newStatus, departmentId) {
  var session = requireAuth(token)

  if (!departmentId) throw new Error('Thiếu phòng ban ID')
  var dept = _getDeptById(departmentId)
  if (!dept) throw new Error('Phòng ban không tồn tại: ' + departmentId)

  var sheetName = _getTaskSheetName(departmentId)
  var tasks = getSheetData(sheetName)
  var task = tasks.find(function(t) { return String(t['ID']) === String(id) })
  if (!task) throw new Error('Không tìm thấy công việc: ' + id)

  var fromStatus = task['Trạng thái']
  if (!canMoveTaskStatus(session, dept, task, fromStatus, newStatus)) {
    throw new Error('Bạn không có quyền chuyển trạng thái này')
  }

  var updateData = { 'Trạng thái': newStatus }

  if (newStatus === 'Hoàn Thành') {
    updateData['Ngày hoàn thành'] = new Date().toISOString()
    updateData['Tiến độ'] = 100
  }

  var result = updateRow(sheetName, id, updateData)

  indexUpsertTask(Object.assign({}, task, updateData, { ID: id }), departmentId)
  logActivity(session, 'Chuyển trạng thái', 'Công Việc', id, newStatus)

  return result
}

/**
 * Delete a task and cascade delete its comments.
 */
function _deleteTask(token, id, departmentId) {
  var session = requireAuth(token)

  if (!departmentId) throw new Error('Thiếu phòng ban ID')
  var dept = _getDeptById(departmentId)
  if (!dept) throw new Error('Phòng ban không tồn tại: ' + departmentId)
  if (!canManageDeptTasks(session, dept)) throw new Error('Không có quyền xóa công việc trong phòng ban này')

  var sheetName = _getTaskSheetName(departmentId)

  var tasks = getSheetData(sheetName)
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

  var ss = getCentralSheet()
  var sheet = ss.getSheetByName(sheetName)
  if (!sheet) throw new Error('Sheet không tồn tại: ' + sheetName)
  var data = rowsToObjects(sheet.getDataRange().getValues())
  var rowIdx = data.findIndex(function(r) { return String(r['ID']) === String(id) })
  if (rowIdx === -1) throw new Error('Không tìm thấy công việc: ' + id)
  sheet.deleteRow(rowIdx + 2) // +2 for header row and 0-index

  indexRemoveTask(id)
  logActivity(session, 'Xóa công việc', 'Công Việc', id, name)

  return { success: true }
}
