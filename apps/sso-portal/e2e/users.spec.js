const { test, expect } = require('@playwright/test')
const { loginAs, waitForDashboard } = require('./fixtures.js')

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'admin@test.com', 'Admin@@123')
  await waitForDashboard(page)
  await page.click('text=Người dùng')
  await page.waitForSelector('text=huyenvv.it@gmail.com', { timeout: 8_000 })
})

test.describe('UserManager (E2E)', () => {
  test('user list shows email addresses', async ({ page }) => {
    await expect(page.locator('text=huyenvv.it@gmail.com')).toBeVisible()
  })

  test('lock button exists for active users', async ({ page }) => {
    const lockBtn = page.locator('button').filter({ hasText: /^Khóa$/ }).first()
    await expect(lockBtn).toBeVisible()
  })

  test('lock user shows confirmation then success toast', async ({ page }) => {
    const lockBtn = page.locator('button').filter({ hasText: /^Khóa$/ }).first()
    await lockBtn.click()
    // Confirmation dialog
    const confirmBtn = page.locator('button').filter({ hasText: /^Xác nhận$/ })
    await expect(confirmBtn).toBeVisible({ timeout: 3_000 })
    await confirmBtn.click()
    // Success toast: "Đã khóa tài khoản"
    await expect(page.locator('text=Đã khóa tài khoản')).toBeVisible({ timeout: 5_000 })
  })
})
