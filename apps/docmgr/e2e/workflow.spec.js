const { test, expect } = require('@playwright/test')

// Mock data in gasClient.js (dev mode):
//   ID 1: "Hợp đồng mua sắm CNTT"  — Tình trạng: "Chờ xử lý",  Phụ trách: ["admin"]
//   ID 2: "Công văn số 01/2024"     — Tình trạng: "Hoàn thành", Phụ trách: ["admin"]
//   ID 3: "Hợp đồng xây dựng VP"   — Tình trạng: "Chờ duyệt",  Phụ trách: ["admin"]
//
// Dev session: role = "admin" — ADMIN_ACTIONS per status:
//   Chờ duyệt  → [giaoViec]
//   Chờ xử lý → [thuHoi, nhanViec]   (nhanViec opens inline form)
//   Đang xử lý → [hoanThanh]
//
// Workflow buttons: data-testid="action-<key>"
// Confirm dialog button: "Xác nhận"
// Giao việc opens inline form — select user then "Xác nhận giao việc"
// Publish button: bg-amber-600 rounded-2xl "Phát hành"

async function waitForApp(page) {
  await page.goto('/')
  await page.locator('text=Hồ sơ').first().waitFor({ timeout: 10_000 })
  // Wait for mock data to load
  await page.locator('text=Hợp đồng mua sắm CNTT').waitFor({ timeout: 10_000 })
}

// Click a document row to open the preview modal, then wait for the doc title in the modal h3
async function openPreview(page, docName) {
  await page.locator(`text=${docName}`).first().click()
  await page.locator(`h3:has-text("${docName}")`).waitFor({ timeout: 8_000 })
}

// Verify status chip in the preview panel.
// The preview modal is: div.fixed.inset-0.bg-black/50.backdrop-blur-sm ... z-50
// We scope the span search to that container to avoid matching status badges
// in the document list behind the overlay.
async function expectPreviewStatus(page, statusText) {
  await page.waitForFunction(
    (status) => {
      // DocumentPreview renders: <div class="fixed inset-0 bg-black/50 backdrop-blur-sm ... z-50 p-4">
      // Use className substring matching to avoid CSS-selector escaping issues with
      // Tailwind's slash classes (bg-black/50). Scoping to the preview container prevents
      // false matches against status badges in the document list rendered behind the overlay.
      const preview = Array.from(document.querySelectorAll('div')).find(el => {
        const cls = el.className || ''
        return cls.includes('fixed') && cls.includes('inset-0') && cls.includes('z-50')
      })
      if (!preview) return false
      const spans = Array.from(preview.querySelectorAll('span'))
      return spans.some(el =>
        el.textContent.trim() === status &&
        el.offsetParent !== null // visible
      )
    },
    statusText,
    { timeout: 8_000 }
  )
}

test.describe('Workflow lifecycle', () => {

  // -----------------------------------------------------------------------
  // 1. Giao việc: Chờ duyệt doc → click Giao việc → inline form
  //    → select user → Xác nhận giao việc → confirm dialog → status = Chờ xử lý
  // submitGiaoViec() calls handleTransition() which calls confirm() — one confirm step.
  // -----------------------------------------------------------------------
  test('1. Giao việc on Chờ duyệt doc → status changes to Chờ xử lý', async ({ page }) => {
    await waitForApp(page)

    // Open "Hợp đồng xây dựng VP" (Chờ duyệt)
    await openPreview(page, 'Hợp đồng xây dựng VP')

    // Admin + Chờ duyệt → "Giao việc" action button
    const giaoViecBtn = page.locator('[data-testid="action-giaoViec"]')
    await expect(giaoViecBtn).toBeVisible({ timeout: 5_000 })
    await giaoViecBtn.click()

    // Inline form: "Xác nhận giao việc" button appears
    const submitBtn = page.getByRole('button', { name: 'Xác nhận giao việc' })
    await expect(submitBtn).toBeVisible({ timeout: 5_000 })

    // Click the Người phụ trách picker trigger (shows "-- Chọn --")
    const phuTrachTrigger = page.getByRole('button', { name: '-- Chọn --' })
    await expect(phuTrachTrigger).toBeVisible({ timeout: 3_000 })
    await phuTrachTrigger.click()

    // Dropdown opens with search input auto-focused and user list
    // Click the first user option button inside the dropdown list
    // The dropdown is a div.absolute.z-50 containing group divs and user buttons
    const userBtn = page.locator('div.absolute.z-50').getByRole('button').filter({ hasText: /\w+/ }).first()
    await userBtn.waitFor({ timeout: 3_000 })
    await userBtn.click()

    // Verify the trigger no longer shows "-- Chọn --" (user was selected)
    await expect(phuTrachTrigger).not.toBeVisible({ timeout: 2_000 })

    // Submit giao viec (calls submitGiaoViec → handleTransition → confirm dialog)
    await expect(submitBtn).toBeVisible({ timeout: 3_000 })
    await submitBtn.click()

    // handleTransition shows a confirm dialog "Xác nhận: Giao việc?" — must click it
    const giaoViecConfirmBtn = page.getByRole('button', { name: 'Xác nhận', exact: true })
    await expect(giaoViecConfirmBtn).toBeVisible({ timeout: 5_000 })
    await giaoViecConfirmBtn.click()

    // Status becomes "Chờ xử lý" in the preview panel
    await expectPreviewStatus(page, 'Chờ xử lý')
  })

  // -----------------------------------------------------------------------
  // 2. Nhận việc: Chờ xử lý doc → click Nhận việc → inline form → confirm form
  //    → confirm dialog → status = Đang xử lý
  // Note: submitGiaoViec() calls handleTransition() which calls confirm() —
  //       so there are TWO confirm steps: the inline form button + the dialog.
  // -----------------------------------------------------------------------
  test('2. Nhận việc on Chờ xử lý doc → status changes to Đang xử lý', async ({ page }) => {
    await waitForApp(page)

    // "Hợp đồng mua sắm CNTT" seeded as "Chờ xử lý", Phụ trách: ["admin"]
    await openPreview(page, 'Hợp đồng mua sắm CNTT')

    const nhanViecBtn = page.locator('[data-testid="action-nhanViec"]')
    await expect(nhanViecBtn).toBeVisible({ timeout: 5_000 })
    await nhanViecBtn.click()

    // Inline form header visible
    await expect(page.locator('text=Nhận việc — chọn người phối hợp')).toBeVisible({ timeout: 5_000 })

    // Submit inline form (step 1)
    const formSubmitBtn = page.getByRole('button', { name: 'Xác nhận nhận việc' })
    await expect(formSubmitBtn).toBeVisible({ timeout: 3_000 })
    await formSubmitBtn.click()

    // handleTransition calls confirm() → confirm dialog appears (step 2)
    const dialogConfirmBtn = page.getByRole('button', { name: 'Xác nhận', exact: true })
    await expect(dialogConfirmBtn).toBeVisible({ timeout: 5_000 })
    await dialogConfirmBtn.click()

    // Status becomes "Đang xử lý"
    await expectPreviewStatus(page, 'Đang xử lý')
  })

  // -----------------------------------------------------------------------
  // 3. Hoàn thành: nhận việc first → then hoanThanh → confirm → Hoàn thành
  // -----------------------------------------------------------------------
  test('3. Hoàn thành on Đang xử lý doc → status changes to Hoàn thành', async ({ page }) => {
    await waitForApp(page)

    // Bring doc 1 to "Đang xử lý" via nhanViec
    await openPreview(page, 'Hợp đồng mua sắm CNTT')

    const nhanViecBtn = page.locator('[data-testid="action-nhanViec"]')
    await expect(nhanViecBtn).toBeVisible({ timeout: 5_000 })
    await nhanViecBtn.click()

    const nhanViecConfirmBtn = page.getByRole('button', { name: 'Xác nhận nhận việc' })
    await expect(nhanViecConfirmBtn).toBeVisible({ timeout: 5_000 })
    await nhanViecConfirmBtn.click()

    // submitGiaoViec → handleTransition → confirm dialog
    const confirmDialogBtn = page.getByRole('button', { name: 'Xác nhận', exact: true })
    await expect(confirmDialogBtn).toBeVisible({ timeout: 5_000 })
    await confirmDialogBtn.click()

    await expectPreviewStatus(page, 'Đang xử lý')

    // Now do Hoàn thành
    const hoanThanhBtn = page.locator('[data-testid="action-hoanThanh"]')
    await expect(hoanThanhBtn).toBeVisible({ timeout: 5_000 })
    await hoanThanhBtn.click()

    // Confirm dialog
    const dialogConfirmBtn = page.getByRole('button', { name: 'Xác nhận', exact: true })
    await expect(dialogConfirmBtn).toBeVisible({ timeout: 5_000 })
    await dialogConfirmBtn.click()

    await expectPreviewStatus(page, 'Hoàn thành')
  })

  // -----------------------------------------------------------------------
  // 4. Người phối hợp field visible in document preview
  // -----------------------------------------------------------------------
  test('4. Người phối hợp field is visible in document preview', async ({ page }) => {
    await waitForApp(page)

    // Doc ID 1 has Người phối hợp: ["editor1"]
    await openPreview(page, 'Hợp đồng mua sắm CNTT')

    // The sidebar shows a "Người phối hợp" label
    await expect(page.locator('p.text-xs:has-text("Người phối hợp")')).toBeVisible({ timeout: 5_000 })
  })

  // -----------------------------------------------------------------------
  // 5. Thu hồi: Chờ xử lý → Thu hồi → confirm → Chờ duyệt
  // -----------------------------------------------------------------------
  test('5. Thu hồi on Chờ xử lý doc → status reverts to Chờ duyệt', async ({ page }) => {
    await waitForApp(page)

    await openPreview(page, 'Hợp đồng mua sắm CNTT')

    const thuHoiBtn = page.locator('[data-testid="action-thuHoi"]')
    await expect(thuHoiBtn).toBeVisible({ timeout: 5_000 })
    await thuHoiBtn.click()

    const confirmBtn = page.getByRole('button', { name: 'Xác nhận', exact: true })
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    await expectPreviewStatus(page, 'Chờ duyệt')
  })

  // -----------------------------------------------------------------------
  // 6-pre. GĐ duyệt — skipped: requires a GĐ-role session not available in dev mock.
  // The dev gasClient returns role="admin" which maps to ADMIN_ACTIONS (giaoViec, not duyệt).
  // The "Giám đốc" role only maps to giaoViec + thuHoi via GIAM_DOC_ACTIONS — no duyệt/luuTaiLieu.
  // WorkflowButtons has no action-duyệt button for any currently-mocked session.
  // -----------------------------------------------------------------------
  test.skip('GĐ duyệt approval not testable in dev mock — requires real GĐ role session', () => {
    // Cannot test because the dev gasClient mock always returns session.role = 'admin'.
    // Admin sees ADMIN_ACTIONS: giaoViec (Chờ duyệt), thuHoi+nhanViec (Chờ xử lý), hoanThanh (Đang xử lý).
    // There is no 'duyệt' or 'luuTaiLieu' key in ADMIN_ACTIONS or GIAM_DOC_ACTIONS.
    // To enable: add a mock session with role='Giám đốc' and extend GIAM_DOC_ACTIONS
    // to include a 'duyệt' action, then seed a 'Chờ duyệt' doc in their phụ trách list.
  })

  // -----------------------------------------------------------------------
  // 6. Publish: admin + Hoàn thành doc → Phát hành → dialog → select user → confirm
  // "Công văn số 01/2024" is seeded as Hoàn thành.
  // The publish action button is rounded-2xl (distinguishes from history badge rounded-full)
  // -----------------------------------------------------------------------
  test('6. Publish Hoàn thành doc → select recipient → confirm publish', async ({ page }) => {
    await waitForApp(page)

    await openPreview(page, 'Công văn số 01/2024')

    // "Phát hành" action button — bg-amber-600 rounded-2xl
    const publishSidebarBtn = page.locator('button.rounded-2xl:has-text("Phát hành")')
    await expect(publishSidebarBtn).toBeVisible({ timeout: 5_000 })
    await publishSidebarBtn.click()

    // PublishDialog opens
    await expect(page.locator('text=Phát hành hồ sơ')).toBeVisible({ timeout: 5_000 })

    // Select first recipient — click a user <label> in the "Người nhận" column
    // Labels contain user names; each wraps an input[type="checkbox"]
    const firstUserLabel = page.locator('label.cursor-pointer').first()
    await firstUserLabel.waitFor({ timeout: 5_000 })
    await firstUserLabel.click()

    // Footer count updates to "Đã chọn 1 người"
    await expect(page.locator('text=Đã chọn 1 người')).toBeVisible({ timeout: 3_000 })

    // Click "Phát hành" submit in dialog footer — scoped to the PublishDialog (z-[60] overlay)
    // The button text is "Phát hành" (or "Đang xử lý…" when loading); use role+name selector.
    const publishDialog = page.locator('div.fixed.inset-0').last()
    const dialogSubmitBtn = publishDialog.getByRole('button', { name: /phát hành/i })
    await expect(dialogSubmitBtn).toBeVisible({ timeout: 3_000 })
    await dialogSubmitBtn.click()

    // Dialog closes after successful publish
    await expect(page.locator('text=Phát hành hồ sơ')).not.toBeVisible({ timeout: 8_000 })
  })

})

test.describe('Comments', () => {

  // -----------------------------------------------------------------------
  // 7. Post comment → appears in comment list
  // Admin is in COMMENT_ROLES so comment form is always visible
  // -----------------------------------------------------------------------
  test('7. Post comment → appears in comment list', async ({ page }) => {
    await waitForApp(page)

    await openPreview(page, 'Hợp đồng mua sắm CNTT')

    // Comments section header: <p>Bình luận (N)</p>
    await expect(page.locator('p:has-text("Bình luận")')).toBeVisible({ timeout: 5_000 })

    const commentInput = page.getByPlaceholder('Nhập bình luận...')
    await expect(commentInput).toBeVisible({ timeout: 5_000 })

    const commentText = 'E2E test comment ' + Date.now()
    await commentInput.fill(commentText)

    // Submit via form's submit button (button[type="submit"] inside the form)
    const sendBtn = page.locator('form').filter({ has: commentInput }).locator('button[type="submit"]')
    await sendBtn.click()

    // Comment appears in list
    await expect(page.locator(`text=${commentText}`)).toBeVisible({ timeout: 8_000 })
  })

  // -----------------------------------------------------------------------
  // 8. Comments persist after closing and reopening the preview panel
  // _mockComments is a module-level array in gasClient.js (not tab-shared),
  // but it persists within the same page session across preview open/close.
  // -----------------------------------------------------------------------
  test('8. Comments persist after closing and reopening the preview panel', async ({ page }) => {
    await waitForApp(page)

    await openPreview(page, 'Hợp đồng mua sắm CNTT')
    await expect(page.locator('p:has-text("Bình luận")')).toBeVisible({ timeout: 5_000 })

    const commentInput = page.getByPlaceholder('Nhập bình luận...')
    await expect(commentInput).toBeVisible({ timeout: 5_000 })

    const commentText = 'Persistent comment ' + Date.now()
    await commentInput.fill(commentText)
    const sendBtn = page.locator('form').filter({ has: commentInput }).locator('button[type="submit"]')
    await sendBtn.click()
    await expect(page.locator(`text=${commentText}`)).toBeVisible({ timeout: 8_000 })

    // Close preview — the DocumentPreview header has a close <button> that contains an Icon
    // with name="close". The Icon renders a <span class="material-symbols-outlined">close</span>
    // We can click the backdrop (the fixed inset-0 div) to trigger onClose.
    // The content div stops propagation, so we need to click outside the white card.
    // Simpler: click at (10, 10) which is the backdrop area outside the centered card.
    await page.locator('div.fixed.inset-0.bg-black\\/50').click({ position: { x: 10, y: 10 }, force: true })
    await expect(page.locator(`h3:has-text("Hợp đồng mua sắm CNTT")`)).not.toBeVisible({ timeout: 5_000 })

    // Reopen preview — comment should still be present
    await openPreview(page, 'Hợp đồng mua sắm CNTT')
    await expect(page.locator('p:has-text("Bình luận")')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator(`text=${commentText}`)).toBeVisible({ timeout: 8_000 })
  })

})
