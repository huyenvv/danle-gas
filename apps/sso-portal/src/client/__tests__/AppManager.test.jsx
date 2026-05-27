import { screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import { renderDashboard, MOCK_APPS } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

// Helper: navigate to Quản lý App tab after rendering dashboard
async function goToAppMgr(overrides = {}) {
  await renderDashboard(gasCall, { apps: MOCK_APPS, ...overrides })
  const tabButtons = screen.getAllByRole('button')
  const appMgrTab = tabButtons.find(btn => btn.textContent.includes('Quản lý App'))
  expect(appMgrTab).toBeDefined()
  fireEvent.click(appMgrTab)
  // Wait for AppManager heading to appear
  await waitFor(() => expect(screen.getByText('Quản lý ứng dụng')).toBeInTheDocument())
}

// ── list ───────────────────────────────────────────────────────────────────────

describe('AppManager — list', () => {
  test('renders app names in the list', async () => {
    await goToAppMgr()
    expect(screen.getByText('Quản lý Tài liệu')).toBeInTheDocument()
    expect(screen.getByText('Quản lý Công việc')).toBeInTheDocument()
  })

  test('admin sees "Thêm App" button', async () => {
    await goToAppMgr()
    expect(screen.getByText('Thêm App')).toBeInTheDocument()
  })

  test('admin sees edit buttons for each app', async () => {
    await goToAppMgr()
    // Each app row has a "Sửa" title button (icon only)
    const editButtons = screen.getAllByTitle('Sửa')
    expect(editButtons.length).toBe(MOCK_APPS.length)
  })

  test('admin sees delete buttons for each app', async () => {
    await goToAppMgr()
    const deleteButtons = screen.getAllByTitle('Xóa')
    expect(deleteButtons.length).toBe(MOCK_APPS.length)
  })
})

// ── add app ────────────────────────────────────────────────────────────────────

describe('AppManager — add app', () => {
  test('opens add form when "Thêm App" is clicked', async () => {
    await goToAppMgr()
    fireEvent.click(screen.getByText('Thêm App'))
    await waitFor(() => expect(screen.getByText('Thêm ứng dụng mới')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('vd: Quản lý Tài liệu')).toBeInTheDocument()
  })

  test('calls api_addApp with correct app name on submit', async () => {
    const newApp = { ID: 3, 'Tên App': 'App Mới', 'Webapp URL': '', 'Icon': 'apps', 'Mô tả': '', 'Trạng thái': 'Active', 'Quyền xem': '' }
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_addApp') return Promise.resolve(newApp)
      if (fn === 'api_portalSync') return Promise.resolve({
        apps: MOCK_APPS, users: [], phongBan: [], assignments: [], mailConfig: {},
      })
      return Promise.reject(new Error('Unhandled: ' + fn))
    })

    await goToAppMgr()

    fireEvent.click(screen.getByText('Thêm App'))
    await waitFor(() => expect(screen.getByPlaceholderText('vd: Quản lý Tài liệu')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('vd: Quản lý Tài liệu'), {
      target: { value: 'App Mới' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^Thêm$/ }))

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_addApp',
        'test-at',
        expect.objectContaining({ 'Tên App': 'App Mới' })
      )
    })
  })
})
