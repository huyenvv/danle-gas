// ===== SSO Portal — authentication & user management =====

// ===== Audit logging =====

function logAudit(session, action, type, target, details) {
  try {
    var username = session && session.username ? session.username : 'system'
    var email = session && session.email ? session.email : ''
    addRow(SHEETS.NHAT_KY, {
      'Thời gian': new Date().toISOString(),
      'Người dùng': username,
      'Email': email,
      'Hành động': action || '',
      'Loại': type || '',
      'Đối tượng': target || '',
      'Chi tiết': details || '',
    })
  } catch(e) {
    Logger.log('logAudit error: ' + e.message)
  }
}

function getAuditLogs(token, filters) {
  requireAdmin(token)
  filters = filters || {}
  var limit = Math.max(1, Number(filters.limit || 20))
  var offset = Math.max(0, Number(filters.offset || 0))
  var keyword = String(filters.keyword || '').toLowerCase()
  var logs = getSheetData(SHEETS.NHAT_KY)
  logs = logs.slice().reverse()
  var types = []
  logs.forEach(function(l) {
    var type = l['Loại'] || ''
    if (type && types.indexOf(type) === -1) types.push(type)
  })
  if (filters.type) {
    logs = logs.filter(function(l) { return l['Loại'] === filters.type })
  }
  if (keyword) {
    logs = logs.filter(function(l) {
      return (
        String(l['Người dùng'] || '').toLowerCase().indexOf(keyword) !== -1 ||
        String(l['Loại'] || '').toLowerCase().indexOf(keyword) !== -1 ||
        String(l['Đối tượng'] || '').toLowerCase().indexOf(keyword) !== -1 ||
        String(l['Chi tiết'] || '').toLowerCase().indexOf(keyword) !== -1
      )
    })
  }
  return {
    data: logs.slice(offset, offset + limit),
    hasMore: offset + limit < logs.length,
    total: logs.length,
    types: types,
  }
}

// ===== Authentication =====

function login(email, password, deviceType, deviceInfo) {
  var users = getSheetData(SHEETS.USERS)
  var user = users.find(function(u) { return u['Email'] && u['Email'].toLowerCase() === email.toLowerCase() })

  if (!user) throw new Error('Email hoặc mật khẩu không đúng')
  if (user['Trạng thái'] === 'Locked') throw new Error('Tài khoản đã bị khóa. Liên hệ quản trị viên.')

  var failedCount = Number(user['FailedLogins']) || 0
  if (!_verifyPassword(user['Tên đăng nhập'], password, user['Mật khẩu'])) {
    failedCount++
    var updates = { 'FailedLogins': failedCount }
    if (failedCount >= 5) updates['Trạng thái'] = 'Locked'
    updateRow(SHEETS.USERS, user['ID'], updates)
    var reason = failedCount >= 5 ? 'Khóa do sai 5 lần' : 'Sai mật khẩu'
    var failDetail = reason
    if (deviceInfo) failDetail = JSON.stringify({ reason: reason, ip: deviceInfo.ip || '', browser: deviceInfo.browser || '', os: deviceInfo.os || '', screen: deviceInfo.screen || '', tz: deviceInfo.tz || '' })
    logAudit({ username: email, email: email }, 'Đăng nhập thất bại', 'Xác thực', '', failDetail)
    if (failedCount >= 5) throw new Error('Tài khoản đã bị khóa do nhập sai mật khẩu quá 5 lần. Liên hệ quản trị viên.')
    throw new Error('Email hoặc mật khẩu không đúng')
  }

  updateRow(SHEETS.USERS, user['ID'], { 'Đăng nhập cuối': now(), 'FailedLogins': 0 })

  var ownerEmail = ''
  try { ownerEmail = getAppSheet().getOwner().getEmail() } catch(e) {}
  var isOwner = !!(ownerEmail && user['Email'].toLowerCase() === ownerEmail.toLowerCase())
  var hasAdminPosition = getSheetData(SHEETS.PHAN_BO).some(function(a) {
    return String(a['UserID']) === String(user['ID']) && a['Chức vụ'] === 'admin'
  })
  var isAdmin = isOwner || hasAdminPosition

  var sessionData = {
    userId: user['ID'],
    username: user['Tên đăng nhập'],
    email: user['Email'],
    displayName: user['Tên nhân viên'] || user['Email'],
    role: isAdmin ? 'admin' : 'user',
    isOwner: isOwner,
    mustChangePass: user['MustChangePass'] === 'TRUE' || user['MustChangePass'] === true,
  }

  var label = (deviceType === 'mobile') ? 'mobile' : 'desktop'

  // Revoke old access token for same device type → kick out old device immediately
  var deviceAtKey = 'device_at_' + user['ID'] + '_' + label
  var oldAt = cacheGet(deviceAtKey)
  if (oldAt) revokeAccessToken(oldAt)

  // Per-device epoch — also kicks any child-app session of the same device-type.
  // Bump BEFORE minting so new RT.createdAt >= epoch.
  bumpEpochDevice(SHEETS.USERS, user['ID'], label)

  var refreshToken = mintRefreshToken(SHEETS.USERS, user['ID'], { label: label })
  var accessToken = mintAccessToken(sessionData, SHEETS.USERS)

  // Track new access token for this device type
  cachePut(deviceAtKey, accessToken, ACCESS_TOKEN_TTL)

  var loginDetail = label
  if (deviceInfo) loginDetail = JSON.stringify({ device: label, ip: deviceInfo.ip || '', browser: deviceInfo.browser || '', os: deviceInfo.os || '', screen: deviceInfo.screen || '', tz: deviceInfo.tz || '' })
  logAudit({ username: sessionData.username, email: sessionData.email }, 'Đăng nhập', 'Xác thực', '', loginDetail)

  return {
    accessToken: accessToken,
    refreshToken: refreshToken,
    user: sessionData,
    parentSheetId: getAppSheet().getId(),
  }
}

function portalChangePassword(token, oldPassword, newPassword) {
  var session = requireAuth(token)

  var policyError = validatePasswordPolicy(newPassword)
  if (policyError) throw new Error(policyError)

  var users = getSheetData(SHEETS.USERS)
  var user = users.find(function(u) { return String(u['ID']) === String(session.userId) })
  if (!user) throw new Error('Không tìm thấy tài khoản')

  if (!_verifyPassword(user['Tên đăng nhập'], oldPassword, user['Mật khẩu'])) {
    throw new Error('Mật khẩu cũ không đúng')
  }
  if (oldPassword === newPassword) throw new Error('Mật khẩu mới phải khác mật khẩu cũ')

  var newHash = _hashPassword(user['Tên đăng nhập'], newPassword)
  updateRow(SHEETS.USERS, user['ID'], { 'Mật khẩu': newHash, 'MustChangePass': 'FALSE' })

  // Update session to clear mustChangePass
  session.mustChangePass = false
  cachePut('at_' + token, session, ACCESS_TOKEN_TTL)

  logAudit(session, 'Đổi mật khẩu', 'Xác thực', '', '')

  return { success: true }
}

function _getOwnerEmail() {
  try { return getAppSheet().getOwner().getEmail().toLowerCase() } catch(e) { return '' }
}

function _isOwnerUser(user) {
  var ownerEmail = _getOwnerEmail()
  return !!(ownerEmail && user['Email'] && user['Email'].toLowerCase() === ownerEmail)
}

function _isAdminUser(user) {
  return getSheetData(SHEETS.PHAN_BO).some(function(a) {
    return String(a['UserID']) === String(user['ID']) && a['Chức vụ'] === 'admin'
  })
}

function _guardProtectedUser(session, target) {
  if (_isOwnerUser(target)) throw new Error('Không thể thay đổi tài khoản chủ sở hữu')
  if (!session.isOwner && _isAdminUser(target)) throw new Error('Không thể thay đổi tài khoản quản trị viên khác')
}

function _buildDiff(oldRow, newData) {
  var diff = {}
  var keys = Object.keys(newData)
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    var oldVal = oldRow ? String(oldRow[k] || '') : ''
    var newVal = String(newData[k] || '')
    if (oldVal !== newVal) diff[k] = { old: oldVal, new: newVal }
  }
  return diff
}

function portalAdminResetPassword(token, targetUserId) {
  var session = requireAdmin(token)

  var users = getSheetData(SHEETS.USERS)
  var user = users.find(function(u) { return String(u['ID']) === String(targetUserId) })
  if (!user) throw new Error('Không tìm thấy tài khoản')
  _guardProtectedUser(session, user)

  var newHash = _hashPassword(user['Tên đăng nhập'], DEFAULT_PASSWORD)
  updateRow(SHEETS.USERS, targetUserId, { 'Mật khẩu': newHash, 'MustChangePass': 'TRUE' })
  var resetTarget = user['Tên nhân viên'] ? (user['Tên nhân viên'] + ' (' + user['Email'] + ')') : user['Email']
  logAudit(session, 'Reset mật khẩu', 'Người dùng', resetTarget, '')
  return { success: true }
}

function portalBulkResetPassword(token, userIds) {
  var session = requireAdmin(token)
  if (!userIds || !userIds.length) throw new Error('Chưa chọn người dùng')

  var users = getSheetData(SHEETS.USERS)
  var count = 0
  var skipped = 0
  userIds.forEach(function(id) {
    var user = users.find(function(u) { return String(u['ID']) === String(id) })
    if (!user) { skipped++; return }
    if (_isOwnerUser(user) || (!session.isOwner && _isAdminUser(user))) { skipped++; return }
    var newHash = _hashPassword(user['Tên đăng nhập'], DEFAULT_PASSWORD)
    updateRow(SHEETS.USERS, id, { 'Mật khẩu': newHash, 'MustChangePass': 'TRUE' })
    count++
  })
  logAudit(session, 'Reset mật khẩu hàng loạt', 'Người dùng', '', String(count) + ' người dùng')
  return { count: count, skipped: skipped }
}

function portalLockUser(token, targetUserId) {
  var session = requireAdmin(token)
  if (String(session.userId) === String(targetUserId)) throw new Error('Không thể tự khóa tài khoản của mình')
  var users = getSheetData(SHEETS.USERS)
  var user = users.find(function(u) { return String(u['ID']) === String(targetUserId) })
  if (user) _guardProtectedUser(session, user)
  updateRow(SHEETS.USERS, targetUserId, { 'Trạng thái': 'Locked' })
  revokeAllRefreshTokens(SHEETS.USERS, targetUserId)
  bumpEpoch(SHEETS.USERS, targetUserId)
  var lockTarget = user ? (user['Tên nhân viên'] ? (user['Tên nhân viên'] + ' (' + user['Email'] + ')') : user['Email']) : targetUserId
  logAudit(session, 'Khóa tài khoản', 'Người dùng', lockTarget, '')
  return { success: true }
}

function portalUnlockUser(token, targetUserId) {
  var session = requireAdmin(token)
  var users = getSheetData(SHEETS.USERS)
  var user = users.find(function(u) { return String(u['ID']) === String(targetUserId) })
  if (!user) throw new Error('Không tìm thấy tài khoản')
  _guardProtectedUser(session, user)
  var newHash = _hashPassword(user['Tên đăng nhập'], DEFAULT_PASSWORD)
  updateRow(SHEETS.USERS, targetUserId, {
    'Trạng thái': 'Active',
    'FailedLogins': 0,
    'Mật khẩu': newHash,
    'MustChangePass': 'TRUE',
  })
  var unlockTarget = user['Tên nhân viên'] ? (user['Tên nhân viên'] + ' (' + user['Email'] + ')') : user['Email']
  logAudit(session, 'Mở khóa', 'Người dùng', unlockTarget, '')
  return { success: true }
}

function getUsers(token) {
  var session = requireAdmin(token)
  var users = getSheetData(SHEETS.USERS)
  var assignments = getSheetData(SHEETS.PHAN_BO)
  var depts = getSheetData(SHEETS.PHONG_BAN)

  var deptMap = {}
  depts.forEach(function(d) { deptMap[String(d['ID'])] = d['Tên phòng ban'] })

  var ownerEmail = ''
  try { ownerEmail = getAppSheet().getOwner().getEmail() } catch(e) {}

  return users.filter(function(u) {
    // Owner row only visible to the owner
    if (ownerEmail && u['Email'] && u['Email'].toLowerCase() === ownerEmail.toLowerCase()) return session.isOwner
    // Other admin (Quản trị) accounts are hidden from non-owner admins
    if (!session.isOwner) {
      var isAdminRow = assignments.some(function(a) { return String(a['UserID']) === String(u['ID']) && a['Chức vụ'] === 'admin' })
      if (isAdminRow) return false
    }
    return true
  }).map(function(u) {
    var uid = String(u['ID'])
    var userAssignments = assignments.filter(function(a) { return String(a['UserID']) === uid })
    var bestRank = 0, bestChucVu = '', bestPhongBan = ''
    userAssignments.forEach(function(a) {
      var rank = _getPositionRank(a['Chức vụ'])
      if (rank > bestRank) {
        bestRank = rank
        bestChucVu = a['Chức vụ']
        bestPhongBan = a['PhongBanID'] ? (deptMap[String(a['PhongBanID'])] || '') : ''
      }
    })
    var hasAdmin = userAssignments.some(function(a) { return a['Chức vụ'] === 'admin' })
    return {
      ID: u['ID'],
      'Tên đăng nhập': u['Tên đăng nhập'],
      'Email': u['Email'],
      'Tên nhân viên': u['Tên nhân viên'] || '',
      'Trạng thái': u['Trạng thái'],
      'MustChangePass': u['MustChangePass'],
      'Đăng nhập cuối': u['Đăng nhập cuối'],
      'Phòng ban': bestPhongBan,
      'Chức vụ': bestChucVu,
      'Quyền': hasAdmin ? 'Quản trị' : '',
    }
  })
}

function addUser(token, data) {
  var session = requireAdmin(token)

  if (!data['Email'] || !data['Email'].trim()) throw new Error('Email là bắt buộc')

  var email = data['Email'].trim()
  // Auto-generate username from email if not provided
  var username = (data['Tên đăng nhập'] && data['Tên đăng nhập'].trim()) || email

  var users = getSheetData(SHEETS.USERS)
  var existing = users.find(function(u) {
    return u['Tên đăng nhập'] === username
  })
  if (existing) throw new Error('Tên đăng nhập đã tồn tại')

  var emailExists = users.find(function(u) {
    return u['Email'] && u['Email'].toLowerCase() === email.toLowerCase()
  })
  if (emailExists) throw new Error('Email đã được sử dụng')

  var passwordHash = _hashPassword(username, DEFAULT_PASSWORD)
  var userData = {
    'Tên đăng nhập': username,
    'Mật khẩu': passwordHash,
    'Email': email,
    'Tên nhân viên': data['Tên nhân viên'] || '',
    'Trạng thái': 'Active',
    'MustChangePass': 'TRUE',
    'Đăng nhập cuối': '',
  }
  if (data['Quyền'] === 'Quản trị' && !session.isOwner) {
    throw new Error('Chỉ chủ sở hữu mới có quyền cấp quyền Quản trị')
  }

  var added = addRow(SHEETS.USERS, userData)

  if (data['Quyền'] === 'Quản trị') {
    addRow(SHEETS.PHAN_BO, { 'UserID': String(added.ID), 'Chức vụ': 'admin', 'PhongBanID': '' })
  }

  _notifyNewUser(email, username, data['Tên nhân viên'] || '')

  logAudit(session, 'Thêm', 'Người dùng', email, '')
  return added
}

function updateUser(token, id, data) {
  var session = requireAdmin(token)
  var users = getSheetData(SHEETS.USERS)
  var target = users.find(function(u) { return String(u['ID']) === String(id) })
  var isSelf = String(session.userId) === String(id)
  if (target && !(isSelf && _isOwnerUser(target))) _guardProtectedUser(session, target)
  // Owner tự sửa chỉ được đổi tên hiển thị
  var ownerSelfEdit = isSelf && target && _isOwnerUser(target)
  var updateData = {}
  if (!ownerSelfEdit && data['Tên đăng nhập'] !== undefined) updateData['Tên đăng nhập'] = data['Tên đăng nhập']
  if (!ownerSelfEdit && data['Email'] !== undefined) updateData['Email'] = data['Email']
  if (data['Tên nhân viên'] !== undefined) updateData['Tên nhân viên'] = data['Tên nhân viên']
  if (!ownerSelfEdit && data['Quyền'] !== undefined) {
    var wantAdmin = data['Quyền'] === 'Quản trị'
    var hasAdmin = _isAdminUser(target)
    if (wantAdmin !== hasAdmin && !session.isOwner) {
      throw new Error('Chỉ chủ sở hữu mới có quyền thay đổi quyền Quản trị')
    }
    if (wantAdmin && !hasAdmin) {
      addRow(SHEETS.PHAN_BO, { 'UserID': String(id), 'Chức vụ': 'admin', 'PhongBanID': '' })
    } else if (!wantAdmin && hasAdmin) {
      var adminAssignment = getSheetData(SHEETS.PHAN_BO).find(function(a) {
        return String(a['UserID']) === String(id) && a['Chức vụ'] === 'admin'
      })
      if (adminAssignment) deleteRow(SHEETS.PHAN_BO, adminAssignment['ID'])
    }
  }
  if (Object.keys(updateData).length > 0) {
    var diff = _buildDiff(target, updateData)
    updateRow(SHEETS.USERS, id, updateData)
    var editTarget = target ? (target['Tên nhân viên'] ? (target['Tên nhân viên'] + ' (' + target['Email'] + ')') : target['Email']) : id
    logAudit(session, 'Sửa', 'Người dùng', editTarget, JSON.stringify(diff))
  }
  return { success: true }
}

// ===== App management =====

function getApps(token) {
  requireAuth(token)
  return getSheetData(SHEETS.APPS)
}

function addApp(token, data) {
  var session = requireAdmin(token)
  var added = addRow(SHEETS.APPS, {
    'Tên App': data['Tên App'],
    'Webapp URL': data['Webapp URL'] || '',
    'Icon': data['Icon'] || 'apps',
    'Mô tả': data['Mô tả'] || '',
    'Trạng thái': 'Active',
  })
  logAudit(session, 'Thêm', 'Ứng dụng', data['Tên App'] || '', '')
  return added
}

function updateApp(token, id, data) {
  var session = requireAdmin(token)
  var apps = getSheetData(SHEETS.APPS)
  var oldApp = apps.find(function(a) { return String(a['ID']) === String(id) })
  var updateData = {}
  if (data['Tên App'] !== undefined) updateData['Tên App'] = data['Tên App']
  if (data['Webapp URL'] !== undefined) updateData['Webapp URL'] = data['Webapp URL']
  if (data['Icon'] !== undefined) updateData['Icon'] = data['Icon']
  if (data['Mô tả'] !== undefined) updateData['Mô tả'] = data['Mô tả']
  if (data['Trạng thái'] !== undefined) updateData['Trạng thái'] = data['Trạng thái']
  if (data['Quyền xem'] !== undefined) updateData['Quyền xem'] = data['Quyền xem']
  if (Object.keys(updateData).length > 0) {
    var diff = _buildDiff(oldApp, updateData)
    updateRow(SHEETS.APPS, id, updateData)
    var appName = oldApp ? (oldApp['Tên App'] || id) : id
    logAudit(session, 'Sửa', 'Ứng dụng', appName, JSON.stringify(diff))
  }
  return { success: true }
}

function deleteApp(token, id) {
  var session = requireAdmin(token)
  var apps = getSheetData(SHEETS.APPS)
  var app = apps.find(function(a) { return String(a['ID']) === String(id) })
  var appName = app ? (app['Tên App'] || id) : id
  deleteRow(SHEETS.APPS, id)
  logAudit(session, 'Xóa', 'Ứng dụng', appName, '')
  return { success: true }
}

// ===== SSO params for iframe =====

function getSsoParams(token) {
  var session = requireAuth(token)
  return {
    email: session.email,
    ssoToken: session.ssoToken,
    parentSheetId: getAppSheet().getId(),
  }
}

// ===== Portal sync — single API for heartbeat + all data =====

function portalSync(token) {
  var session = requireAuth(token)
  var isAdmin = session.role === 'admin'

  var allApps = getSheetData(SHEETS.APPS)
  if (isAdmin) {
    var result = { apps: allApps }
    result.users = getUsers(token)
    result.phongBan = getSheetData(SHEETS.PHONG_BAN)
    result.assignments = getSheetData(SHEETS.PHAN_BO)
    result.mailConfig = _getMailConfig()
  } else {
    var uid = String(session.userId)
    var result = {
      apps: allApps.filter(function(app) {
        var qx = app['Quyền xem']
        if (!qx) return true
        try {
          var allowed = JSON.parse(qx)
          return Array.isArray(allowed) && allowed.indexOf(uid) !== -1
        } catch(_) { return true }
      })
    }
  }

  return result
}

// ===== Phòng ban (department) management =====

function getPhongBan(token) {
  requireAdmin(token)
  var departments = getSheetData(SHEETS.PHONG_BAN)

  return departments.map(function(dept) {
    return {
      ID: dept['ID'],
      'Tên phòng ban': dept['Tên phòng ban'],
    }
  })
}

function addPhongBan(token, data) {
  var session = requireAdmin(token)
  var name = data['Tên phòng ban']
  if (!name || !name.trim()) throw new Error('Tên phòng ban là bắt buộc')
  name = name.trim()

  var existing = getSheetData(SHEETS.PHONG_BAN)
  var dup = existing.find(function(d) { return d['Tên phòng ban'] === name })
  if (dup) throw new Error('Phòng ban đã tồn tại')

  var rowData = { 'Tên phòng ban': name }
  if (data['Mô tả'] !== undefined) rowData['Mô tả'] = data['Mô tả']
  if (data['Đơn vị thuộc sự quản lý'] !== undefined) rowData['Đơn vị thuộc sự quản lý'] = data['Đơn vị thuộc sự quản lý']
  var added = addRow(SHEETS.PHONG_BAN, rowData)
  logAudit(session, 'Thêm', 'Phòng ban', name, '')
  return added
}

function updatePhongBan(token, id, data) {
  var session = requireAdmin(token)
  var departments = getSheetData(SHEETS.PHONG_BAN)
  var dept = departments.find(function(d) { return String(d['ID']) === String(id) })
  if (!dept) throw new Error('Không tìm thấy phòng ban')

  var updateData = {}
  if (data['Tên phòng ban'] !== undefined) updateData['Tên phòng ban'] = data['Tên phòng ban']
  if (data['Mô tả'] !== undefined) updateData['Mô tả'] = data['Mô tả']
  if (data['Đơn vị thuộc sự quản lý'] !== undefined) updateData['Đơn vị thuộc sự quản lý'] = data['Đơn vị thuộc sự quản lý']

  if (Object.keys(updateData).length > 0) {
    var diff = _buildDiff(dept, updateData)
    updateRow(SHEETS.PHONG_BAN, id, updateData)
    logAudit(session, 'Sửa', 'Phòng ban', (dept['Tên phòng ban'] || id), JSON.stringify(diff))
  }
  return { success: true }
}

function deletePhongBan(token, id) {
  var session = requireAdmin(token)
  var departments = getSheetData(SHEETS.PHONG_BAN)
  var dept = departments.find(function(d) { return String(d['ID']) === String(id) })
  if (!dept) throw new Error('Không tìm thấy phòng ban')

  var assignments = getSheetData(SHEETS.PHAN_BO)
  var hasMembers = assignments.some(function(a) { return String(a['PhongBanID']) === String(id) })
  if (hasMembers) throw new Error('Không thể xóa phòng ban vẫn còn nhân viên. Hãy chuyển hết nhân viên trước.')

  deleteRow(SHEETS.PHONG_BAN, id)
  logAudit(session, 'Xóa', 'Phòng ban', dept['Tên phòng ban'] || id, '')
  return { success: true }
}

// ===== Org structure (Bộ máy công ty) =====

function getOrgStructure(token) {
  requireAdmin(token)
  var assignments = getSheetData(SHEETS.PHAN_BO)
  var depts = getSheetData(SHEETS.PHONG_BAN)
  var users = getSheetData(SHEETS.USERS)

  return {
    assignments: assignments,
    departments: depts.map(function(d) { return { ID: d['ID'], 'Tên phòng ban': d['Tên phòng ban'] } }),
    positions: POSITIONS,
    users: users.map(function(u) {
      return { ID: u['ID'], 'Tên nhân viên': u['Tên nhân viên'] || '', 'Email': u['Email'] || '' }
    }),
  }
}

function batchSaveAssignments(token, operations) {
  var session = requireAdmin(token)
  var adds = operations.adds || []
  var removes = operations.removes || []

  if (adds.length === 0 && removes.length === 0) return { success: true }

  // Single lock for the whole validate-then-mutate sequence so concurrent calls
  // can't race past each other's max/duplicate checks. Use the *unlocked* CRUD
  // primitives inside — the locking variants would release this lock early.
  var lock = LockService.getScriptLock()
  lock.waitLock(15000)
  try {
    invalidateSheetCache(SHEETS.PHAN_BO)
    var assignments = getSheetData(SHEETS.PHAN_BO)
    var depts = getSheetData(SHEETS.PHONG_BAN)
    var users = getSheetData(SHEETS.USERS)

    // --- Validate & execute removes first ---
    removes.forEach(function(assignmentId) {
      var assignment = assignments.find(function(a) { return String(a['ID']) === String(assignmentId) })
      if (!assignment) throw new Error('Không tìm thấy phân bổ ID ' + assignmentId)
      _deleteRowUnlocked(SHEETS.PHAN_BO, assignmentId)
      var u = users.find(function(u) { return String(u['ID']) === String(assignment['UserID']) })
      var userName = u ? (u['Tên nhân viên'] || u['Email']) : assignment['UserID']
      var rmTarget = userName + ' khỏi vị trí ' + assignment['Chức vụ']
      if (assignment['PhongBanID']) {
        var dept = depts.find(function(d) { return String(d['ID']) === String(assignment['PhongBanID']) })
        if (dept) rmTarget += ' — ' + dept['Tên phòng ban']
      }
      logAudit(session, 'Xóa', 'Bộ máy', rmTarget, '')
    })

    // Re-read after removes (still under lock)
    if (removes.length > 0) {
      invalidateSheetCache(SHEETS.PHAN_BO)
      assignments = getSheetData(SHEETS.PHAN_BO)
    }

    // --- Validate & execute adds ---
    adds.forEach(function(data) {
      var userId = String(data.userId)
      var chucVu = data.chucVu
      var phongBanId = data.phongBanId || ''

      if (!userId || !chucVu) throw new Error('Thiếu thông tin')
      if (chucVu === 'admin' && !session.isOwner) throw new Error('Chỉ chủ sở hữu mới có quyền phân bổ admin')

      var pos = POSITIONS.find(function(p) { return p.code === chucVu })
      if (!pos) throw new Error('Chức vụ không hợp lệ: ' + chucVu)

      if (pos.scope === 'dept' && !phongBanId) throw new Error('Chức vụ ' + chucVu + ' yêu cầu phòng ban')
      if (pos.scope === 'company' && phongBanId) phongBanId = ''

      if (pos.max > 0) {
        var count = assignments.filter(function(a) {
          if (a['Chức vụ'] !== chucVu) return false
          if (pos.scope === 'dept') return String(a['PhongBanID']) === String(phongBanId)
          return true
        }).length
        if (count >= pos.max) {
          var where = pos.scope === 'dept' ? ' trong phòng ban này' : ''
          throw new Error('Chỉ được tối đa ' + pos.max + ' ' + chucVu + where)
        }
      }

      var dup = assignments.find(function(a) {
        return String(a['UserID']) === userId && a['Chức vụ'] === chucVu && String(a['PhongBanID'] || '') === String(phongBanId)
      })
      if (dup) throw new Error('Phân bổ đã tồn tại: ' + chucVu + ' cho user ' + userId)

      if (pos.scope === 'dept' && phongBanId) {
        var sameUserDept = assignments.find(function(a) {
          return String(a['UserID']) === userId && String(a['PhongBanID']) === String(phongBanId)
        })
        if (sameUserDept) throw new Error('Người dùng đã có vị trí trong phòng ban này (' + sameUserDept['Chức vụ'] + ')')
      }

      var added = _addRowUnlocked(SHEETS.PHAN_BO, { 'UserID': userId, 'Chức vụ': chucVu, 'PhongBanID': phongBanId })
      // Track the new row in our working copy for subsequent validations
      assignments.push({ ID: added.ID || (assignments.length + 1), 'UserID': userId, 'Chức vụ': chucVu, 'PhongBanID': phongBanId })

      var u = users.find(function(u) { return String(u['ID']) === userId })
      var userName = u ? (u['Tên nhân viên'] || u['Email']) : userId
      var batchAddTarget = userName + ' làm ' + chucVu
      if (phongBanId) {
        var batchDept = depts.find(function(d) { return String(d['ID']) === String(phongBanId) })
        if (batchDept) batchAddTarget += ' — ' + batchDept['Tên phòng ban']
      }
      logAudit(session, 'Phân bổ', 'Bộ máy', batchAddTarget, '')
    })

    return { success: true, added: adds.length, removed: removes.length }
  } finally {
    lock.releaseLock()
  }
}

// ===== Email notifications =====

function _getMailConfig() {
  var sys = getSheetData(SHEETS.SYS)
  var config = {}
  sys.forEach(function(row) {
    var val = row['Value']
    // Google Sheets auto-converts TRUE/FALSE to booleans — normalize to strings
    if (typeof val === 'boolean') val = val ? 'TRUE' : 'FALSE'
    config[row['Key']] = val != null ? String(val) : ''
  })
  return config
}

function _notifyNewUser(email, username, name) {
  if (!email) return
  try {
    var config = _getMailConfig()
    if (config['MAIL_ENABLED'] !== 'TRUE') return

    var subject = config['MAIL_SUBJECT_NEW_USER'] || 'Tài khoản mới đã được tạo'
    var body = config['MAIL_BODY_NEW_USER'] || 'Xin chào {tênNgườiDùng},\n\nTài khoản của bạn đã được tạo.\nTên đăng nhập: {emailĐăngNhập}\nMật khẩu mặc định: {mậtKhẩu}\n\nVui lòng đổi mật khẩu ngay lần đăng nhập đầu tiên.'

    body = body.replace(/\{tênNgườiDùng\}/g, name || username).replace(/\{emailĐăngNhập\}/g, username).replace(/\{mậtKhẩu\}/g, DEFAULT_PASSWORD)

    var mailOptions = {}
    if (config['MAIL_SENDER_NAME']) mailOptions.name = config['MAIL_SENDER_NAME']
    // Use GmailApp to support sending from a Gmail alias (must be configured in Gmail → Settings → Accounts → Send mail as)
    if (config['MAIL_SENDER_EMAIL']) mailOptions.from = config['MAIL_SENDER_EMAIL']
    GmailApp.sendEmail(email, subject, body, mailOptions)
  } catch(e) {
    Logger.log('Email notification error: ' + e.message)
  }
}

function getMailConfig(token) {
  requireAdmin(token)
  return _getMailConfig()
}

function saveMailConfig(token, config) {
  var session = requireAdmin(token)
  var ss = getAppSheet()
  var sheet = ss.getSheetByName(SHEETS.SYS)
  if (!sheet) throw new Error('Sheet _Hệ Thống không tồn tại')

  var keys = Object.keys(config)
  keys.forEach(function(key) {
    var data = sheet.getDataRange().getValues()
    var found = false
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(config[key])
        found = true
        break
      }
    }
    if (!found) {
      sheet.appendRow([key, config[key]])
    }
  })
  invalidateSheetCache(SHEETS.SYS)
  logAudit(session, 'Cài đặt email', 'Hệ thống', '', '')
  return { success: true }
}
