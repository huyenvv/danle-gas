// GAS client — calls google.script.run (real) or mock (dev)
// All calls return Promises resolving to payload or rejecting with error message.

const IS_GAS = typeof google !== 'undefined' && google.script && google.script.run

const ACCESS_KEY = 'docmgr_access_token'
const REFRESH_KEY = 'docmgr_refresh_token'
const USER_KEY = 'docmgr_user'

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
    text.includes('we\'re sorry, a server error occurred')
  )
}

function _isReadOnly(fnName) {
  return /^api_(get|poll|check|browse|resume)/.test(fnName)
}

function _getRetryPolicy(fnName) {
  if (fnName === 'api_getInitialData' || fnName === 'api_getDocuments' || fnName === 'api_getDocumentStats') {
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
        // Don't decrement _activeCount yet — async refresh in flight
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

      const canRetry = _isRetryableError(errMsg) || (!res && _isReadOnly(fnName))
      if (retries > 0 && canRetry) {
        requeue()
      } else {
        reject(new Error(errMsg))
      }
      _processQueue()
    })
    .withFailureHandler(err => {
      _activeCount--
      const msg = err.message || String(err)
      if (retries > 0 && !_isSessionExpired(msg) && (_isRetryableError(msg) || _isReadOnly(fnName))) {
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
  // Dev mock (never used in production build)
  return mockCall(fnName, ...args)
}

export default gasCall

// ── Dev mock ─────────────────────────────────────────────────────────────────
let _mockSession = null
let _nextId = 100
const _mockUnreadIds = new Set()
const _mockConfig = {}
const _mockComments = []
let _nextCommentId = 1

const _mockData = {
  users: [
    { ID: 1, 'Tên đăng nhập': 'admin', 'Email': 'admin@test.com', 'Quyền': 'admin', 'Trạng thái': 'Active', 'Đăng nhập cuối': '2024-01-15', 'Phòng ban': '' },
    { ID: 2, 'Tên đăng nhập': 'editor1', 'Email': 'editor@test.com', 'Quyền': 'Nhân viên', 'Trạng thái': 'Active', 'Đăng nhập cuối': '2024-01-10', 'Phòng ban': JSON.stringify(['Kỹ thuật']) },
    { ID: 3, 'Tên đăng nhập': 'truongphong', 'Email': 'tp@test.com', 'Quyền': 'Trưởng phòng', 'Trạng thái': 'Active', 'Đăng nhập cuối': '2024-01-12', 'Phòng ban': JSON.stringify(['Kỹ thuật']) },
  ],
  danhMuc: [
    { ID: 1, 'Tên danh mục': 'Hợp đồng', Icon: 'contract', 'Mô tả': 'Hợp đồng kinh tế', 'Danh mục cha': '' },
    { ID: 2, 'Tên danh mục': 'Công văn',  Icon: 'description', 'Mô tả': 'Công văn đến/đi', 'Danh mục cha': '' },
    { ID: 3, 'Tên danh mục': 'Báo cáo',   Icon: 'bar_chart', 'Mô tả': 'Báo cáo định kỳ', 'Danh mục cha': '' },
    { ID: 4, 'Tên danh mục': 'Hợp đồng XD', Icon: 'engineering', 'Mô tả': 'Hợp đồng xây dựng', 'Danh mục cha': 1 },
  ],
  nhom: [
    { ID: 1, 'Tên nhóm': 'Nhóm Kỹ thuật', 'Mô tả': 'Nhóm kỹ thuật dự án', 'Thành viên': JSON.stringify([1, 2]) },
    { ID: 2, 'Tên nhóm': 'Nhóm Kinh doanh', 'Mô tả': 'Nhóm kinh doanh', 'Thành viên': JSON.stringify([3]) },
  ],
  duAn: [
    { ID: 1, 'Tên dự án viết tắt': 'DA-01', 'Tên dự án đầy đủ': 'Dự án Xây dựng Trụ sở', 'Địa chỉ': 'HCM' },
    { ID: 2, 'Tên dự án viết tắt': 'DA-02', 'Tên dự án đầy đủ': 'Dự án CNTT 2024', 'Địa chỉ': 'Hà Nội' },
  ],
  nhaCungCap: [
    { ID: 1, 'Tên NCC viết tắt': 'ABC Corp', 'Tên NCC đầy đủ': 'Công ty TNHH ABC', 'Mã số thuế': '012345', 'Điện thoại': '028-1234', 'Lĩnh vực kinh doanh': 'CNTT' },
    { ID: 2, 'Tên NCC viết tắt': 'XYZ Ltd', 'Tên NCC đầy đủ': 'Công ty CP XYZ', 'Mã số thuế': '067890', 'Điện thoại': '024-5678', 'Lĩnh vực kinh doanh': 'Xây dựng' },
  ],
  phongBan: [
    { ID: 1, 'Tên phòng ban': 'Kỹ thuật' },
    { ID: 2, 'Tên phòng ban': 'Kinh doanh' },
  ],
  assignments: [
    // Ban Giám Đốc
    { ID: 1, UserID: '4', 'Chức vụ': 'Giám đốc', PhongBanID: '' },
    { ID: 2, UserID: '5', 'Chức vụ': 'Phó GĐ', PhongBanID: '' },
    { ID: 3, UserID: '6', 'Chức vụ': 'Phó GĐ', PhongBanID: '' },
    // Văn thư & Quản trị
    { ID: 4, UserID: '1', 'Chức vụ': 'admin', PhongBanID: '' },
    { ID: 5, UserID: '7', 'Chức vụ': 'Văn thư', PhongBanID: '' },
    // Phòng Kỹ thuật
    { ID: 6, UserID: '3', 'Chức vụ': 'Trưởng phòng', PhongBanID: '1' },
    { ID: 7, UserID: '2', 'Chức vụ': 'Nhân viên', PhongBanID: '1' },
    { ID: 8, UserID: '8', 'Chức vụ': 'Nhân viên', PhongBanID: '1' },
    // Phòng Kinh doanh
    { ID: 9, UserID: '9', 'Chức vụ': 'Trưởng phòng', PhongBanID: '2' },
    { ID: 10, UserID: '10', 'Chức vụ': 'Nhân viên', PhongBanID: '2' },
  ],
  docs: [
    // Quá hạn (red row) — overdue 5 days
    { ID: 1, 'Tên hồ sơ': 'Hợp đồng mua sắm CNTT', 'Danh mục': 1, 'Tình trạng': 'Chờ xử lý', 'Dự án (Phòng ban)': 'DA-01', 'Nhà cung cấp (Nơi ban hành)': 'ABC Corp', 'Số hồ sơ': 'HS-001', 'Giá trị HĐ': 100000000, 'Ngày ban hành': '2024-01-15', 'Ngày kết thúc': _daysFromNow(-5), 'Ngày cập nhật': '2024-01-15', 'Phụ trách': JSON.stringify(['admin']), 'Người phối hợp': JSON.stringify(['editor1']), 'Ghi chú': 'Hợp đồng ưu tiên', 'Người tạo': 'admin', 'Người cập nhật': 'admin', 'Tệp đính kèm': JSON.stringify([{ fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs', fileName: 'hop-dong-cntt.pdf', mimeType: 'application/pdf', size: 204800 }]), 'Lịch sử phát hành': JSON.stringify([{ lan: 1, ngay: '2024-02-10T09:00:00', nguoiGui: 1, to: [{ id: 2, name: 'Nguyễn Văn A', email: 'nva@test.com' }], cc: [{ id: 3, name: 'Trần Thị Bình', email: 'ttb@test.com' }] }, { lan: 2, ngay: '2024-03-15T14:30:00', nguoiGui: 1, to: [{ id: 2, name: 'Nguyễn Văn A', email: 'nva@test.com' }, { id: 3, name: 'Trần Thị Bình', email: 'ttb@test.com' }], cc: [] }]) },
    // Hoàn thành — no badge even though deadline passed
    { ID: 2, 'Tên hồ sơ': 'Công văn số 01/2024', 'Danh mục': 2, 'Tình trạng': 'Hoàn thành', 'Dự án (Phòng ban)': 'DA-02', 'Nhà cung cấp (Nơi ban hành)': '', 'Số hồ sơ': 'HS-002', 'Giá trị HĐ': 0, 'Ngày ban hành': '2024-02-01', 'Ngày kết thúc': _daysFromNow(-10), 'Ngày cập nhật': '2024-02-01', 'Phụ trách': JSON.stringify(['admin']), 'Người phối hợp': JSON.stringify(['editor1']), 'Ghi chú': '', 'Người tạo': 'admin', 'Người cập nhật': 'editor1', 'Tệp đính kèm': JSON.stringify([{ fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs', fileName: 'cong-van-01.pdf', mimeType: 'application/pdf', size: 102400 }, { fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlcs', fileName: 'phu-luc.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 51200 }]), 'Lịch sử phát hành': JSON.stringify([{ lan: 1, ngay: '2024-02-20T10:15:00', nguoiGui: 3, to: [{ id: 1, name: 'Admin Hệ thống', email: 'admin@test.com' }], cc: [] }]) },
    // Hết hạn hôm nay (yellow row)
    { ID: 3, 'Tên hồ sơ': 'Báo cáo tài chính Q2', 'Danh mục': 3, 'Tình trạng': 'Đang xử lý', 'Dự án (Phòng ban)': 'DA-02', 'Nhà cung cấp (Nơi ban hành)': '', 'Số hồ sơ': 'HS-003', 'Giá trị HĐ': 0, 'Ngày ban hành': '2024-03-01', 'Ngày kết thúc': _daysFromNow(0), 'Ngày cập nhật': '2024-03-01', 'Phụ trách': JSON.stringify(['editor1']), 'Người phối hợp': '', 'Ghi chú': 'Cần nộp trong ngày', 'Người tạo': 'admin', 'Người cập nhật': 'admin' },
    // Còn 2 ngày — urgent (yellow row)
    { ID: 4, 'Tên hồ sơ': 'Hợp đồng xây dựng VP', 'Danh mục': 1, 'Tình trạng': 'Chờ duyệt', 'Dự án (Phòng ban)': 'DA-01', 'Nhà cung cấp (Nơi ban hành)': 'XYZ Ltd', 'Số hồ sơ': 'HS-004', 'Giá trị HĐ': 500000000, 'Ngày ban hành': '2024-03-01', 'Ngày kết thúc': _daysFromNow(2), 'Ngày cập nhật': '2024-03-01', 'Phụ trách': JSON.stringify(['admin']), 'Người phối hợp': '', 'Ghi chú': 'Chờ GĐ duyệt', 'Người tạo': 'admin', 'Người cập nhật': 'admin' },
    // Còn 5 ngày — warning (green row)
    { ID: 5, 'Tên hồ sơ': 'Công văn gửi Sở KH-ĐT', 'Danh mục': 2, 'Tình trạng': 'Chờ xử lý', 'Dự án (Phòng ban)': 'DA-01', 'Nhà cung cấp (Nơi ban hành)': '', 'Số hồ sơ': 'HS-005', 'Giá trị HĐ': 0, 'Ngày ban hành': '2024-04-01', 'Ngày kết thúc': _daysFromNow(5), 'Ngày cập nhật': '2024-04-01', 'Phụ trách': JSON.stringify(['truongphong']), 'Người phối hợp': JSON.stringify(['editor1']), 'Ghi chú': '', 'Người tạo': 'admin', 'Người cập nhật': 'admin' },
    // Khẩn + quá hạn (orange row + deadline text)
    { ID: 6, 'Tên hồ sơ': 'Hợp đồng cung cấp vật tư', 'Danh mục': 4, 'Tình trạng': 'Chờ duyệt', 'Khẩn': 'TRUE', 'Dự án (Phòng ban)': 'DA-01', 'Nhà cung cấp (Nơi ban hành)': 'ABC Corp', 'Số hồ sơ': 'HS-006', 'Giá trị HĐ': 250000000, 'Ngày ban hành': '2024-04-10', 'Ngày kết thúc': _daysFromNow(-2), 'Ngày cập nhật': '2024-04-10', 'Phụ trách': JSON.stringify(['admin', 'editor1']), 'Người phối hợp': '', 'Ghi chú': 'Vật tư cần gấp cho công trình', 'Người tạo': 'editor1', 'Người cập nhật': 'admin' },
    // Khẩn, chưa có deadline (orange row, no deadline text)
    { ID: 7, 'Tên hồ sơ': 'Công văn khẩn - Sự cố công trình', 'Danh mục': 2, 'Tình trạng': 'Đang xử lý', 'Khẩn': 'TRUE', 'Dự án (Phòng ban)': 'DA-01', 'Nhà cung cấp (Nơi ban hành)': '', 'Số hồ sơ': 'HS-007', 'Giá trị HĐ': 0, 'Ngày ban hành': '2024-05-01', 'Ngày kết thúc': '', 'Ngày cập nhật': '2024-05-01', 'Phụ trách': JSON.stringify(['truongphong']), 'Người phối hợp': JSON.stringify(['editor1', 'admin']), 'Ghi chú': 'Xử lý gấp', 'Người tạo': 'admin', 'Người cập nhật': 'truongphong' },
    // Còn 10 ngày — bình thường, không highlight (> 7 ngày)
    { ID: 8, 'Tên hồ sơ': 'Thanh lý HĐ thuê mặt bằng', 'Danh mục': 1, 'Tình trạng': 'Đang xử lý', 'Dự án (Phòng ban)': 'DA-02', 'Nhà cung cấp (Nơi ban hành)': 'XYZ Ltd', 'Số hồ sơ': 'HS-008', 'Giá trị HĐ': 80000000, 'Ngày ban hành': '2024-05-10', 'Ngày kết thúc': _daysFromNow(10), 'Ngày cập nhật': '2024-05-10', 'Phụ trách': JSON.stringify(['editor1']), 'Người phối hợp': '', 'Ghi chú': '', 'Người tạo': 'admin', 'Người cập nhật': 'admin' },
    // Còn 20 ngày — bình thường (no highlight)
    { ID: 9, 'Tên hồ sơ': 'Báo cáo tiến độ DA-02', 'Danh mục': 3, 'Tình trạng': 'Chờ xử lý', 'Dự án (Phòng ban)': 'DA-02', 'Nhà cung cấp (Nơi ban hành)': '', 'Số hồ sơ': 'HS-009', 'Giá trị HĐ': 0, 'Ngày ban hành': '2024-05-15', 'Ngày kết thúc': _daysFromNow(20), 'Ngày cập nhật': '2024-05-15', 'Phụ trách': JSON.stringify(['admin']), 'Người phối hợp': '', 'Ghi chú': '', 'Người tạo': 'admin', 'Người cập nhật': 'admin' },
  ],
}

function _mockSsoUsers() {
  return [
    { ID: 1,  'Tên đăng nhập': 'admin',      'Tên nhân viên': 'Admin Hệ thống',    'Email': 'admin@test.com',   'Quyền': '' },
    { ID: 2,  'Tên đăng nhập': 'editor1',     'Tên nhân viên': 'Nguyễn Văn A',      'Email': 'nva@test.com',     'Quyền': '' },
    { ID: 3,  'Tên đăng nhập': 'truongphong', 'Tên nhân viên': 'Trần Thị Bình',     'Email': 'ttb@test.com',     'Quyền': '' },
    { ID: 4,  'Tên đăng nhập': 'giamdoc',     'Tên nhân viên': 'Lê Văn Giám Đốc',  'Email': 'gd@test.com',      'Quyền': '' },
    { ID: 5,  'Tên đăng nhập': 'phogd1',      'Tên nhân viên': 'Phạm Phó GĐ 1',    'Email': 'pgd1@test.com',    'Quyền': '' },
    { ID: 6,  'Tên đăng nhập': 'phogd2',      'Tên nhân viên': 'Hoàng Phó GĐ 2',   'Email': 'pgd2@test.com',    'Quyền': '' },
    { ID: 7,  'Tên đăng nhập': 'vanthu',      'Tên nhân viên': 'Ngô Thị Văn Thư',  'Email': 'vt@test.com',      'Quyền': '' },
    { ID: 8,  'Tên đăng nhập': 'nhanvien2',   'Tên nhân viên': 'Đỗ Minh Tuấn',     'Email': 'dmt@test.com',     'Quyền': '' },
    { ID: 9,  'Tên đăng nhập': 'tpkd',        'Tên nhân viên': 'Vũ Thị Hương',     'Email': 'vth@test.com',     'Quyền': '' },
    { ID: 10, 'Tên đăng nhập': 'nvkd1',       'Tên nhân viên': 'Bùi Đức Thắng',    'Email': 'bdt@test.com',     'Quyền': '' },
    { ID: 11, 'Tên đăng nhập': 'newuser',     'Tên nhân viên': 'Người Mới',         'Email': 'new@test.com',     'Quyền': '' },
  ]
}

function _daysFromNow(n) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function _mockAdd(list, data) {
  const item = { ...data, ID: ++_nextId }
  list.push(item)
  return item
}

// Append an uploaded file to an existing mock draft and return the updated row.
function _mockAppendDraftFile(draftId, fileInfo) {
  const d = _mockData.docs.find(x => String(x.ID) === String(draftId))
  if (!d) return null
  let infos = []
  try { infos = JSON.parse(d['Tệp đính kèm'] || '[]') } catch (_) {}
  infos.push(fileInfo)
  d['Tệp đính kèm'] = JSON.stringify(infos)
  d['Tên file'] = infos.map(f => f.fileName).join(', ')
  d['Ngày cập nhật'] = new Date().toISOString()
  return { ...d }
}

function _mockUpdate(list, id, data) {
  const idx = list.findIndex(i => String(i.ID) === String(id))
  if (idx === -1) throw new Error('Không tìm thấy ID ' + id)
  list[idx] = { ...list[idx], ...data }
  return list[idx]
}

function _mockDelete(list, id) {
  const idx = list.findIndex(i => String(i.ID) === String(id))
  if (idx === -1) throw new Error('Không tìm thấy ID ' + id)
  list.splice(idx, 1)
  return { success: true }
}

async function mockCall(fn, ...args) {
  await delay(80)
  // eslint-disable-next-line no-console
  console.log('[gasClient mock]', fn, args)
  switch (fn) {
    case 'api_logout':
      _mockSession = null
      return { success: true }
    case 'api_ssoLogin':
    case 'api_resume': {
      if (!_mockSession) {
        _mockSession = { userId: 1, username: 'admin', role: 'admin', email: 'admin@test.com', name: 'Admin', mustChangePass: false, canCreate: true, canCreateSubCat: true }
      }
      return {
        accessToken: 'mock-access-' + Date.now(),
        refreshToken: 'mock-refresh-' + Date.now(),
        user: { ..._mockSession },
      }
    }

    case 'api_getAllData': {
      const _lookups = {
        danhMuc:     _mockData.danhMuc.map(i => ({ ...i })),
        nhom:        _mockData.nhom.map(i => ({ ...i })),
        duAn:        _mockData.duAn.map(i => ({ ...i })),
        nhaCungCap:  _mockData.nhaCungCap.map(i => ({ ...i })),
        phongBan:    _mockData.phongBan.map(i => ({ ...i })),
        assignments: _mockData.assignments.map(i => ({ ...i })),
        users: _mockSsoUsers(),
        ssoUsers: _mockSsoUsers(),
      }
      return _lookups
    }
    case 'api_getInitialData': {
      const docs = _mockData.docs.map(d => ({ ...d }))
      const byStatus = {}
      let totalValue = 0
      docs.forEach(d => { const s = d['Tình trạng'] || 'Không rõ'; byStatus[s] = (byStatus[s] || 0) + 1; totalValue += Number(d['Giá trị HĐ']) || 0 })
      return {
        lookups: {
          danhMuc: _mockData.danhMuc.map(i => ({ ...i })),
          nhom: _mockData.nhom.map(i => ({ ...i })),
          duAn: _mockData.duAn.map(i => ({ ...i })),
          nhaCungCap: _mockData.nhaCungCap.map(i => ({ ...i })),
          phongBan: _mockData.phongBan.map(i => ({ ...i })),
          assignments: _mockData.assignments.map(i => ({ ...i })),
          users: _mockSsoUsers(),
          ssoUsers: _mockSsoUsers(),
        },
        docs,
        stats: { total: docs.length, byStatus, totalValue },
        unreadIds: [..._mockUnreadIds],
        companyName: _mockConfig['COMPANY_NAME'] || '',
      }
    }
    case 'api_pollUpdates': {
      const pollDocs = _mockData.docs.map(d => ({ ...d }))
      const res = { docs: pollDocs, unreadIds: [..._mockUnreadIds] }
      if (args[1] && args[1].includeLookups) {
        res.lookups = {
          danhMuc: _mockData.danhMuc.map(i => ({ ...i })),
          nhom: _mockData.nhom.map(i => ({ ...i })),
          duAn: _mockData.duAn.map(i => ({ ...i })),
          nhaCungCap: _mockData.nhaCungCap.map(i => ({ ...i })),
          phongBan: _mockData.phongBan.map(i => ({ ...i })),
          assignments: _mockData.assignments.map(i => ({ ...i })),
          users: _mockSsoUsers(),
          ssoUsers: _mockSsoUsers(),
        }
      }
      return res
    }
    case 'api_getDocuments':
      return { data: _mockData.docs.map(d => ({ ...d })) }
    case 'api_getDocumentStats': {
      const byStatus = {}
      let totalValue = 0
      _mockData.docs.forEach(d => {
        const s = d['Tình trạng'] || 'Không rõ'
        byStatus[s] = (byStatus[s] || 0) + 1
        totalValue += Number(d['Giá trị HĐ']) || 0
      })
      return { total: _mockData.docs.length, byStatus, totalValue }
    }
    case 'api_createDocument':
      return _mockAdd(_mockData.docs, { ...(args[1] || {}), 'Ngày cập nhật': new Date().toISOString(), 'Phụ trách': JSON.stringify(['admin']), 'Người tạo': 'admin', 'Người cập nhật': 'admin' })
    case 'api_updateDocument': {
      const updated = _mockUpdate(_mockData.docs, args[1], args[2] || {})
      return updated
    }
    case 'api_deleteDocument':
      return _mockDelete(_mockData.docs, args[1])
    case 'api_addCategory':
      return _mockAdd(_mockData.danhMuc, args[1])
    case 'api_updateCategory':
      return _mockUpdate(_mockData.danhMuc, args[1], args[2])
    case 'api_deleteCategory':
      return _mockDelete(_mockData.danhMuc, args[1])
    case 'api_addNhom':
      return _mockAdd(_mockData.nhom, args[1])
    case 'api_updateNhom':
      return _mockUpdate(_mockData.nhom, args[1], args[2])
    case 'api_deleteNhom':
      return _mockDelete(_mockData.nhom, args[1])
    case 'api_addNhaCungCap':
      return _mockAdd(_mockData.nhaCungCap, args[1])
    case 'api_updateNhaCungCap':
      return _mockUpdate(_mockData.nhaCungCap, args[1], args[2])
    case 'api_deleteNhaCungCap':
      return _mockDelete(_mockData.nhaCungCap, args[1])
    case 'api_addDuAn':
      return _mockAdd(_mockData.duAn, args[1])
    case 'api_updateDuAn':
      return _mockUpdate(_mockData.duAn, args[1], args[2])
    case 'api_deleteDuAn':
      return _mockDelete(_mockData.duAn, args[1])
    case 'api_getUsers': {
      // Derive Quyền from assignments (like real server does)
      const roleMap = {}
      _mockData.assignments.forEach(a => {
        const uid = String(a.UserID)
        // Keep highest-priority role per user
        if (!roleMap[uid]) roleMap[uid] = a['Chức vụ']
      })
      return _mockSsoUsers().filter(u => u.ID !== 4 /* hide owner */).map(u => ({
        ...u,
        'Trạng thái': 'Active',
        'Quyền': roleMap[String(u.ID)] || '',
        'Phân quyền chi tiết': '',
        'Được tạo hồ sơ': '',
        'Được tạo danh mục con': '',
        'Được phát hành': '',
      }))
    }
    case 'api_addUser': {
      const nu = { ID: ++_nextId, ...args[1], 'Trạng thái': 'Active', 'Đăng nhập cuối': '' }
      _mockData.users = [...(_mockData.users || []), nu]
      return nu
    }
    case 'api_updateUser':
      return { success: true }
    case 'api_removeUserRole':
      return { success: true }
    case 'api_markAsRead':
      _mockUnreadIds.delete(String(args[1]))
      return { success: true }
    case 'api_getUnreadDocIds':
      return { unreadIds: [..._mockUnreadIds] }
    case 'api_markMultipleAsRead':
      ;(args[1] || []).forEach(id => _mockUnreadIds.delete(String(id)))
      return { success: true, marked: (args[1] || []).length }
    case 'api_getUnreadCount':
      return { count: _mockUnreadIds.size }
    case 'api_getAuditLogs':
      return { data: [
        { ID: 1, 'Thời gian': new Date().toISOString(), 'Người dùng': 'admin', 'Email': 'admin@test.com', 'Hành động': 'Tạo', 'Loại': 'Hồ sơ', 'Đối tượng': 'Hợp đồng mua sắm CNTT', 'Chi tiết': JSON.stringify({ 'Tên hồ sơ': 'Hợp đồng mua sắm CNTT', 'Danh mục': 'Hợp đồng', 'Dự án': 'DA-01', 'NCC': 'ABC Corp', 'Số hồ sơ': 'HS-001', 'Giá trị HĐ': 100000000, 'Phụ trách': 'admin', 'Tình trạng': 'Chờ duyệt' }) },
        { ID: 2, 'Thời gian': new Date(Date.now()-1800000).toISOString(), 'Người dùng': 'admin', 'Email': 'admin@test.com', 'Hành động': 'Sửa', 'Loại': 'Hồ sơ', 'Đối tượng': 'Công văn số 01/2024', 'Chi tiết': JSON.stringify({ 'Trường thay đổi': [{ field: 'Tình trạng', old: 'Chờ duyệt', new: 'Chờ xử lý' }, { field: 'Phụ trách', old: 'admin', new: 'editor1' }, { field: 'Ghi chú', old: '', new: 'Đã chuyển cho phòng kỹ thuật xử lý' }] }) },
        { ID: 3, 'Thời gian': new Date(Date.now()-3600000).toISOString(), 'Người dùng': 'editor1', 'Email': 'editor@test.com', 'Hành động': 'Workflow', 'Loại': 'Hồ sơ', 'Đối tượng': 'Hợp đồng xây dựng VP', 'Chi tiết': JSON.stringify({ action: 'trinhDuyet', from: 'Chờ xử lý', to: 'Chờ duyệt', note: 'Đã kiểm tra xong, trình GĐ duyệt', assignedTo: 'admin', attachments: ['bao-gia-v2.pdf', 'hop-dong-draft.docx'] }) },
        { ID: 4, 'Thời gian': new Date(Date.now()-5400000).toISOString(), 'Người dùng': 'admin', 'Email': 'admin@test.com', 'Hành động': 'Giao việc', 'Loại': 'Hồ sơ', 'Đối tượng': 'Hợp đồng mua sắm CNTT', 'Chi tiết': JSON.stringify({ assignedTo: 'editor1', collaborators: ['viewer1', 'editor2'], deadline: '2025-02-28', priority: 'Cao', note: 'Cần hoàn thành trước cuối tháng, ưu tiên xử lý' }) },
        { ID: 5, 'Thời gian': new Date(Date.now()-7200000).toISOString(), 'Người dùng': 'editor1', 'Email': 'editor@test.com', 'Hành động': 'Đăng nhập', 'Loại': 'Hệ thống', 'Đối tượng': 'editor1', 'Chi tiết': JSON.stringify({ ip: '192.168.1.45', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0', loginMethod: 'SSO', sessionId: 'sess_abc123def456' }) },
        { ID: 6, 'Thời gian': new Date(Date.now()-10800000).toISOString(), 'Người dùng': 'admin', 'Email': 'admin@test.com', 'Hành động': 'Phân quyền', 'Loại': 'Người dùng', 'Đối tượng': 'editor2', 'Chi tiết': JSON.stringify({ role: 'Văn thư', permissions: { hoSo: 'full', danhMuc: 'read', nhaCungCap: 'edit', duAn: 'edit', nguoiDung: 'none' }, previousRole: 'Nhân viên' }) },
        { ID: 7, 'Thời gian': new Date(Date.now()-14400000).toISOString(), 'Người dùng': 'admin', 'Email': 'admin@test.com', 'Hành động': 'Tạo', 'Loại': 'Danh mục', 'Đối tượng': 'Công văn đến', 'Chi tiết': JSON.stringify({ 'Tên danh mục': 'Công văn đến', 'Danh mục cha': 'Công văn', description: 'Công văn nhận từ bên ngoài' }) },
        { ID: 8, 'Thời gian': new Date(Date.now()-18000000).toISOString(), 'Người dùng': 'admin', 'Email': 'admin@test.com', 'Hành động': 'Xóa', 'Loại': 'Nhà cung cấp', 'Đối tượng': 'XYZ Ltd', 'Chi tiết': JSON.stringify({ 'Tên NCC': 'XYZ Ltd', 'Tên đầy đủ': 'Công ty TNHH XYZ', 'MST': '0312345678', reason: 'Đã ngừng hợp tác' }) },
        { ID: 9, 'Thời gian': new Date(Date.now()-21600000).toISOString(), 'Người dùng': 'viewer1', 'Email': 'viewer@test.com', 'Hành động': 'Đăng nhập', 'Loại': 'Hệ thống', 'Đối tượng': 'viewer1', 'Chi tiết': JSON.stringify({ ip: '10.0.0.22', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/17.2', loginMethod: 'SSO', sessionId: 'sess_xyz789ghi012' }) },
        { ID: 10, 'Thời gian': new Date(Date.now()-25200000).toISOString(), 'Người dùng': 'admin', 'Email': 'admin@test.com', 'Hành động': 'Sửa', 'Loại': 'Dự án', 'Đối tượng': 'DA-02', 'Chi tiết': JSON.stringify({ 'Trường thay đổi': [{ field: 'Tên dự án đầy đủ', old: 'Dự án CNTT 2024', new: 'Dự án Chuyển đổi số 2024-2025' }, { field: 'Địa chỉ', old: 'Hà Nội', new: 'Hà Nội - HCM' }] }) },
      ], hasMore: false, total: 10, types: ['Hồ sơ', 'Danh mục', 'Người dùng', 'Nhóm', 'Dự án', 'Nhà cung cấp', 'Hệ thống'] }
    case 'api_getConfig':
      return { value: _mockConfig[args[1]] || null }
    case 'api_setConfig':
      _mockConfig[args[1]] = args[2]
      return { success: true }
    case 'api_clearCache':
      return { success: true }
    case 'api_getComments': {
      const docId = String(args[1])
      return { data: _mockComments.filter(c => String(c.DocID) === docId) }
    }
    case 'api_transitionDocument': {
      const docId = args[1]
      const action = args[2]
      const tData = args[3] || {}
      const idx = _mockData.docs.findIndex(d => String(d.ID) === String(docId))
      if (idx === -1) throw new Error('Không tìm thấy hồ sơ')
      const ACTIONS = {
        trinhDuyet: 'Chờ duyệt', luuTaiLieu: 'Hoàn thành',
        giaoViec: 'Chờ xử lý', thuHoi: 'Chờ duyệt',
        nhanViec: 'Đang xử lý', hoanThanh: 'Hoàn thành',
      }
      if (!ACTIONS[action]) throw new Error('Hành động không hợp lệ: ' + action)
      _mockData.docs[idx]['Tình trạng'] = ACTIONS[action]
      if (action === 'giaoViec' && tData['Phụ trách']) {
        _mockData.docs[idx]['Phụ trách'] = JSON.stringify([String(tData['Phụ trách'])])
      }
      if (tData['Người phối hợp'] !== undefined) {
        _mockData.docs[idx]['Người phối hợp'] = Array.isArray(tData['Người phối hợp']) ? JSON.stringify(tData['Người phối hợp']) : ''
      }
      _mockData.docs[idx]['Ngày cập nhật'] = new Date().toISOString()
      return { data: { ..._mockData.docs[idx] } }
    }
    case 'api_addComment': {
      const docId = String(args[1])
      const content = args[2]
      const comment = { ID: _nextCommentId++, DocID: docId, UserID: 1, 'Tên người dùng': 'admin', 'Nội dung': content, 'Thời gian': new Date().toISOString() }
      _mockComments.push(comment)
      return { data: comment }
    }
    case 'api_publishDocument': {
      const docId = args[1]
      const toIds = args[2] || []
      const ccIds = args[3] || []
      const idx = _mockData.docs.findIndex(d => String(d.ID) === String(docId))
      if (idx === -1) throw new Error('Không tìm thấy hồ sơ')
      const doc = _mockData.docs[idx]
      const history = doc['Lịch sử phát hành'] ? JSON.parse(doc['Lịch sử phát hành']) : []
      const toRecipients = toIds.map(id => {
        const u = _mockData.users.find(u => String(u.ID) === String(id))
        return { id, name: u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : String(id), email: u ? u['Email'] : '' }
      })
      const ccRecipients = ccIds.map(id => {
        const u = _mockData.users.find(u => String(u.ID) === String(id))
        return { id, name: u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : String(id), email: u ? u['Email'] : '' }
      })
      history.push({ lan: history.length + 1, ngay: new Date().toISOString(), nguoiGui: 1, to: toRecipients, cc: ccRecipients })
      _mockData.docs[idx]['Lịch sử phát hành'] = JSON.stringify(history)
      return { success: true, lan: history.length }
    }
    case 'api_browseDriveFolders': {
      const pid = args[1]
      if (!pid) return { current: { id: 'root', name: 'My Drive' }, folders: [
        { id: 'f1', name: 'Dự án A' }, { id: 'f2', name: 'Hợp đồng' }, { id: 'f3', name: 'Tài liệu nội bộ' }
      ]}
      return { current: { id: pid, name: 'Subfolder' }, folders: [
        { id: pid + '_sub1', name: '2024' }, { id: pid + '_sub2', name: '2025' }
      ]}
    }
    case 'api_uploadFileEager': {
      const categoryId = args[4]
      const draftId = args[5]
      const fileInfo = { fileId: 'mock-file-' + (++_nextId), fileName: args[3], mimeType: args[2], size: 1024 }
      if (draftId === 'edit') return { fileInfo }
      if (draftId) return { fileInfo, data: _mockAppendDraftFile(draftId, fileInfo) }
      const draft = _mockAdd(_mockData.docs, { 'Tên hồ sơ': '', 'Danh mục': categoryId, 'Tình trạng': 'Nháp', 'Tệp đính kèm': JSON.stringify([fileInfo]), 'Tên file': fileInfo.fileName, 'Người tạo': 'admin', 'Người cập nhật': 'admin', 'Ngày cập nhật': new Date().toISOString() })
      return { draftId: draft.ID, fileInfo, data: { ...draft } }
    }
    case 'api_startResumableUpload':
      return { uploadUri: 'mock-resumable-uri', accessToken: 'mock-token' }
    case 'api_finalizeChunkedUpload': {
      // args: token, uploadUri, fileName, mimeType, fileSize, categoryId, draftId
      const categoryId = args[5]
      const draftId = args[6]
      const fileInfo = { fileId: 'mock-file-' + (++_nextId), fileName: args[2], mimeType: args[3], size: args[4] }
      if (draftId === 'edit') return { fileInfo }
      if (draftId) return { fileInfo, data: _mockAppendDraftFile(draftId, fileInfo) }
      const draft = _mockAdd(_mockData.docs, { 'Tên hồ sơ': '', 'Danh mục': categoryId, 'Tình trạng': 'Nháp', 'Tệp đính kèm': JSON.stringify([fileInfo]), 'Tên file': fileInfo.fileName, 'Người tạo': 'admin', 'Người cập nhật': 'admin', 'Ngày cập nhật': new Date().toISOString() })
      return { draftId: draft.ID, fileInfo, data: { ...draft } }
    }
    case 'api_finalizeDraft': {
      const draftId = args[1]
      const formData = args[2] || {}
      const idx = _mockData.docs.findIndex(d => String(d.ID) === String(draftId))
      if (idx === -1) throw new Error('Không tìm thấy hồ sơ nháp')
      Object.assign(_mockData.docs[idx], formData, { 'Tình trạng': formData['Tình trạng'] || 'Chờ duyệt', 'Ngày cập nhật': new Date().toISOString() })
      return { data: { ..._mockData.docs[idx] } }
    }
    case 'api_cancelDraft': {
      const draftId = args[1]
      return _mockDelete(_mockData.docs, draftId)
    }
    case 'api_deleteFiles':
      return { success: true }
    case 'api_parseImportFile': {
      // Dev mock: simulate server-parsed rows from the uploaded xlsx (FileMoi tab).
      // Exercises grouping, category resolution, email resolution, conflicts,
      // duplicate G_ID, and validation errors.
      const mk = (o) => {
        const r = Object.assign({
          tenHoSo: '', tenFile: '', link: '', soHoSo: '', ngayBanHanh: '', ngayKetThuc: '',
          ghiChu: '', noiLuu: '', duAn: '', nhaCungCap: '', phuTrach: '',
          nguoiPhoiHop: '', giaTriHD: 0, gId: '', mimeType: 'application/pdf', size: 1024, danhMuc: '',
        }, o)
        if (!r.link && r.gId) r.link = 'https://drive.google.com/file/d/' + r.gId + '/view'
        return r
      }
      return {
        success: true,
        fileName: args[2] || 'scan file.xlsx',
        totalRows: 6,
        rows: [
          // Group A: 2 files, valid, with assignees
          mk({ tenHoSo: 'Hợp đồng EVN 2024', tenFile: 'hd-evn.pdf', gId: 'gid-A1', danhMuc: 'Hợp đồng / Hợp đồng XD', soHoSo: 'HS-100', phuTrach: 'vt@test.com', nguoiPhoiHop: 'nva@test.com, missing@test.com', giaTriHD: 5000000, rowIndex: 2 }),
          mk({ tenHoSo: 'Hợp đồng EVN 2024', tenFile: 'phu-luc-evn.docx', gId: 'gid-A2', danhMuc: 'Hợp đồng / Hợp đồng XD', soHoSo: 'HS-100-KHAC', rowIndex: 3 }), // soHoSo khác → warning
          // Group B: valid single file
          mk({ tenHoSo: 'Công văn đến 05', tenFile: 'cv-05.pdf', gId: 'gid-B1', danhMuc: 'Công văn', soHoSo: 'HS-200', rowIndex: 4 }),
          // Group B duplicate G_ID → dedup warning
          mk({ tenHoSo: 'Công văn đến 05', tenFile: 'cv-05-trung.pdf', gId: 'gid-B1', danhMuc: 'Công văn', rowIndex: 5 }),
          // Group C: error — category không tồn tại
          mk({ tenHoSo: 'Báo cáo lỗi DM', tenFile: 'bc.pdf', gId: 'gid-C1', danhMuc: 'Danh mục không có', rowIndex: 6 }),
          // Group D: error — thiếu G_ID
          mk({ tenHoSo: 'Hồ sơ thiếu file', tenFile: 'x.pdf', gId: '', danhMuc: 'Báo cáo', rowIndex: 7 }),
        ],
      }
    }
    case 'api_bulkImportDocuments': {
      const groups = (args[1] && args[1].groups) || []
      let totalFiles = 0
      const warnings = []
      groups.forEach(g => {
        _mockAdd(_mockData.docs, Object.assign({}, g.docData, {
          'Tình trạng': 'Hoàn thành',
          'Tệp đính kèm': JSON.stringify(g.files || []),
          'Tên file': (g.files || []).map(f => f.fileName).join(', '),
          'Ngày cập nhật': new Date().toISOString(),
          'Người tạo': 'admin', 'Người cập nhật': 'admin',
        }))
        totalFiles += (g.files || []).length
        ;(g.warnings || []).forEach(w => warnings.push({ group: g.docData['Tên hồ sơ'], message: w, rowIndices: g.rowIndices || [] }))
      })
      return { success: true, created: groups.length, totalFiles, errors: [], warnings }
    }
    default:
      throw new Error('Mock không hỗ trợ: ' + fn)
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
