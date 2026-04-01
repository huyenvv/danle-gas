// GAS client — calls google.script.run (real) or mock (dev)
// All calls return Promises resolving to payload or rejecting with error message.

const IS_GAS = typeof google !== 'undefined' && google.script && google.script.run

// ── Wrapper ──────────────────────────────────────────────────────────────────
function gasCall(fnName, ...args) {
  if (IS_GAS) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(res => {
          if (res && res.success) resolve(res.payload)
          else reject(new Error(res ? res.error : 'Lỗi không xác định'))
        })
        .withFailureHandler(err => reject(new Error(err.message || String(err))))
        [fnName](...args)
    })
  }
  // Dev mock (never used in production build)
  return mockCall(fnName, ...args)
}

export default gasCall

// ── Dev mock ─────────────────────────────────────────────────────────────────
let _mockSession = null

async function mockCall(fn, ...args) {
  await delay(80)
  // eslint-disable-next-line no-console
  console.log('[gasClient mock]', fn, args)
  switch (fn) {
    case 'api_login': {
      const [username, password] = args
      if (username === 'admin' && password === 'admin123') {
        _mockSession = { token: 'mock-token', user: { userId: 1, username: 'admin', role: 'admin', email: 'admin@test.com', mustChangePass: false } }
        return _mockSession
      }
      throw new Error('Tên đăng nhập hoặc mật khẩu không đúng')
    }
    case 'api_logout':
      _mockSession = null
      return { success: true }
    case 'api_validateSession':
      if (_mockSession) return _mockSession
      throw new Error('Phiên đăng nhập hết hạn')
    case 'api_getAllData':
      return {
        danhMuc: [
          { ID: 1, 'Tên danh mục': 'Hợp đồng', Icon: '📄', 'Màu sắc': '#3b82f6' },
          { ID: 2, 'Tên danh mục': 'Công văn',  Icon: '📋', 'Màu sắc': '#10b981' },
          { ID: 3, 'Tên danh mục': 'Báo cáo',   Icon: '📊', 'Màu sắc': '#f59e0b' },
        ],
        phongBan: [],
        duAn: [],
        nhaCungCap: [],
      }
    case 'api_getDocuments':
      return {
        data: [
          { ID: 1, 'Tên hồ sơ': 'Hợp đồng mua sắm CNTT', 'Danh mục': 1, 'Trạng thái': 'Hiệu lực', 'Giá trị HĐ': 100000000, 'Giá trị thực hiện': 80000000, 'Chênh lệch': 20000000, 'Ngày tạo': '2024-01-15' },
          { ID: 2, 'Tên hồ sơ': 'Công văn số 01/2024',    'Danh mục': 2, 'Trạng thái': 'Hiệu lực', 'Giá trị HĐ': 0, 'Giá trị thực hiện': 0, 'Chênh lệch': 0, 'Ngày tạo': '2024-02-01' },
        ]
      }
    case 'api_getDocumentStats':
      return { total: 2, byStatus: { 'Hiệu lực': 2 }, totalValue: 100000000, totalExecuted: 80000000, totalDiff: 20000000 }
    case 'api_createDocument':
      return { ...(args[1] || {}), ID: Date.now() }
    case 'api_updateDocument':
      return { success: true }
    case 'api_deleteDocument':
      return { success: true }
    case 'api_addCategory':
    case 'api_updateCategory':
    case 'api_deleteCategory':
      return { success: true }
    case 'api_addLoaiHoSo':
    case 'api_updateLoaiHoSo':
    case 'api_deleteLoaiHoSo':
      return { success: true }
    case 'api_addUser':
    case 'api_updateUser':
      return { success: true }
    case 'api_changePassword':
      return { success: true }
    case 'api_adminResetPassword':
    case 'api_lockUser':
    case 'api_unlockUser':
      return { success: true }
    case 'api_getConfig':
      return { value: null }
    case 'api_setConfig':
      return { success: true }
    default:
      throw new Error('Mock không hỗ trợ: ' + fn)
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
