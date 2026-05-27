import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import { renderDashboard, MOCK_USERS, MOCK_ASSIGNMENTS, MOCK_PHONG_BAN } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

// Helper: navigate to Người dùng tab after rendering dashboard
async function goToUsersTab(overrides = {}) {
  await renderDashboard(gasCall, { users: MOCK_USERS, assignments: MOCK_ASSIGNMENTS, phongBan: MOCK_PHONG_BAN, ...overrides })
  const tabButtons = screen.getAllByRole('button')
  const userTab = tabButtons.find(btn => btn.textContent.includes('Người dùng') && !btn.textContent.includes('dùng cuối'))
  expect(userTab).toBeDefined()
  fireEvent.click(userTab)
  // Wait for user list to appear
  await waitFor(() => expect(screen.getByText('huyenvv@test.com')).toBeInTheDocument())
}

// ── list ──────────────────────────────────────────────────────────────────────

describe('UserManager — list', () => {
  test('renders all user emails in the table', async () => {
    await goToUsersTab()
    expect(screen.getByText('huyenvv@test.com')).toBeInTheDocument()
    expect(screen.getByText('user3@test.com')).toBeInTheDocument()
    expect(screen.getByText('locked@test.com')).toBeInTheDocument()
  })

  test('shows "Đã khóa" badge for locked user', async () => {
    await goToUsersTab()
    // The locked user row should have the locked status badge
    const lockedBadges = screen.getAllByText('Đã khóa')
    expect(lockedBadges.length).toBeGreaterThan(0)
  })

  test('shows "Hoạt động" badge for active users', async () => {
    await goToUsersTab()
    const activeBadges = screen.getAllByText('Hoạt động')
    expect(activeBadges.length).toBeGreaterThanOrEqual(2)
  })
})

// ── add user ──────────────────────────────────────────────────────────────────

describe('UserManager — add user', () => {
  test('opens add user form when "Thêm người dùng" button is clicked', async () => {
    await goToUsersTab()
    const addBtn = screen.getByText('Thêm người dùng')
    fireEvent.click(addBtn)
    await waitFor(() => expect(screen.getByText('Thêm người dùng mới')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('vd: huyenvv@gmail.com')).toBeInTheDocument()
  })

  test('calls api_addUser with the entered email on submit', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_addUser') return Promise.resolve({ ok: true })
      if (fn === 'api_portalSync') return Promise.resolve({
        apps: [], users: MOCK_USERS, phongBan: MOCK_PHONG_BAN,
        assignments: MOCK_ASSIGNMENTS, mailConfig: {},
      })
      return Promise.reject(new Error('Unhandled: ' + fn))
    })

    await goToUsersTab()

    fireEvent.click(screen.getByText('Thêm người dùng'))
    await waitFor(() => expect(screen.getByPlaceholderText('vd: huyenvv@gmail.com')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('vd: huyenvv@gmail.com'), {
      target: { value: 'newuser@test.com' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^Thêm$/ }))

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_addUser',
        'test-at',
        expect.objectContaining({ 'Email': 'newuser@test.com' })
      )
    })
  })
})

// ── lock / unlock ─────────────────────────────────────────────────────────────

describe('UserManager — lock/unlock', () => {
  test('clicking "Khóa" button shows confirm dialog and calls api_lockUser on confirm', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_lockUser') return Promise.resolve({ ok: true })
      if (fn === 'api_portalSync') return Promise.resolve({
        apps: [], users: MOCK_USERS, phongBan: MOCK_PHONG_BAN,
        assignments: MOCK_ASSIGNMENTS, mailConfig: {},
      })
      return Promise.reject(new Error('Unhandled: ' + fn))
    })

    await goToUsersTab()

    // huyenvv is Active — should have "Khóa" button
    const lockButtons = screen.getAllByRole('button', { name: /^Khóa$/ })
    expect(lockButtons.length).toBeGreaterThan(0)
    fireEvent.click(lockButtons[0])

    // Confirm dialog should appear
    await waitFor(() => expect(screen.getByText('Xác nhận')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Xác nhận'))

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith('api_lockUser', 'test-at', expect.anything())
    })
  })

  test('cancelling confirm dialog does not call api_lockUser', async () => {
    await goToUsersTab()

    const lockButtons = screen.getAllByRole('button', { name: /^Khóa$/ })
    fireEvent.click(lockButtons[0])

    await waitFor(() => expect(screen.getByText('Xác nhận')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Huỷ'))

    await waitFor(() => expect(screen.queryByText('Xác nhận')).not.toBeInTheDocument())

    expect(gasCall).not.toHaveBeenCalledWith('api_lockUser', expect.anything(), expect.anything())
  })

  test('clicking "Mở khóa" button shows confirm dialog and calls api_unlockUser on confirm', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_unlockUser') return Promise.resolve({ ok: true })
      if (fn === 'api_portalSync') return Promise.resolve({
        apps: [], users: MOCK_USERS, phongBan: MOCK_PHONG_BAN,
        assignments: MOCK_ASSIGNMENTS, mailConfig: {},
      })
      return Promise.reject(new Error('Unhandled: ' + fn))
    })

    await goToUsersTab()

    // Locked user row has "Mở khóa" button
    const unlockButton = screen.getByRole('button', { name: /^Mở khóa$/ })
    expect(unlockButton).toBeInTheDocument()
    fireEvent.click(unlockButton)

    await waitFor(() => expect(screen.getByText('Xác nhận')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Xác nhận'))

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith('api_unlockUser', 'test-at', 4)
    })
  })
})

// ── role display ──────────────────────────────────────────────────────────────

describe('UserManager — role display', () => {
  test('shows "Trưởng phòng" role badge for user with assignment', async () => {
    // MOCK_ASSIGNMENTS has UserID 2 (huyenvv) as Trưởng phòng in PhongBanID 1
    await goToUsersTab()
    const badges = screen.getAllByText('Trưởng phòng')
    expect(badges.length).toBeGreaterThan(0)
  })

  test('shows department name alongside role badge', async () => {
    // UserID 2 and 3 are both in PhongBanID 1 = "Kỹ thuật"
    await goToUsersTab()
    const deptLabels = screen.getAllByText('Kỹ thuật')
    expect(deptLabels.length).toBeGreaterThan(0)
  })

  test('shows dash for user with no assignment', async () => {
    // ID 4 (locked user) has no assignment in MOCK_ASSIGNMENTS
    await goToUsersTab()
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })
})
