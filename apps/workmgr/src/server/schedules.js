// ===== Schedule (Lịch họp / Công tác) business logic =====
// Approval workflow:
//   - Nhân viên đăng ký → 'Chờ TP' → TP xác nhận → 'Chờ GĐ' → GĐ duyệt → 'Đã duyệt' / 'Từ chối'
//   - Trưởng phòng đăng ký → 'Chờ GĐ' (rút gọn) → GĐ duyệt
//   - Admin/GĐ đăng ký → 'Đã duyệt' (auto)

// ===== Email notifications =====
// TEMP: all notifications routed to a single test inbox.
// Replace with the user's real Email field when ready for production.
var SCHEDULE_TEST_EMAIL = 'huyenvv.it@gmail.com'

function _resolveUserInfo(userId) {
  if (!userId) return { name: '', email: '' }
  var map = _getParentUsersMap()
  var entry = map[String(userId)]
  return entry ? { name: entry.name, email: entry.email } : { name: String(userId), email: '' }
}

function _getDirectorIds() {
  var roles = getSheetData(SHEETS.APP_ROLES)
  return roles
    .filter(function(r) {
      return r['AppID'] === APP_ID && (r['Quyền'] === 'Giám đốc' || r['Quyền'] === 'admin' || r['Quyền'] === 'Quản trị viên')
    })
    .map(function(r) { return r['UserID'] })
}

function _formatScheduleBody(schedule) {
  var lines = [
    '--- Chi tiết lịch ---',
    'Loại: ' + (schedule['Loại'] || ''),
    'Nội dung: ' + (schedule['Nội dung'] || ''),
    'Thời gian: ' + (schedule['Thời gian bắt đầu'] || '?') + ' → ' + (schedule['Thời gian kết thúc'] || '?'),
    'Địa điểm: ' + (schedule['Địa điểm'] || '—'),
    'Người chủ trì: ' + (_resolveUserInfo(schedule['Người chủ trì ID']).name || '—'),
    'Trạng thái: ' + (schedule['Trạng thái'] || ''),
  ]
  if (schedule['Link họp']) lines.push('Link họp: ' + schedule['Link họp'])
  if (schedule['Ghi chú']) lines.push('Ghi chú: ' + schedule['Ghi chú'])
  if (schedule['Lý do từ chối']) lines.push('Lý do từ chối: ' + schedule['Lý do từ chối'])
  return lines.join('\n')
}

function _notifySchedule(toUserId, subject, intro, schedule) {
  var info = _resolveUserInfo(toUserId)
  var body =
    'Người nhận dự kiến: ' + (info.name || '—') + ' (' + (info.email || '—') + ')\n\n' +
    intro + '\n\n' +
    _formatScheduleBody(schedule)
  try {
    MailApp.sendEmail(SCHEDULE_TEST_EMAIL, '[Workmgr] ' + subject, body)
  } catch(e) {
    Logger.log('MailApp.sendEmail failed: ' + e.message)
  }
}

function _notifyParticipants(schedule, subject, intro) {
  var raw = String(schedule['Thành phần'] || '').trim()
  if (raw === 'All') {
    _notifySchedule(null, subject + ' (All)', intro + '\n[Gửi tới tất cả nhân viên]', schedule)
    return
  }
  raw.split(',').map(function(s) { return s.trim() }).filter(Boolean).forEach(function(uid) {
    _notifySchedule(uid, subject, intro, schedule)
  })
}

function _findUserDept(userId) {
  var depts = _getSSODepartments()
  var uid = String(userId)
  return depts.find(function(d) {
    if (String(d['Trưởng phòng ID'] || '').split(',').indexOf(uid) !== -1) return true
    if (String(d['Phó phòng ID'] || '').split(',').indexOf(uid) !== -1) return true
    if (String(d['PGĐ phụ trách ID'] || '').split(',').indexOf(uid) !== -1) return true
    var members = String(d['Thành viên'] || '')
    return members.split(',').some(function(m) { return m.trim() === uid })
  })
}

/**
 * Get schedules. All authenticated users can read all schedules.
 * Filters: type, status, dateFrom, dateTo.
 */
function getSchedules(token, filters) {
  requireAuth(token)
  filters = filters || {}
  var rows = getSheetData(SHEETS.LICH)

  if (filters.type) rows = rows.filter(function(r) { return r['Loại'] === filters.type })
  if (filters.status) rows = rows.filter(function(r) { return r['Trạng thái'] === filters.status })
  if (filters.dateFrom) {
    var from = new Date(filters.dateFrom)
    rows = rows.filter(function(r) {
      var d = r['Thời gian bắt đầu'] ? new Date(r['Thời gian bắt đầu']) : null
      return d && !isNaN(d.getTime()) && d >= from
    })
  }
  if (filters.dateTo) {
    var to = new Date(filters.dateTo)
    to.setHours(23, 59, 59, 999)
    rows = rows.filter(function(r) {
      var d = r['Thời gian bắt đầu'] ? new Date(r['Thời gian bắt đầu']) : null
      return d && !isNaN(d.getTime()) && d <= to
    })
  }

  return rows
}

/**
 * Register a new schedule. Initial status depends on registrant role.
 */
function createSchedule(token, data) {
  var session = requireAuth(token)
  if (!data['Nội dung']) throw new Error('Vui lòng nhập nội dung')
  if (!data['Thời gian bắt đầu']) throw new Error('Vui lòng nhập thời gian bắt đầu')
  if (!data['Loại'] || SCHEDULE_TYPES.indexOf(data['Loại']) === -1) {
    throw new Error('Loại lịch không hợp lệ')
  }

  // Determine starting status
  var startStatus
  var userDept = null
  if (_isAdminRole(session.role)) {
    startStatus = 'Đã duyệt'
  } else {
    userDept = _findUserDept(session.userId)
    if (!userDept) throw new Error('Bạn không thuộc phòng/ban nào — không thể đăng ký lịch. Liên hệ admin.')
    var isLeader =
      String(userDept['Trưởng phòng ID'] || '').split(',').indexOf(String(session.userId)) !== -1 ||
      String(userDept['Phó phòng ID'] || '').split(',').indexOf(String(session.userId)) !== -1
    startStatus = isLeader ? 'Chờ GĐ' : 'Chờ TP'
    data['Phòng ban ID'] = userDept['ID']
  }

  data['Trạng thái'] = startStatus
  data['Người đăng ký ID'] = session.userId
  data['Ngày đăng ký'] = new Date().toISOString()

  var result = addRow(SHEETS.LICH, data)
  logActivity(session, 'Đăng ký lịch ' + data['Loại'], 'Lịch', result.ID, data['Nội dung'])

  // Notifications
  var registrar = _resolveUserInfo(session.userId)
  var intro = registrar.name + ' (' + (registrar.email || '—') + ') vừa đăng ký một lịch ' + data['Loại'].toLowerCase() + '.'
  if (startStatus === 'Chờ TP') {
    // Notify TP/PP of the registrant's dept
    var dept = userDept
    if (dept) {
      var leaderIds = String(dept['Trưởng phòng ID'] || '').split(',').concat(String(dept['Phó phòng ID'] || '').split(','))
      leaderIds.filter(Boolean).forEach(function(uid) {
        _notifySchedule(uid.trim(), 'Lịch mới chờ Trưởng/Phó phòng xác nhận', intro, data)
      })
    }
  } else if (startStatus === 'Chờ GĐ') {
    _getDirectorIds().forEach(function(uid) {
      _notifySchedule(uid, 'Lịch mới chờ Giám đốc phê duyệt', intro, data)
    })
  } else if (startStatus === 'Đã duyệt') {
    _notifyParticipants(data, 'Lịch ' + data['Loại'].toLowerCase() + ' đã được lên', intro)
  }

  return result
}

/**
 * Approve a schedule. TP can advance 'Chờ TP' → 'Chờ GĐ'. GĐ approves to 'Đã duyệt'.
 */
function approveSchedule(token, id) {
  var session = requireAuth(token)
  var rows = getSheetData(SHEETS.LICH)
  var row = rows.find(function(r) { return String(r['ID']) === String(id) })
  if (!row) throw new Error('Không tìm thấy lịch: ' + id)

  var newStatus
  if (row['Trạng thái'] === 'Chờ TP') {
    // Need to be TP/PP of the registrant's dept
    var deptId = row['Phòng ban ID']
    var depts = _getSSODepartments()
    var dept = depts.find(function(d) { return String(d['ID']) === String(deptId) })
    if (!dept) throw new Error('Phòng ban không tồn tại')
    var uid = String(session.userId)
    var isLeader = String(dept['Trưởng phòng ID'] || '').split(',').indexOf(uid) !== -1 || String(dept['Phó phòng ID'] || '').split(',').indexOf(uid) !== -1
    if (!isLeader && !_isAdminRole(session.role)) {
      throw new Error('Chỉ Trưởng/Phó phòng được xác nhận')
    }
    newStatus = 'Chờ GĐ'
  } else if (row['Trạng thái'] === 'Chờ GĐ') {
    if (!_isAdminRole(session.role)) throw new Error('Chỉ Giám đốc được phê duyệt')
    newStatus = 'Đã duyệt'
  } else {
    throw new Error('Trạng thái hiện tại không cho phép phê duyệt')
  }

  var update = {
    'Trạng thái': newStatus,
    'Người duyệt ID': session.userId,
    'Ngày duyệt': new Date().toISOString(),
  }
  var result = updateRow(SHEETS.LICH, id, update)
  logActivity(session, 'Phê duyệt lịch → ' + newStatus, 'Lịch', id, row['Nội dung'])

  // Merge for notification body
  var nextRow = Object.assign({}, row, update)
  var approver = _resolveUserInfo(session.userId)
  var intro = approver.name + ' (' + (approver.email || '—') + ') đã ' +
    (newStatus === 'Chờ GĐ' ? 'xác nhận' : 'phê duyệt') + ' lịch này.'

  if (newStatus === 'Chờ GĐ') {
    _getDirectorIds().forEach(function(uid) {
      _notifySchedule(uid, 'Lịch chờ Giám đốc phê duyệt', intro, nextRow)
    })
    // Also notify the registrant
    _notifySchedule(row['Người đăng ký ID'], 'Lịch của bạn đã được TP xác nhận', intro, nextRow)
  } else if (newStatus === 'Đã duyệt') {
    _notifySchedule(row['Người đăng ký ID'], 'Lịch của bạn đã được phê duyệt', intro, nextRow)
    _notifyParticipants(nextRow, 'Lịch ' + nextRow['Loại'].toLowerCase() + ' đã được duyệt', intro)
  }

  return result
}

/**
 * Reject a schedule. Only TP (for Chờ TP) or GĐ (for Chờ GĐ).
 */
function rejectSchedule(token, id, reason) {
  var session = requireAuth(token)
  var rows = getSheetData(SHEETS.LICH)
  var row = rows.find(function(r) { return String(r['ID']) === String(id) })
  if (!row) throw new Error('Không tìm thấy lịch: ' + id)

  if (row['Trạng thái'] === 'Chờ TP') {
    var deptId = row['Phòng ban ID']
    var depts = _getSSODepartments()
    var dept = depts.find(function(d) { return String(d['ID']) === String(deptId) })
    var uid = String(session.userId)
    var isLeader = dept && (String(dept['Trưởng phòng ID'] || '').split(',').indexOf(uid) !== -1 || String(dept['Phó phòng ID'] || '').split(',').indexOf(uid) !== -1)
    if (!isLeader && !_isAdminRole(session.role)) throw new Error('Chỉ Trưởng/Phó phòng được từ chối')
  } else if (row['Trạng thái'] === 'Chờ GĐ') {
    if (!_isAdminRole(session.role)) throw new Error('Chỉ Giám đốc được từ chối')
  } else {
    throw new Error('Trạng thái hiện tại không cho phép từ chối')
  }

  var update = {
    'Trạng thái': 'Từ chối',
    'Lý do từ chối': reason || '',
    'Người duyệt ID': session.userId,
    'Ngày duyệt': new Date().toISOString(),
  }
  var result = updateRow(SHEETS.LICH, id, update)
  logActivity(session, 'Từ chối lịch', 'Lịch', id, row['Nội dung'])

  var nextRow = Object.assign({}, row, update)
  var rejecter = _resolveUserInfo(session.userId)
  var intro = rejecter.name + ' (' + (rejecter.email || '—') + ') đã từ chối lịch này.' +
    (reason ? '\nLý do: ' + reason : '')
  _notifySchedule(row['Người đăng ký ID'], 'Lịch của bạn đã bị từ chối', intro, nextRow)

  return result
}

/**
 * Update a schedule's fields. After approval only Admin/GĐ can edit.
 * Before approval the registrant can also edit.
 */
function updateSchedule(token, id, data) {
  var session = requireAuth(token)
  var rows = getSheetData(SHEETS.LICH)
  var row = rows.find(function(r) { return String(r['ID']) === String(id) })
  if (!row) throw new Error('Không tìm thấy lịch: ' + id)

  var isAdmin = _isAdminRole(session.role)
  var isOwner = String(row['Người đăng ký ID']) === String(session.userId)
  var alreadyApproved = row['Trạng thái'] === 'Đã duyệt'

  if (alreadyApproved && !isAdmin) throw new Error('Lịch đã duyệt, chỉ Admin/Giám đốc được sửa')
  if (!alreadyApproved && !isOwner && !isAdmin) throw new Error('Chỉ người đăng ký được sửa')

  // Don't allow status to be changed via this endpoint
  delete data['Trạng thái']
  delete data['Người duyệt ID']
  delete data['Ngày duyệt']

  var result = updateRow(SHEETS.LICH, id, data)
  logActivity(session, 'Cập nhật lịch', 'Lịch', id, data['Nội dung'] || row['Nội dung'])
  return result
}

/**
 * Delete a schedule. Only Admin/GĐ or the registrant (before approval).
 */
function _deleteSchedule(token, id) {
  var session = requireAuth(token)
  var rows = getSheetData(SHEETS.LICH)
  var row = rows.find(function(r) { return String(r['ID']) === String(id) })
  if (!row) throw new Error('Không tìm thấy lịch: ' + id)

  var isAdmin = _isAdminRole(session.role)
  var isOwner = String(row['Người đăng ký ID']) === String(session.userId)
  var alreadyApproved = row['Trạng thái'] === 'Đã duyệt'

  if (alreadyApproved && !isAdmin) throw new Error('Lịch đã duyệt, chỉ Admin/Giám đốc được xóa')
  if (!alreadyApproved && !isOwner && !isAdmin) throw new Error('Chỉ người đăng ký được xóa')

  var result = _coreDeleteRow(SHEETS.LICH, id)
  logActivity(session, 'Xóa lịch', 'Lịch', id, row['Nội dung'])
  return result
}
