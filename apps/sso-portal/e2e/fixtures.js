const { test: base, expect } = require('@playwright/test')

/**
 * Fill and submit the login form.
 */
async function loginAs(page, email, password) {
  await page.goto('/')
  await page.waitForSelector('input[placeholder="Nhập email đăng nhập"]')
  await page.fill('input[placeholder="Nhập email đăng nhập"]', email)
  await page.fill('input[placeholder="Nhập mật khẩu"]', password)
  await page.click('button[type="submit"]')
}

/**
 * Wait for the Dashboard to be visible.
 */
async function waitForDashboard(page) {
  await page.waitForSelector('text=Ứng dụng', { timeout: 10_000 })
}

/**
 * Click a dashboard tab by label text.
 */
async function clickTab(page, label) {
  await page.click(`text=${label}`)
}

/**
 * Read localStorage value in page context.
 */
async function getLocalStorage(page, key) {
  return page.evaluate((k) => localStorage.getItem(k), key)
}

module.exports = { loginAs, waitForDashboard, clickTab, getLocalStorage }
