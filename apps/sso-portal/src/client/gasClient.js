// GAS client — calls google.script.run (real) or mock (dev)

const IS_GAS = typeof google !== 'undefined' && google.script && google.script.run

function _isSessionExpired(msg) {
  return msg && (msg.includes('hết hạn') || msg.includes('Phiên đăng nhập'))
}

function gasCall(fnName, ...args) {
  if (IS_GAS) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(res => {
          if (res && res.success) {
            resolve(res.payload)
          } else {
            const errMsg = res ? res.error : 'Lỗi không xác định'
            if (_isSessionExpired(errMsg) && typeof window.__onSessionExpired === 'function') {
              window.__onSessionExpired()
            }
            reject(new Error(errMsg))
          }
        })
        .withFailureHandler(err => reject(new Error(err.message || String(err))))
        [fnName](...args)
    })
  }
  return mockCall(fnName, ...args)
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
        return { token: 'mock-token', ssoToken: 'mock-sso-token', parentSheetId: 'mock-sheet-id', user: { ..._mockSession } }
      }
      if (loginEmail === 'huyenvv.it@gmail.com' && password === 'Admin@@123') {
        _mockSession = { userId: 2, username: 'huyenvv', email: 'huyenvv.it@gmail.com', displayName: 'Vũ Văn Huyên', role: 'user', isOwner: false, mustChangePass: true, ssoToken: 'mock-sso-token-2' }
        return { token: 'mock-token-2', ssoToken: 'mock-sso-token-2', parentSheetId: 'mock-sheet-id', user: { ..._mockSession } }
      }
      if (loginEmail === 'nv1@test.com' && password === 'Admin@@123') {
        _mockSession = { userId: 3, username: 'nhanvien1', email: 'nv1@test.com', displayName: 'Nguyễn Văn A', role: 'user', isOwner: false, mustChangePass: false, ssoToken: 'mock-sso-token-3' }
        return { token: 'mock-token-3', ssoToken: 'mock-sso-token-3', parentSheetId: 'mock-sheet-id', user: { ..._mockSession } }
      }
      throw new Error('Email hoặc mật khẩu không đúng')
    }
    case 'api_logout':
      _mockSession = null
      return { success: true }
    case 'api_validateSession':
      if (_mockSession) return { ..._mockSession }
      throw new Error('Phiên đăng nhập hết hạn')
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
    default:
      throw new Error('Mock không hỗ trợ: ' + fn)
  }
}
