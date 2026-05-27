import { screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import App from '../App.jsx'
import { renderLoginPage, MOCK_ADMIN, MOCK_APPS, MOCK_USERS, MOCK_PHONG_BAN, MOCK_ASSIGNMENTS } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

// ── Render ────────────────────────────────────────────────────────────────────

describe('LoginPage — render', () => {
  test('shows email and password inputs', async () => {
    await renderLoginPage(gasCall)
    expect(screen.getByPlaceholderText('Nhập email đăng nhập')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nhập mật khẩu')).toBeInTheDocument()
  })
})

// ── Validation ────────────────────────────────────────────────────────────────

describe('LoginPage — validation', () => {
  test('does not call api_login when email is empty', async () => {
    await renderLoginPage(gasCall)
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }))
    expect(gasCall).not.toHaveBeenCalledWith('api_login', expect.anything(), expect.anything(), expect.anything())
  })

  test('does not call api_login when password is empty', async () => {
    await renderLoginPage(gasCall)
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'x@x.com' } })
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }))
    expect(gasCall).not.toHaveBeenCalledWith('api_login', expect.anything(), expect.anything(), expect.anything())
  })
})

// ── Wrong credentials ─────────────────────────────────────────────────────────

describe('LoginPage — wrong credentials', () => {
  test('shows "không đúng" error on bad credentials', async () => {
    await renderLoginPage(gasCall)
    // Override mock AFTER renderLoginPage so api_login gets the right behavior
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.reject(new Error('Email hoặc mật khẩu không đúng'))
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'x@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }))
    await waitFor(() => expect(screen.getByText('Email hoặc mật khẩu không đúng')).toBeInTheDocument())
  })

  test('shows lockout error after 5 failures', async () => {
    await renderLoginPage(gasCall)
    // Override mock AFTER renderLoginPage so api_login gets the right behavior
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.reject(new Error('Tài khoản đã bị khóa do nhập sai mật khẩu quá 5 lần. Liên hệ quản trị viên.'))
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'x@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }))
    await waitFor(() => expect(screen.getByText(/khóa/)).toBeInTheDocument())
  })
})

// ── mustChangePass ────────────────────────────────────────────────────────────

describe('LoginPage — mustChangePass', () => {
  test('shows ChangePasswordModal when mustChangePass=true', async () => {
    await renderLoginPage(gasCall)
    // Override mock AFTER renderLoginPage so api_login gets the right behavior
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: { ...MOCK_ADMIN, mustChangePass: true }, parentSheetId: 'test-sheet',
      })
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'admin@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeInTheDocument())
    // Forced modal shows Đăng xuất instead of Hủy, and has no dismiss button
    expect(screen.getByRole('button', { name: /đăng xuất/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /hủy/i })).not.toBeInTheDocument()
  })
})

// ── Successful login ──────────────────────────────────────────────────────────

describe('LoginPage — successful login', () => {
  test('navigates to Dashboard on success', async () => {
    await renderLoginPage(gasCall)
    // Override mock AFTER renderLoginPage so api_login and api_portalSync get the right behavior
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
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'admin@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }))
    await waitFor(() => expect(screen.getByText('Ứng dụng')).toBeInTheDocument())
  })

  test('regular user role also reaches Dashboard', async () => {
    await renderLoginPage(gasCall)
    // Override mock AFTER renderLoginPage so api_login and api_portalSync get the right behavior
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: { userId: 2, username: 'huyenvv', email: 'huyenvv@test.com', role: 'user', displayName: 'Huyên', mustChangePass: false, isOwner: false },
        parentSheetId: 'test-sheet',
      })
      if (fn === 'api_portalSync') return Promise.resolve({
        apps: MOCK_APPS, users: [], phongBan: [], assignments: [], mailConfig: {},
      })
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'huyenvv@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }))
    await waitFor(() => expect(screen.getByText('Ứng dụng')).toBeInTheDocument())
  })
})
