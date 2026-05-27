import { render, screen, waitFor } from '@testing-library/react'
import App from '../App.jsx'

// ── Mock data factories ───────────────────────────────────────────────────────

export const MOCK_USER = { userId: 2, username: 'huyenvv', email: 'huyenvv@test.com', role: 'user', displayName: 'Huyên', mustChangePass: false, isOwner: false }
export const MOCK_ADMIN = { userId: 1, username: 'admin', email: 'admin@test.com', role: 'admin', displayName: 'Admin', mustChangePass: false, isOwner: false }

export const MOCK_USERS = [
  { ID: 2, 'Tên đăng nhập': 'huyenvv', 'Email': 'huyenvv@test.com', 'Tên nhân viên': 'Huyên', 'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'FailedLogins': 0 },
  { ID: 3, 'Tên đăng nhập': 'user3',   'Email': 'user3@test.com',   'Tên nhân viên': 'User 3', 'Trạng thái': 'Active', 'MustChangePass': 'FALSE', 'FailedLogins': 0 },
  { ID: 4, 'Tên đăng nhập': 'locked',  'Email': 'locked@test.com',  'Tên nhân viên': 'Locked', 'Trạng thái': 'Locked', 'MustChangePass': 'FALSE', 'FailedLogins': 5  },
]

export const MOCK_APPS = [
  { ID: 1, 'Tên App': 'Quản lý Tài liệu', 'Webapp URL': 'http://localhost:5173/', 'Icon': 'description', 'Trạng thái': 'Active', 'Quyền xem': '' },
  { ID: 2, 'Tên App': 'Quản lý Công việc', 'Webapp URL': 'http://localhost:5175/', 'Icon': 'task', 'Trạng thái': 'Active', 'Quyền xem': '' },
]

export const MOCK_PHONG_BAN = [
  { ID: 1, 'Tên phòng ban': 'Kỹ thuật' },
  { ID: 2, 'Tên phòng ban': 'Kinh doanh' },
]

export const MOCK_ASSIGNMENTS = [
  { ID: 1, 'UserID': '1',  'Chức vụ': 'admin',        'PhongBanID': '' },
  { ID: 2, 'UserID': '2',  'Chức vụ': 'Trưởng phòng', 'PhongBanID': '1' },
  { ID: 3, 'UserID': '3',  'Chức vụ': 'Nhân viên',    'PhongBanID': '1' },
]

// ── Session setup helpers ─────────────────────────────────────────────────────

/**
 * Configure gasCall mock for an authenticated admin session.
 * Call before render(<App />).
 */
export function setupAdminSession(gasCall, overrides = {}) {
  gasCall.mockImplementation((fn, ...args) => {
    if (fn === 'api_resume') return Promise.resolve({
      accessToken: 'test-at', refreshToken: 'test-rt',
      user: MOCK_ADMIN, parentSheetId: 'test-sheet',
    })
    if (fn === 'api_portalSync') return Promise.resolve({
      apps:        overrides.apps        ?? MOCK_APPS,
      users:       overrides.users       ?? MOCK_USERS,
      phongBan:    overrides.phongBan    ?? MOCK_PHONG_BAN,
      assignments: overrides.assignments ?? MOCK_ASSIGNMENTS,
      mailConfig:  overrides.mailConfig  ?? { MAIL_ENABLED: 'FALSE' },
    })
    if (fn === 'api_getAuditLogs') return Promise.resolve({
      data: overrides.logs ?? [
        { ID: 1, 'Thời gian': '2026-01-01T00:00:00Z', 'Người dùng': 'admin@test.com', 'Email': 'admin@test.com', 'Hành động': 'Đăng nhập', 'Loại': 'Xác thực', 'Đối tượng': '', 'Chi tiết': '' },
      ],
      hasMore: false, total: 1, types: ['Xác thực'],
    })
    return Promise.reject(new Error('Unhandled gasCall mock: ' + fn))
  })
  localStorage.setItem('sso_refresh_token', 'test-rt')
  localStorage.setItem('sso_access_token', 'test-at')
  localStorage.setItem('sso_parent_sheet_id', 'test-sheet')
}

/**
 * Render <App /> in admin state and wait for Dashboard to appear.
 */
export async function renderDashboard(gasCall, overrides = {}) {
  setupAdminSession(gasCall, overrides)
  render(<App />)
  await waitFor(() => screen.getByText('Ứng dụng')) // first tab label
}

/**
 * Render <App /> in unauthenticated state (LoginPage).
 */
export async function renderLoginPage(gasCall) {
  gasCall.mockRejectedValue(new Error('TOKEN_REVOKED'))
  render(<App />)
  await waitFor(() => screen.getByPlaceholderText('Nhập email đăng nhập'))
}
