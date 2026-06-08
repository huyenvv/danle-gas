export const MOCK_TOKEN = 'test-access-token'

export const MOCK_ADMIN_SESSION = {
  userId: 1,
  username: 'admin',
  role: 'admin',
  email: 'admin@test.com',
  name: 'Admin',
  canCreate: true,
  canCreateSubCat: true,
  departments: [],
}

export const MOCK_VIEWER_SESSION = {
  userId: 2,
  username: 'viewer1',
  role: 'Nhân viên',
  email: 'viewer@test.com',
  name: 'Viewer',
  canCreate: false,
  canCreateSubCat: false,
  departments: [],
}

export const MOCK_USERS = [
  {
    ID: 1,
    'Tên đăng nhập': 'admin',
    'Tên nhân viên': 'Admin',
    'Email': 'admin@test.com',
    'Trạng thái': 'Active',
    'Quyền': 'admin',
    'Được phát hành': 'FALSE',
  },
  {
    ID: 2,
    'Tên đăng nhập': 'viewer1',
    'Tên nhân viên': 'Viewer One',
    'Email': 'viewer@test.com',
    'Trạng thái': 'Active',
    'Quyền': 'Nhân viên',
    'Được phát hành': 'FALSE',
  },
]

export const MOCK_DOCS = [
  {
    ID: '1',
    'Tên hồ sơ': 'Hợp đồng mua sắm CNTT',
    'Tình trạng': 'Chờ duyệt',
    'Danh mục': '1',
    'Người tạo': 'admin',
    'Phụ trách': JSON.stringify(['admin']),
    'Ngày cập nhật': new Date().toISOString(),
    'Giá trị HĐ': '100000000',
    'Tệp đính kèm': '',
  },
  {
    ID: '2',
    'Tên hồ sơ': 'Công văn số 01/2024',
    'Tình trạng': 'Hoàn thành',
    'Danh mục': '2',
    'Người tạo': 'admin',
    'Phụ trách': JSON.stringify(['admin']),
    'Ngày cập nhật': new Date().toISOString(),
    'Giá trị HĐ': '0',
    'Tệp đính kèm': '',
  },
]

export const MOCK_LOOKUPS = {
  danhMuc: [
    { ID: '1', 'Tên danh mục': 'Hợp đồng', 'Danh mục cha': '' },
    { ID: '2', 'Tên danh mục': 'Công văn', 'Danh mục cha': '' },
  ],
  nhom: [],
  duAn: [{ ID: '1', 'Tên dự án': 'DA-01', 'Tên đầy đủ': 'Dự án 01' }],
  nhaCungCap: [{ ID: '1', 'Tên nhà cung cấp': 'ABC Corp', 'Tên đầy đủ': 'Công ty ABC' }],
  phongBan: [{ ID: '1', 'Tên phòng ban': 'Ban Giám Đốc' }],
  assignments: [{ ID: '1', UserID: '1', 'Chức vụ': 'Giám đốc', PhongBanID: '1' }],
  users: MOCK_USERS,
  ssoUsers: MOCK_USERS,
}

export const MOCK_INITIAL_DATA = {
  docs: MOCK_DOCS,
  lookups: MOCK_LOOKUPS,
  stats: {
    total: 2,
    byStatus: { 'Chờ duyệt': 1, 'Hoàn thành': 1 },
    totalValue: 100000000,
  },
  unreadIds: [],
  companyName: 'Test Company',
}

export const MOCK_COMMENTS = [
  {
    ID: 1,
    DocID: '1',
    UserID: 1,
    'Tên người dùng': 'admin',
    'Nội dung': 'Bình luận đầu tiên',
    'Thời gian': new Date().toISOString(),
  },
]
