/**
 * E2E test: access token auto-refresh.
 *
 * Setup: temporarily shorten ACCESS_TOKEN_TTL to 15 s + deploy sso-portal.
 * Test:  login → wait > TTL → trigger an API call → verify gasClient
 *        silently refreshed (new AT in localStorage, no expiry modal).
 * Teardown: revert ACCESS_TOKEN_TTL to 1800 s + deploy sso-portal.
 *
 * The finally block always runs revert + redeploy even if the test throws,
 * so prod doesn't stay in short-TTL mode.
 *
 * Usage: node scripts/test-sso-refresh.js
 */
const { chromium } = require('playwright')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const AT_FILE = path.resolve(__dirname, '../packages/gas-core/access-token.js')
const PROD_LINE = 'var ACCESS_TOKEN_TTL = 1800 // 30 min'
const TEST_LINE = 'var ACCESS_TOKEN_TTL = 15 // 15s — TEMP for refresh test'

const PORTAL_URL = 'https://script.google.com/macros/s/AKfycbxcCjEaa8ZXeFH0-8M8q5ZS5nYwcauQgzDs_nO5Gx_mokdSkIb8n_867PxSwgPBteQmNQ/exec'
const NV = { email: 'nhanvien@gmail.com', pass: 'Admin@123' }

function setTtl(toTest) {
  const content = fs.readFileSync(AT_FILE, 'utf8')
  const next = toTest
    ? content.replace(PROD_LINE, TEST_LINE)
    : content.replace(TEST_LINE, PROD_LINE)
  if (next === content) {
    throw new Error(`ACCESS_TOKEN_TTL line not found (expected "${toTest ? PROD_LINE : TEST_LINE}")`)
  }
  fs.writeFileSync(AT_FILE, next)
  console.log(`  patched access-token.js → ${toTest ? 'TEST (15s)' : 'PROD (1800s)'}`)
}

function deploy() {
  console.log('  deploying sso-portal…')
  execSync('npm run deploy:sso', { stdio: 'pipe' })
  console.log('  ✓ deployed')
}

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
      } catch (_) {}
    }
    await page.waitForTimeout(500)
  }
  throw new Error('App frame did not mount')
}

async function login(page) {
  const frame = await waitForAppFrame(page)
  await frame.fill('input[type="email"]', NV.email)
  await frame.fill('input[type="password"]', NV.pass)
  await frame.locator('button:has-text("Đăng nhập")').click()
  await frame.waitForFunction(
    () => !document.body.innerText.includes('Đăng nhập để truy cập'),
    { timeout: 20000 }
  )
  await page.waitForTimeout(2000)
  return frame
}

// Read sso_access_token from the iframe's localStorage (cross-origin from top page).
async function readAccessToken(page) {
  for (const f of page.frames()) {
    if (!f.url().includes('googleusercontent.com')) continue
    try {
      const at = await f.evaluate(() => localStorage.getItem('sso_access_token'))
      if (at) return at
    } catch (_) {}
  }
  return null
}

async function runTest() {
  console.log('\n── Test: AT auto-refresh after expiry ──')
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })
  const page = await ctx.newPage()

  // Track gasClient activity via browser console
  page.on('console', msg => {
    const t = msg.text()
    if (/TOKEN_EXPIRED|api_resume|api_portalSync|refresh|gasClient/i.test(t)) {
      console.log(`  [browser ${msg.type()}] ${t}`)
    }
  })

  await page.goto(PORTAL_URL, { waitUntil: 'load' })
  await page.waitForTimeout(5000)
  const frame = await login(page)
  const t0 = Date.now()
  console.log(`  ✓ logged in @ t=0`)

  const at1 = await readAccessToken(page)
  if (!at1) throw new Error('no access token after login')
  console.log(`  AT1: ${at1.slice(0, 16)}…`)

  // Wait for AT to expire. Poll every 5s to log AT state along the way.
  const waitMs = 35000
  console.log(`  waiting ${waitMs / 1000}s (TTL=15s)…`)
  for (let i = 5; i <= waitMs / 1000; i += 5) {
    await page.waitForTimeout(5000)
    const at = await readAccessToken(page)
    const same = at === at1 ? '=AT1' : 'CHANGED'
    console.log(`    +${i}s (real ${((Date.now() - t0) / 1000).toFixed(1)}s) AT: ${at?.slice(0, 16)}… ${same}`)
  }

  // Trigger an API call: refresh-apps button (title="Làm mới danh sách").
  const refreshBtn = frame.locator('button[title*="Làm mới"]').first()
  const btnCount = await refreshBtn.count()
  console.log(`  refresh button found: ${btnCount}`)
  if (btnCount === 0) {
    // Fallback: try the page-reload heartbeat by switching tabs (visibilitychange)
    console.log('  fallback: dispatch visibilitychange')
    await frame.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
  } else {
    await refreshBtn.click({ timeout: 5000 })
    console.log('  ✓ clicked refresh apps button')
  }

  console.log('  waiting 6s for API + refresh round-trip…')
  await page.waitForTimeout(6000)

  // Verify no expiry modal
  const allText = await Promise.all(
    page.frames().map(f => f.evaluate(() => document.body.innerText).catch(() => ''))
  )
  const joined = allText.join(' | ')
  const expiredModal = /Phiên đăng nhập đã hết hạn/i.test(joined)

  const at2 = await readAccessToken(page)
  const rotated = at2 && at2 !== at1

  console.log(`  expired modal: ${expiredModal ? '✗ SHOWN' : '✓ not shown'}`)
  console.log(`  AT2: ${at2 ? at2.slice(0, 16) + '…' : '(null)'}`)
  console.log(`  AT rotated:    ${rotated ? '✓' : '✗ SAME as AT1'}`)

  await page.screenshot({ path: '/tmp/refresh-after.png', fullPage: true })
  await browser.close()

  if (expiredModal) throw new Error('Auto-refresh failed — user saw expiry modal')
  if (!rotated) throw new Error('AT did not rotate after expiry — either refresh did not fire or call did not occur')
  console.log('  ✓ PASS')
}

async function main() {
  let testError = null

  // Setup
  setTtl(true)
  deploy()

  // Test
  try {
    await runTest()
  } catch (e) {
    testError = e
    console.error(`\n✗ Test error: ${e.message}`)
  }

  // Teardown — always run
  console.log('\n── Teardown ──')
  try {
    setTtl(false)
    deploy()
  } catch (e) {
    console.error('\n✗ TEARDOWN FAILED — manual revert needed!')
    console.error('  Edit packages/gas-core/access-token.js → ACCESS_TOKEN_TTL = 1800')
    console.error('  Then: npm run deploy:sso')
    throw e
  }

  if (testError) process.exit(1)
  console.log('\n✓ Done')
}

main().catch(err => {
  console.error('\nFATAL:', err.message)
  process.exit(1)
})
