/**
 * SSO Portal end-to-end test via Playwright.
 * Tests login + click child app + multi-context scenarios.
 */
const { chromium } = require('playwright')

const PORTAL_URL = 'https://script.google.com/macros/s/AKfycbxcCjEaa8ZXeFH0-8M8q5ZS5nYwcauQgzDs_nO5Gx_mokdSkIb8n_867PxSwgPBteQmNQ/exec'
const NV = { email: 'nhanvien@gmail.com', pass: 'Admin@123' }
const ADMIN = { email: 'huyenvv90@gmail.com', pass: 'Admin@123' }

// Wait for React app inside GAS sandbox iframe to mount + return its Frame
// React app lives in the deepest googleusercontent frame (URL ends in /blank, srcdoc-rendered).
// The userCodeAppPanel frame is just the security wrapper.
async function waitForAppFrame(page, { timeout = 60000 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    for (const frame of page.frames()) {
      if (!frame.url().includes('googleusercontent.com')) continue
      try {
        const has = await frame.evaluate(() =>
          document.querySelectorAll('input, button').length > 0 ||
          document.querySelectorAll('div').length > 10
        )
        if (has) return frame
      } catch (e) { /* still loading */ }
    }
    await page.waitForTimeout(500)
  }
  throw new Error('App frame did not mount within ' + timeout + 'ms')
}

async function getBodyText(frame) {
  return frame.evaluate(() => document.body.innerText)
}

async function login(page, email, pass) {
  const frame = await waitForAppFrame(page)
  await frame.fill('input[type="email"]', email)
  await frame.fill('input[type="password"]', pass)
  await frame.locator('button:has-text("Đăng nhập")').click()
  // Wait until login form is gone or error/toast appears (max 20s)
  await frame.waitForFunction(() => {
    const text = document.body.innerText
    return !text.includes('Đăng nhập để truy cập') || text.includes('không đúng') || text.includes('khóa')
  }, { timeout: 20000 }).catch(() => console.log('  ⚠ login wait timed out'))
  await page.waitForTimeout(2000)
  return frame
}

async function probeFrame(frame, label) {
  const text = await getBodyText(frame).catch(() => '')
  const inputs = await frame.evaluate(() =>
    Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, placeholder: i.placeholder }))
  ).catch(() => [])
  console.log(`\n=== ${label} ===`)
  console.log('Text:', text.slice(0, 300).replace(/\n+/g, ' | '))
  console.log('Inputs:', JSON.stringify(inputs))
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

async function newBrowserContext() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })
  return { browser, ctx }
}

async function testA1_loginAndOpenDocmgr() {
  console.log('\n┌─── Test A1: login NV → click docmgr ───')
  const { browser, ctx } = await newBrowserContext()
  const page = await ctx.newPage()

  await page.goto(PORTAL_URL, { waitUntil: 'load' })
  await page.waitForTimeout(5000) // React inside GAS sandbox needs time

  const frame = await login(page, NV.email, NV.pass)
  await probeFrame(frame, 'After login')
  await page.screenshot({ path: '/tmp/a1-dashboard.png', fullPage: true })

  // Find docmgr card — look for app name "Quản lý Tài liệu" or "docmgr"
  const docmgrCard = frame.locator('button:has-text("Tài liệu"), [role="button"]:has-text("Tài liệu"), div[class*="card"]:has-text("Tài liệu")').first()
  const cardCount = await docmgrCard.count()
  console.log(`Docmgr-like cards: ${cardCount}`)

  if (cardCount > 0) {
    await docmgrCard.click()
    await page.waitForTimeout(4000)
    await page.screenshot({ path: '/tmp/a1-after-click-docmgr.png', fullPage: true })

    // Look for "Phiên hết hạn" anywhere in any frame
    const allText = await Promise.all(
      page.frames().map(f => f.evaluate(() => document.body.innerText).catch(() => ''))
    )
    const joined = allText.join(' | ')
    const expired = /hết hạn/i.test(joined)
    console.log(`After-click frames text snippets:`)
    allText.forEach((t, i) => {
      if (t.length > 5) console.log(`  [${i}]`, t.slice(0, 150).replace(/\n+/g, ' '))
    })
    console.log(`Test A1: ${expired ? '✗ FAIL — saw "hết hạn"' : '✓ PASS — no expiry error'}`)
  } else {
    console.log('✗ FAIL — docmgr card not found')
  }

  await browser.close()
  console.log('└────────────────────────────────────────')
}

// Hard reload after login, then immediately click docmgr.
// Used to fail because cached AT in LS was stale post-resume.
async function testA2_reloadThenOpenDocmgr() {
  console.log('\n┌─── Test A2: login NV → reload portal → click docmgr ───')
  const { browser, ctx } = await newBrowserContext()
  const page = await ctx.newPage()

  await page.goto(PORTAL_URL, { waitUntil: 'load' })
  await page.waitForTimeout(5000)
  await login(page, NV.email, NV.pass)
  await page.waitForTimeout(2000) // dashboard renders

  console.log('→ Hard reload')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  const frame = await waitForAppFrame(page)
  await probeFrame(frame, 'After reload')

  const docmgrCard = frame.locator(':has-text("Tài liệu")').filter({ has: frame.locator('[class*="material-symbols"], [class*="icon"]') }).first()
  let cardCount = await docmgrCard.count()
  if (cardCount === 0) {
    // fallback: any clickable element with "Tài liệu"
    const fallback = frame.locator('text=/Tài liệu/i').first()
    cardCount = await fallback.count()
    if (cardCount > 0) {
      await fallback.click()
    }
  } else {
    await docmgrCard.click()
  }
  console.log(`Docmgr clickable: ${cardCount}`)

  await page.waitForTimeout(4000)
  await page.screenshot({ path: '/tmp/a2-after-reload-click.png', fullPage: true })

  const allText = await Promise.all(
    page.frames().map(f => f.evaluate(() => document.body.innerText).catch(() => ''))
  )
  const joined = allText.join(' | ')
  const expired = /hết hạn/i.test(joined)
  console.log(`Test A2: ${expired ? '✗ FAIL — saw "hết hạn"' : '✓ PASS — no expiry'}`)

  await browser.close()
  console.log('└────────────────────────────────────────')
}

// After clicking docmgr, child iframe should leave "Đang khởi tạo…" and show actual UI.
async function waitForDocmgrLoaded(page, { timeout = 25000 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    for (const f of page.frames()) {
      try {
        const text = await f.evaluate(() => document.body.innerText || '')
        if (/hết hạn|khóa|không có quyền/i.test(text)) return { ok: false, reason: text.slice(0, 200) }
        // docmgr Dashboard markers — header / sidebar usually contain "Hồ sơ" or "Danh mục"
        if (/Hồ sơ|Danh mục|Tài liệu/i.test(text) && !text.includes('Quản lý tài liệu Quản lý công việc')) {
          return { ok: true, reason: text.slice(0, 200) }
        }
      } catch (_) {}
    }
    await page.waitForTimeout(1000)
  }
  return { ok: false, reason: 'timed out waiting for docmgr UI' }
}

// ── Test C: original bug — login user A, logout, login user B (same context), click docmgr.
async function testC_switchUser() {
  console.log('\n┌─── Test C: login admin → logout → login NV (same context) → click docmgr ───')
  const { browser, ctx } = await newBrowserContext()
  const page = await ctx.newPage()

  await page.goto(PORTAL_URL, { waitUntil: 'load' })
  await page.waitForTimeout(5000)
  await login(page, ADMIN.email, ADMIN.pass)
  console.log('  [admin] logged in')

  // logout via user menu
  const frame = await waitForAppFrame(page)
  await frame.locator('button:has-text("' + ADMIN.email + '"), button:has-text("expand_more")').first().click()
  await page.waitForTimeout(800)
  await frame.locator('button:has-text("Đăng xuất")').click()
  await page.waitForTimeout(500)
  // confirm dialog
  await frame.locator('button:has-text("OK"), button:has-text("Đồng ý"), button:has-text("Xác nhận")').first().click().catch(() => {})
  await page.waitForTimeout(3000)
  console.log('  [admin] logged out')

  await login(page, NV.email, NV.pass)
  console.log('  [NV] logged in (same context — stale RT may still be in LS)')

  const frame2 = await waitForAppFrame(page)
  await frame2.locator('text=/Quản lý tài liệu/i').first().click()
  console.log('  [NV] clicked docmgr')

  const result = await waitForDocmgrLoaded(page)
  console.log(`Test C: ${result.ok ? '✓ PASS' : '✗ FAIL'} — ${result.reason.replace(/\n+/g, ' ')}`)

  await page.screenshot({ path: '/tmp/c-after-switch.png', fullPage: true })
  await browser.close()
  console.log('└────────────────────────────────────────')
}

// Multi-tab: open portal in 2 pages sharing localStorage → both must resume cleanly.
// Pre-fix this race could cause one tab to get TOKEN_REVOKED because rotateRefreshToken
// invalidated the other tab's RT in flight.
async function testB1_multiTabRace() {
  console.log('\n┌─── Test B1: 2 tabs same context, simultaneous resume ───')
  const { browser, ctx } = await newBrowserContext()
  const page1 = await ctx.newPage()
  await page1.goto(PORTAL_URL, { waitUntil: 'load' })
  await page1.waitForTimeout(5000)
  await login(page1, NV.email, NV.pass)
  console.log('  [tab1] logged in')

  // Open tab2 in same context — shares localStorage, will auto-resume on mount
  const page2 = await ctx.newPage()
  // Open both in parallel by reloading tab1 at the same time tab2 navigates.
  await Promise.all([
    page1.reload({ waitUntil: 'load' }),
    page2.goto(PORTAL_URL, { waitUntil: 'load' }),
  ])

  // Both should land on Dashboard (no login form) after auto-resume
  for (const [name, page] of [['tab1', page1], ['tab2', page2]]) {
    try {
      const frame = await waitForAppFrame(page, { timeout: 20000 })
      const text = await frame.evaluate(() => document.body.innerText)
      const onDashboard = /Cổng Đăng Nhập/.test(text) && /Quản lý/.test(text) && !/Đăng nhập để truy cập/.test(text)
      const expired = /hết hạn/i.test(text)
      console.log(`  [${name}] dashboard=${onDashboard} expired=${expired}`)
      if (!onDashboard || expired) {
        console.log(`    text snippet: ${text.slice(0, 150).replace(/\n+/g, ' ')}`)
      }
    } catch (e) {
      console.log(`  [${name}] error: ${e.message}`)
    }
  }
  console.log('Test B1: ' + (true ? 'see above' : ''))
  await browser.close()
  console.log('└────────────────────────────────────────')
}

async function main() {
  await testA1_loginAndOpenDocmgr()
  await testA2_reloadThenOpenDocmgr()
  await testC_switchUser()
  await testB1_multiTabRace()
  console.log('\nDone.')
}

main().catch(err => {
  console.error('\n✗ FATAL:', err.message)
  console.error(err.stack)
  process.exit(1)
})
