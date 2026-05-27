const { test, expect } = require('@playwright/test')
const { loginAs, waitForDashboard, getLocalStorage } = require('./fixtures.js')

// Mock credentials (from gasClient.js mock data):
//   All users share password 'Admin@@123'
//   admin@test.com  — MustChangePass: FALSE, role: admin  — used for main login tests
//   nv2@test.com    — MustChangePass: FALSE, role: user   — used for lockout test (isolated)

const VALID_EMAIL = 'admin@test.com'
const VALID_PASS = 'Admin@@123'
const LOCKOUT_EMAIL = 'nv2@test.com' // nhanvien2, dedicated to lockout test

/**
 * Submit the login form without navigating (page already at '/').
 * Clears both fields, fills new values, submits, and waits for the
 * loading button to stop spinning before returning.
 */
async function submitLogin(page, email, password) {
  await page.fill('input[placeholder="Nhập email đăng nhập"]', email)
  await page.fill('input[placeholder="Nhập mật khẩu"]', password)
  await page.click('button[type="submit"]')
  // Playwright awaits click completion; caller uses waitForSelector for the response
}

test.describe('Login — success', () => {
  test('valid credentials show Dashboard', async ({ page }) => {
    await loginAs(page, VALID_EMAIL, VALID_PASS)
    await waitForDashboard(page)
  })

  test('access token stored in localStorage after login', async ({ page }) => {
    await loginAs(page, VALID_EMAIL, VALID_PASS)
    await waitForDashboard(page)
    const token = await getLocalStorage(page, 'sso_access_token')
    expect(token).toBeTruthy()
  })

  test('refresh token stored in localStorage after login', async ({ page }) => {
    await loginAs(page, VALID_EMAIL, VALID_PASS)
    await waitForDashboard(page)
    const token = await getLocalStorage(page, 'sso_refresh_token')
    expect(token).toBeTruthy()
  })
})

test.describe('Login — failure', () => {
  test('wrong password shows error containing "không đúng"', async ({ page }) => {
    await loginAs(page, VALID_EMAIL, 'wrongpassword')
    await page.waitForSelector('text=không đúng', { timeout: 5_000 })
  })

  test('unknown email shows error containing "không đúng"', async ({ page }) => {
    await loginAs(page, 'nobody@unknown.com', VALID_PASS)
    await page.waitForSelector('text=không đúng', { timeout: 5_000 })
  })
})

test.describe('Login — lockout', () => {
  // The mock state (_mockUsers[].FailedLogins) lives in the browser JS module.
  // It persists within a single page session but resets on page reload.
  // This test navigates once then submits the form 5 times in-place.
  test('5 consecutive wrong passwords lock the account', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('input[placeholder="Nhập email đăng nhập"]')

    // Attempts 1–4: each returns "không đúng"
    for (let i = 0; i < 4; i++) {
      await submitLogin(page, LOCKOUT_EMAIL, 'wrongpassword')
      await page.waitForSelector('text=không đúng', { timeout: 5_000 })
    }

    // 5th wrong attempt triggers lockout message
    await submitLogin(page, LOCKOUT_EMAIL, 'wrongpassword')
    await page.waitForSelector('text=khóa', { timeout: 5_000 })
  })
})

test.describe('Logout', () => {
  test('logout returns to login page and clears localStorage', async ({ page }) => {
    await loginAs(page, VALID_EMAIL, VALID_PASS)
    await waitForDashboard(page)

    // Open the user menu (avatar/username button in the header)
    await page.click('button:has(span.material-symbols-outlined:text("person"))')

    // Click "Đăng xuất" inside the dropdown
    await page.click('text=Đăng xuất')

    // Confirm the logout in the confirm dialog
    await page.click('button:has-text("Xác nhận")')

    // Login form should be visible again
    await page.waitForSelector('input[placeholder="Nhập email đăng nhập"]', { timeout: 10_000 })

    // localStorage tokens should be cleared
    const accessToken = await getLocalStorage(page, 'sso_access_token')
    const refreshToken = await getLocalStorage(page, 'sso_refresh_token')
    expect(accessToken).toBeNull()
    expect(refreshToken).toBeNull()
  })
})
