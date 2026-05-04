// GAS client — calls google.script.run (real) or mock (dev)
// All calls return Promises resolving to payload or rejecting with error message.

const IS_GAS = typeof google !== 'undefined' && google.script && google.script.run

// ── Wrapper ──────────────────────────────────────────────────────────────────
function _isSessionExpired(msg) {
  return msg && (msg.includes('hết hạn') || msg.includes('Phiên đăng nhập'))
}

// GAS Call Queue to prevent concurrent request limits and auto-retry
const _queue = []
let _activeCount = 0
const MAX_CONCURRENT = 3

function _processQueue() {
  if (_queue.length === 0 || _activeCount >= MAX_CONCURRENT) return
  _activeCount++
  const { fnName, args, resolve, reject, retries } = _queue.shift()

  google.script.run
    .withSuccessHandler(res => {
      _activeCount--
      _processQueue()
      if (res && res.success) {
        resolve(res.payload)
      } else {
        const errMsg = res ? res.error : 'Lỗi không xác định'
        if (_isSessionExpired(errMsg)) {
          window.dispatchEvent(new CustomEvent('auth:sessionExpired', { detail: { message: errMsg } }))
        }
        reject(new Error(errMsg))
      }
    })
    .withFailureHandler(err => {
      _activeCount--
      const msg = err.message || String(err)
      if (retries > 0 && !_isSessionExpired(msg)) {
        setTimeout(() => {
          _queue.push({ fnName, args, resolve, reject, retries: retries - 1 })
          _processQueue()
        }, 1000)
      } else {
        reject(new Error(msg))
        _processQueue()
      }
    })
    [fnName](...args)
}

function gasCall(fnName, ...args) {
  if (IS_GAS) {
    return new Promise((resolve, reject) => {
      _queue.push({ fnName, args, resolve, reject, retries: 2 })
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
const _mockReadIds = new Set(['1'])
const _mockConfig = {}
const _mockComments = []
let _nextCommentId = 1

const _mockData = {
  users: [
    { ID: 1, 'Tên đăng nhập': 'admin', 'Email': 'admin@test.com', 'Quyền': 'admin', 'Phân quyền chi tiết': '', 'Trạng thái': 'Active', 'Đăng nhập cuối': '2024-01-15', 'Phòng ban': '' },
    { ID: 2, 'Tên đăng nhập': 'editor1', 'Email': 'editor@test.com', 'Quyền': 'Nhân viên', 'Phân quyền chi tiết': '', 'Trạng thái': 'Active', 'Đăng nhập cuối': '2024-01-10', 'Phòng ban': JSON.stringify(['Kỹ thuật']) },
    { ID: 3, 'Tên đăng nhập': 'truongphong', 'Email': 'tp@test.com', 'Quyền': 'Trưởng phòng', 'Phân quyền chi tiết': '', 'Trạng thái': 'Active', 'Đăng nhập cuối': '2024-01-12', 'Phòng ban': JSON.stringify(['Kỹ thuật']) },
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
  docs: [
    { ID: 1, 'Tên hồ sơ': 'Hợp đồng mua sắm CNTT', 'Danh mục': 1, 'Tình trạng': 'Chờ xử lý', 'Dự án (Phòng ban)': 'DA-01', 'Nhà cung cấp (Nơi ban hành)': 'ABC Corp', 'Số hồ sơ': 'HS-001', 'Giá trị HĐ': 100000000, 'Ngày ban hành': '2024-01-15', 'Ngày kết thúc': '2024-12-31', 'Ngày cập nhật': '2024-01-15', 'Phụ trách': JSON.stringify(['admin']), 'Người phối hợp': JSON.stringify(['editor1']), 'Ghi chú': 'Hợp đồng ưu tiên', 'Người tạo': 'admin', 'Người cập nhật': 'admin', 'File ID': JSON.stringify([{ fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs', fileName: 'hop-dong-cntt.pdf', mimeType: 'application/pdf', size: 204800 }]) },
    { ID: 2, 'Tên hồ sơ': 'Công văn số 01/2024',    'Danh mục': 2, 'Tình trạng': 'Hoàn thành', 'Dự án (Phòng ban)': 'DA-02', 'Nhà cung cấp (Nơi ban hành)': '', 'Số hồ sơ': 'HS-002', 'Giá trị HĐ': 0, 'Ngày ban hành': '2024-02-01', 'Ngày kết thúc': '', 'Ngày cập nhật': '2024-02-01', 'Phụ trách': JSON.stringify(['admin']), 'Người phối hợp': JSON.stringify(['editor1']), 'Ghi chú': '', 'Người tạo': 'admin', 'Người cập nhật': 'editor1', 'File ID': JSON.stringify([{ fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs', fileName: 'cong-van-01.pdf', mimeType: 'application/pdf', size: 102400 }, { fileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlcs', fileName: 'phu-luc.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 51200 }]) },
    { ID: 3, 'Tên hồ sơ': 'Hợp đồng xây dựng VP', 'Danh mục': 1, 'Tình trạng': 'Chờ duyệt', 'Dự án (Phòng ban)': 'DA-01', 'Nhà cung cấp (Nơi ban hành)': 'XYZ Ltd', 'Số hồ sơ': 'HS-003', 'Giá trị HĐ': 500000000, 'Ngày ban hành': '2024-03-01', 'Ngày kết thúc': '2025-03-01', 'Ngày cập nhật': '2024-03-01', 'Phụ trách': JSON.stringify(['admin']), 'Người phối hợp': '', 'Ghi chú': 'Chờ GĐ duyệt', 'Người tạo': 'admin', 'Người cập nhật': 'admin' },
  ],
}

function _mockAdd(list, data) {
  const item = { ...data, ID: ++_nextId }
  list.push(item)
  return item
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

const _ADMIN_PERMS = {
  hoSo:       { c: true, r: true, u: true, d: true },
  danhMuc:    { c: true, r: true, u: true, d: true },
  nhom:       { c: true, r: true, u: true, d: true },
  nhaCungCap: { c: true, r: true, u: true, d: true },
  duAn:       { c: true, r: true, u: true, d: true },
  user:       { c: true, r: true, u: true, d: true },
  caiDat:     { c: true, r: true, u: true, d: true },
  allowedCategories: [],
}

async function mockCall(fn, ...args) {
  await delay(80)
  // eslint-disable-next-line no-console
  console.log('[gasClient mock]', fn, args)
  switch (fn) {
    case 'api_logout':
      _mockSession = null
      return { success: true }
    case 'api_validateSession':
      // In dev mode, auto-create session for testing
      if (!_mockSession) {
        _mockSession = { userId: 1, username: 'admin', role: 'admin', email: 'admin@test.com', mustChangePass: false, departments: [], permissions: _ADMIN_PERMS, canCreate: true }
      }
      return { ..._mockSession }
    case 'api_getAllData':
      return {
        danhMuc:     _mockData.danhMuc.map(i => ({ ...i })),
        nhom:        _mockData.nhom.map(i => ({ ...i })),
        duAn:        _mockData.duAn.map(i => ({ ...i })),
        nhaCungCap:  _mockData.nhaCungCap.map(i => ({ ...i })),
        users: [
          { ID: 1, 'Tên đăng nhập': 'admin',       'Tên nhân viên': 'Admin Hệ thống',  'Email': 'admin@test.com',  'Quyền': 'admin' },
          { ID: 2, 'Tên đăng nhập': 'editor1',      'Tên nhân viên': 'Nguyễn Văn A',    'Email': 'nva@test.com',    'Quyền': 'Nhân viên' },
          { ID: 3, 'Tên đăng nhập': 'truongphong',  'Tên nhân viên': 'Trần Thị Bình',   'Email': 'ttb@test.com',    'Quyền': 'Trưởng phòng' },
        ],
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
    case 'api_getUsers':
      return (_mockData.users || [
        { ID: 1, 'Tên đăng nhập': 'admin', 'Email': 'admin@test.com', 'Quyền': 'admin', 'Phân quyền chi tiết': '', 'Trạng thái': 'Active', 'Đăng nhập cuối': '2024-01-15', 'Phòng ban': '' },
        { ID: 2, 'Tên đăng nhập': 'editor1', 'Email': 'editor@test.com', 'Quyền': 'Nhân viên', 'Phân quyền chi tiết': '', 'Trạng thái': 'Active', 'Đăng nhập cuối': '2024-01-10', 'Phòng ban': JSON.stringify(['Kỹ thuật']) },
        { ID: 3, 'Tên đăng nhập': 'truongphong', 'Email': 'tp@test.com', 'Quyền': 'Trưởng phòng', 'Phân quyền chi tiết': '', 'Trạng thái': 'Active', 'Đăng nhập cuối': '2024-01-12', 'Phòng ban': JSON.stringify(['Kỹ thuật']) },
      ]).map(u => ({ ...u }))
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
      _mockReadIds.add(String(args[1]))
      return { success: true }
    case 'api_getReadDocIds':
      return { readIds: [..._mockReadIds] }
    case 'api_markMultipleAsRead':
      ;(args[1] || []).forEach(id => _mockReadIds.add(String(id)))
      return { success: true, marked: (args[1] || []).length }
    case 'api_getUnreadCount':
      return { count: Math.max(0, _mockData.docs.length - _mockReadIds.size) }
    case 'api_getAuditLogs':
      return { data: [
        { ID: 1, 'Thời gian': new Date().toISOString(), 'Người dùng': 'admin', 'Email': 'admin@test.com', 'Hành động': 'Tạo', 'Loại': 'Hồ sơ', 'Đối tượng': 'Hợp đồng mua sắm', 'Chi tiết': '{}' },
        { ID: 2, 'Thời gian': new Date(Date.now()-3600000).toISOString(), 'Người dùng': 'admin', 'Email': 'admin@test.com', 'Hành động': 'Sửa', 'Loại': 'Danh mục', 'Đối tượng': 'Hợp đồng', 'Chi tiết': '{}' },
        { ID: 3, 'Thời gian': new Date(Date.now()-7200000).toISOString(), 'Người dùng': 'editor1', 'Email': 'editor@test.com', 'Hành động': 'Đăng nhập', 'Loại': 'Hệ thống', 'Đối tượng': 'editor1', 'Chi tiết': '{}' },
      ] }
    case 'api_getConfig':
      return { value: _mockConfig[args[1]] || null }
    case 'api_setConfig':
      _mockConfig[args[1]] = args[2]
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
    case 'api_browseDriveFolders': {
      const pid = args[1]
      if (!pid) return { current: { id: 'root', name: 'My Drive' }, folders: [
        { id: 'f1', name: 'Dự án A' }, { id: 'f2', name: 'Hợp đồng' }, { id: 'f3', name: 'Tài liệu nội bộ' }
      ]}
      return { current: { id: pid, name: 'Subfolder' }, folders: [
        { id: pid + '_sub1', name: '2024' }, { id: pid + '_sub2', name: '2025' }
      ]}
    }
    default:
      throw new Error('Mock không hỗ trợ: ' + fn)
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }
