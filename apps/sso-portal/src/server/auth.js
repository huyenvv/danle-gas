// ===== SSO Portal — authentication & user management =====

function login(email, password) {
  var users = getSheetData(SHEETS.USERS)
  var user = users.find(function(u) { return u['Email'] && u['Email'].toLowerCase() === email.toLowerCase() })

  if (!user) throw new Error('Email hoặc mật khẩu không đúng')
  if (user['Trạng thái'] === 'Locked') throw new Error('Tài khoản đã bị khóa. Liên hệ quản trị viên.')
  if (!_verifyPassword(user['Tên đăng nhập'], password, user['Mật khẩu'])) {
    throw new Error('Email hoặc mật khẩu không đúng')
  }

  updateRow(SHEETS.USERS, user['ID'], { 'Đăng nhập cuối': now() })

  var ownerEmail = ''
  try { ownerEmail = getAppSheet().getOwner().getEmail() } catch(e) {}
  var isOwner = !!(ownerEmail && user['Email'].toLowerCase() === ownerEmail.toLowerCase())
  var isAdmin = isOwner || user['Quyền'] === 'Quản trị'

  var sessionData = {
    userId: user['ID'],
    username: user['Tên đăng nhập'],
    email: user['Email'],
    displayName: user['Tên nhân viên'] || user['Email'],
    role: isAdmin ? 'admin' : 'user',
    isOwner: isOwner,
    mustChangePass: user['MustChangePass'] === 'TRUE' || user['MustChangePass'] === true,
  }

  var refreshToken = mintRefreshToken(SHEETS.USERS, user['ID'], { label: 'Web' })
  var accessToken = mintAccessToken(sessionData)

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
  cachePut('sess_' + token, session, SESSION_TTL)

  return { success: true }
}

function _getOwnerEmail() {
  try { return getAppSheet().getOwner().getEmail().toLowerCase() } catch(e) { return '' }
}

function _isOwnerUser(user) {
  var ownerEmail = _getOwnerEmail()
  return !!(ownerEmail && user['Email'] && user['Email'].toLowerCase() === ownerEmail)
}

function portalAdminResetPassword(token, targetUserId) {
  requireAdmin(token)

  var users = getSheetData(SHEETS.USERS)
  var user = users.find(function(u) { return String(u['ID']) === String(targetUserId) })
  if (!user) throw new Error('Không tìm thấy tài khoản')
  if (_isOwnerUser(user)) throw new Error('Không thể thay đổi mật khẩu tài khoản chủ sở hữu')

  var newHash = _hashPassword(user['Tên đăng nhập'], DEFAULT_PASSWORD)
  updateRow(SHEETS.USERS, targetUserId, { 'Mật khẩu': newHash, 'MustChangePass': 'TRUE' })
  return { success: true }
}

function portalBulkResetPassword(token, userIds) {
  requireAdmin(token)
  if (!userIds || !userIds.length) throw new Error('Chưa chọn người dùng')

  var users = getSheetData(SHEETS.USERS)
  var count = 0
  var skipped = 0
  userIds.forEach(function(id) {
    var user = users.find(function(u) { return String(u['ID']) === String(id) })
    if (!user) { skipped++; return }
    if (_isOwnerUser(user)) { skipped++; return }
    var newHash = _hashPassword(user['Tên đăng nhập'], DEFAULT_PASSWORD)
    updateRow(SHEETS.USERS, id, { 'Mật khẩu': newHash, 'MustChangePass': 'TRUE' })
    count++
  })
  return { count: count, skipped: skipped }
}

function portalLockUser(token, targetUserId) {
  var session = requireAdmin(token)
  if (String(session.userId) === String(targetUserId)) throw new Error('Không thể tự khóa tài khoản của mình')
  var users = getSheetData(SHEETS.USERS)
  var user = users.find(function(u) { return String(u['ID']) === String(targetUserId) })
  if (user && _isOwnerUser(user)) throw new Error('Không thể khóa tài khoản chủ sở hữu')
  updateRow(SHEETS.USERS, targetUserId, { 'Trạng thái': 'Locked' })
  revokeAllRefreshTokens(SHEETS.USERS, targetUserId)
  bumpEpoch(SHEETS.USERS, targetUserId)
  return { success: true }
}

function portalUnlockUser(token, targetUserId) {
  requireAdmin(token)
  updateRow(SHEETS.USERS, targetUserId, { 'Trạng thái': 'Active' })
  return { success: true }
}

function portalLogoutAllDevices(userId) {
  revokeAllRefreshTokens(SHEETS.USERS, userId)
  bumpEpoch(SHEETS.USERS, userId)
  return { success: true }
}

function getUsers(token) {
  var session = requireAdmin(token)
  var users = getSheetData(SHEETS.USERS)

  var ownerEmail = ''
  try { ownerEmail = getAppSheet().getOwner().getEmail() } catch(e) {}

  return users.filter(function(u) {
    // Owner luôn ẩn khỏi tất cả
    if (ownerEmail && u['Email'] && u['Email'].toLowerCase() === ownerEmail.toLowerCase()) return false
    // Owner thấy tất cả (trừ chính mình đã filter ở trên)
    if (session.isOwner) return true
    // Admin chỉ thấy user thường (không phải Quản trị)
    return u['Quyền'] !== 'Quản trị'
  }).map(function(u) {
    return {
      ID: u['ID'],
      'Tên đăng nhập': u['Tên đăng nhập'],
      'Email': u['Email'],
      'Tên nhân viên': u['Tên nhân viên'] || '',
      'Trạng thái': u['Trạng thái'],
      'MustChangePass': u['MustChangePass'],
      'Đăng nhập cuối': u['Đăng nhập cuối'],
      'Phòng ban': u['Phòng ban'] || '',
      'Quyền': u['Quyền'] || '',
    }
  })
}

function addUser(token, data) {
  requireAdmin(token)

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
    'Phòng ban': data['Phòng ban'] || '',
    'Quyền': data['Quyền'] || '',
  }
  var added = addRow(SHEETS.USERS, userData)

  // Send email notification if configured
  _notifyNewUser(email, username)

  return added
}

function updateUser(token, id, data) {
  requireAdmin(token)
  var users = getSheetData(SHEETS.USERS)
  var target = users.find(function(u) { return String(u['ID']) === String(id) })
  if (target && _isOwnerUser(target)) throw new Error('Không thể thay đổi thông tin tài khoản chủ sở hữu')
  var updateData = {}
  if (data['Tên đăng nhập'] !== undefined) updateData['Tên đăng nhập'] = data['Tên đăng nhập']
  if (data['Email'] !== undefined) updateData['Email'] = data['Email']
  if (data['Tên nhân viên'] !== undefined) updateData['Tên nhân viên'] = data['Tên nhân viên']
  if (data['Phòng ban'] !== undefined) updateData['Phòng ban'] = data['Phòng ban']
  if (data['Quyền'] !== undefined) updateData['Quyền'] = data['Quyền']
  if (Object.keys(updateData).length > 0) updateRow(SHEETS.USERS, id, updateData)
  return { success: true }
}

// ===== App management =====

function getApps(token) {
  requireAuth(token)
  return getSheetData(SHEETS.APPS)
}

function addApp(token, data) {
  requireAdmin(token)
  return addRow(SHEETS.APPS, {
    'Tên App': data['Tên App'],
    'Webapp URL': data['Webapp URL'] || '',
    'Icon': data['Icon'] || 'apps',
    'Mô tả': data['Mô tả'] || '',
    'Trạng thái': 'Active',
  })
}

function updateApp(token, id, data) {
  requireAdmin(token)
  var updateData = {}
  if (data['Tên App'] !== undefined) updateData['Tên App'] = data['Tên App']
  if (data['Webapp URL'] !== undefined) updateData['Webapp URL'] = data['Webapp URL']
  if (data['Icon'] !== undefined) updateData['Icon'] = data['Icon']
  if (data['Mô tả'] !== undefined) updateData['Mô tả'] = data['Mô tả']
  if (data['Trạng thái'] !== undefined) updateData['Trạng thái'] = data['Trạng thái']
  if (Object.keys(updateData).length > 0) updateRow(SHEETS.APPS, id, updateData)
  return { success: true }
}

function deleteApp(token, id) {
  requireAdmin(token)
  deleteRow(SHEETS.APPS, id)
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

// ===== Email notifications =====

function _getMailConfig() {
  var sys = getSheetData(SHEETS.SYS)
  var config = {}
  sys.forEach(function(row) { config[row['Key']] = row['Value'] })
  return config
}

function _notifyNewUser(email, username) {
  if (!email) return
  try {
    var config = _getMailConfig()
    if (config['MAIL_ENABLED'] !== 'TRUE') return

    var subject = config['MAIL_SUBJECT_NEW_USER'] || 'Tài khoản mới đã được tạo'
    var body = config['MAIL_BODY_NEW_USER'] || 'Xin chào {username},\n\nTài khoản của bạn đã được tạo.\nTên đăng nhập: {username}\nMật khẩu mặc định: {password}\n\nVui lòng đổi mật khẩu ngay lần đăng nhập đầu tiên.'

    body = body.replace(/\{username\}/g, username).replace(/\{password\}/g, DEFAULT_PASSWORD)

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
  requireAdmin(token)
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
  return { success: true }
}
