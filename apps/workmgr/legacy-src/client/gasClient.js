// GAS client — calls google.script.run (real) or mock (dev)
// All calls return Promises resolving to payload or rejecting with error message.

const IS_GAS = typeof google !== 'undefined' && google.script && google.script.run

const ACCESS_KEY = 'workmgr_access_token'
const REFRESH_KEY = 'workmgr_refresh_token'
const USER_KEY = 'workmgr_user'

// ── Wrapper ──────────────────────────────────────────────────────────────────
function _isSessionExpired(msg) {
  return msg && (msg.includes('hết hạn') || msg.includes('Phiên đăng nhập'))
}

function _isRetryableError(msg) {
  if (!msg) return false
  const text = String(msg).toLowerCase()
  return (
    text.includes('timed out') ||
    text.includes('timeout') ||
    text.includes('rate limit') ||
    text.includes('quota') ||
    text.includes('too many') ||
    text.includes('service invoked too many times') ||
    text.includes('try again later') ||
    text.includes('resource has been exhausted') ||
    text.includes('service unavailable') ||
    text.includes('internal error') ||
    text.includes('server error') ||
    text.includes('service error') ||
    text.includes('backend error') ||
    text.includes('network') ||
    text.includes('failed to fetch') ||
    text.includes("we're sorry, a server error occurred")
  )
}

function _getRetryPolicy(fnName) {
  if (fnName === 'api_getDashboardStats' || fnName === 'api_getTasks') {
    return { retries: 5, baseDelayMs: 1500 }
  }
  return { retries: 2, baseDelayMs: 1000 }
}

function _getRetryDelay(baseDelayMs, retriesLeft, totalRetries) {
  const attempt = Math.max(0, totalRetries - retriesLeft)
  const backoff = baseDelayMs * Math.pow(2, attempt)
  const jitter = Math.floor(Math.random() * 250)
  return backoff + jitter
}

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

// GAS Call Queue to prevent concurrent request limits and auto-retry
const _queue = []
let _activeCount = 0
const MAX_CONCURRENT = 3

function _processQueue() {
  if (_queue.length === 0 || _activeCount >= MAX_CONCURRENT) return
  _activeCount++
  const { fnName, args, resolve, reject, retries, totalRetries, baseDelayMs, refreshAttempted } = _queue.shift()

  function requeue() {
    setTimeout(() => {
      _queue.push({ fnName, args, resolve, reject, retries: retries - 1, totalRetries, baseDelayMs })
      _processQueue()
    }, _getRetryDelay(baseDelayMs, retries, totalRetries))
  }

  google.script.run
    .withSuccessHandler(res => {
      if (res && res.success) {
        _activeCount--
        resolve(res.payload)
        _processQueue()
        return
      }

      const errMsg = res ? res.error : 'Lỗi không xác định'

      if (errMsg === 'TOKEN_EXPIRED' && !refreshAttempted) {
        _doRefresh()
          .then(newAccess => {
            _activeCount--
            const newArgs = [...args]
            // First arg is the access token for all authenticated calls
            if (newArgs.length > 0 && typeof newArgs[0] === 'string' && newArgs[0].length > 10) {
              newArgs[0] = newAccess
            }
            _queue.unshift({ fnName, args: newArgs, resolve, reject, retries, totalRetries, baseDelayMs, refreshAttempted: true })
            _processQueue()
          })
          .catch(refreshErr => {
            _activeCount--
            window.dispatchEvent(new CustomEvent('auth:sessionExpired', { detail: { message: refreshErr.message } }))
            reject(new Error(refreshErr.message))
            _processQueue()
          })
        return
      }

      _activeCount--

      if (_isSessionExpired(errMsg) || errMsg === 'TOKEN_EXPIRED' || errMsg === 'TOKEN_REVOKED' || errMsg === 'USER_LOCKED') {
        window.dispatchEvent(new CustomEvent('auth:sessionExpired', { detail: { message: errMsg } }))
        reject(new Error(errMsg))
        _processQueue()
        return
      }

      if (retries > 0 && _isRetryableError(errMsg)) {
        requeue()
      } else {
        reject(new Error(errMsg))
      }
      _processQueue()
    })
    .withFailureHandler(err => {
      _activeCount--
      const msg = err.message || String(err)
      if (retries > 0 && !_isSessionExpired(msg) && _isRetryableError(msg)) {
        requeue()
      } else {
        reject(new Error(msg))
      }
      _processQueue()
    })
    [fnName](...args)
}

function gasCall(fnName, ...args) {
  if (IS_GAS) {
    const policy = _getRetryPolicy(fnName)
    return new Promise((resolve, reject) => {
      _queue.push({ fnName, args, resolve, reject, retries: policy.retries, totalRetries: policy.retries, baseDelayMs: policy.baseDelayMs })
      _processQueue()
    })
  }
  return mockCall(fnName, ...args)
}
export default gasCall

// ── Dev mock ─────────────────────────────────────────────────────────────────
let _mockSession = null
let _nextId = 100
const _mockComments = []
let _nextCommentId = 1

const ADMIN_PERMS = { phongBan: { c:true,r:true,u:true,d:true }, congViec: { c:true,r:true,u:true,d:true }, nhan: { c:true,r:true,u:true,d:true }, user: { c:true,r:true,u:true,d:true }, caiDat: { c:true,r:true,u:true,d:true } }

const _mockData = {
  users: [
    { ID: 1, 'Tên đăng nhập': 'admin', 'Tên nhân viên': 'Admin Hệ thống', 'Email': 'admin@test.com', 'Quyền': 'admin', 'Trạng thái': 'Active' },
    { ID: 2, 'Tên đăng nhập': 'leader1', 'Tên nhân viên': 'Nguyễn Văn Hùng', 'Email': 'hung@test.com', 'Quyền': 'Trưởng phòng', 'Trạng thái': 'Active' },
    { ID: 3, 'Tên đăng nhập': 'nhanvien1', 'Tên nhân viên': 'Trần Thị Mai', 'Email': 'mai@test.com', 'Quyền': 'Nhân viên', 'Trạng thái': 'Active' },
  ],
  phongBan: [
    { ID: 1, 'Tên phòng ban': 'Phòng Công Nghệ', 'Mô tả': 'Phát triển phần mềm', 'Trưởng phòng ID': '2', 'Phó phòng ID': '', 'PGĐ phụ trách ID': '', 'Thành viên': '2,3', 'Đơn vị quản lý': '', 'Sheet Name': 'CV_1' },
    { ID: 2, 'Tên phòng ban': 'Phòng Marketing', 'Mô tả': 'Marketing và truyền thông', 'Trưởng phòng ID': '1', 'Phó phòng ID': '', 'PGĐ phụ trách ID': '', 'Thành viên': '1,3', 'Đơn vị quản lý': '', 'Sheet Name': 'CV_2' },
    { ID: 3, 'Tên phòng ban': 'Phòng Nhân Sự', 'Mô tả': 'Quản lý nhân sự', 'Trưởng phòng ID': '1', 'Phó phòng ID': '2', 'PGĐ phụ trách ID': '', 'Thành viên': '1,2,3', 'Đơn vị quản lý': '', 'Sheet Name': 'CV_3' },
  ],
  nhan: [
    { ID: 1, 'Tên nhãn': 'Bug', 'Màu sắc': '#e53935' },
    { ID: 2, 'Tên nhãn': 'Feature', 'Màu sắc': '#43a047' },
    { ID: 3, 'Tên nhãn': 'Design', 'Màu sắc': '#fb8c00' },
    { ID: 4, 'Tên nhãn': 'Backend', 'Màu sắc': '#1e88e5' },
    { ID: 5, 'Tên nhãn': 'Urgent', 'Màu sắc': '#c62828' },
  ],
  congViec: [
    { ID: 1, 'Tiêu đề': 'Thiết kế giao diện trang chủ', 'Mô tả': 'Thiết kế mockup và prototype cho trang chủ mới.', 'Phòng ban ID': 1, 'Người thực hiện ID': 3, 'Người giao ID': 2, 'Trạng thái': 'Hoàn Thành', 'Mức độ ưu tiên': 'Cao', 'Ngày bắt đầu': '2026-01-20', 'Ngày hết hạn': '2026-02-10', 'Ngày hoàn thành': '2026-02-08', 'Nhãn': 'Design', 'Tiến độ': 100, 'Người phối hợp': '2', 'Subtasks': JSON.stringify([{ id: 1, title: 'Wireframe desktop', done: true }, { id: 2, title: 'Wireframe mobile', done: true }]), 'Ghi chú': 'Đã duyệt.', 'Ngày tạo': '2026-01-18' },
    { ID: 2, 'Tiêu đề': 'Xây dựng API thanh toán', 'Mô tả': 'Tích hợp cổng thanh toán.', 'Phòng ban ID': 1, 'Người thực hiện ID': 2, 'Người giao ID': 1, 'Trạng thái': 'Đang Thực Hiện', 'Mức độ ưu tiên': 'Cao', 'Ngày bắt đầu': '2026-02-15', 'Ngày hết hạn': '2026-03-15', 'Nhãn': 'Backend,API', 'Tiến độ': 60, 'Người phối hợp': '3', 'Subtasks': JSON.stringify([{ id: 1, title: 'API VNPay', done: true }, { id: 2, title: 'API Momo', done: false }]), 'Ngày tạo': '2026-02-10' },
    { ID: 3, 'Tiêu đề': 'Viết unit test module auth', 'Phòng ban ID': 1, 'Người thực hiện ID': 3, 'Người giao ID': 2, 'Trạng thái': 'Cần Làm', 'Mức độ ưu tiên': 'Trung Bình', 'Ngày bắt đầu': '2026-03-01', 'Ngày hết hạn': '2026-03-20', 'Nhãn': 'Testing', 'Tiến độ': 0, 'Ngày tạo': '2026-02-28' },
  ],
  hoatDong: [
    { ID: 1, 'Loại': 'Tạo phòng ban', 'Mô tả': 'Phòng Công Nghệ', 'Đối tượng': 'Phòng Ban', 'Mã đối tượng': 1, 'UserID': 1, 'Tên người dùng': 'Admin', 'Thời gian': '2026-01-10T08:00:00Z' },
    { ID: 2, 'Loại': 'Tạo công việc', 'Mô tả': 'Thiết kế giao diện trang chủ', 'Đối tượng': 'Công Việc', 'Mã đối tượng': 1, 'UserID': 2, 'Tên người dùng': 'Nguyễn Văn Hùng', 'Thời gian': '2026-01-18T09:30:00Z' },
  ],
}

function _mockAdd(list, data) { const item = { ...data, ID: ++_nextId }; list.push(item); return item }
function _mockUpdate(list, id, data) { const idx = list.findIndex(i => String(i.ID) === String(id)); if (idx === -1) throw new Error('Không tìm thấy'); list[idx] = { ...list[idx], ...data }; return list[idx] }
function _mockDelete(list, id) { const idx = list.findIndex(i => String(i.ID) === String(id)); if (idx === -1) throw new Error('Không tìm thấy'); list.splice(idx, 1); return { success: true } }

async function mockCall(fn, ...args) {
  await new Promise(r => setTimeout(r, 80))
  console.log('[gasClient mock]', fn, args)
  switch (fn) {
    case 'api_ssoLogin':
      _mockSession = { userId: 1, username: 'admin', name: 'Admin Hệ thống', role: 'admin', email: 'admin@test.com', permissions: ADMIN_PERMS }
      return { accessToken: 'mock_access', refreshToken: 'mock_refresh', user: { ..._mockSession } }
    case 'api_resume':
      if (!_mockSession) _mockSession = { userId: 1, username: 'admin', name: 'Admin Hệ thống', role: 'admin', email: 'admin@test.com', permissions: ADMIN_PERMS }
      return { accessToken: 'mock_access', refreshToken: 'mock_refresh', user: { ..._mockSession } }
    case 'api_logout': _mockSession = null; return { success: true }
    case 'api_getAllData':
      return { phongBan: _mockData.phongBan.map(i => ({...i})), nhan: _mockData.nhan.map(i => ({...i})), users: _mockData.users.map(i => ({...i})) }
    case 'api_getDepartments': return _mockData.phongBan.map(i => ({...i}))
    case 'api_getTasks': return _mockData.congViec.map(i => ({...i}))
    case 'api_createTask': return _mockAdd(_mockData.congViec, { ...(args[1]||{}), 'Ngày tạo': new Date().toISOString() })
    case 'api_updateTask': return _mockUpdate(_mockData.congViec, args[1], args[2])
    case 'api_updateTaskStatus': return _mockUpdate(_mockData.congViec, args[1], { 'Trạng thái': args[2] })
    case 'api_deleteTask': return _mockDelete(_mockData.congViec, args[1])
    case 'api_getComments': { const oid = String(args[1]); return _mockComments.filter(c => String(c['Mã đối tượng']) === oid) }
    case 'api_addComment': { const c = { ID: _nextCommentId++, 'Mã đối tượng': args[1], 'Loại đối tượng': args[2]||'Công Việc', UserID: 1, 'Tên người dùng': 'Admin', 'Nội dung': args[3], 'Thời gian': new Date().toISOString() }; _mockComments.push(c); return c }
    case 'api_deleteComment': { const idx = _mockComments.findIndex(c => String(c.ID) === String(args[1])); if (idx !== -1) _mockComments.splice(idx, 1); return { success: true } }
    case 'api_addLabel': return _mockAdd(_mockData.nhan, args[1])
    case 'api_updateLabel': return _mockUpdate(_mockData.nhan, args[1], args[2])
    case 'api_deleteLabel': return _mockDelete(_mockData.nhan, args[1])
    case 'api_getUsers': return _mockData.users.map(u => ({...u}))
    case 'api_updateUser': return { success: true }
    case 'api_removeUserRole': return { success: true }
    case 'api_getDashboardStats': {
      const tasks = _mockData.congViec
      const depts = _mockData.phongBan
      const now = new Date()
      const taskStats = { todo: 0, inProgress: 0, review: 0, completed: 0 }
      const priorityStats = { high: 0, medium: 0, low: 0 }
      let overdue = 0
      tasks.forEach(t => {
        if (t['Trạng thái']==='Cần Làm') taskStats.todo++; else if (t['Trạng thái']==='Đang Thực Hiện') taskStats.inProgress++
        else if (t['Trạng thái']==='Chờ Duyệt') taskStats.review++; else if (t['Trạng thái']==='Hoàn Thành') taskStats.completed++
        if (t['Mức độ ưu tiên']==='Cao') priorityStats.high++; else if (t['Mức độ ưu tiên']==='Trung Bình') priorityStats.medium++; else priorityStats.low++
        if (t['Ngày hết hạn'] && t['Trạng thái']!=='Hoàn Thành' && new Date(t['Ngày hết hạn']) < now) overdue++
      })
      let totalBudget = 0, totalCost = 0
      tasks.forEach(t => { totalBudget += Number(t['Chi phí ước tính'])||0; totalCost += Number(t['Chi phí thực tế'])||0 })
      return {
        totalDepartments: depts.length, totalTasks: tasks.length, totalMembers: _mockData.users.length,
        totalCompleted: taskStats.completed, totalOverdue: overdue,
        totalBudget, totalActualCost: totalCost, taskStats, priorityStats,
        overdueTasks: [], upcomingTasks: [], deptDistribution: [],
      }
    }
    case 'api_getActivities': return { data: _mockData.hoatDong.map(i => ({...i})), hasMore: false, total: _mockData.hoatDong.length, types: [], users: [] }
    case 'api_getAuditLogs': return { data: [], hasMore: false, total: 0, types: [] }
    case 'api_getSchedules': return []
    case 'api_runArchive': return { archived: 0 }
    case 'api_rebuildTaskIndex': return { success: true }
    default: throw new Error('Mock không hỗ trợ: ' + fn)
  }
}
