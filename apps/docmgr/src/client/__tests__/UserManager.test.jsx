import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import UserManager from '../components/UserManager.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN, MOCK_ADMIN_SESSION, MOCK_LOOKUPS, MOCK_USERS } from './helpers/mockData.js'

jest.mock('../gasClient.js')

// MOCK_LOOKUPS has assignments: [{ UserID: '1', 'Chức vụ': 'Giám đốc', PhongBanID: '1' }]
// So user 1 (admin) gets SSO role 'Giám đốc' → hasFullDefaults → no "Sửa quyền" button
// User 2 (viewer1) has no SSO assignment → role shown as 'Chưa phân quyền' → "Sửa quyền" button visible
// MOCK_ADMIN_SESSION.role = 'admin' (not 'Giám đốc') → canManage always returns true

// Use empty lookups so neither user gets SSO role override,
// keeping user 1's 'admin' Quyền and user 2's 'Nhân viên' Quyền from local sheet only.
// But with no SSO assignments, getSsoRole returns '' for both users,
// and hasFullDefaults is false, so "Sửa quyền" appears for both.
// However MOCK_USERS[0] has Quyền:'admin' but openEdit uses getSsoRole first,
// falling back to user['Quyền']. For user 1 that gives 'admin' → isAdmin=true → no checkboxes.
// For user 2 (Nhân viên) → isAdmin=false → checkboxes visible.
const LOOKUPS_NO_ASSIGNMENTS = {
  ...MOCK_LOOKUPS,
  assignments: [],
  phongBan: [],
}

const DEFAULT_PROPS = {
  token:   MOCK_TOKEN,
  session: MOCK_ADMIN_SESSION,
  lookups: LOOKUPS_NO_ASSIGNMENTS,
}

function renderUserManager(overrides = {}) {
  return renderWithProviders(<UserManager {...DEFAULT_PROPS} {...overrides} />)
}

beforeEach(() => {
  gasCall.mockReset()
  gasCall.mockImplementation((fn) => {
    if (fn === 'api_getUsers') return Promise.resolve([...MOCK_USERS])
    if (fn === 'api_updateUser') return Promise.resolve({ ok: true })
    return Promise.reject(new Error('Unhandled: ' + fn))
  })
})

describe('UserManager — user list', () => {
  test('renders user names and emails after load', async () => {
    renderUserManager()
    // Wait for loading to complete — both usernames should appear
    await screen.findByText('admin')
    await screen.findByText('viewer1')
    expect(screen.getByText('admin@test.com')).toBeInTheDocument()
    expect(screen.getByText('viewer@test.com')).toBeInTheDocument()
  })

  test('shows role badge text or "Chưa phân quyền" for each user', async () => {
    renderUserManager()
    await screen.findByText('admin')
    // With no SSO assignments, getSsoRole returns '' for both users
    // The component renders 'Chưa phân quyền' italic text for both user rows,
    // plus the StatCard label — 3 instances total
    const unassigned = screen.getAllByText('Chưa phân quyền')
    expect(unassigned).toHaveLength(3)
  })
})

describe('UserManager — canPublish toggle', () => {
  test('clicking Sửa quyền for viewer1 opens form with Được phát hành checkbox', async () => {
    renderUserManager()
    await screen.findByText('viewer1')

    // User 2 (viewer1) has no SSO role → hasFullDefaults=false → "Sửa quyền" button visible
    // Scope to viewer1's row to avoid positional index dependency
    const viewer1Cell = screen.getByText('viewer1')
    const viewer1Row = viewer1Cell.closest('tr')
    const editBtn = within(viewer1Row).getByRole('button', { name: /sửa quyền/i })
    fireEvent.click(editBtn)

    // Modal should open with title 'Phân quyền'
    await screen.findByText('Phân quyền')

    // Được phát hành checkbox should be present (viewer1 is Nhân viên → isAdmin=false)
    const publishCheckbox = screen.getByRole('checkbox', { name: /được phát hành/i })
    expect(publishCheckbox).toBeInTheDocument()
    expect(publishCheckbox).not.toBeChecked()
  })

  test('toggling Được phát hành and saving calls api_updateUser with correct args', async () => {
    renderUserManager()
    await screen.findByText('viewer1')

    // Open edit for viewer1 — scope to its row to avoid positional index dependency
    const viewer1Cell = screen.getByText('viewer1')
    const viewer1Row = viewer1Cell.closest('tr')
    const editBtn = within(viewer1Row).getByRole('button', { name: /sửa quyền/i })
    fireEvent.click(editBtn)
    await screen.findByText('Phân quyền')

    // Toggle the canPublish checkbox
    const publishCheckbox = screen.getByRole('checkbox', { name: /được phát hành/i })
    expect(publishCheckbox).not.toBeChecked()
    fireEvent.click(publishCheckbox)
    expect(publishCheckbox).toBeChecked()

    // Click the save button ("Lưu")
    const saveButton = screen.getByRole('button', { name: 'Lưu' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_updateUser',
        MOCK_TOKEN,
        2, // viewer1's ID
        expect.objectContaining({
          'Được phát hành': true,
        })
      )
    })
  })
})
