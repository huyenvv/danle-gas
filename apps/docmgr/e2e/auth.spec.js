const { test, expect } = require('@playwright/test')

// AuthContext in dev mode:
//   1. Always calls _clearAuth() then gasCall('api_resume', 'dev-auto')
//   2. Mock responds with a full admin session
//   3. Pre-seeded localStorage tokens don't change the flow (cleared on every load)
//
// Production path (not testable in dev build):
//   window.__SSO_TOKEN__ present → api_ssoLogin
//   docmgr_refresh_token present (no SSO token) → api_resume(rt)

test.describe('Auth — token flows', () => {
  test('dev mode auto-auth → app loads and shows main content', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Sidebar "Hồ sơ" nav item is the first entry — reliable main-content indicator
    await expect(page.locator('text=Hồ sơ').first()).toBeVisible({ timeout: 10_000 })
  })

  test('pre-seeded localStorage token → overwritten by dev auto-auth, app still loads', async ({ page }) => {
    // Dev mode always clears local auth before calling api_resume('dev-auto').
    // Seeding a stale token verifies the app doesn't get stuck on an invalid token.
    await page.addInitScript(() => {
      localStorage.setItem('docmgr_access_token', 'stale-token-from-previous-session')
      localStorage.setItem('docmgr_refresh_token', 'stale-refresh-token')
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Hồ sơ').first()).toBeVisible({ timeout: 10_000 })
  })

  test('after auto-auth, fresh access token is stored in localStorage', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.locator('text=Hồ sơ').first().waitFor({ timeout: 10_000 })

    const token = await page.evaluate(() => localStorage.getItem('docmgr_access_token'))
    expect(token).toBeTruthy()
    expect(token).toMatch(/^mock-access-/)
  })

  test('auth:sessionExpired event → shows "Phiên đăng nhập đã hết hạn" screen', async ({ page }) => {
    await page.goto('/')
    await page.locator('text=Hồ sơ').first().waitFor({ timeout: 10_000 })

    // Dispatch the custom event that API calls fire when the server rejects the token
    await page.evaluate(() => window.dispatchEvent(new Event('auth:sessionExpired')))

    await expect(page.getByRole('heading', { name: 'Phiên đăng nhập đã hết hạn' })).toBeVisible({ timeout: 5_000 })
  })

  test('SSO token on window → api_ssoLogin path, app loads normally', async ({ page }) => {
    // Inject __SSO_TOKEN__ and __SSO_PARENT__ before React initialises.
    // The mock treats api_ssoLogin identically to api_resume → returns an admin session.
    await page.addInitScript(() => {
      window.__SSO_TOKEN__ = 'mock-sso-token'
      window.__SSO_PARENT__ = 'mock-parent-sheet-id'
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Hồ sơ').first()).toBeVisible({ timeout: 10_000 })
  })
})
