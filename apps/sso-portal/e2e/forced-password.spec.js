const { test, expect } = require('@playwright/test')
const { loginAs } = require('./fixtures.js')

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'huyenvv.it@gmail.com', 'Admin@@123')
  // Wait for ChangePasswordModal (mustChangePass=TRUE for this user)
  await page.waitForSelector('text=Đổi mật khẩu', { timeout: 8_000 })
})

test.describe('Forced password change', () => {
  test('modal appears immediately after login', async ({ page }) => {
    await expect(page.locator('text=Bạn cần đổi mật khẩu trước khi tiếp tục')).toBeVisible()
  })

  test('backdrop click does NOT close modal', async ({ page }) => {
    // The backdrop div has no onClick handler — click passes through, modal stays open
    await page.mouse.click(10, 10) // top-left corner = outside centered modal
    await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeVisible()
  })

  test('no close (X) button in forced mode', async ({ page }) => {
    // Close button is only rendered when !forced — should not exist in DOM at all
    const closeBtn = page.locator('button:has(span.material-symbols-outlined:text("close"))')
    await expect(closeBtn).not.toBeVisible()
  })

  test('successful password change → Dashboard visible', async ({ page }) => {
    // Fill old password (autoComplete=current-password)
    await page.fill('input[autocomplete="current-password"]', 'Admin@@123')
    // Fill new password (2nd and 3rd password inputs; use autocomplete=new-password with nth)
    await page.locator('input[autocomplete="new-password"]').nth(0).fill('NewPass@@789')
    await page.locator('input[autocomplete="new-password"]').nth(1).fill('NewPass@@789')
    await page.click('button[type="submit"]')
    await page.waitForSelector('text=Ứng dụng', { timeout: 10_000 })
    await expect(page.locator('text=Ứng dụng')).toBeVisible()
  })
})
