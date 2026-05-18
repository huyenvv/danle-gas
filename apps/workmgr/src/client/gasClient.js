// GAS client — calls google.script.run (real) or mock (dev)
const IS_GAS = typeof google !== 'undefined' && google.script && google.script.run

function _isSessionExpired(msg) {
  return msg && (msg.includes('hết hạn') || msg.includes('Phiên đăng nhập'))
}
function _isRetryableError(msg) {
  if (!msg) return false
  const text = String(msg).toLowerCase()
  return text.includes('timed out') || text.includes('timeout') || text.includes('rate limit') ||
    text.includes('quota') || text.includes('too many') || text.includes('service invoked too many times') ||
    text.includes('try again later') || text.includes('resource has been exhausted')
}
function _getRetryPolicy(fnName) {
  if (fnName === 'api_getDashboardStats' || fnName === 'api_getTasks') return { retries: 5, baseDelayMs: 1500 }
  return { retries: 2, baseDelayMs: 1000 }
}
function _getRetryDelay(baseDelayMs, retriesLeft, totalRetries) {
  const attempt = Math.max(0, totalRetries - retriesLeft)
  return baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 250)
}

const _queue = []
let _activeCount = 0
const MAX_CONCURRENT = 3

function _processQueue() {
  if (_queue.length === 0 || _activeCount >= MAX_CONCURRENT) return
  _activeCount++
  const { fnName, args, resolve, reject, retries, totalRetries, baseDelayMs } = _queue.shift()
  function requeue() {
    setTimeout(() => {
      _queue.push({ fnName, args, resolve, reject, retries: retries - 1, totalRetries, baseDelayMs })
      _processQueue()
    }, _getRetryDelay(baseDelayMs, retries, totalRetries))
  }
  google.script.run
    .withSuccessHandler(res => {
      _activeCount--
      if (res && res.success) { resolve(res.payload) }
      else {
        const errMsg = res ? res.error : 'Lỗi không xác định'
        if (_isSessionExpired(errMsg)) window.dispatchEvent(new CustomEvent('auth:sessionExpired', { detail: { message: errMsg } }))
        if (retries > 0 && !_isSessionExpired(errMsg) && _isRetryableError(errMsg)) requeue()
        else reject(new Error(errMsg))
      }
      _processQueue()
    })
    .withFailureHandler(err => {
      _activeCount--
      const msg = err.message || String(err)
      if (retries > 0 && !_isSessionExpired(msg) && _isRetryableError(msg)) requeue()
      else reject(new Error(msg))
      _processQueue()
    })[fnName](...args)
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
    { ID: 1, 'Tên phòng ban': 'Phòng Công Nghệ', 'Mô tả': 'Phát triển phần mềm', 'Trưởng phòng ID': 2, 'Phó phòng ID': '', 'PGĐ phụ trách ID': '', 'Thành viên': '2,3', 'Sheet Name': 'CV_1', 'Người tạo': 1, 'Ngày tạo': '2026-01-10' },
    { ID: 2, 'Tên phòng ban': 'Phòng Marketing', 'Mô tả': 'Marketing và truyền thông', 'Trưởng phòng ID': 1, 'Phó phòng ID': '', 'PGĐ phụ trách ID': '', 'Thành viên': '1,3', 'Sheet Name': 'CV_2', 'Người tạo': 1, 'Ngày tạo': '2026-02-01' },
    { ID: 3, 'Tên phòng ban': 'Phòng Nhân Sự', 'Mô tả': 'Quản lý nhân sự', 'Trưởng phòng ID': 1, 'Phó phòng ID': 2, 'PGĐ phụ trách ID': '', 'Thành viên': '1,2,3', 'Sheet Name': 'CV_3', 'Người tạo': 1, 'Ngày tạo': '2026-02-15' },
  ],
  nhan: [
    { ID: 1, 'Tên nhãn': 'Bug', 'Màu sắc': '#e53935' },
    { ID: 2, 'Tên nhãn': 'Feature', 'Màu sắc': '#43a047' },
    { ID: 3, 'Tên nhãn': 'Design', 'Màu sắc': '#fb8c00' },
    { ID: 4, 'Tên nhãn': 'Backend', 'Màu sắc': '#1e88e5' },
    { ID: 5, 'Tên nhãn': 'Urgent', 'Màu sắc': '#c62828' },
  ],
  congViec: [
    { ID: 1, 'Tiêu đề': 'Thiết kế giao diện trang chủ', 'Mô tả': 'Thiết kế mockup và prototype cho trang chủ mới, bao gồm responsive cho mobile/tablet.', 'Phòng ban ID': 1, 'Người thực hiện ID': 3, 'Người giao ID': 2, 'Trạng thái': 'Hoàn Thành', 'Mức độ ưu tiên': 'Cao', 'Ngày bắt đầu': '2026-01-20', 'Ngày hết hạn': '2026-02-10', 'Ngày hoàn thành': '2026-02-08', 'Nhãn': 'Design', 'Tiến độ': 100, 'Người phối hợp': '2', 'Subtasks': JSON.stringify([{ id: 1, title: 'Wireframe desktop', done: true }, { id: 2, title: 'Wireframe mobile', done: true }, { id: 3, title: 'Prototype Figma', done: true }]), 'Ghi chú': 'Đã duyệt lần cuối bởi GĐ.', 'Ngày tạo': '2026-01-18' },
    { ID: 2, 'Tiêu đề': 'Xây dựng API thanh toán', 'Mô tả': 'Tích hợp cổng thanh toán VNPay và Momo, xử lý callback và webhook.', 'Phòng ban ID': 1, 'Người thực hiện ID': 2, 'Người giao ID': 1, 'Trạng thái': 'Đang Thực Hiện', 'Mức độ ưu tiên': 'Cao', 'Ngày bắt đầu': '2026-02-15', 'Ngày hết hạn': '2026-03-15', 'Nhãn': 'Backend,API', 'Tiến độ': 60, 'Người phối hợp': '3', 'Subtasks': JSON.stringify([{ id: 1, title: 'API VNPay', done: true }, { id: 2, title: 'API Momo', done: false }, { id: 3, title: 'Webhook handler', done: false }, { id: 4, title: 'Unit tests', done: false }]), 'Ghi chú': 'Cần hoàn thành trước khi deploy v1.0', 'Ngày tạo': '2026-02-10' },
    { ID: 3, 'Tiêu đề': 'Viết unit test module auth', 'Mô tả': 'Bổ sung test coverage cho module authentication: login, logout, token refresh.', 'Phòng ban ID': 1, 'Người thực hiện ID': 3, 'Người giao ID': 2, 'Trạng thái': 'Cần Làm', 'Mức độ ưu tiên': 'Trung Bình', 'Ngày bắt đầu': '2026-03-01', 'Ngày hết hạn': '2026-03-20', 'Nhãn': 'Testing', 'Tiến độ': 0, 'Subtasks': JSON.stringify([{ id: 1, title: 'Test login flow', done: false }, { id: 2, title: 'Test token refresh', done: false }]), 'Ngày tạo': '2026-02-28' },
    { ID: 4, 'Tiêu đề': 'Fix lỗi responsive mobile', 'Mô tả': 'Menu sidebar bị che content trên màn hình < 768px.', 'Phòng ban ID': 1, 'Người thực hiện ID': 3, 'Người giao ID': 2, 'Trạng thái': 'Chờ Duyệt', 'Mức độ ưu tiên': 'Cao', 'Ngày bắt đầu': '2026-02-20', 'Ngày hết hạn': '2026-03-05', 'Nhãn': 'Bug', 'Tiến độ': 90, 'Ngày tạo': '2026-02-18' },
    { ID: 5, 'Tiêu đề': 'Nghiên cứu UI framework mới', 'Mô tả': 'So sánh Tailwind vs MUI vs Ant Design cho dự án tiếp theo.', 'Phòng ban ID': 2, 'Người thực hiện ID': 3, 'Người giao ID': 1, 'Trạng thái': 'Cần Làm', 'Mức độ ưu tiên': 'Thấp', 'Ngày bắt đầu': '2026-03-10', 'Ngày hết hạn': '2026-04-01', 'Nhãn': 'Feature', 'Tiến độ': 0, 'Ngày tạo': '2026-03-05' },
    { ID: 6, 'Tiêu đề': 'Tích hợp hệ thống CRM', 'Mô tả': 'Đồng bộ dữ liệu khách hàng từ CRM hiện tại sang hệ thống mới.', 'Phòng ban ID': 3, 'Người thực hiện ID': 2, 'Người giao ID': 1, 'Trạng thái': 'Đang Thực Hiện', 'Mức độ ưu tiên': 'Trung Bình', 'Ngày bắt đầu': '2026-04-01', 'Ngày hết hạn': '2026-05-15', 'Nhãn': 'Backend', 'Tiến độ': 40, 'Người phối hợp': '1,3', 'Subtasks': JSON.stringify([{ id: 1, title: 'Mapping data schema', done: true }, { id: 2, title: 'Import script', done: false }, { id: 3, title: 'Validation', done: false }]), 'Ngày tạo': '2026-03-28' },
    { ID: 7, 'Tiêu đề': 'Deploy production v1.0', 'Phòng ban ID': 3, 'Người thực hiện ID': 1, 'Người giao ID': 1, 'Trạng thái': 'Cần Làm', 'Mức độ ưu tiên': 'Cao', 'Ngày bắt đầu': '2026-05-01', 'Ngày hết hạn': '2026-05-10', 'Nhãn': 'Urgent', 'Tiến độ': 0, 'Ngày tạo': '2026-04-25' },
    { ID: 8, 'Tiêu đề': 'Cập nhật tài liệu API', 'Mô tả': 'Cập nhật Swagger docs cho các endpoint mới.', 'Phòng ban ID': 1, 'Người thực hiện ID': 2, 'Người giao ID': 1, 'Trạng thái': 'Cần Làm', 'Mức độ ưu tiên': 'Thấp', 'Ngày bắt đầu': '2026-04-20', 'Ngày hết hạn': '2026-04-30', 'Nhãn': '', 'Tiến độ': 0, 'Ngày tạo': '2026-04-15' },
  ],
  hoatDong: [
    { ID: 1, 'Loại': 'Tạo phòng ban', 'Mô tả': 'Phòng Công Nghệ', 'Đối tượng': 'Phòng Ban', 'Mã đối tượng': 1, 'UserID': 1, 'Tên người dùng': 'Admin', 'Thời gian': '2026-01-10T08:00:00Z' },
    { ID: 2, 'Loại': 'Tạo công việc', 'Mô tả': 'Thiết kế giao diện trang chủ', 'Đối tượng': 'Công Việc', 'Mã đối tượng': 1, 'UserID': 2, 'Tên người dùng': 'Nguyễn Văn Hùng', 'Thời gian': '2026-01-18T09:30:00Z' },
    { ID: 3, 'Loại': 'Chuyển trạng thái', 'Mô tả': 'Hoàn Thành', 'Đối tượng': 'Công Việc', 'Mã đối tượng': 1, 'UserID': 3, 'Tên người dùng': 'Trần Thị Mai', 'Thời gian': '2026-02-08T16:00:00Z' },
    { ID: 4, 'Loại': 'Cập nhật phòng ban', 'Mô tả': 'Phòng Nhân Sự', 'Đối tượng': 'Phòng Ban', 'Mã đối tượng': 3, 'UserID': 1, 'Tên người dùng': 'Admin', 'Thời gian': '2026-04-20T10:15:00Z' },
  ],
}

function _mockAdd(list, data) { const item = { ...data, ID: ++_nextId }; list.push(item); return item }
function _mockUpdate(list, id, data) { const idx = list.findIndex(i => String(i.ID) === String(id)); if (idx === -1) throw new Error('Không tìm thấy'); list[idx] = { ...list[idx], ...data }; return list[idx] }
function _mockDelete(list, id) { const idx = list.findIndex(i => String(i.ID) === String(id)); if (idx === -1) throw new Error('Không tìm thấy'); list.splice(idx, 1); return { success: true } }

async function mockCall(fn, ...args) {
  await new Promise(r => setTimeout(r, 80))
  console.log('[gasClient mock]', fn, args)
  switch (fn) {
    case 'api_logout': _mockSession = null; return { success: true }
    case 'api_validateSession':
      if (!_mockSession) _mockSession = { userId: 1, username: 'admin', role: 'admin', email: 'admin@test.com', mustChangePass: false, permissions: ADMIN_PERMS }
      return { ..._mockSession }
    case 'api_getAllData':
      return { phongBan: _mockData.phongBan.map(i => ({...i})), nhan: _mockData.nhan.map(i => ({...i})), users: _mockData.users.map(i => ({...i})) }
    case 'api_getDepartments': return _mockData.phongBan.map(i => ({...i}))
    case 'api_createDepartment': return _mockAdd(_mockData.phongBan, { ...(args[1]||{}), 'Sheet Name': 'CV_' + (_nextId+1) })
    case 'api_updateDepartment': return _mockUpdate(_mockData.phongBan, args[1], args[2])
    case 'api_deleteDepartment': return _mockDelete(_mockData.phongBan, args[1])
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
    case 'api_getAuditLogs': return { data: [], hasMore: false, total: 0, types: [] }
    default: throw new Error('Mock không hỗ trợ: ' + fn)
  }
}
