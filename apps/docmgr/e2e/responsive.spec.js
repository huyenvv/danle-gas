const { test, expect } = require('@playwright/test')

// Mobile project: Pixel 5 viewport (393×851, isMobile: true)
//
// Dev mode auto-authenticates as admin on every page load.
// Mock data contains 3 pre-seeded docs — see documents.spec.js for details.
//
// Sidebar design:
//   Always rendered; toggles between w-[72px] (collapsed, icons only) and
//   w-64 (expanded) via a hamburger button in TopHeader.
//   On mobile the sidebar starts in whatever state is in localStorage
//   (defaults expanded). The hamburger is always visible in TopHeader.
//
// DocumentPreview layout: fixed inset-0 z-50, max-w-7xl max-h-[92vh]
// DocumentModal layout:   fixed inset-0 z-50, max-w-4xl max-h-[92vh], p-4 gutter

async function waitForApp(page) {
  await page.goto('/')
  // "Hồ sơ" is the first sidebar nav item — rendered as soon as the app loads.
  // On mobile the sidebar may be collapsed (icon-only) but the nav item is still
  // in the DOM; text=Hồ sơ matches the title attribute on the collapsed icon button.
  await page.locator('.sidebar-nav-item').first().waitFor({ timeout: 10_000 })
}

// Open DocumentPreview for the first mock document and wait for the h3 heading.
async function openPreview(page, docName) {
  await page.locator(`text=${docName}`).first().click()
  await page.locator(`h3:has-text("${docName}")`).waitFor({ timeout: 8_000 })
}

test.describe('Responsive — mobile layout (Pixel 5)', () => {

  test.beforeEach(async ({ page }) => {
    // Ensure sidebar starts expanded so nav text "Hồ sơ" is visible for other
    // specs that need it. The responsive test itself tests the collapse behavior.
    await page.addInitScript(() => {
      localStorage.removeItem('sidebar_collapsed')
    })
    await waitForApp(page)
  })

  // ── 1. Sidebar collapse / hamburger ──────────────────────────────────────

  test('1. Hamburger button is visible and sidebar can be toggled on mobile', async ({ page }) => {
    // Hamburger is always rendered in TopHeader (title="Thu gọn / mở rộng")
    const hamburger = page.locator('button[title="Thu gọn / mở rộng"]')
    await expect(hamburger).toBeVisible()

    // The sidebar is a flex container with border-r — its width toggles between
    // w-64 (256px, expanded) and w-[72px] (72px, collapsed).
    // Measure the width of the first .sidebar-nav-item's parent container.
    // We use the sidebar-nav-item's offsetParent chain to detect collapse.
    //
    // Simpler approach: measure how many pixels the first sidebar-nav-item's
    // label span occupies. When collapsed, the span is hidden (not rendered).
    // We detect collapse by checking sidebar width via JS.
    const getSidebarWidth = () =>
      page.evaluate(() => {
        // The sidebar is the first element that has both 'border-r' and 'shrink-0'
        // classes, matching the Sidebar.jsx outer div.
        const el = document.querySelector('[class*="shrink-0"][class*="border-r"]')
        return el ? el.getBoundingClientRect().width : null
      })

    const widthBefore = await getSidebarWidth()
    expect(widthBefore).not.toBeNull()
    expect(widthBefore).toBeGreaterThan(100) // expanded: w-64 = 256px

    // Click hamburger → sidebar collapses (w-[72px] = 72px)
    await hamburger.click()
    // Wait for transition to complete (300ms)
    await page.waitForTimeout(400)
    const widthAfter = await getSidebarWidth()
    expect(widthAfter).not.toBeNull()
    expect(widthAfter).toBeLessThan(widthBefore)
    expect(widthAfter).toBeLessThanOrEqual(80) // collapsed: w-[72px] = 72px

    // Click again → sidebar re-expands
    await hamburger.click()
    await page.waitForTimeout(400)
    const widthRestored = await getSidebarWidth()
    expect(widthRestored).toBeGreaterThan(100)
  })

  // ── 2. DocumentModal is not clipped on mobile ─────────────────────────────

  test('2. DocumentModal fits inside viewport on mobile — no overflow clipping', async ({ page }) => {
    const viewport = page.viewportSize() // { width: 393, height: 851 }

    // Open the create modal via the toolbar button (visible for admin)
    await page.locator('button:has-text("Thêm hồ sơ")').click()
    await page.locator('text=Thêm hồ sơ mới').waitFor({ timeout: 5_000 })

    // The modal backdrop occupies the full viewport; the dialog card inside it
    // has max-w-4xl max-h-[92vh] with a p-4 gutter around it.
    // On a 393px mobile width the dialog should be at most 393px wide and
    // must not be taller than the viewport.
    const dialog = page.locator('.bg-white.rounded-3xl').first()
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()

    // Dialog fits horizontally within the viewport (allows 1px rounding)
    expect(box.width).toBeLessThanOrEqual(viewport.width + 1)

    // Dialog does not clip below the bottom of the viewport
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 2)

    // Dialog has usable width (not tiny)
    expect(box.width).toBeGreaterThan(200)

    // Close the modal
    await page.keyboard.press('Escape')
  })

  // ── 3. Comment input is usable on mobile ─────────────────────────────────

  test('3. Comment input is visible and accepts text on mobile', async ({ page }) => {
    // Wait for mock docs to render, then open DocumentPreview
    await page.locator('text=Hợp đồng mua sắm CNTT').waitFor({ timeout: 10_000 })
    await openPreview(page, 'Hợp đồng mua sắm CNTT')

    // The comment input is inside DocumentPreview sidebar
    const commentInput = page.locator('input[placeholder="Nhập bình luận..."]')
    await expect(commentInput).toBeVisible({ timeout: 5_000 })

    // Verify it's not clipped outside the viewport
    const box = await commentInput.boundingBox()
    expect(box).not.toBeNull()
    const viewport = page.viewportSize()
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 2)

    // Can type into it
    await commentInput.fill('Mobile comment test')
    await expect(commentInput).toHaveValue('Mobile comment test')
  })

  // ── 4. Workflow buttons visible on mobile ─────────────────────────────────

  test('4. Workflow action buttons are visible in DocumentPreview on mobile', async ({ page }) => {
    // Wait for mock docs to render, then open DocumentPreview
    await page.locator('text=Hợp đồng mua sắm CNTT').waitFor({ timeout: 10_000 })
    await openPreview(page, 'Hợp đồng mua sắm CNTT')

    // Dev session is admin; "Chờ xử lý" status has actions [thuHoi, nhanViec]
    // Check if any workflow action button is visible — they use data-testid="action-<key>"
    const actionButtons = page.locator('[data-testid^="action-"]')
    const count = await actionButtons.count()

    // In dev mock, admin session always has actions for documents — count must be > 0
    expect(count).toBeGreaterThan(0)

    // At least one action button should be visible and inside viewport
    const firstBtn = actionButtons.first()
    await expect(firstBtn).toBeVisible({ timeout: 5_000 })

    // Verify it's within the horizontal bounds of mobile viewport (393px)
    const box = await firstBtn.boundingBox()
    expect(box).not.toBeNull()
    const viewport = page.viewportSize()
    // Button must be within viewport bounds (not hidden off-screen)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 2)
  })

  // ── 5. No catastrophic horizontal overflow ────────────────────────────────

  test('5. No catastrophic horizontal overflow on mobile main screen', async ({ page }) => {
    // Wait for the document list to render (confirms full app state)
    await page.locator('text=Hợp đồng mua sắm CNTT').waitFor({ timeout: 10_000 })

    const overflow = await page.evaluate(
      () => Math.max(0, document.body.scrollWidth - window.innerWidth)
    )
    // Allow up to 199px (some table overflow is expected for wide tables,
    // but anything >= 200px is a catastrophic layout break)
    expect(overflow).toBeLessThan(200)
  })

})
