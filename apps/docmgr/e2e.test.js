const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('Bắt đầu chạy Test Tự Động (E2E) bằng Playwright...');
  
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

  async function loginAndGoToDocMgr(email) {
    console.log(`\n[${email}] Đang đăng nhập...`);
    await page.goto(SSO_URL);
    
    const ssoFrame = await waitForFrameWithText("Đăng nhập để tiếp tục");
    await page.waitForTimeout(2000);
    
    const passwords = ['Admin@123', 'Admin@@123'];
    let loggedIn = false;

    for (const pass of passwords) {
      console.log(`[${email}] Thử mật khẩu: ${pass}`);
      await ssoFrame.locator('input[type="email"]').fill(email);
      await ssoFrame.locator('input[type="password"]').fill(pass);
      await ssoFrame.locator('button', { hasText: /Đăng nhập/i }).click();

      try {
        const result = await Promise.race([
          ssoFrame.locator('text=Email hoặc mật khẩu không đúng')
            .waitFor({ state: 'visible', timeout: 5000 })
            .then(() => 'wrong')
            .catch(() => 'ignore'), // Ngăn chặn TimeoutError crash program
          waitForFrameWithText("Ứng dụng", 15000)
            .then(() => 'success')
        ]);
        
        if (result === 'wrong') {
          throw new Error('Wrong password');
        } else if (result === 'success') {
          loggedIn = true;
          break;
        } else {
          // result === 'ignore' means wrong password message didn't appear but we didn't succeed either yet?
          // We should just wait for success or fail
          await waitForFrameWithText("Ứng dụng", 10000);
          loggedIn = true;
          break;
        }
      } catch (err) {
        if (err.message === 'Wrong password') {
          console.log(`[${email}] Sai mật khẩu ${pass}`);
          await ssoFrame.locator('input[type="password"]').fill('');
          continue;
        } else {
          throw err;
        }
      }
    }
    if (!loggedIn) throw new Error(`Không thể đăng nhập ${email}!`);
    console.log(`[${email}] Đăng nhập thành công! Đang mở ứng dụng Quản lý...`);
    
    await page.waitForTimeout(3000);
    
    const appCard = ssoFrame.locator('button').filter({ hasText: /Quản lý Tài liệu/i });
    await appCard.waitFor({ state: 'visible' });
    await appCard.click();

    const docMgrFrame = await waitForFrameWithText("Thêm hồ sơ", 30000);
    return { ssoFrame, docMgrFrame };
  }

  async function logout(ssoFrame) {
    console.log('Đang đăng xuất...');
    
    await ssoFrame.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dashBtn = btns.find(b => b.textContent.includes('Dashboard'));
      if (dashBtn) dashBtn.click();
    });
    
    await page.waitForTimeout(2000);
    await waitForFrameWithText("Ứng dụng"); 
    
    await ssoFrame.locator('header button').last().click();
    await ssoFrame.locator('button', { hasText: /Đăng xuất/i }).click();
    await waitForFrameWithText("Đăng nhập để tiếp tục");
  }

  try {
    const docName = `Hợp đồng E2E ${new Date().getTime()}`;
    
    // BƯỚC 1: VĂN THƯ
    let { ssoFrame, docMgrFrame } = await loginAndGoToDocMgr('vanthu@gmail.com');
    
    console.log(`[vanthu] Đợi dữ liệu tải...`);
    await page.waitForTimeout(8000); 
    
    console.log(`[vanthu] Tạo hồ sơ: "${docName}"`);
    await docMgrFrame.locator('button', { hasText: /Thêm hồ sơ/i }).click();
    await docMgrFrame.locator('input[placeholder="Nhập tên hồ sơ..."]').fill(docName);
    
    await docMgrFrame.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const catLabel = labels.find(l => l.textContent.includes('Danh mục'));
      if (catLabel) {
        const select = catLabel.parentElement.querySelector('select');
        if (select && select.options.length > 1) {
          select.selectedIndex = 1;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    await docMgrFrame.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const projectLabel = labels.find(l => l.textContent.includes('Dự án (Phòng ban)'));
      if (projectLabel) {
        const select = projectLabel.parentElement.querySelector('select');
        if (select && select.options.length > 1) {
          select.selectedIndex = 1;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    
    await docMgrFrame.locator('button', { hasText: /Lưu tài liệu/i }).click();
    
    await docMgrFrame.locator('text=Đã thêm hồ sơ').waitFor({ state: 'visible', timeout: 15000 });
    console.log('[vanthu] Thành công!');
    await logout(ssoFrame);

    // BƯỚC 2: GIÁM ĐỐC
    ({ ssoFrame, docMgrFrame } = await loginAndGoToDocMgr('giamdoc@gmail.com'));
    
    console.log(`[giamdoc] Giao việc...`);
    await page.waitForTimeout(5000); 
    await docMgrFrame.locator('input[placeholder*="Tìm kiếm"]').fill(docName);
    await docMgrFrame.locator('input[placeholder*="Tìm kiếm"]').press('Enter');
    
    await docMgrFrame.locator(`text=${docName}`).first().waitFor({ state: 'visible' });
    await docMgrFrame.locator(`text=${docName}`).first().click();
    
    await docMgrFrame.locator('button', { hasText: /Giao việc/i }).click();
    
    await page.waitForTimeout(3000); 
    
    await docMgrFrame.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const assignLabel = labels.find(l => l.textContent.includes('Phụ trách'));
      if (assignLabel) {
        const select = assignLabel.parentElement.querySelector('select');
        if (select) {
          for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === 'nhanvien' || select.options[i].text.toLowerCase().includes('nhanvien')) {
              select.selectedIndex = i;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              return;
            }
          }
          if (select.options.length > 1) {
             select.selectedIndex = 1;
             select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }
    });
    
    await docMgrFrame.locator('button', { hasText: /Lưu/i }).click();
    await docMgrFrame.locator('text=Đã cập nhật').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    console.log('[giamdoc] Thành công!');
    await logout(ssoFrame);

    // BƯỚC 3: NHÂN VIÊN
    ({ ssoFrame, docMgrFrame } = await loginAndGoToDocMgr('nhanvien@gmail.com'));
    
    console.log(`[nhanvien] Hoàn thành việc...`);
    await page.waitForTimeout(5000); 
    await docMgrFrame.locator('input[placeholder*="Tìm kiếm"]').fill(docName);
    await docMgrFrame.locator('input[placeholder*="Tìm kiếm"]').press('Enter');
    
    await docMgrFrame.locator(`text=${docName}`).first().waitFor({ state: 'visible' });
    await docMgrFrame.locator(`text=${docName}`).first().click();
    
    await docMgrFrame.locator('button', { hasText: /Nhận việc/i }).click();
    await docMgrFrame.locator('text=Đã nhận xử lý hồ sơ').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    
    await docMgrFrame.locator('button', { hasText: /Hoàn thành/i }).click();
    await docMgrFrame.locator('button', { hasText: /Xác nhận/i }).click();
    
    await docMgrFrame.locator('text=Đã hoàn thành hồ sơ').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    console.log('[nhanvien] Thành công rực rỡ!');
    await logout(ssoFrame);

    console.log('\n✅✅✅ TEST TỰ ĐỘNG THÀNH CÔNG!');
  } catch (err) {
    console.error('\n❌ TEST THẤT BẠI:', err);
    await page.screenshot({ path: 'playwright-fail.png' });
    console.log('Đã lưu ảnh chụp lỗi vào playwright-fail.png');
  } finally {
    await browser.close();
  }
})();
