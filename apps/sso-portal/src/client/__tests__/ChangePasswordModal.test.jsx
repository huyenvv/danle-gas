import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import App from '../App.jsx'
import { renderLoginPage } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

// ── Helpers ───────────────────────────────────────────────────────────────────

const NEWBIE_USER = {
  userId: 2, username: 'newbie', email: 'newbie@test.com',
  role: 'user', displayName: 'Newbie', mustChangePass: true, isOwner: false,
}

/**
 * Login with mustChangePass=true so the forced ChangePasswordModal appears.
 * Uses renderLoginPage (sets gasCall to reject) then overrides before clicking login.
 */
async function renderForcedModal() {
  await renderLoginPage(gasCall)
  gasCall.mockImplementation((fn) => {
    if (fn === 'api_login') return Promise.resolve({
      accessToken: 'test-at', refreshToken: 'test-rt',
      user: NEWBIE_USER,
      parentSheetId: 'test-sheet',
    })
    return Promise.reject(new Error('TOKEN_REVOKED'))
  })
  fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'newbie@test.com' } })
  fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
  fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }))
  await waitFor(() => screen.getByRole('heading', { name: 'Đổi mật khẩu' }))
}

/**
 * Returns the three password inputs in the ChangePasswordModal in order:
 * [oldPass, newPass, confirmPass]
 * Scoped to the modal container to avoid picking up stray password inputs.
 */
function getPasswordInputs() {
  const modal = screen.getByRole('heading', { name: 'Đổi mật khẩu' }).closest('.rounded-3xl')
  return modal.querySelectorAll('input[type="password"]')
}

// ── Forced mode ───────────────────────────────────────────────────────────────

describe('ChangePasswordModal — forced mode', () => {
  test('renders "Bạn cần đổi mật khẩu" hint when forced', async () => {
    await renderForcedModal()
    expect(screen.getByText(/Bạn cần đổi mật khẩu trước khi tiếp tục/)).toBeInTheDocument()
  })

  test('shows Đăng xuất button and no Hủy button in forced mode', async () => {
    await renderForcedModal()
    expect(screen.getByRole('button', { name: /đăng xuất/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /hủy/i })).not.toBeInTheDocument()
  })

  test('old password input is present', async () => {
    await renderForcedModal()
    // Modal has exactly 3 password inputs: old, new, confirm
    const inputs = getPasswordInputs()
    expect(inputs).toHaveLength(3)
    expect(inputs[0]).toBeInTheDocument()
  })
})

// ── Validation ────────────────────────────────────────────────────────────────

describe('ChangePasswordModal — validation', () => {
  test('submit button is disabled when fields are incomplete', async () => {
    await renderForcedModal()
    expect(screen.getByRole('button', { name: /Đổi mật khẩu/i })).toBeDisabled()
  })

  test('shows error when api_changePassword rejects with wrong old password', async () => {
    await renderLoginPage(gasCall)
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: NEWBIE_USER,
        parentSheetId: 'test-sheet',
      })
      if (fn === 'api_changePassword') return Promise.reject(new Error('Mật khẩu cũ không đúng'))
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'newbie@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }))
    await waitFor(() => screen.getByRole('heading', { name: 'Đổi mật khẩu' }))

    const [oldInput, newInput, confirmInput] = getPasswordInputs()
    fireEvent.change(oldInput,     { target: { value: 'WrongOld@@1' } })
    fireEvent.change(newInput,     { target: { value: 'NewPass@@789' } })
    fireEvent.change(confirmInput, { target: { value: 'NewPass@@789' } })
    fireEvent.click(screen.getByRole('button', { name: /Đổi mật khẩu/i }))

    await waitFor(() => expect(screen.getByText('Mật khẩu cũ không đúng')).toBeInTheDocument())
  })
})

// ── Success flow ──────────────────────────────────────────────────────────────

describe('ChangePasswordModal — success', () => {
  test('modal closes and user reaches Dashboard on success', async () => {
    await renderLoginPage(gasCall)
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_login') return Promise.resolve({
        accessToken: 'test-at', refreshToken: 'test-rt',
        user: NEWBIE_USER,
        parentSheetId: 'test-sheet',
      })
      if (fn === 'api_changePassword') return Promise.resolve({ success: true })
      if (fn === 'api_portalSync') return Promise.resolve({
        apps: [], users: [], phongBan: [], assignments: [], mailConfig: {},
      })
      return Promise.reject(new Error('TOKEN_REVOKED'))
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập email đăng nhập'), { target: { value: 'newbie@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), { target: { value: 'Admin@@123' } })
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }))
    await waitFor(() => screen.getByRole('heading', { name: 'Đổi mật khẩu' }))

    const [oldInput, newInput, confirmInput] = getPasswordInputs()
    fireEvent.change(oldInput,     { target: { value: 'Admin@@123' } })
    fireEvent.change(newInput,     { target: { value: 'NewPass@@789' } })
    fireEvent.change(confirmInput, { target: { value: 'NewPass@@789' } })
    fireEvent.click(screen.getByRole('button', { name: /Đổi mật khẩu/i }))

    await waitFor(() => expect(screen.getByText('Ứng dụng')).toBeInTheDocument())
  })
})
