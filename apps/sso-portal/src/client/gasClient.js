// GAS client — calls google.script.run (real) or mock (dev)

const IS_GAS = typeof google !== 'undefined' && google.script && google.script.run

const ACCESS_KEY = 'sso_access_token'
const REFRESH_KEY = 'sso_refresh_token'
const USER_KEY = 'sso_user'
const PARENT_SHEET_KEY = 'sso_parent_sheet_id'

let _refreshInFlight = null

// Token errors that should NOT be retried (genuine auth failures)
const _FATAL_TOKEN_ERRORS = ['TOKEN_REVOKED', 'USER_LOCKED']

function _doRefreshOnce(rt) {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          const p = res.payload
          localStorage.setItem(ACCESS_KEY, p.accessToken)
          localStorage.setItem(REFRESH_KEY, p.refreshToken)
          localStorage.setItem(USER_KEY, JSON.stringify(p.user))
          if (p.parentSheetId) localStorage.setItem(PARENT_SHEET_KEY, p.parentSheetId)
          resolve(p.accessToken)
        } else {
          const errMsg = (res && res.error) || 'TOKEN_REVOKED'
          reject(new Error(errMsg))
        }
      })
      .withFailureHandler(err => reject(err))
      .api_resume(rt)
  })
}

function _doRefresh() {
  if (_refreshInFlight) return _refreshInFlight
  const rt = localStorage.getItem(REFRESH_KEY)
  if (!rt) return Promise.reject(new Error('TOKEN_REVOKED'))
  _refreshInFlight = _doRefreshOnce(rt).catch(err => {
    // Fatal token errors — don't retry
    if (_FATAL_TOKEN_ERRORS.includes(err.message)) {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem(USER_KEY)
      throw err
    }
    // Transient error (network not ready after wake) — retry once after 2s
    return new Promise(r => setTimeout(r, 2000)).then(() => _doRefreshOnce(rt))
  }).catch(err => {
    // Final failure — clean up if token error
    if (_FATAL_TOKEN_ERRORS.includes(err.message)) {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem(USER_KEY)
    }
    throw err
  }).finally(() => { _refreshInFlight = null })
  return _refreshInFlight
}

function gasCall(fnName, ...args) {
  if (IS_GAS) {
    return _gasCallOnce(fnName, args).catch(err => {
      if (err.message === 'TOKEN_EXPIRED') {
        return _doRefresh().then(newAccess => {
          // Replace first arg if it was the (now-stale) access token
          const newArgs = [...args]
          if (newArgs.length > 0 && typeof newArgs[0] === 'string' && newArgs[0].length > 10) {
            newArgs[0] = newAccess
          }
          return _gasCallOnce(fnName, newArgs)
        }).catch(refreshErr => {
          window.dispatchEvent(new CustomEvent('auth:sessionExpired', { detail: { message: refreshErr.message } }))
          throw refreshErr
        })
      }
      if (err.message === 'TOKEN_REVOKED' || err.message === 'USER_LOCKED') {
        window.dispatchEvent(new CustomEvent('auth:sessionExpired', { detail: { message: err.message } }))
      }
      throw err
    })
  }
  return mockCall(fnName, ...args)
}

function _gasCallOnce(fnName, args) {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          resolve(res.payload)
        } else {
          const errMsg = res ? res.error : 'Lỗi không xác định'
          reject(new Error(errMsg))
        }
      })
      .withFailureHandler(err => reject(new Error(err.message || String(err))))
      [fnName](...args)
  })
}

export default gasCall

// ── Dev mock ─────────────────────────────────────────────────────────────────
let _mockSession = null
let _nextId = 10
const _mockLogs = [
  { ID: 3, 'Thời gian': '2024-01-15T10:30:00.000Z', 'Người dùng': 'admin@test.com', 'Email': 'admin@test.com', 'Hành động': 'Thêm', 'Loại': 'Người dùng', 'Đối tượng': 'nv1@test.com', 'Chi tiết': '' },
  { ID: 2, 'Thời gian': '2024-01-15T09:15:00.000Z', 'Người dùng': 'admin@test.com', 'Email': 'admin@test.com', 'Hành động': 'Đăng nhập', 'Loại': 'Xác thực', 'Đối tượng': 'admin@test.com', 'Chi tiết': 'desktop' },
  { ID: 1, 'Thời gian': '2024-01-14T08:00:00.000Z', 'Người dùng': 'huyenvv', 'Email': 'huyenvv.it@gmail.com', 'Hành động': 'Đăng nhập thất bại', 'Loại': 'Xác thực', 'Đối tượng': 'huyenvv.it@gmail.com', 'Chi tiết': 'Sai mật khẩu' },
]

function _pushLog(action, type, target, details) {
  _mockLogs.unshift({
    ID: _mockLogs.length + 1,
    'Thời gian': new Date().toISOString(),
    'Người dùng': _mockSession?.username || 'system',
    'Email': _mockSession?.email || '',
    'Hành động': action,
    'Loại': type,
    'Đối tượng': target || '',
    'Chi tiết': details || '',
  })
}

const _mockUsers = [
  { ID: 1,  'Tên đăng nhập': 'admin@test.com', 'Email': 'admin@test.com',      'Tên nhân viên': 'Admin Hệ thống',    'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '2024-01-15', 'Quyền': 'Quản trị', 'FailedLogins': 0 },
  { ID: 2,  'Tên đăng nhập': 'huyenvv',        'Email': 'huyenvv.it@gmail.com', 'Tên nhân viên': 'Vũ Văn Huyên',      'Trạng thái': 'Active', 'MustChangePass': 'TRUE',  'Đăng nhập cuối': '',           'Quyền': '',        'FailedLogins': 0 },
  { ID: 3,  'Tên đăng nhập': 'nhanvien1',      'Email': 'nv1@test.com',         'Tên nhân viên': 'Nguyễn Văn A',      'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '',           'Quyền': '',        'FailedLogins': 0 },
  { ID: 4,  'Tên đăng nhập': 'giamdoc',        'Email': 'gd@test.com',          'Tên nhân viên': 'Lê Văn Giám Đốc',  'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '',           'Quyền': '',        'FailedLogins': 0 },
  { ID: 5,  'Tên đăng nhập': 'phogd1',         'Email': 'pgd1@test.com',        'Tên nhân viên': 'Phạm Phó GĐ 1',    'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '',           'Quyền': '',        'FailedLogins': 0 },
  { ID: 6,  'Tên đăng nhập': 'phogd2',         'Email': 'pgd2@test.com',        'Tên nhân viên': 'Hoàng Phó GĐ 2',   'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '',           'Quyền': '',        'FailedLogins': 0 },
  { ID: 7,  'Tên đăng nhập': 'vanthu',         'Email': 'vt@test.com',          'Tên nhân viên': 'Ngô Thị Văn Thư',  'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '',           'Quyền': '',        'FailedLogins': 0 },
  { ID: 8,  'Tên đăng nhập': 'nhanvien2',      'Email': 'nv2@test.com',         'Tên nhân viên': 'Đỗ Minh Tuấn',     'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '',           'Quyền': '',        'FailedLogins': 0 },
  { ID: 9,  'Tên đăng nhập': 'tpkd',           'Email': 'tpkd@test.com',        'Tên nhân viên': 'Vũ Thị Hương',     'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '',           'Quyền': '',        'FailedLogins': 0 },
  { ID: 10, 'Tên đăng nhập': 'nvkd1',          'Email': 'nvkd1@test.com',       'Tên nhân viên': 'Bùi Đức Thắng',    'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '',           'Quyền': '',        'FailedLogins': 0 },
  { ID: 11, 'Tên đăng nhập': 'newuser',        'Email': 'new@test.com',         'Tên nhân viên': 'Người Mới',         'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '',           'Quyền': '',        'FailedLogins': 0 },
]

const _mockPhongBan = [
  { ID: 1, 'Tên phòng ban': 'Kỹ thuật', 'Mô tả': 'Phòng kỹ thuật & phát triển', 'Người phụ trách': '', 'Đơn vị thuộc sự quản lý': '' },
  { ID: 2, 'Tên phòng ban': 'Kinh doanh', 'Mô tả': 'Phòng kinh doanh & marketing', 'Người phụ trách': '', 'Đơn vị thuộc sự quản lý': '' },
]

const _mockAssignments = [
  // Ban Giám Đốc
  { ID: 1, 'UserID': '4', 'Chức vụ': 'Giám đốc', 'PhongBanID': '' },
  { ID: 2, 'UserID': '5', 'Chức vụ': 'Phó GĐ', 'PhongBanID': '' },
  { ID: 3, 'UserID': '6', 'Chức vụ': 'Phó GĐ', 'PhongBanID': '' },
  // Văn thư & Quản trị
  { ID: 4, 'UserID': '1', 'Chức vụ': 'admin', 'PhongBanID': '' },
  { ID: 5, 'UserID': '7', 'Chức vụ': 'Văn thư', 'PhongBanID': '' },
  // Phòng Kỹ thuật
  { ID: 6, 'UserID': '2', 'Chức vụ': 'Trưởng phòng', 'PhongBanID': '1' },
  { ID: 7, 'UserID': '3', 'Chức vụ': 'Nhân viên', 'PhongBanID': '1' },
  { ID: 8, 'UserID': '8', 'Chức vụ': 'Nhân viên', 'PhongBanID': '1' },
  // Phòng Kinh doanh
  { ID: 9, 'UserID': '9', 'Chức vụ': 'Trưởng phòng', 'PhongBanID': '2' },
  { ID: 10, 'UserID': '10', 'Chức vụ': 'Nhân viên', 'PhongBanID': '2' },
]

const _mockApps = [
  { ID: 1, 'Tên App': 'Quản lý Tài liệu', 'Webapp URL': 'http://127.0.0.1:5173/', 'Icon': 'description', 'Mô tả': 'Quản lý hồ sơ, tài liệu', 'Trạng thái': 'Active', 'Quyền xem': '' },
  { ID: 2, 'Tên App': 'Quản lý Công việc', 'Webapp URL': 'http://127.0.0.1:5175/', 'Icon': 'task', 'Mô tả': 'Quản lý công việc, dự án', 'Trạng thái': 'Active', 'Quyền xem': '' },
]

async function mockCall(fn, ...args) {
  await new Promise(r => setTimeout(r, 80))
  console.log('[gasClient mock]', fn, args)

  switch (fn) {
    case 'api_login': {
      const [email, password] = args
      const loginEmail = (email || '').toLowerCase()
      const mockUser = _mockUsers.find(u => u['Email'].toLowerCase() === loginEmail)
      if (!mockUser) throw new Error('Email hoặc mật khẩu không đúng')
      if (mockUser['Trạng thái'] === 'Locked') throw new Error('Tài khoản đã bị khóa. Liên hệ quản trị viên.')
      if (password !== 'Admin@@123') {
        mockUser['FailedLogins'] = (mockUser['FailedLogins'] || 0) + 1
        if (mockUser['FailedLogins'] >= 5) {
          mockUser['Trạng thái'] = 'Locked'
          throw new Error('Tài khoản đã bị khóa do nhập sai mật khẩu quá 5 lần. Liên hệ quản trị viên.')
        }
        throw new Error('Email hoặc mật khẩu không đúng')
      }
      mockUser['FailedLogins'] = 0
      const isOwner = mockUser['Email'] === 'admin@test.com'
      const isAdmin = isOwner || mockUser['Quyền'] === 'Quản trị'
      _mockSession = { userId: mockUser.ID, username: mockUser['Tên đăng nhập'], email: mockUser['Email'], displayName: mockUser['Tên nhân viên'] || mockUser['Email'], role: isAdmin ? 'admin' : 'user', isOwner, mustChangePass: mockUser['MustChangePass'] === 'TRUE', ssoToken: 'mock-sso-token-' + mockUser.ID }
      _pushLog('Đăng nhập', 'Xác thực', mockUser['Email'], args[2] || 'desktop')
      return { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token', user: { ..._mockSession }, parentSheetId: 'mock-sheet-id' }
    }
    case 'api_logout':
      _pushLog('Đăng xuất', 'Xác thực', _mockSession?.username || '', '')
      _mockSession = null
      return { success: true }
    case 'api_resume': {
      // args[0] is refreshToken (string), ignored in mock
      if (_mockSession) {
        return {
          accessToken: 'mock-access-token-' + Date.now(),
          refreshToken: 'mock-refresh-token-' + Date.now(),
          user: { ..._mockSession },
          parentSheetId: 'mock-sheet-id',
        }
      }
      throw new Error('TOKEN_REVOKED')
    }
    case 'api_changePassword':
      if (_mockSession) _mockSession.mustChangePass = false
      return { success: true }
    case 'api_adminResetPassword':
    case 'api_lockUser':
      return { success: true }
    case 'api_unlockUser': {
      const targetId = args[1]
      const target = _mockUsers.find(u => String(u.ID) === String(targetId))
      if (target) { target['Trạng thái'] = 'Active'; target['FailedLogins'] = 0; target['MustChangePass'] = 'TRUE' }
      return { success: true }
    }
    case 'api_getUsers': {
      // Mock visibility: owner hidden, admins hide each other
      const isOwner = _mockSession?.isOwner
      return _mockUsers.filter(u => {
        if (u['Email'] === 'admin@test.com') return false // owner always hidden
        if (isOwner) return true
        return u['Quyền'] !== 'Quản trị'
      }).map(u => ({ ...u }))
    }
    case 'api_addUser': {
      _pushLog('Thêm', 'Người dùng', args[1]['Email'] || '', '')
      const newUser = { ID: ++_nextId, ...args[1], 'Trạng thái': 'Active', 'MustChangePass': 'TRUE', 'Phòng ban': '', 'Chức vụ': '', 'FailedLogins': 0 }
      _mockUsers.push(newUser)
      return { ...newUser }
    }
    case 'api_updateUser': {
      const uid = args[1]
      const updates = args[2]
      const target = _mockUsers.find(u => String(u.ID) === String(uid))
      if (target && updates) Object.assign(target, updates)
      return { success: true }
    }
    case 'api_getApps':
      return _mockApps.map(a => ({ ...a }))
    case 'api_addApp':
      { const newApp = { ID: ++_nextId, ...args[1], 'Trạng thái': 'Active', 'Quyền xem': '' }; _mockApps.push(newApp); return { ...newApp } }
    case 'api_updateApp': {
      const appId = args[1]
      const appUpdates = args[2]
      const app = _mockApps.find(a => String(a.ID) === String(appId))
      if (app && appUpdates) Object.assign(app, appUpdates)
      return { success: true }
    }
    case 'api_deleteApp': {
      const delAppIdx = _mockApps.findIndex(a => String(a.ID) === String(args[1]))
      if (delAppIdx !== -1) _mockApps.splice(delAppIdx, 1)
      return { success: true }
    }
    case 'api_getSsoParams':
      return { email: _mockSession?.email || '', ssoToken: _mockSession?.ssoToken || '', parentSheetId: 'mock-sheet-id' }
    case 'api_portalSync': {
      let syncApps = _mockApps.map(a => ({ ...a }))
      if (_mockSession?.role !== 'admin') {
        const uid = String(_mockSession?.userId)
        syncApps = syncApps.filter(a => {
          if (!a['Quyền xem']) return true
          try { const arr = JSON.parse(a['Quyền xem']); return Array.isArray(arr) && arr.indexOf(uid) !== -1 } catch(_) { return true }
        })
      }
      const result = { apps: syncApps }
      if (_mockSession?.role === 'admin') {
        result.users = _mockUsers.filter(u => u['Email'] !== 'admin@test.com').map(u => ({ ...u }))
        result.phongBan = _mockPhongBan.map(pb => ({ ...pb }))
        result.assignments = _mockAssignments.map(a => ({ ...a }))
        result.mailConfig = { MAIL_ENABLED: 'FALSE' }
      }
      return result
    }
    case 'api_getPhongBan':
      return _mockPhongBan.map(pb => ({ ...pb }))
    case 'api_addPhongBan': {
      const newDept = { ID: ++_nextId, 'Tên phòng ban': args[1]['Tên phòng ban'], 'Mô tả': args[1]['Mô tả'] || '', 'Người phụ trách': args[1]['Người phụ trách'] || '', 'Đơn vị thuộc sự quản lý': args[1]['Đơn vị thuộc sự quản lý'] || '' }
      _mockPhongBan.push(newDept)
      return { ...newDept }
    }
    case 'api_updatePhongBan': {
      const deptId = args[1]
      const deptUpdates = args[2]
      const dept = _mockPhongBan.find(d => String(d.ID) === String(deptId))
      if (dept && deptUpdates) {
        for (const k of ['Tên phòng ban', 'Mô tả', 'Trưởng', 'Phó', 'Người phụ trách', 'Đơn vị thuộc sự quản lý']) {
          if (deptUpdates[k] !== undefined) dept[k] = deptUpdates[k]
        }
      }
      return { success: true }
    }
    case 'api_deletePhongBan': {
      const delId = args[1]
      const delIdx = _mockPhongBan.findIndex(d => String(d.ID) === String(delId))
      if (delIdx !== -1) {
        // Cascade: remove assignments for this dept
        for (let i = _mockAssignments.length - 1; i >= 0; i--) {
          if (String(_mockAssignments[i]['PhongBanID']) === String(delId)) _mockAssignments.splice(i, 1)
        }
        _mockPhongBan.splice(delIdx, 1)
      }
      return { success: true }
    }
    case 'api_getOrgStructure':
      return {
        assignments: _mockAssignments.map(a => ({ ...a })),
        departments: _mockPhongBan.map(d => ({ ID: d.ID, 'Tên phòng ban': d['Tên phòng ban'] })),
        positions: [
          { code: 'admin', rank: 100, scope: 'company', max: -1 },
          { code: 'Giám đốc', rank: 90, scope: 'company', max: 1 },
          { code: 'Phó GĐ', rank: 80, scope: 'company', max: -1 },
          { code: 'Trưởng phòng', rank: 70, scope: 'dept', max: 1 },
          { code: 'Văn thư', rank: 60, scope: 'company', max: -1 },
          { code: 'Phó phòng', rank: 50, scope: 'dept', max: -1 },
          { code: 'Nhân viên', rank: 10, scope: 'dept', max: -1 },
        ],
        users: _mockUsers.map(u => ({ ID: u.ID, 'Tên nhân viên': u['Tên nhân viên'] || '', 'Email': u['Email'] || '' })),
      }
    case 'api_saveAssignment': {
      const aData = args[1]
      const newAssignment = { ID: ++_nextId, 'UserID': String(aData.userId), 'Chức vụ': aData.chucVu, 'PhongBanID': aData.phongBanId || '' }
      _mockAssignments.push(newAssignment)
      return { ...newAssignment }
    }
    case 'api_removeAssignment': {
      const aId = args[1]
      const aIdx = _mockAssignments.findIndex(a => String(a.ID) === String(aId))
      if (aIdx !== -1) _mockAssignments.splice(aIdx, 1)
      return { success: true }
    }
    case 'api_batchSaveAssignments': {
      const ops = args[1] || {}
      const bRemoves = ops.removes || []
      const bAdds = ops.adds || []
      bRemoves.forEach(rid => {
        const idx = _mockAssignments.findIndex(a => String(a.ID) === String(rid))
        if (idx !== -1) _mockAssignments.splice(idx, 1)
      })
      bAdds.forEach(d => {
        _mockAssignments.push({ ID: ++_nextId, 'UserID': String(d.userId), 'Chức vụ': d.chucVu, 'PhongBanID': d.phongBanId || '' })
      })
      return { success: true, added: bAdds.length, removed: bRemoves.length }
    }
    case 'api_getMailConfig':
      return { MAIL_ENABLED: 'FALSE' }
    case 'api_saveMailConfig':
      _pushLog('Cài đặt email', 'Hệ thống', '', '')
      return { success: true }
    case 'api_getAuditLogs': {
      const filters = args[1] || {}
      const limit = Math.max(1, Number(filters.limit || 20))
      const offset = Math.max(0, Number(filters.offset || 0))
      const keyword = String(filters.keyword || '').toLowerCase()
      let logs = [..._mockLogs]
      const types = []
      logs.forEach(l => { const t = l['Loại'] || ''; if (t && !types.includes(t)) types.push(t) })
      if (filters.type) logs = logs.filter(l => l['Loại'] === filters.type)
      if (keyword) logs = logs.filter(l =>
        String(l['Người dùng'] || '').toLowerCase().includes(keyword) ||
        String(l['Đối tượng'] || '').toLowerCase().includes(keyword) ||
        String(l['Chi tiết'] || '').toLowerCase().includes(keyword)
      )
      return { data: logs.slice(offset, offset + limit), hasMore: offset + limit < logs.length, total: logs.length, types }
    }
    default:
      throw new Error('Mock không hỗ trợ: ' + fn)
  }
}
