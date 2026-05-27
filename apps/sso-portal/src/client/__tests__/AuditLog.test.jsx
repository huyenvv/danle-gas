import { screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import { renderDashboard } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

const MOCK_LOGS = [
  { ID: 3, 'Thời gian': '2026-01-03T10:00:00Z', 'Người dùng': 'admin', 'Email': 'admin@test.com', 'Hành động': 'Thêm',              'Loại': 'Người dùng', 'Đối tượng': 'new@test.com',     'Chi tiết': '' },
  { ID: 2, 'Thời gian': '2026-01-02T09:00:00Z', 'Người dùng': 'admin', 'Email': 'admin@test.com', 'Hành động': 'Đăng nhập',         'Loại': 'Xác thực',   'Đối tượng': 'admin@test.com',   'Chi tiết': 'desktop' },
  { ID: 1, 'Thời gian': '2026-01-01T08:00:00Z', 'Người dùng': 'huyenvv', 'Email': 'huyenvv@test.com', 'Hành động': 'Đăng nhập thất bại', 'Loại': 'Xác thực', 'Đối tượng': 'huyenvv@test.com', 'Chi tiết': '' },
]

// Navigate to Nhật ký tab after rendering dashboard with MOCK_LOGS
async function goToAuditLog(overrides = {}) {
  await renderDashboard(gasCall, {
    logs: MOCK_LOGS,
    // types returned alongside the logs
    ...overrides,
  })
  // Override the api_getAuditLogs mock to include types
  gasCall.mockImplementation((fn, ...args) => {
    if (fn === 'api_getAuditLogs') return Promise.resolve({
      data: MOCK_LOGS,
      hasMore: false,
      total: MOCK_LOGS.length,
      types: ['Xác thực', 'Người dùng'],
    })
    return Promise.reject(new Error('Unhandled gasCall mock: ' + fn))
  })

  const tabButtons = screen.getAllByRole('button')
  const auditTab = tabButtons.find(btn => btn.textContent.includes('Nhật ký'))
  expect(auditTab).toBeDefined()
  fireEvent.click(auditTab)
  // Wait for log rows to render
  await waitFor(() => expect(screen.getAllByText('Đăng nhập').length).toBeGreaterThan(0))
}

// ── rendering ─────────────────────────────────────────────────────────────────

describe('AuditLog — log rendering', () => {
  test('renders action names from logs', async () => {
    await goToAuditLog()
    // 'Đăng nhập' appears in two rows (ID 2 and ID 1's action variant)
    expect(screen.getAllByText('Đăng nhập').length).toBeGreaterThan(0)
    expect(screen.getByText('Thêm')).toBeInTheDocument()
    expect(screen.getByText('Đăng nhập thất bại')).toBeInTheDocument()
  })

  test('renders actor username for each log row', async () => {
    await goToAuditLog()
    // 'admin' appears in actor cell (2 rows) + possibly header/other places
    const adminCells = screen.getAllByText('admin')
    expect(adminCells.length).toBeGreaterThanOrEqual(2)
    // 'huyenvv' appears in actor cell and also in Đối tượng column quote
    const huyenCells = screen.getAllByText('huyenvv')
    expect(huyenCells.length).toBeGreaterThanOrEqual(1)
  })

  test('renders type badges (Xác thực, Người dùng)', async () => {
    await goToAuditLog()
    // 'Xác thực' appears as type badge in 2 rows
    const xacThucBadges = screen.getAllByText('Xác thực')
    expect(xacThucBadges.length).toBeGreaterThanOrEqual(2)
    // 'Người dùng' appears as type badge AND in the tab navigation
    const nguoiDungEls = screen.getAllByText('Người dùng')
    expect(nguoiDungEls.length).toBeGreaterThanOrEqual(1)
  })
})

// ── type filter ───────────────────────────────────────────────────────────────

describe('AuditLog — type filter select', () => {
  test('shows "Tất cả loại" option and type options in select', async () => {
    await goToAuditLog()
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    // After the api call resolves with types, options should include the type values
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Tất cả loại' })).toBeInTheDocument()
    })
  })

  test('filtering by "Người dùng" hides Xác thực-only rows and keeps Thêm row', async () => {
    await goToAuditLog()
    const select = screen.getByRole('combobox')
    // Wait for type options to be populated
    await waitFor(() => {
      const options = select.querySelectorAll('option')
      expect(options.length).toBeGreaterThan(1)
    })
    fireEvent.change(select, { target: { value: 'Người dùng' } })
    // After filter: only log with Loại='Người dùng' is visible (the 'Thêm' action)
    await waitFor(() => {
      expect(screen.getByText('Thêm')).toBeInTheDocument()
    })
    // 'Đăng nhập thất bại' row (Xác thực) should no longer be in the filtered list
    expect(screen.queryByText('Đăng nhập thất bại')).not.toBeInTheDocument()
  })

  test('resetting filter to "Tất cả loại" shows all rows again', async () => {
    await goToAuditLog()
    const select = screen.getByRole('combobox')
    await waitFor(() => {
      const options = select.querySelectorAll('option')
      expect(options.length).toBeGreaterThan(1)
    })
    // Apply filter first
    fireEvent.change(select, { target: { value: 'Người dùng' } })
    await waitFor(() => expect(screen.queryByText('Đăng nhập thất bại')).not.toBeInTheDocument())
    // Reset
    fireEvent.change(select, { target: { value: '' } })
    await waitFor(() => expect(screen.getByText('Đăng nhập thất bại')).toBeInTheDocument())
    expect(screen.getByText('Thêm')).toBeInTheDocument()
  })
})

// ── keyword search ────────────────────────────────────────────────────────────

describe('AuditLog — search', () => {
  test('typing keyword and pressing Enter calls api_getAuditLogs with keyword param', async () => {
    await goToAuditLog()
    // Set up mock for the second api_getAuditLogs call (triggered after Enter)
    gasCall.mockImplementation((fn, token, params) => {
      if (fn === 'api_getAuditLogs') return Promise.resolve({
        data: [MOCK_LOGS[1]], // only the matching log
        hasMore: false,
        total: 1,
        types: ['Xác thực'],
      })
      return Promise.reject(new Error('Unhandled: ' + fn))
    })
    // Find search input and type keyword
    const searchInput = screen.getByPlaceholderText('Tìm kiếm...')
    fireEvent.change(searchInput, { target: { value: 'Đăng nhập' } })
    // Submit search by pressing Enter
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' })
    // Wait for api_getAuditLogs to be called with the keyword
    await waitFor(() => expect(gasCall).toHaveBeenCalledWith(
      'api_getAuditLogs',
      expect.any(String),
      expect.objectContaining({ keyword: 'Đăng nhập' }),
    ))
  })
})
