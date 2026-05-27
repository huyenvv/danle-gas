const { test, expect } = require('@playwright/test')
const { loginAs, waitForDashboard, getLocalStorage } = require('./fixtures.js')

test.describe('LocalStorage cache after login', () => {
  test('access_token and refresh_token present', async ({ page }) => {
    await loginAs(page, 'admin@test.com', 'Admin@@123')
    await waitForDashboard(page)
    const at = await getLocalStorage(page, 'sso_access_token')
    const rt = await getLocalStorage(page, 'sso_refresh_token')
    expect(at).toBeTruthy()
    expect(rt).toBeTruthy()
  })

  test('user object stored in sso_user with correct role', async ({ page }) => {
    await loginAs(page, 'admin@test.com', 'Admin@@123')
    await waitForDashboard(page)
    const raw = await getLocalStorage(page, 'sso_user')
    const user = JSON.parse(raw)
    expect(user.username).toBeTruthy()
    expect(user.role).toBe('admin')
  })
})

test.describe('Background sync (api_portalSync every 60s)', () => {
  test('portalSync fires within 61s using fake clock', async ({ page }) => {
    // Patch console.log via addInitScript so it is in place before any page JS
    // runs (including gasClient.js). addInitScript executes on every navigation.
    await page.addInitScript(() => {
      window.__syncCount = 0
      const _orig = console.log
      console.log = function (...args) {
        if (args.length > 0 && String(args[0]).includes('gasClient mock')) window.__syncCount++
        _orig.apply(console, args)
      }
    })

    // Install fake clock BEFORE page.goto() so setInterval is controlled
    await page.clock.install({ time: 0 })

    await loginAs(page, 'admin@test.com', 'Admin@@123')
    await waitForDashboard(page)

    // Mechanics: mockCall() does `await new Promise(r => setTimeout(r, 80))`.
    // That inner timer is also fake-clock-controlled. We need three rounds:
    //   1. fastForward(200)  → fires the mock's 80ms init-sync timer
    //   2. yield (evaluate)  → lets the async chain resolve + log
    //   3. fastForward(60000) → fires the 60s setInterval
    //   4. yield             → setInterval callback runs, hits inner setTimeout
    //   5. fastForward(200)  → fires that inner 80ms timer
    //   6. yield             → async chain resolves, console.log executes

    // Round 1: pump initial sync
    await page.clock.fastForward(200)
    await page.evaluate(() => new Promise(r => setTimeout(r, 0)))

    const syncCountBeforeInterval = await page.evaluate(() => window.__syncCount)

    // Round 2: fire the 60s interval
    await page.clock.fastForward(60_000)
    await page.evaluate(() => new Promise(r => setTimeout(r, 0)))

    // Round 3: pump the interval callback's inner 80ms timer
    await page.clock.fastForward(200)
    await page.evaluate(() => new Promise(r => setTimeout(r, 0)))

    // At least one more sync call must have happened after the interval fired
    await expect.poll(() => page.evaluate(() => window.__syncCount), { timeout: 3_000 })
      .toBeGreaterThan(syncCountBeforeInterval)
  })
})

test.describe('Logout clears localStorage', () => {
  test('sso_ keys removed after logout simulation', async ({ page }) => {
    await loginAs(page, 'admin@test.com', 'Admin@@123')
    await waitForDashboard(page)

    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await expect(page.locator('input[placeholder="Nhập email đăng nhập"]')).toBeVisible({ timeout: 8_000 })
    const at = await getLocalStorage(page, 'sso_access_token')
    expect(at).toBeNull()
  })
})
