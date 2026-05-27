import { screen, fireEvent, waitFor } from '@testing-library/react'
import AuditLogPage from '../components/AuditLogPage.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN } from './helpers/mockData.js'

jest.mock('../gasClient.js')

const MOCK_LOGS = [
  {
    ID: 1,
    'Thời gian': new Date().toISOString(),
    'Người dùng': 'admin',
    'Email': 'admin@test.com',
    'Hành động': 'Tạo',
    'Loại': 'Hồ sơ',
    'Đối tượng': 'Hợp đồng 01',
    'Chi tiết': '{}',
  },
  {
    ID: 2,
    'Thời gian': new Date().toISOString(),
    'Người dùng': 'viewer1',
    'Email': 'viewer@test.com',
    'Hành động': 'Đăng nhập',
    'Loại': 'Hệ thống',
    'Đối tượng': 'viewer1',
    'Chi tiết': '{}',
  },
]

// AuditLogPage calls api_getAuditLogs on mount with { offset, limit, keyword }.
// Response shape: { data, hasMore, total, types }
// The type filter (<select>) filters client-side without another gasCall.
beforeEach(() => {
  gasCall.mockReset()
  gasCall.mockResolvedValue({
    data: MOCK_LOGS,
    hasMore: false,
    total: 2,
    types: ['Hồ sơ', 'Hệ thống'],
  })
})

test('renders audit log entries on mount', async () => {
  renderWithProviders(<AuditLogPage token={MOCK_TOKEN} />)

  // 'admin' appears in both the row span and the tooltip paragraph — use getAllByText
  await waitFor(() => {
    expect(screen.getAllByText('admin').length).toBeGreaterThan(0)
  })

  expect(screen.getByText('Tạo')).toBeInTheDocument()
  expect(screen.getByText('"Hợp đồng 01"')).toBeInTheDocument()
  expect(screen.getAllByText('viewer1').length).toBeGreaterThan(0)
})

test('filter by type shows only matching log entries', async () => {
  renderWithProviders(<AuditLogPage token={MOCK_TOKEN} />)

  await waitFor(() => {
    expect(screen.getAllByText('admin').length).toBeGreaterThan(0)
  })

  // Select 'Hồ sơ' in the type filter — client-side filtering, no extra gasCall
  const select = screen.getByRole('combobox')
  fireEvent.change(select, { target: { value: 'Hồ sơ' } })

  // Only the 'Hồ sơ' log entry should remain; viewer1 row should be gone
  await waitFor(() => {
    expect(screen.getAllByText('admin').length).toBeGreaterThan(0)
    expect(screen.queryByText('viewer1')).not.toBeInTheDocument()
  })
})
