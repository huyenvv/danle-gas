const { test, expect } = require('@playwright/test')

// Polling: startPolling() is called in MainApp's useEffect on session load.
// It uses setInterval(60_000) and calls gasCall('api_pollUpdates', ...) on each tick.
// Console log format: '[gasClient mock] api_pollUpdates [args...]'
//
// DEV mode auth: AuthContext always clears localStorage then calls api_resume('dev-auto').
// The mock stores mock-access-<timestamp> as the new access token.
//
// Logout: There is no logout button in the UI. The effective logout path is the
// auth:sessionExpired event, which calls _clearAuth() → removes all three localStorage keys.

test.describe('Sync + cache', () => {
  test('after dev auto-auth, fresh access token is stored in localStorage', async ({ page }) => {
    await page.goto('/')
    await page.locator('text=Hồ sơ').first().waitFor({ timeout: 10_000 })

    const token = await page.evaluate(() => localStorage.getItem('docmgr_access_token'))
    expect(token).toBeTruthy()
    expect(token).toMatch(/^mock-access-/)
  })

  test('api_pollUpdates is called after 60s (fake clock)', async ({ page }) => {
    const pollCalls = []
    page.on('console', msg => {
      if (msg.text().includes('[gasClient mock] api_pollUpdates')) pollCalls.push(msg.text())
    })

    // Install fake clock before navigation so all timers from page init are controlled
    await page.clock.install({ time: 0 })

    await page.goto('/')
    await page.locator('text=Hồ sơ').first().waitFor({ timeout: 10_000 })

    // Advance 61 seconds to trigger the first polling interval
    await page.clock.fastForward(61_000)
    // Flush microtasks / async callbacks from the mock's delay(80)
    await page.evaluate(() => new Promise(r => setTimeout(r, 0)))
    await page.clock.fastForward(200)
    await page.evaluate(() => new Promise(r => setTimeout(r, 0)))

    expect(pollCalls.length).toBeGreaterThanOrEqual(1)
  })

  test('auth:sessionExpired event clears tokens from localStorage', async ({ page }) => {
    await page.goto('/')
    await page.locator('text=Hồ sơ').first().waitFor({ timeout: 10_000 })

    // Verify tokens are present after successful dev auto-auth
    const tokenBefore = await page.evaluate(() => localStorage.getItem('docmgr_access_token'))
    expect(tokenBefore).toBeTruthy()

    // Dispatch the sessionExpired event — this is the same event that API calls fire
    // when the server rejects a token. AuthContext handles it by calling _clearAuth().
    await page.evaluate(() => window.dispatchEvent(new Event('auth:sessionExpired')))

    // Wait for the access-denied screen to confirm the handler ran
    await expect(page.getByRole('heading', { name: 'Phiên đăng nhập đã hết hạn' })).toBeVisible({ timeout: 5_000 })

    const tokenAfter = await page.evaluate(() => localStorage.getItem('docmgr_access_token'))
    expect(tokenAfter).toBeNull()

    const refreshAfter = await page.evaluate(() => localStorage.getItem('docmgr_refresh_token'))
    expect(refreshAfter).toBeNull()
  })
})
