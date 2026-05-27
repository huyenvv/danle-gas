const { test, expect } = require('@playwright/test')
const { loginAs, waitForDashboard } = require('./fixtures.js')

// NOTE: These tests only make sense on the 'mobile' project (Pixel 5, 393×851).
// They verify layout doesn't overflow or clip on small screens.

test.describe('Responsive — LoginPage', () => {
  test('form fits viewport without horizontal scroll', async ({ page }) => {
    const viewportWidth = page.viewportSize()?.width ?? 1280
    test.skip(viewportWidth === 1280, 'Responsive tests only run on mobile project')

    await page.goto('/')
    await page.waitForSelector('input[placeholder="Nhập email đăng nhập"]')
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2) // 2px tolerance
  })

  test('submit button is wide on mobile', async ({ page }) => {
    const viewportWidth = page.viewportSize()?.width ?? 1280
    test.skip(viewportWidth === 1280, 'Responsive tests only run on mobile project')

    await page.goto('/')
    await page.waitForSelector('button[type="submit"]')
    const btnBox = await page.locator('button[type="submit"]').boundingBox()
    // Button should take up most of the viewport (allow for padding/margins)
    expect(btnBox?.width).toBeGreaterThan(viewportWidth * 0.6)
  })
})

test.describe('Responsive — Dashboard tabs', () => {
  test('admin tabs container exists and is visible on mobile', async ({ page }) => {
    const viewportWidth = page.viewportSize()?.width ?? 1280
    test.skip(viewportWidth === 1280, 'Responsive tests only run on mobile project')

    await loginAs(page, 'admin@test.com', 'Admin@@123')
    await waitForDashboard(page)
    // The Dashboard tab bar is a div with overflow-x-auto containing tab buttons.
    // It has no nav/tablist role, so we match the scrollable tab container directly.
    const tabBar = page.locator('div.overflow-x-auto').first()
    await expect(tabBar).toBeVisible()
  })
})

test.describe('Responsive — ChangePasswordModal', () => {
  test('forced password modal does not overflow viewport', async ({ page }) => {
    const viewportWidth = page.viewportSize()?.width ?? 1280
    test.skip(viewportWidth === 1280, 'Responsive tests only run on mobile project')

    await loginAs(page, 'huyenvv.it@gmail.com', 'Admin@@123')
    await page.waitForSelector('text=Đổi mật khẩu', { timeout: 8_000 })
    // Modal container should not exceed viewport width
    const modalBox = await page.locator('[class*="rounded-3xl"]').first().boundingBox()
    if (modalBox) {
      expect(modalBox.x).toBeGreaterThanOrEqual(0)
      expect(modalBox.x + modalBox.width).toBeLessThanOrEqual(viewportWidth + 4) // 4px tolerance
    }
  })
})

test.describe('Responsive — UserManager table', () => {
  test('user list content is accessible on mobile', async ({ page }) => {
    const viewportWidth = page.viewportSize()?.width ?? 1280
    test.skip(viewportWidth === 1280, 'Responsive tests only run on mobile project')

    await loginAs(page, 'admin@test.com', 'Admin@@123')
    await waitForDashboard(page)
    await page.click('text=Người dùng')
    await page.waitForSelector('text=huyenvv.it@gmail.com', { timeout: 8_000 })
    // User content is visible — table may scroll horizontally but text is accessible
    await expect(page.locator('text=huyenvv.it@gmail.com')).toBeVisible()
  })
})
