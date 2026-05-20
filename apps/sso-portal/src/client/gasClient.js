// GAS client — calls google.script.run (real) or mock (dev)

const IS_GAS = typeof google !== 'undefined' && google.script && google.script.run

const ACCESS_KEY = 'sso_access_token'
const REFRESH_KEY = 'sso_refresh_token'
const USER_KEY = 'sso_user'
const PARENT_SHEET_KEY = 'sso_parent_sheet_id'

let _refreshInFlight = null

function _doRefresh() {
  if (_refreshInFlight) return _refreshInFlight
  const rt = localStorage.getItem(REFRESH_KEY)
  if (!rt) return Promise.reject(new Error('TOKEN_REVOKED'))
  _refreshInFlight = new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(res => {
        _refreshInFlight = null
        if (res && res.success) {
          const p = res.payload
          localStorage.setItem(ACCESS_KEY, p.accessToken)
          localStorage.setItem(REFRESH_KEY, p.refreshToken)
          localStorage.setItem(USER_KEY, JSON.stringify(p.user))
          if (p.parentSheetId) localStorage.setItem(PARENT_SHEET_KEY, p.parentSheetId)
          resolve(p.accessToken)
        } else {
          localStorage.removeItem(ACCESS_KEY)
          localStorage.removeItem(REFRESH_KEY)
          localStorage.removeItem(USER_KEY)
          reject(new Error((res && res.error) || 'TOKEN_REVOKED'))
        }
      })
      .withFailureHandler(err => {
        _refreshInFlight = null
        reject(err)
      })
      .api_resume(rt)
  })
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
  { ID: 1, 'Tên đăng nhập': 'admin@test.com', 'Email': 'admin@test.com', 'Tên nhân viên': '', 'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '2024-01-15', 'Phòng ban': '', 'Quyền': 'Quản trị' },
  { ID: 2, 'Tên đăng nhập': 'huyenvv', 'Email': 'huyenvv.it@gmail.com', 'Tên nhân viên': 'Vũ Văn Huyên', 'Trạng thái': 'Active', 'MustChangePass': 'TRUE', 'Đăng nhập cuối': '', 'Phòng ban': 'Kỹ thuật', 'Quyền': '' },
  { ID: 3, 'Tên đăng nhập': 'nhanvien1', 'Email': 'nv1@test.com', 'Tên nhân viên': 'Nguyễn Văn A', 'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'Đăng nhập cuối': '', 'Phòng ban': 'Kinh doanh', 'Quyền': '' },
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
      if (loginEmail === 'admin@test.com' && password === 'Admin@@123') {
        _mockSession = { userId: 1, username: 'admin@test.com', email: 'admin@test.com', displayName: 'admin@test.com', role: 'admin', isOwner: true, mustChangePass: false, ssoToken: 'mock-sso-token' }
        return { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token', user: { ..._mockSession }, parentSheetId: 'mock-sheet-id' }
      }
      if (loginEmail === 'huyenvv.it@gmail.com' && password === 'Admin@@123') {
        _mockSession = { userId: 2, username: 'huyenvv', email: 'huyenvv.it@gmail.com', displayName: 'Vũ Văn Huyên', role: 'user', isOwner: false, mustChangePass: true, ssoToken: 'mock-sso-token-2' }
        return { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token', user: { ..._mockSession }, parentSheetId: 'mock-sheet-id' }
      }
      if (loginEmail === 'nv1@test.com' && password === 'Admin@@123') {
        _mockSession = { userId: 3, username: 'nhanvien1', email: 'nv1@test.com', displayName: 'Nguyễn Văn A', role: 'user', isOwner: false, mustChangePass: false, ssoToken: 'mock-sso-token-3' }
        return { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token', user: { ..._mockSession }, parentSheetId: 'mock-sheet-id' }
      }
      throw new Error('Email hoặc mật khẩu không đúng')
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
    case 'api_unlockUser':
      return { success: true }
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
      return { ID: ++_nextId, ...args[1], 'Trạng thái': 'Active', 'MustChangePass': 'TRUE' }
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
    case 'api_getMailConfig':
      return { MAIL_ENABLED: 'FALSE' }
    case 'api_saveMailConfig':
      return { success: true }
    case 'api_createHandoff': {
      // args[0] = accessToken, args[1] = appId (app ID number)
      return { handoffToken: 'mock-handoff-' + Date.now() }
    }
    case 'api_logoutAllDevices':
      _mockSession = null
      return { success: true }
    default:
      throw new Error('Mock không hỗ trợ: ' + fn)
  }
}
