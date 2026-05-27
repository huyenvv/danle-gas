import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import App from '../App.jsx'
import { renderDashboard, MOCK_APPS, MOCK_USERS, MOCK_PHONG_BAN, MOCK_ASSIGNMENTS, setupAdminSession } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

// Navigate to Cài đặt tab after rendering dashboard
async function goToSettings(overrides = {}) {
  await renderDashboard(gasCall, overrides)
  const tabButtons = screen.getAllByRole('button')
  const settingsTab = tabButtons.find(btn => btn.textContent.includes('Cài đặt'))
  expect(settingsTab).toBeDefined()
  fireEvent.click(settingsTab)
  // Wait for the mail config section (unique to the settings page)
  await waitFor(() => expect(screen.getByText('Gửi email thông báo')).toBeInTheDocument())
}

// ── rendering ─────────────────────────────────────────────────────────────────

describe('Settings — mail config section', () => {
  test('renders mail config section heading', async () => {
    await goToSettings({ mailConfig: { MAIL_ENABLED: 'FALSE' } })
    expect(screen.getByText('Gửi email thông báo')).toBeInTheDocument()
  })

  test('renders "Bật gửi email" toggle label', async () => {
    await goToSettings({ mailConfig: { MAIL_ENABLED: 'FALSE' } })
    expect(screen.getByText('Bật gửi email')).toBeInTheDocument()
  })

  test('renders "Lưu cấu hình" save button', async () => {
    await goToSettings({ mailConfig: { MAIL_ENABLED: 'FALSE' } })
    expect(screen.getByRole('button', { name: /Lưu cấu hình/ })).toBeInTheDocument()
  })

  test('does not show sender email input when MAIL_ENABLED is FALSE', async () => {
    await goToSettings({ mailConfig: { MAIL_ENABLED: 'FALSE' } })
    expect(screen.queryByPlaceholderText('vd: noreply@company.com')).not.toBeInTheDocument()
  })

  test('shows sender email input when MAIL_ENABLED is TRUE', async () => {
    await goToSettings({ mailConfig: { MAIL_ENABLED: 'TRUE', MAIL_SENDER_EMAIL: '' } })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('vd: noreply@company.com')).toBeInTheDocument()
    )
  })
})

// ── save ──────────────────────────────────────────────────────────────────────

describe('Settings — save', () => {
  test('clicking "Lưu cấu hình" calls api_saveMailConfig with current config', async () => {
    const mailConfig = { MAIL_ENABLED: 'FALSE' }
    // Set up the full mock chain — setupAdminSession is called by renderDashboard,
    // so we must include api_saveMailConfig and api_portalSync in one unified mock.
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_resume') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: { userId: 1, username: 'admin', email: 'admin@test.com', role: 'admin', displayName: 'Admin', mustChangePass: false, isOwner: true },
        parentSheetId: 'test-sheet',
      })
      if (fn === 'api_portalSync') return Promise.resolve({
        apps: MOCK_APPS, users: MOCK_USERS, phongBan: MOCK_PHONG_BAN,
        assignments: MOCK_ASSIGNMENTS, mailConfig,
      })
      if (fn === 'api_getAuditLogs') return Promise.resolve({ data: [], hasMore: false, total: 0, types: [] })
      if (fn === 'api_saveMailConfig') return Promise.resolve({ ok: true })
      return Promise.reject(new Error('Unhandled gasCall mock: ' + fn))
    })
    localStorage.setItem('sso_refresh_token', 'test-rt')
    localStorage.setItem('sso_access_token', 'test-at')
    localStorage.setItem('sso_parent_sheet_id', 'test-sheet')

    render(<App />)
    await waitFor(() => screen.getByText('Ứng dụng'))

    const tabButtons = screen.getAllByRole('button')
    const settingsTab = tabButtons.find(btn => btn.textContent.includes('Cài đặt'))
    expect(settingsTab).toBeDefined()
    fireEvent.click(settingsTab)
    await waitFor(() => expect(screen.getByText('Gửi email thông báo')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Lưu cấu hình/ }))

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_saveMailConfig',
        'test-at',
        expect.objectContaining({ MAIL_ENABLED: 'FALSE' })
      )
    })
  })
})
