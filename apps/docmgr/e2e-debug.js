const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const SSO_URL = 'https://script.google.com/macros/s/AKfycbxcCjEaa8ZXeFH0-8M8q5ZS5nYwcauQgzDs_nO5Gx_mokdSkIb8n_867PxSwgPBteQmNQ/exec';

  async function waitForFrameWithText(text, timeout = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      for (const frame of page.frames()) {
        try {
          if (await frame.locator(`text="${text}"`).first().isVisible({ timeout: 200 })) {
            return frame;
          }
        } catch(e) {}
      }
      await page.waitForTimeout(500);
    }
    throw new Error(`Timeout waiting for frame with text: ${text}`);
  }

  try {
    console.log(`Đang đăng nhập...`);
    await page.goto(SSO_URL);
    const ssoFrame = await waitForFrameWithText("Đăng nhập để tiếp tục");
    await page.waitForTimeout(2000);
    
    await ssoFrame.locator('input[type="email"]').fill('vanthu@gmail.com');
    await ssoFrame.locator('input[type="password"]').fill('Admin@123');
    await ssoFrame.locator('button', { hasText: /Đăng nhập/i }).click();

    await waitForFrameWithText("Ứng dụng", 15000);
    console.log(`Đăng nhập thành công! Đang mở ứng dụng Quản lý...`);
    await page.waitForTimeout(2000);
    
    const appCard = ssoFrame.locator('button').filter({ hasText: /Quản lý Tài liệu/i });
    await appCard.waitFor({ state: 'visible' });
    await appCard.click();

    const docMgrFrame = await waitForFrameWithText("Thêm hồ sơ", 30000);
    console.log("Mở modal Thêm hồ sơ...");
    await docMgrFrame.locator('button', { hasText: /Thêm hồ sơ/i }).click();
    await page.waitForTimeout(2000);
    
    console.log("Đang dump HTML của modal...");
    const html = await docMgrFrame.content();
    fs.writeFileSync('docmgr-modal-dump.html', html);
    console.log("Đã lưu vào docmgr-modal-dump.html");

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
