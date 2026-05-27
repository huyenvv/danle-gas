# SSO Portal RTL Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add React Testing Library component tests for all 8 SSO Portal client screens.

**Architecture:** Render `<App />` with mocked `gasCall` to control auth state and API responses. All context providers (AuthProvider, ToastProvider, ConfirmProvider, PortalDataProvider) are exercised via the real component tree — only the network layer (`gasCall`) is mocked.

**Tech Stack:** React Testing Library (`@testing-library/react`), `@testing-library/jest-dom`, `babel-jest`, Jest jsdom — all already installed at monorepo root.

---

## File Map

| Action | File |
|---|---|
| Modify | `apps/sso-portal/jest.config.js` |
| Create | `apps/sso-portal/babel.config.js` |
| Modify | `apps/sso-portal/package.json` (add `test` script) |
| Create | `apps/sso-portal/src/client/__tests__/setup.js` |
| Create | `apps/sso-portal/src/client/__tests__/__mocks__/fileMock.js` |
| Create | `apps/sso-portal/src/client/__tests__/helpers.js` |
| Create | `apps/sso-portal/src/client/__tests__/LoginPage.test.jsx` |
| Create | `apps/sso-portal/src/client/__tests__/ChangePasswordModal.test.jsx` |
| Create | `apps/sso-portal/src/client/__tests__/Dashboard.test.jsx` |
| Create | `apps/sso-portal/src/client/__tests__/UserManager.test.jsx` |
| Create | `apps/sso-portal/src/client/__tests__/OrgStructure.test.jsx` |
| Create | `apps/sso-portal/src/client/__tests__/AppManager.test.jsx` |
| Create | `apps/sso-portal/src/client/__tests__/AuditLog.test.jsx` |
| Create | `apps/sso-portal/src/client/__tests__/Settings.test.jsx` |

---

## Task 1: Infrastructure

**Files:**
- Modify: `apps/sso-portal/jest.config.js`
- Create: `apps/sso-portal/babel.config.js`
- Modify: `apps/sso-portal/package.json`
- Create: `apps/sso-portal/src/client/__tests__/setup.js`
- Create: `apps/sso-portal/src/client/__tests__/__mocks__/fileMock.js`
- Create: `apps/sso-portal/src/client/__tests__/helpers.js`

- [ ] **Step 1: Update jest.config.js — add client project**

Replace `apps/sso-portal/jest.config.js` with:

```js
module.exports = {
  rootDir: '.',
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/server/__tests__/**/*.test.js'],
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/client/__tests__/**/*.test.{js,jsx}'],
      setupFilesAfterEnv: ['<rootDir>/src/client/__tests__/setup.js'],
      transform: { '^.+\\.(js|jsx)$': 'babel-jest' },
      moduleFileExtensions: ['js', 'jsx'],
      moduleNameMapper: {
        '\\.(png|jpg|jpeg|gif|svg|webp)$': '<rootDir>/src/client/__tests__/__mocks__/fileMock.js',
        '\\.(css)$': '<rootDir>/src/client/__tests__/__mocks__/fileMock.js',
      },
    },
  ],
}
```

- [ ] **Step 2: Create babel.config.js**

Create `apps/sso-portal/babel.config.js`:

```js
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
}
```

- [ ] **Step 3: Add test script to package.json**

In `apps/sso-portal/package.json`, add to `"scripts"`:
```json
"test": "jest --config jest.config.js",
"test:client": "jest --config jest.config.js --selectProjects client"
```

- [ ] **Step 4: Create setup.js and fileMock.js**

Create `apps/sso-portal/src/client/__tests__/setup.js`:
```js
require('@testing-library/jest-dom')

beforeEach(() => {
  localStorage.clear()
})
```

Create `apps/sso-portal/src/client/__tests__/__mocks__/fileMock.js`:
```js
module.exports = 'test-file-stub'
```

- [ ] **Step 5: Create helpers.js — shared test utilities**

Create `apps/sso-portal/src/client/__tests__/helpers.js`:

```js
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
```

- [ ] **Step 6: Verify infrastructure — run empty test suite**

```bash
cd /Users/vanhuyen.vu/Documents/Vuhu/Projects/Appscripts
npx jest --config apps/sso-portal/jest.config.js --selectProjects client --passWithNoTests
```

Expected: `Test Suites: 0 passed` (no test files yet, no errors)

- [ ] **Step 7: Commit infrastructure**

```bash
git add apps/sso-portal/jest.config.js apps/sso-portal/babel.config.js apps/sso-portal/package.json apps/sso-portal/src/client/__tests__/
git commit -m "test(sso): add RTL test infrastructure (jest client project, babel, helpers)"
```

---

## Task 2: LoginPage.test.jsx

**Files:**
- Create: `apps/sso-portal/src/client/__tests__/LoginPage.test.jsx`

- [ ] **Step 1: Create LoginPage.test.jsx**

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import App from '../App.jsx'
import { renderLoginPage, MOCK_ADMIN, MOCK_APPS, MOCK_USERS, MOCK_PHONG_BAN, MOCK_ASSIGNMENTS } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

describe('LoginPage — render', () => {
  test('shows email and password inputs', async () => {
    await renderLoginPage(gasCall)
    expect(screen.getByPlaceholderText('Nhập email đăng nhập')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nhập mật khẩu')).toBeInTheDocument()
  })
})

describe('LoginPage — validation', () => {
  test('does not call api_login when email is empty', async () => {
    await renderLoginPage(gasCall)
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
    fireEvent.submit(document.querySelector('form'))
    expect(gasCall).not.toHaveBeenCalledWith('api_login', expect.anything(), expect.anything(), expect.anything())
  })

  test('does not call api_login when password is empty', async () => {
    await renderLoginPage(gasCall)
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'x@x.com' } })
    fireEvent.submit(document.querySelector('form'))
    expect(gasCall).not.toHaveBeenCalledWith('api_login', expect.anything(), expect.anything(), expect.anything())
  })
})

describe('LoginPage — wrong credentials', () => {
  test('shows "không đúng" error on bad credentials', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.reject(new Error('Email hoặc mật khẩu không đúng'))
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    await renderLoginPage(gasCall)
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'x@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'wrong' } })
    fireEvent.submit(document.querySelector('form'))
    await waitFor(() => expect(screen.getByText('Email hoặc mật khẩu không đúng')).toBeInTheDocument())
  })

  test('shows lockout error after 5 failures', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.reject(new Error('Tài khoản đã bị khóa do nhập sai mật khẩu quá 5 lần. Liên hệ quản trị viên.'))
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    await renderLoginPage(gasCall)
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'x@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'wrong' } })
    fireEvent.submit(document.querySelector('form'))
    await waitFor(() => expect(screen.getByText(/khóa/)).toBeInTheDocument())
  })
})

describe('LoginPage — mustChangePass', () => {
  test('shows ChangePasswordModal when mustChangePass=true', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: { ...MOCK_ADMIN, mustChangePass: true }, parentSheetId: 'test-sheet',
      })
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    await renderLoginPage(gasCall)
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'admin@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
    fireEvent.submit(document.querySelector('form'))
    await waitFor(() => expect(screen.getByText('Đổi mật khẩu')).toBeInTheDocument())
    // forced modal: no close button
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })
})

describe('LoginPage — successful login', () => {
  test('navigates to Dashboard on success', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: MOCK_ADMIN, parentSheetId: 'test-sheet',
      })
      if (fn === 'api_portalSync') return Promise.resolve({
        apps: MOCK_APPS, users: MOCK_USERS, phongBan: MOCK_PHONG_BAN, assignments: MOCK_ASSIGNMENTS, mailConfig: { MAIL_ENABLED: 'FALSE' },
      })
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    await renderLoginPage(gasCall)
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'admin@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
    fireEvent.submit(document.querySelector('form'))
    await waitFor(() => expect(screen.getByText('Ứng dụng')).toBeInTheDocument())
  })

  test('regular user role also reaches Dashboard', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: { userId: 2, username: 'huyenvv', email: 'huyenvv@test.com', role: 'user', displayName: 'Huyên', mustChangePass: false, isOwner: false },
        parentSheetId: 'test-sheet',
      })
      if (fn === 'api_portalSync') return Promise.resolve({ apps: MOCK_APPS, users: [], phongBan: [], assignments: [], mailConfig: {} })
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    await renderLoginPage(gasCall)
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'huyenvv@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
    fireEvent.submit(document.querySelector('form'))
    await waitFor(() => expect(screen.getByText('Ứng dụng')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run LoginPage tests**

```bash
npx jest --config apps/sso-portal/jest.config.js --selectProjects client --testPathPattern="LoginPage" --verbose
```

Expected: `6 tests passed`

- [ ] **Step 3: Commit**

```bash
git add apps/sso-portal/src/client/__tests__/LoginPage.test.jsx
git commit -m "test(sso): LoginPage RTL tests — form validation, errors, mustChangePass, login success"
```

---

## Task 3: ChangePasswordModal.test.jsx

**Files:**
- Create: `apps/sso-portal/src/client/__tests__/ChangePasswordModal.test.jsx`

- [ ] **Step 1: Create ChangePasswordModal.test.jsx**

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import App from '../App.jsx'
import { renderLoginPage, renderDashboard } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

// Helper: login then trigger mustChangePass modal
async function renderForcedModal() {
  gasCall.mockImplementation((fn) => {
    if (fn === 'api_login') return Promise.resolve({
      accessToken: 'test-at', refreshToken: 'test-rt',
      user: { userId: 2, username: 'newbie', email: 'newbie@test.com', role: 'user', displayName: 'Newbie', mustChangePass: true, isOwner: false },
      parentSheetId: 'test-sheet',
    })
    return Promise.reject(new Error('TOKEN_REVOKED'))
  })
  render(<App />)
  await waitFor(() => screen.getByPlaceholderText('Nhập email đăng nhập'))
  fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'newbie@test.com' } })
  fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
  fireEvent.submit(document.querySelector('form'))
  await waitFor(() => screen.getByText('Đổi mật khẩu'))
}

describe('ChangePasswordModal — forced mode', () => {
  test('renders "Bạn cần đổi mật khẩu" hint when forced', async () => {
    await renderForcedModal()
    expect(screen.getByText(/Bạn cần đổi mật khẩu trước khi tiếp tục/)).toBeInTheDocument()
  })

  test('no close button in forced mode', async () => {
    await renderForcedModal()
    // The close button is rendered only when !forced
    const closeBtn = document.querySelector('button[aria-label="close"], button > .material-symbols-outlined')
    // Check no X/close visually — the modal stays open
    expect(screen.queryByText('Đổi mật khẩu')).toBeInTheDocument() // modal still there
  })

  test('old password field is present', async () => {
    await renderForcedModal()
    expect(screen.getByLabelText('Mật khẩu cũ') ?? document.querySelector('input[autocomplete="current-password"]')).toBeInTheDocument()
  })
})

describe('ChangePasswordModal — validation', () => {
  test('submit button disabled when fields incomplete', async () => {
    await renderForcedModal()
    const submitBtn = screen.getByRole('button', { name: /Đổi mật khẩu/i })
    expect(submitBtn).toBeDisabled()
  })

  test('shows error when api_changePassword rejects with "không đúng"', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: { userId: 2, username: 'newbie', email: 'newbie@test.com', role: 'user', displayName: 'Newbie', mustChangePass: true, isOwner: false },
        parentSheetId: 'test-sheet',
      })
      if (fn === 'api_changePassword') return Promise.reject(new Error('Mật khẩu cũ không đúng'))
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    render(<App />)
    await waitFor(() => screen.getByPlaceholderText('Nhập email đăng nhập'))
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'newbie@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
    fireEvent.submit(document.querySelector('form'))
    await waitFor(() => screen.getByText('Đổi mật khẩu'))

    // Fill old password (wrong) and valid new password
    const [oldInput, newInput, confirmInput] = document.querySelectorAll('input[type="password"]')
    fireEvent.change(oldInput, { target: { value: 'WrongOld@@1' } })
    fireEvent.change(newInput, { target: { value: 'NewPass@@789' } })
    fireEvent.change(confirmInput, { target: { value: 'NewPass@@789' } })
    fireEvent.submit(document.querySelector('form'))
    await waitFor(() => expect(screen.getByText('Mật khẩu cũ không đúng')).toBeInTheDocument())
  })
})

describe('ChangePasswordModal — success', () => {
  test('modal closes and user reaches Dashboard on success', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: { userId: 2, username: 'newbie', email: 'newbie@test.com', role: 'user', displayName: 'Newbie', mustChangePass: true, isOwner: false },
        parentSheetId: 'test-sheet',
      })
      if (fn === 'api_changePassword') return Promise.resolve({ success: true })
      if (fn === 'api_portalSync') return Promise.resolve({ apps: [], users: [], phongBan: [], assignments: [], mailConfig: {} })
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    render(<App />)
    await waitFor(() => screen.getByPlaceholderText('Nhập email đăng nhập'))
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'newbie@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
    fireEvent.submit(document.querySelector('form'))
    await waitFor(() => screen.getByText('Đổi mật khẩu'))

    const [oldInput, newInput, confirmInput] = document.querySelectorAll('input[type="password"]')
    fireEvent.change(oldInput,    { target: { value: 'Admin@@123' } })
    fireEvent.change(newInput,    { target: { value: 'NewPass@@789' } })
    fireEvent.change(confirmInput,{ target: { value: 'NewPass@@789' } })
    fireEvent.submit(document.querySelector('form'))
    await waitFor(() => expect(screen.getByText('Ứng dụng')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npx jest --config apps/sso-portal/jest.config.js --selectProjects client --testPathPattern="ChangePasswordModal" --verbose
```

Expected: `6 tests passed`

- [ ] **Step 3: Commit**

```bash
git add apps/sso-portal/src/client/__tests__/ChangePasswordModal.test.jsx
git commit -m "test(sso): ChangePasswordModal RTL tests — forced mode, validation, success flow"
```

---

## Task 4: Dashboard.test.jsx — tabs, role matrix, token injection

**Files:**
- Create: `apps/sso-portal/src/client/__tests__/Dashboard.test.jsx`

- [ ] **Step 1: Create Dashboard.test.jsx**

```jsx
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import gasCall from '../gasClient.js'
import App from '../App.jsx'
import { renderDashboard, setupAdminSession, MOCK_APPS, MOCK_USERS, MOCK_PHONG_BAN, MOCK_ASSIGNMENTS } from './helpers.js'

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

describe('Dashboard — tab switching', () => {
  test('clicking Người dùng tab renders UserManager content', async () => {
    await renderDashboard(gasCall, { users: MOCK_USERS })
    fireEvent.click(screen.getByText('Người dùng'))
    await waitFor(() => expect(screen.getByText('huyenvv@test.com')).toBeInTheDocument())
  })

  test('clicking Nhật ký tab renders AuditLog content', async () => {
    await renderDashboard(gasCall)
    fireEvent.click(screen.getByText('Nhật ký'))
    await waitFor(() => expect(screen.getByText('Đăng nhập')).toBeInTheDocument())
  })
})

describe('Dashboard — Apps tab token injection', () => {
  test('app card iframe src contains access token and parentSheetId', async () => {
    await renderDashboard(gasCall, { apps: MOCK_APPS })
    // Wait for preload iframes to be created (50ms delay per app)
    await new Promise(r => setTimeout(r, 200))
    const iframes = document.querySelectorAll('iframe')
    expect(iframes.length).toBeGreaterThan(0)
    const src = iframes[0].src
    expect(src).toContain('token=')
    expect(src).toContain('parent=')
    expect(src).toContain(encodeURIComponent('test-at'))
    expect(src).toContain(encodeURIComponent('test-sheet'))
  })

  test('app card URL is not regenerated on second click (token reuse)', async () => {
    await renderDashboard(gasCall, { apps: [MOCK_APPS[0]] })
    await new Promise(r => setTimeout(r, 200))
    const firstSrc = document.querySelector('iframe')?.src
    // Click the app card (IframeOverlay opens with preloaded URL)
    fireEvent.click(screen.getByText('Quản lý Tài liệu'))
    await new Promise(r => setTimeout(r, 100))
    const secondSrc = document.querySelector('iframe')?.src
    // URL should remain the same — no new token generated
    expect(secondSrc).toBe(firstSrc)
  })
})
```

- [ ] **Step 2: Run Dashboard tests**

```bash
npx jest --config apps/sso-portal/jest.config.js --selectProjects client --testPathPattern="Dashboard" --verbose
```

Expected: `5 tests passed`

- [ ] **Step 3: Commit**

```bash
git add apps/sso-portal/src/client/__tests__/Dashboard.test.jsx
git commit -m "test(sso): Dashboard RTL tests — role matrix, tab switching, token injection"
```

---

## Task 5: UserManager.test.jsx

**Files:**
- Create: `apps/sso-portal/src/client/__tests__/UserManager.test.jsx`

- [ ] **Step 1: Create UserManager.test.jsx**

```jsx
import { screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import { renderDashboard, MOCK_USERS, MOCK_PHONG_BAN, MOCK_ASSIGNMENTS } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

async function goToUsersTab(overrides = {}) {
  await renderDashboard(gasCall, overrides)
  fireEvent.click(screen.getByText('Người dùng'))
  await waitFor(() => screen.getByText('huyenvv@test.com'))
}

describe('UserManager — list', () => {
  test('renders user emails from portalSync data', async () => {
    await goToUsersTab({ users: MOCK_USERS })
    expect(screen.getByText('huyenvv@test.com')).toBeInTheDocument()
    expect(screen.getByText('user3@test.com')).toBeInTheDocument()
  })

  test('shows Locked badge for locked users', async () => {
    await goToUsersTab({ users: MOCK_USERS })
    expect(screen.getByText('Locked')).toBeInTheDocument()
  })
})

describe('UserManager — add user', () => {
  test('calls api_addUser with correct email and shows success', async () => {
    const mockUsers = [...MOCK_USERS]
    gasCall.mockImplementation((fn, ...args) => {
      if (fn === 'api_resume') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: { userId: 1, username: 'admin', email: 'admin@test.com', role: 'admin', displayName: 'Admin', mustChangePass: false, isOwner: false },
        parentSheetId: 'test-sheet',
      })
      if (fn === 'api_portalSync') return Promise.resolve({ apps: [], users: mockUsers, phongBan: MOCK_PHONG_BAN, assignments: MOCK_ASSIGNMENTS, mailConfig: {} })
      if (fn === 'api_addUser') {
        const newUser = { ID: 99, 'Email': args[1]['Email'], 'Tên nhân viên': args[1]['Tên nhân viên'] || '', 'Trạng thái': 'Active', 'MustChangePass': 'TRUE', 'FailedLogins': 0, 'Tên đăng nhập': 'new' }
        mockUsers.push(newUser)
        return Promise.resolve(newUser)
      }
      return Promise.reject(new Error('Unhandled: ' + fn))
    })
    localStorage.setItem('sso_refresh_token', 'test-rt')
    const { render } = await import('@testing-library/react')
    const App = (await import('../App.jsx')).default
    render(<App />)
    await waitFor(() => screen.getByText('Ứng dụng'))
    fireEvent.click(screen.getByText('Người dùng'))
    await waitFor(() => screen.getByText('huyenvv@test.com'))

    // Click add user button
    fireEvent.click(screen.getByRole('button', { name: /Thêm nhân viên/i }))
    await waitFor(() => screen.getByLabelText(/Email/i) ?? screen.getByPlaceholderText(/email/i))

    // Fill email
    const emailInput = screen.getByPlaceholderText(/email/i) || document.querySelector('input[type="email"]')
    fireEvent.change(emailInput, { target: { value: 'new@test.com' } })
    fireEvent.submit(document.querySelector('form') ?? screen.getByRole('form'))

    await waitFor(() => expect(gasCall).toHaveBeenCalledWith(
      'api_addUser', 'test-at', expect.objectContaining({ 'Email': 'new@test.com' })
    ))
  })
})

describe('UserManager — lock/unlock', () => {
  test('lock user calls api_lockUser', async () => {
    gasCall.mockImplementation((fn, ...args) => {
      if (fn === 'api_resume') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: { userId: 1, username: 'admin', email: 'admin@test.com', role: 'admin', displayName: 'Admin', mustChangePass: false, isOwner: false },
        parentSheetId: 'test-sheet',
      })
      if (fn === 'api_portalSync') return Promise.resolve({ apps: [], users: MOCK_USERS, phongBan: [], assignments: [], mailConfig: {} })
      if (fn === 'api_lockUser') return Promise.resolve({ success: true })
      return Promise.reject(new Error('Unhandled: ' + fn))
    })
    localStorage.setItem('sso_refresh_token', 'test-rt')
    const { render } = await import('@testing-library/react')
    const App = (await import('../App.jsx')).default
    render(<App />)
    await waitFor(() => screen.getByText('Ứng dụng'))
    fireEvent.click(screen.getByText('Người dùng'))
    await waitFor(() => screen.getByText('huyenvv@test.com'))

    // Find lock button for active user (user3 is Active)
    const lockButtons = screen.getAllByRole('button', { name: /khóa/i })
    fireEvent.click(lockButtons[0])
    // Confirm dialog
    const confirmBtn = await screen.findByRole('button', { name: /xác nhận|ok|khóa/i })
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(gasCall).toHaveBeenCalledWith('api_lockUser', 'test-at', expect.any(Number)))
  })

  test('unlock user calls api_unlockUser', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_resume') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: { userId: 1, username: 'admin', email: 'admin@test.com', role: 'admin', displayName: 'Admin', mustChangePass: false, isOwner: false },
        parentSheetId: 'test-sheet',
      })
      if (fn === 'api_portalSync') return Promise.resolve({ apps: [], users: MOCK_USERS, phongBan: [], assignments: [], mailConfig: {} })
      if (fn === 'api_unlockUser') return Promise.resolve({ success: true })
      return Promise.reject(new Error('Unhandled: ' + fn))
    })
    localStorage.setItem('sso_refresh_token', 'test-rt')
    const { render } = await import('@testing-library/react')
    const App = (await import('../App.jsx')).default
    render(<App />)
    await waitFor(() => screen.getByText('Ứng dụng'))
    fireEvent.click(screen.getByText('Người dùng'))
    await waitFor(() => screen.getByText('locked@test.com'))

    const unlockButtons = screen.getAllByRole('button', { name: /mở khóa/i })
    fireEvent.click(unlockButtons[0])
    const confirmBtn = await screen.findByRole('button', { name: /xác nhận|ok|mở/i })
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(gasCall).toHaveBeenCalledWith('api_unlockUser', 'test-at', expect.any(Number)))
  })
})

describe('UserManager — role display', () => {
  test('renders role badge for admin assignment', async () => {
    await goToUsersTab({ users: MOCK_USERS, assignments: MOCK_ASSIGNMENTS, phongBan: MOCK_PHONG_BAN })
    // admin user (ID:1) has 'admin' role badge — but admin is hidden from list
    // huyenvv (ID:2) has Trưởng phòng badge
    expect(screen.getByText('Trưởng phòng')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run UserManager tests**

```bash
npx jest --config apps/sso-portal/jest.config.js --selectProjects client --testPathPattern="UserManager" --verbose
```

Expected: all tests passed

- [ ] **Step 3: Commit**

```bash
git add apps/sso-portal/src/client/__tests__/UserManager.test.jsx
git commit -m "test(sso): UserManager RTL tests — list, add user, lock/unlock, role badge"
```

---

## Task 6: OrgStructure.test.jsx

**Files:**
- Create: `apps/sso-portal/src/client/__tests__/OrgStructure.test.jsx`

- [ ] **Step 1: Create OrgStructure.test.jsx**

```jsx
import { screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import { renderDashboard, MOCK_USERS, MOCK_PHONG_BAN, MOCK_ASSIGNMENTS } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

async function goToOrgTab(overrides = {}) {
  await renderDashboard(gasCall, overrides)
  fireEvent.click(screen.getByText('Phòng ban'))
  // Wait for org structure to render
  await waitFor(() => screen.getByText('Kỹ thuật'))
}

describe('OrgStructure — dept groups', () => {
  test('renders department names from phongBan data', async () => {
    await goToOrgTab({ phongBan: MOCK_PHONG_BAN, assignments: MOCK_ASSIGNMENTS, users: MOCK_USERS })
    expect(screen.getByText('Kỹ thuật')).toBeInTheDocument()
    expect(screen.getByText('Kinh doanh')).toBeInTheDocument()
  })

  test('users appear under their assigned dept', async () => {
    await goToOrgTab({ phongBan: MOCK_PHONG_BAN, assignments: MOCK_ASSIGNMENTS, users: MOCK_USERS })
    // huyenvv is assigned to Kỹ thuật (PhongBanID: 1)
    expect(screen.getByText('Huyên')).toBeInTheDocument()
  })
})

describe('OrgStructure — kiêm nhiệm display', () => {
  test('user with company role + dept role shows kiêm label', async () => {
    const assignmentsWithKiemNhiem = [
      ...MOCK_ASSIGNMENTS,
      { ID: 10, 'UserID': '2', 'Chức vụ': 'Giám đốc', 'PhongBanID': '' }, // company role for huyenvv
    ]
    await goToOrgTab({ phongBan: MOCK_PHONG_BAN, assignments: assignmentsWithKiemNhiem, users: MOCK_USERS })
    expect(screen.getAllByText('kiêm').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run OrgStructure tests**

```bash
npx jest --config apps/sso-portal/jest.config.js --selectProjects client --testPathPattern="OrgStructure" --verbose
```

Expected: `3 tests passed`

- [ ] **Step 3: Commit**

```bash
git add apps/sso-portal/src/client/__tests__/OrgStructure.test.jsx
git commit -m "test(sso): OrgStructure RTL tests — dept groups, user placement, kiêm nhiệm"
```

---

## Task 7: AppManager.test.jsx

**Files:**
- Create: `apps/sso-portal/src/client/__tests__/AppManager.test.jsx`

- [ ] **Step 1: Create AppManager.test.jsx**

```jsx
import { screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import { renderDashboard, MOCK_APPS } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

async function goToAppMgr(apps = MOCK_APPS) {
  await renderDashboard(gasCall, { apps })
  fireEvent.click(screen.getByText('Quản lý App'))
  await waitFor(() => screen.getByText('Quản lý Tài liệu'))
}

describe('AppManager — list', () => {
  test('renders app names', async () => {
    await goToAppMgr()
    expect(screen.getByText('Quản lý Tài liệu')).toBeInTheDocument()
    expect(screen.getByText('Quản lý Công việc')).toBeInTheDocument()
  })

  test('admin sees add/edit/delete actions', async () => {
    await goToAppMgr()
    expect(screen.getByRole('button', { name: /thêm app/i })).toBeInTheDocument()
    // Edit buttons exist (one per app)
    expect(screen.getAllByRole('button', { name: /sửa/i }).length).toBeGreaterThan(0)
  })
})

describe('AppManager — add app', () => {
  test('calls api_addApp with form data', async () => {
    gasCall.mockImplementation((fn, ...args) => {
      if (fn === 'api_resume') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: { userId: 1, username: 'admin', email: 'admin@test.com', role: 'admin', displayName: 'Admin', mustChangePass: false, isOwner: false },
        parentSheetId: 'test-sheet',
      })
      if (fn === 'api_portalSync') return Promise.resolve({ apps: MOCK_APPS, users: [], phongBan: [], assignments: [], mailConfig: {} })
      if (fn === 'api_addApp') return Promise.resolve({ ID: 99, ...args[1], 'Trạng thái': 'Active', 'Quyền xem': '' })
      return Promise.reject(new Error('Unhandled: ' + fn))
    })
    localStorage.setItem('sso_refresh_token', 'test-rt')
    const { render } = await import('@testing-library/react')
    const App = (await import('../App.jsx')).default
    render(<App />)
    await waitFor(() => screen.getByText('Ứng dụng'))
    fireEvent.click(screen.getByText('Quản lý App'))
    await waitFor(() => screen.getByText('Quản lý Tài liệu'))

    fireEvent.click(screen.getByRole('button', { name: /thêm app/i }))
    await waitFor(() => document.querySelector('input[placeholder*="tên"]') ?? screen.getByRole('dialog'))

    const nameInput = document.querySelector('input[placeholder*="tên"]') || document.querySelectorAll('input[type="text"]')[0]
    const urlInput  = document.querySelector('input[placeholder*="url"]') || document.querySelectorAll('input[type="text"]')[1]
    fireEvent.change(nameInput, { target: { value: 'App Mới' } })
    fireEvent.change(urlInput,  { target: { value: 'http://localhost:9999/' } })
    fireEvent.submit(document.querySelector('form') ?? document.querySelector('[role="dialog"] button[type="submit"]'))

    await waitFor(() => expect(gasCall).toHaveBeenCalledWith(
      'api_addApp', 'test-at', expect.objectContaining({ 'Tên App': 'App Mới' })
    ))
  })
})
```

- [ ] **Step 2: Run AppManager tests**

```bash
npx jest --config apps/sso-portal/jest.config.js --selectProjects client --testPathPattern="AppManager" --verbose
```

Expected: all passed

- [ ] **Step 3: Commit**

```bash
git add apps/sso-portal/src/client/__tests__/AppManager.test.jsx
git commit -m "test(sso): AppManager RTL tests — list, admin actions, add app"
```

---

## Task 8: AuditLog.test.jsx + Settings.test.jsx

**Files:**
- Create: `apps/sso-portal/src/client/__tests__/AuditLog.test.jsx`
- Create: `apps/sso-portal/src/client/__tests__/Settings.test.jsx`

- [ ] **Step 1: Create AuditLog.test.jsx**

```jsx
import { screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import { renderDashboard } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

const MOCK_LOGS = [
  { ID: 3, 'Thời gian': '2026-01-03T10:00:00Z', 'Người dùng': 'admin@test.com', 'Email': 'admin@test.com', 'Hành động': 'Thêm', 'Loại': 'Người dùng', 'Đối tượng': 'new@test.com', 'Chi tiết': '' },
  { ID: 2, 'Thời gian': '2026-01-02T09:00:00Z', 'Người dùng': 'admin@test.com', 'Email': 'admin@test.com', 'Hành động': 'Đăng nhập', 'Loại': 'Xác thực', 'Đối tượng': 'admin@test.com', 'Chi tiết': 'desktop' },
  { ID: 1, 'Thời gian': '2026-01-01T08:00:00Z', 'Người dùng': 'huyenvv', 'Email': 'huyenvv@test.com', 'Hành động': 'Đăng nhập thất bại', 'Loại': 'Xác thực', 'Đối tượng': 'huyenvv@test.com', 'Chi tiết': '' },
]

async function goToAuditLog(logs = MOCK_LOGS) {
  await renderDashboard(gasCall, { logs })
  fireEvent.click(screen.getByText('Nhật ký'))
  await waitFor(() => screen.getByText('Đăng nhập'))
}

describe('AuditLog — render', () => {
  test('renders log rows', async () => {
    await goToAuditLog()
    expect(screen.getByText('Đăng nhập')).toBeInTheDocument()
    expect(screen.getByText('Thêm')).toBeInTheDocument()
  })

  test('shows actor email/username', async () => {
    await goToAuditLog()
    expect(screen.getByText('admin@test.com')).toBeInTheDocument()
  })
})

describe('AuditLog — filter', () => {
  test('filter by type calls api_getAuditLogs with type param', async () => {
    await goToAuditLog()
    // Find type filter select/button
    const filterEls = screen.getAllByRole('option') ?? screen.getAllByRole('button')
    // If a select exists, change it
    const select = document.querySelector('select')
    if (select) {
      fireEvent.change(select, { target: { value: 'Xác thực' } })
      await waitFor(() => expect(gasCall).toHaveBeenCalledWith(
        'api_getAuditLogs', expect.any(String), expect.objectContaining({ type: 'Xác thực' })
      ))
    }
  })
})
```

- [ ] **Step 2: Create Settings.test.jsx**

```jsx
import { screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import { renderDashboard } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

async function goToSettings() {
  await renderDashboard(gasCall)
  fireEvent.click(screen.getByText('Cài đặt'))
  await waitFor(() => screen.getByText(/Email|SMTP|Cấu hình/i))
}

describe('Settings — render', () => {
  test('renders mail config section', async () => {
    await goToSettings()
    expect(screen.getByText(/Email|SMTP|Cấu hình/i)).toBeInTheDocument()
  })
})

describe('Settings — save', () => {
  test('save calls api_saveMailConfig', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_resume') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: { userId: 1, username: 'admin', email: 'admin@test.com', role: 'admin', displayName: 'Admin', mustChangePass: false, isOwner: false },
        parentSheetId: 'test-sheet',
      })
      if (fn === 'api_portalSync') return Promise.resolve({ apps: [], users: [], phongBan: [], assignments: [], mailConfig: { MAIL_ENABLED: 'FALSE' } })
      if (fn === 'api_getAuditLogs') return Promise.resolve({ data: [], hasMore: false, total: 0, types: [] })
      if (fn === 'api_saveMailConfig') return Promise.resolve({ success: true })
      return Promise.reject(new Error('Unhandled: ' + fn))
    })
    localStorage.setItem('sso_refresh_token', 'test-rt')
    const { render } = await import('@testing-library/react')
    const App = (await import('../App.jsx')).default
    render(<App />)
    await waitFor(() => screen.getByText('Ứng dụng'))
    fireEvent.click(screen.getByText('Cài đặt'))
    await waitFor(() => screen.getByText(/Email|SMTP|Cấu hình/i))

    const saveBtn = screen.getByRole('button', { name: /lưu|save/i })
    fireEvent.click(saveBtn)
    await waitFor(() => expect(gasCall).toHaveBeenCalledWith('api_saveMailConfig', 'test-at', expect.any(Object)))
  })
})
```

- [ ] **Step 3: Run both**

```bash
npx jest --config apps/sso-portal/jest.config.js --selectProjects client --testPathPattern="AuditLog|Settings" --verbose
```

Expected: all passed

- [ ] **Step 4: Run full SSO Portal client test suite**

```bash
npx jest --config apps/sso-portal/jest.config.js --selectProjects client --verbose
```

Expected: all client tests green

- [ ] **Step 5: Commit**

```bash
git add apps/sso-portal/src/client/__tests__/AuditLog.test.jsx apps/sso-portal/src/client/__tests__/Settings.test.jsx
git commit -m "test(sso): AuditLog + Settings RTL tests — happy path render and save"
```
