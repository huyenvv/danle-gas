import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import App from '../App.jsx'
import { renderDashboard, MOCK_APPS, MOCK_USERS } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

// Helper: render as regular user
async function renderUserDashboard() {
  gasCall.mockImplementation((fn) => {
    if (fn === 'api_resume') return Promise.resolve({
      accessToken: 'test-at', refreshToken: 'test-rt',
      user: { userId: 2, username: 'huyenvv', email: 'huyenvv@test.com', role: 'user', displayName: 'Huyên', mustChangePass: false, isOwner: false },
      parentSheetId: 'test-sheet',
    })
    if (fn === 'api_portalSync') return Promise.resolve({ apps: MOCK_APPS, users: [], phongBan: [], assignments: [], mailConfig: {} })
    return Promise.reject(new Error('TOKEN_REVOKED'))
  })
  localStorage.setItem('sso_refresh_token', 'test-rt')
  render(<App />)
  await waitFor(() => screen.getByText('Ứng dụng'))
}

// ── Role matrix ───────────────────────────────────────────────────────────────

describe('Dashboard — role matrix', () => {
  const ADMIN_ONLY_TABS = ['Người dùng', 'Phòng ban', 'Quản lý App', 'Nhật ký', 'Cài đặt']

  test('admin sees all 6 tabs', async () => {
    await renderDashboard(gasCall)
    for (const label of ['Ứng dụng', ...ADMIN_ONLY_TABS]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  test('regular user sees only Ứng dụng tab', async () => {
    await renderUserDashboard()
    expect(screen.getByText('Ứng dụng')).toBeInTheDocument()
    for (const label of ADMIN_ONLY_TABS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })
})

// ── Tab switching ─────────────────────────────────────────────────────────────

describe('Dashboard — tab switching', () => {
  test('clicking Người dùng tab renders UserManager content', async () => {
    await renderDashboard(gasCall, { users: MOCK_USERS })
    // Tab bar buttons are inside the tab nav — find the tab specifically by role=button
    const tabButtons = screen.getAllByRole('button')
    const userTab = tabButtons.find(btn => btn.textContent.includes('Người dùng'))
    expect(userTab).toBeDefined()
    fireEvent.click(userTab)
    await waitFor(() => expect(screen.getByText('huyenvv@test.com')).toBeInTheDocument())
  })

  test('clicking Nhật ký tab renders AuditLog content', async () => {
    await renderDashboard(gasCall)
    const tabButtons = screen.getAllByRole('button')
    const auditTab = tabButtons.find(btn => btn.textContent.includes('Nhật ký'))
    expect(auditTab).toBeDefined()
    fireEvent.click(auditTab)
    await waitFor(() => expect(screen.getByText('Đăng nhập')).toBeInTheDocument())
  })
})

// ── Token injection ───────────────────────────────────────────────────────────

describe('Dashboard — Apps tab token injection', () => {
  test('app card iframe src contains access token and parentSheetId', async () => {
    // Use a single app so first preload fires at idx=0 (0ms delay)
    await renderDashboard(gasCall, { apps: [MOCK_APPS[0]] })
    // First app preloads at idx * 2000ms = 0ms, so just await it
    await waitFor(() => {
      const iframes = document.querySelectorAll('iframe')
      expect(iframes.length).toBeGreaterThan(0)
    })
    const iframes = document.querySelectorAll('iframe')
    const src = iframes[0].src
    expect(src).toContain('token=')
    expect(src).toContain('parent=')
    expect(src).toContain(encodeURIComponent('test-at'))
    expect(src).toContain(encodeURIComponent('test-sheet'))
  })

  test('opening app card uses same preloaded URL (no token regeneration)', async () => {
    await renderDashboard(gasCall, { apps: [MOCK_APPS[0]] })
    // Wait for the preload iframe to appear
    await waitFor(() => {
      const iframes = document.querySelectorAll('iframe')
      expect(iframes.length).toBeGreaterThan(0)
    })
    const preloadSrc = document.querySelector('iframe').src

    // Click the app card — openApp() compares freshUrl with existing preload URL
    // Since token hasn't rotated, existing iframe is reused (same URL)
    fireEvent.click(screen.getByText('Quản lý Tài liệu'))

    await waitFor(() => {
      // IframeOverlay is rendered — iframe is still in DOM
      const iframes = document.querySelectorAll('iframe')
      expect(iframes.length).toBeGreaterThan(0)
    })
    const postClickSrc = document.querySelector('iframe').src
    // Same URL — no new token minted, iframe reused
    expect(postClickSrc).toBe(preloadSrc)
  })
})
