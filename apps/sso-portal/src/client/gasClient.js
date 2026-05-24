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

const _mockUsers = [
  { ID: 1, 'Tên đăng nhập': 'admin@test.com', 'Email': 'admin@test.com', 'Tên nhân viên': '', 'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '2024-01-15', 'Phòng ban': '', 'Quyền': 'Quản trị', 'Chức vụ': 'admin', 'FailedLogins': 0 },
  { ID: 2, 'Tên đăng nhập': 'huyenvv', 'Email': 'huyenvv.it@gmail.com', 'Tên nhân viên': 'Vũ Văn Huyên', 'Trạng thái': 'Active', 'MustChangePass': 'TRUE', 'Đăng nhập cuối': '', 'Phòng ban': 'Kỹ thuật', 'Quyền': '', 'Chức vụ': 'Trưởng phòng', 'FailedLogins': 0 },
  { ID: 3, 'Tên đăng nhập': 'nhanvien1', 'Email': 'nv1@test.com', 'Tên nhân viên': 'Nguyễn Văn A', 'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '', 'Phòng ban': 'Kinh doanh', 'Quyền': '', 'Chức vụ': 'Nhân viên', 'FailedLogins': 0 },
]

const _mockPhongBan = [
  { ID: 1, 'Tên phòng ban': 'Kỹ thuật', 'Trưởng': 'huyenvv', 'Phó': '' },
  { ID: 2, 'Tên phòng ban': 'Kinh doanh', 'Trưởng': '', 'Phó': '' },
]

const _mockApps = [
  { ID: 1, 'Tên App': 'Quản lý Tài liệu', 'Webapp URL': 'http://localhost:5173/', 'Icon': 'description', 'Mô tả': 'Quản lý hồ sơ, tài liệu', 'Trạng thái': 'Active' },
  { ID: 2, 'Tên App': 'Quản lý Công việc', 'Webapp URL': 'http://localhost:5175/', 'Icon': 'task_alt', 'Mô tả': 'Quản lý công việc, dự án', 'Trạng thái': 'Active' },
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
      return { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token', user: { ..._mockSession }, parentSheetId: 'mock-sheet-id' }
    }
    case 'api_logout':
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
    case 'api_addUser':
      return { ID: ++_nextId, ...args[1], 'Trạng thái': 'Active', 'MustChangePass': 'TRUE', 'Chức vụ': args[1]['Chức vụ'] || 'Nhân viên', 'FailedLogins': 0 }
    case 'api_updateUser':
      return { success: true }
    case 'api_getApps':
      return _mockApps.map(a => ({ ...a }))
    case 'api_addApp':
      return { ID: ++_nextId, ...args[1], 'Trạng thái': 'Active' }
    case 'api_updateApp':
      return { success: true }
    case 'api_deleteApp':
      return { success: true }
    case 'api_getSsoParams':
      return { email: _mockSession?.email || '', ssoToken: _mockSession?.ssoToken || '', parentSheetId: 'mock-sheet-id' }
    case 'api_portalSync': {
      const result = { apps: _mockApps.map(a => ({ ...a })) }
      if (_mockSession?.role === 'admin') {
        result.users = _mockUsers.filter(u => u['Email'] !== 'admin@test.com').map(u => ({ ...u }))
        result.phongBan = _mockPhongBan.map(pb => ({ ...pb }))
        result.mailConfig = { MAIL_ENABLED: 'FALSE' }
      }
      return result
    }
    case 'api_getPhongBan':
      return _mockPhongBan.map(pb => ({ ...pb }))
    case 'api_addPhongBan':
      return { ID: ++_nextId, ...args[1] }
    case 'api_updatePhongBan':
      return { success: true }
    case 'api_deletePhongBan':
      return { success: true }
    case 'api_getMailConfig':
      return { MAIL_ENABLED: 'FALSE' }
    case 'api_saveMailConfig':
      return { success: true }
    default:
      throw new Error('Mock không hỗ trợ: ' + fn)
  }
}
