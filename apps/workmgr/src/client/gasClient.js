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

const ADMIN_PERMS = { duAn: { c:true,r:true,u:true,d:true }, congViec: { c:true,r:true,u:true,d:true }, nhan: { c:true,r:true,u:true,d:true }, user: { c:true,r:true,u:true,d:true }, caiDat: { c:true,r:true,u:true,d:true } }

const _mockData = {
  users: [
    { ID: 1, 'Tên đăng nhập': 'admin', 'Tên nhân viên': 'Admin Hệ thống', 'Email': 'admin@test.com', 'Quyền': 'admin' },
    { ID: 2, 'Tên đăng nhập': 'leader1', 'Tên nhân viên': 'Nguyễn Văn Hùng', 'Email': 'hung@test.com', 'Quyền': 'Trưởng phòng' },
    { ID: 3, 'Tên đăng nhập': 'nhanvien1', 'Tên nhân viên': 'Trần Thị Mai', 'Email': 'mai@test.com', 'Quyền': 'Nhân viên' },
  ],
  duAn: [
    { ID: 1, 'Tên dự án': 'Website E-Commerce', 'Mô tả': 'Xây dựng hệ thống bán hàng online', 'Trạng thái': 'Đang Thực Hiện', 'Mức độ ưu tiên': 'Cao', 'Ngân sách': 500000000, 'Chi phí thực tế': 320000000, 'Ngày bắt đầu': '2026-01-15', 'Ngày kết thúc': '2026-06-30', 'Leader ID': 2, 'Thành viên': '2,3', 'Tiến độ': 65, 'Người tạo': 1, 'Ngày tạo': '2026-01-10' },
    { ID: 2, 'Tên dự án': 'Mobile App v2', 'Mô tả': 'Nâng cấp ứng dụng mobile', 'Trạng thái': 'Lên Kế Hoạch', 'Mức độ ưu tiên': 'Trung Bình', 'Ngân sách': 300000000, 'Chi phí thực tế': 0, 'Ngày bắt đầu': '2026-03-01', 'Ngày kết thúc': '2026-09-30', 'Leader ID': 2, 'Thành viên': '2,3', 'Tiến độ': 10, 'Người tạo': 1, 'Ngày tạo': '2026-02-20' },
    { ID: 3, 'Tên dự án': 'CRM Internal', 'Mô tả': 'Hệ thống quản lý khách hàng nội bộ', 'Trạng thái': 'Đang Thực Hiện', 'Mức độ ưu tiên': 'Cao', 'Ngân sách': 200000000, 'Chi phí thực tế': 150000000, 'Leader ID': 1, 'Thành viên': '1,2,3', 'Tiến độ': 80, 'Người tạo': 1, 'Ngày tạo': '2025-11-01', 'Ngày bắt đầu': '2025-11-15', 'Ngày kết thúc': '2026-05-31' },
  ],
  nhan: [
    { ID: 1, 'Tên nhãn': 'Bug', 'Màu sắc': '#e53935' },
    { ID: 2, 'Tên nhãn': 'Feature', 'Màu sắc': '#43a047' },
    { ID: 3, 'Tên nhãn': 'Design', 'Màu sắc': '#fb8c00' },
    { ID: 4, 'Tên nhãn': 'Backend', 'Màu sắc': '#1e88e5' },
    { ID: 5, 'Tên nhãn': 'Urgent', 'Màu sắc': '#c62828' },
  ],
  congViec: [
    { ID: 1, 'Tiêu đề': 'Thiết kế giao diện trang chủ', 'Dự án ID': 1, 'Người thực hiện ID': 3, 'Người giao ID': 2, 'Trạng thái': 'Hoàn Thành', 'Mức độ ưu tiên': 'Cao', 'Ngày bắt đầu': '2026-01-20', 'Ngày hết hạn': '2026-02-10', 'Ngày hoàn thành': '2026-02-08', 'Nhãn': 'Design', 'Tiến độ': 100, 'Ngày tạo': '2026-01-18' },
    { ID: 2, 'Tiêu đề': 'Xây dựng API thanh toán', 'Dự án ID': 1, 'Người thực hiện ID': 2, 'Người giao ID': 1, 'Trạng thái': 'Đang Thực Hiện', 'Mức độ ưu tiên': 'Cao', 'Ngày bắt đầu': '2026-02-15', 'Ngày hết hạn': '2026-03-15', 'Nhãn': 'Backend,API', 'Tiến độ': 60, 'Ngày tạo': '2026-02-10' },
    { ID: 3, 'Tiêu đề': 'Viết unit test module auth', 'Dự án ID': 1, 'Người thực hiện ID': 3, 'Người giao ID': 2, 'Trạng thái': 'Cần Làm', 'Mức độ ưu tiên': 'Trung Bình', 'Ngày bắt đầu': '2026-03-01', 'Ngày hết hạn': '2026-03-20', 'Nhãn': 'Testing', 'Tiến độ': 0, 'Ngày tạo': '2026-02-28' },
    { ID: 4, 'Tiêu đề': 'Fix lỗi responsive mobile', 'Dự án ID': 1, 'Người thực hiện ID': 3, 'Người giao ID': 2, 'Trạng thái': 'Đang Xem Xét', 'Mức độ ưu tiên': 'Cao', 'Ngày bắt đầu': '2026-02-20', 'Ngày hết hạn': '2026-03-05', 'Nhãn': 'Bug', 'Tiến độ': 90, 'Ngày tạo': '2026-02-18' },
    { ID: 5, 'Tiêu đề': 'Nghiên cứu UI framework mới', 'Dự án ID': 2, 'Người thực hiện ID': 3, 'Người giao ID': 1, 'Trạng thái': 'Cần Làm', 'Mức độ ưu tiên': 'Thấp', 'Ngày bắt đầu': '2026-03-10', 'Ngày hết hạn': '2026-04-01', 'Nhãn': 'Feature', 'Tiến độ': 0, 'Ngày tạo': '2026-03-05' },
    { ID: 6, 'Tiêu đề': 'Tích hợp hệ thống CRM', 'Dự án ID': 3, 'Người thực hiện ID': 2, 'Người giao ID': 1, 'Trạng thái': 'Đang Thực Hiện', 'Mức độ ưu tiên': 'Trung Bình', 'Ngày bắt đầu': '2026-04-01', 'Ngày hết hạn': '2026-05-15', 'Nhãn': 'Backend', 'Tiến độ': 40, 'Ngày tạo': '2026-03-28' },
    { ID: 7, 'Tiêu đề': 'Deploy production v1.0', 'Dự án ID': 3, 'Người thực hiện ID': 1, 'Người giao ID': 1, 'Trạng thái': 'Cần Làm', 'Mức độ ưu tiên': 'Cao', 'Ngày bắt đầu': '2026-05-01', 'Ngày hết hạn': '2026-05-10', 'Nhãn': 'Urgent', 'Tiến độ': 0, 'Ngày tạo': '2026-04-25' },
    { ID: 8, 'Tiêu đề': 'Cập nhật tài liệu API', 'Dự án ID': 1, 'Người thực hiện ID': 2, 'Người giao ID': 1, 'Trạng thái': 'Cần Làm', 'Mức độ ưu tiên': 'Thấp', 'Ngày bắt đầu': '2026-04-20', 'Ngày hết hạn': '2026-04-30', 'Nhãn': '', 'Tiến độ': 0, 'Ngày tạo': '2026-04-15' },
  ],
  hoatDong: [
    { ID: 1, 'Loại': 'Tạo dự án', 'Mô tả': 'Website E-Commerce', 'Đối tượng': 'Dự Án', 'Mã đối tượng': 1, 'UserID': 1, 'Tên người dùng': 'Admin', 'Thời gian': '2026-01-10T08:00:00Z' },
    { ID: 2, 'Loại': 'Tạo công việc', 'Mô tả': 'Thiết kế giao diện trang chủ', 'Đối tượng': 'Công Việc', 'Mã đối tượng': 1, 'UserID': 2, 'Tên người dùng': 'Nguyễn Văn Hùng', 'Thời gian': '2026-01-18T09:30:00Z' },
    { ID: 3, 'Loại': 'Chuyển trạng thái', 'Mô tả': 'Hoàn Thành', 'Đối tượng': 'Công Việc', 'Mã đối tượng': 1, 'UserID': 3, 'Tên người dùng': 'Trần Thị Mai', 'Thời gian': '2026-02-08T16:00:00Z' },
    { ID: 4, 'Loại': 'Cập nhật dự án', 'Mô tả': 'CRM Internal', 'Đối tượng': 'Dự Án', 'Mã đối tượng': 3, 'UserID': 1, 'Tên người dùng': 'Admin', 'Thời gian': '2026-04-20T10:15:00Z' },
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
      return { duAn: _mockData.duAn.map(i => ({...i})), nhan: _mockData.nhan.map(i => ({...i})), users: _mockData.users.map(i => ({...i})) }
    case 'api_getProjects': return _mockData.duAn.map(i => ({...i}))
    case 'api_createProject': return _mockAdd(_mockData.duAn, args[1])
    case 'api_updateProject': return _mockUpdate(_mockData.duAn, args[1], args[2])
    case 'api_deleteProject': return _mockDelete(_mockData.duAn, args[1])
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
      const projects = _mockData.duAn
      const now = new Date()
      const taskStats = { todo: 0, inProgress: 0, review: 0, completed: 0 }
      const priorityStats = { high: 0, medium: 0, low: 0 }
      let overdue = 0
      tasks.forEach(t => {
        if (t['Trạng thái']==='Cần Làm') taskStats.todo++; else if (t['Trạng thái']==='Đang Thực Hiện') taskStats.inProgress++
        else if (t['Trạng thái']==='Đang Xem Xét') taskStats.review++; else if (t['Trạng thái']==='Hoàn Thành') taskStats.completed++
        if (t['Mức độ ưu tiên']==='Cao') priorityStats.high++; else if (t['Mức độ ưu tiên']==='Trung Bình') priorityStats.medium++; else priorityStats.low++
        if (t['Ngày hết hạn'] && t['Trạng thái']!=='Hoàn Thành' && new Date(t['Ngày hết hạn']) < now) overdue++
      })
      let totalBudget = 0, totalCost = 0
      const projectStats = { planning:0, inProgress:0, completed:0, paused:0, cancelled:0 }
      projects.forEach(p => {
        totalBudget += Number(p['Ngân sách'])||0; totalCost += Number(p['Chi phí thực tế'])||0
        if (p['Trạng thái']==='Lên Kế Hoạch') projectStats.planning++; else if (p['Trạng thái']==='Đang Thực Hiện') projectStats.inProgress++
        else if (p['Trạng thái']==='Hoàn Thành') projectStats.completed++
      })
      return {
        totalProjects: projects.length, totalTasks: tasks.length, totalCompleted: taskStats.completed, totalOverdue: overdue,
        totalBudget, totalActualCost: totalCost, projectStats, taskStats, priorityStats,
        overdueTasks: [], upcomingTasks: [],
        weeklyTrend: [{label:'T1',created:3,completed:1},{label:'T2',created:2,completed:2},{label:'T3',created:4,completed:3},{label:'T4',created:1,completed:0}],
        recentActivities: _mockData.hoatDong.slice().reverse(),
        projectProgress: projects.map(p => ({id:p.ID,name:p['Tên dự án'],progress:Number(p['Tiến độ'])||0,status:p['Trạng thái']})),
      }
    }
    case 'api_getAuditLogs': return { data: [], hasMore: false, total: 0, types: [] }
    default: throw new Error('Mock không hỗ trợ: ' + fn)
  }
}
