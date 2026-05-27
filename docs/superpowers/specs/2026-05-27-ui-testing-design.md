# UI Testing Design — SSO Portal + DocMgr

**Date:** 2026-05-27
**Scope:** SSO Portal → DocMgr (in that order)
**Approach:** Hybrid — RTL (component logic) + Playwright (critical E2E flows)

---

## 1. Strategy

| Layer | Tool | Environment | Purpose |
|---|---|---|---|
| Component | React Testing Library + jsdom | Jest | Logic, rendering, conditional display, form validation |
| E2E | Playwright | Real browser + Vite dev server | Critical user flows, multi-device/tab, responsive |

**Mock strategy (RTL):** `gasClient.js` exports a single `gasCall` function. Tests mock the entire module with `jest.mock()` and stub per-test with `gasCall.mockResolvedValue(data)` or `gasCall.mockRejectedValue(error)`. No `google.script.run` setup needed — `IS_GAS` is `false` in jsdom automatically.

**Mock strategy (Playwright):** Vite dev server (`localhost:5174`, `localhost:5173`) uses `mockCall()` in `gasClient.js` automatically (no GAS context). Specific behaviors (call counts, error injection) use `page.route()` to intercept API responses.

**Responsive:** Playwright config runs all specs on two projects: `desktop` (1280×800) and `mobile` (`devices['Pixel 5']`, 393×851 touch). RTL does not test CSS.

---

## 2. File Structure

```
apps/sso-portal/
  jest.config.js                        ← add client project (jsdom + babel-jest)
  playwright.config.js                  ← NEW: desktop + mobile projects
  src/client/__tests__/
    setup.js                            ← @testing-library/jest-dom, gasCall mock helper
    helpers/
      render.jsx                        ← custom render wrapping Context providers
    LoginPage.test.jsx
    ChangePasswordModal.test.jsx
    Dashboard.test.jsx
    UserManager.test.jsx
    OrgStructure.test.jsx
    AppManager.test.jsx
    AuditLog.test.jsx
    Settings.test.jsx
  e2e/
    login.spec.js
    forced-password.spec.js
    session.spec.js
    sync-cache.spec.js
    users.spec.js
    responsive.spec.js

apps/docmgr/
  playwright.config.js                  ← NEW: desktop + mobile projects
  src/client/__tests__/
    setup.js                            ← bổ sung @testing-library/jest-dom
    helpers/
      render.jsx
    DocumentModal.test.jsx
    DocumentPreview.test.jsx
    PublishDialog.test.jsx
    Documents.test.jsx
    Categories.test.jsx
    UserManager.test.jsx
    Settings.test.jsx
    AuditLog.test.jsx
    # WorkflowButtons.test.jsx          ← đã có, không viết lại
  e2e/
    auth.spec.js
    sync-cache.spec.js
    documents.spec.js
    workflow.spec.js
    responsive.spec.js
```

**Dependencies to install:**
- `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` — vào SSO Portal (DocMgr có thể đã có)
- `@playwright/test` — root devDependency
- `babel-jest` + `@babel/preset-react` — nếu chưa có ở SSO Portal jest config

---

## 3. SSO Portal — RTL Tests

### 3.1 LoginPage (`LoginPage.test.jsx`) — Full behavior
- Email field required → submit without email → validation error
- Password field required → submit without password → validation error
- Wrong credentials → `gasCall` rejects → error message "không đúng" hiển thị
- Locked account → error message "bị khóa" hiển thị
- `mustChangePass=true` trong response → `ChangePasswordModal` render (không đến dashboard)
- Successful login as regular user → dashboard render, role = 'user'
- Successful login as admin → dashboard render, role = 'admin'

### 3.2 ChangePasswordModal (`ChangePasswordModal.test.jsx`) — Full behavior
- Render khi `forced=true`: không có nút close, backdrop click không đóng
- Old password wrong → error "không đúng"
- New password == old password → error "khác"
- New password quá ngắn / vi phạm policy → error
- Success → modal unmount, `mustChangePass` flag cleared trong session

### 3.3 Dashboard (`Dashboard.test.jsx`) — Happy path + role matrix
- **Role matrix** (render as each role, assert tab visible/hidden):
  | Tab | Owner | Admin | User |
  |---|---|---|---|
  | Ứng dụng | ✓ | ✓ | ✓ |
  | Người dùng | ✓ | ✓ | ✗ |
  | Bộ máy | ✓ | ✓ | ✗ |
  | Quản lý App | ✓ | ✓ | ✗ |
  | Nhật ký | ✓ | ✓ | ✗ |
  | Cài đặt | ✓ | ✓ | ✗ |
- Tab switching → đúng component render
- **Apps tab — token injection**: click app card → iframe `src` chứa `?token=<accessToken>&parent=<parentSheetId>`. Assert URL params có mặt và không rỗng.

### 3.4 UserManager (`UserManager.test.jsx`) — Full behavior
- Danh sách user render đúng (tên, email, trạng thái)
- Role badges + kiêm nhiệm display theo role priority
- Add user form: required fields, validation, success → user xuất hiện trong list
- Lock user: confirmation dialog → confirm → toast success → status "Locked"
- Unlock user: confirmation → success → status "Active"
- Bulk reset password: select multiple → button available → confirm → success

### 3.5 OrgStructure (`OrgStructure.test.jsx`) — Happy path
- Dept groups render đúng tên phòng ban theo thứ tự (Ban Giám Đốc → Văn thư & Quản trị → Phòng ban → Chưa phân phòng)
- User xuất hiện đúng group
- Kiêm nhiệm label "kiêm" hiển thị cho user có nhiều dept
- User kiêm nhiệm xuất hiện ở nhiều groups

### 3.6 AppManager (`AppManager.test.jsx`) — Happy path + admin guard
- App list render (tên, icon, URL, trạng thái)
- Admin: thấy nút Thêm, Sửa, Xóa
- Add form: required URL, required tên, success
- Delete: confirmation → success

### 3.7 AuditLog (`AuditLog.test.jsx`) — Happy path
- Table render với mock logs (thời gian, người dùng, hành động)
- Filter by type → list lọc đúng
- Keyword search → kết quả đúng

### 3.8 Settings (`Settings.test.jsx`) — Happy path
- Mail config form render (MAIL_ENABLED toggle, SMTP fields)
- Save → `gasCall('api_saveMailConfig')` được gọi

---

## 4. SSO Portal — Playwright E2E

**Playwright config (`playwright.config.js`):**
```js
projects: [
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  { name: 'mobile',  use: { ...devices['Pixel 5'] } },
]
baseURL: 'http://localhost:5174'
```

### 4.1 `login.spec.js`
- Happy path: email + password → dashboard, tên user hiển thị
- Wrong password: error message visible
- Lockout: 5 lần sai liên tiếp → message "bị khóa"
- Logout: click logout → redirect về LoginPage, localStorage cleared

### 4.2 `forced-password.spec.js`
- Login user có `mustChangePass=true` → ChangePasswordModal xuất hiện ngay
- Backdrop click → modal không đóng
- Không có nút X
- Đổi password thành công → vào dashboard, modal đóng

### 4.3 `session.spec.js`
- **Multi-device desktop+mobile**: login desktop → token D valid. Login mobile → token M valid. Cả hai `requireAuth` pass. Login lại desktop → token D revoked, token D2 valid, token M vẫn valid.
- **Multi-tab logout**: 2 tab mở SSO. Tab 1 logout → tab 2 gọi API tiếp theo → nhận `auth:sessionExpired` event → redirect về login.
- **Child app token reuse**: mở SSO tab 1 (click DocMgr → iframe load với token T1). Mở SSO tab 2 → token cha còn hạn → click DocMgr lại → KHÔNG mint token mới (intercept `api_getSsoParams` / `mintAccessToken` call count, assert = 0 thêm calls).
- **Parent logout → child expires**: SSO logout → DocMgr tab background sync call tiếp theo nhận lỗi token → dùng `page.clock.fastForward(61_000)` trigger polling 60s → DocMgr hiển thị "phiên hết hạn".

### 4.4 `sync-cache.spec.js`
- Sau login: `localStorage.sso_access_token` có giá trị, `sso_refresh_token` có giá trị
- `api_portalSync` được gọi mỗi 60s — dùng `page.clock.fastForward(61_000)` để trigger mà không chờ thật, intercept + assert called
- Simulate token expired (manipulate localStorage) → client gọi `api_resume` → token mới lưu
- Logout → `localStorage` cleared (access + refresh + user key)

### 4.5 `users.spec.js`
- Admin mở tab Người dùng → danh sách render
- Lock một user → toast success → user hiển thị trạng thái "Locked"

### 4.6 `responsive.spec.js` (chạy trên `mobile` project)
- LoginPage: form không overflow, button full-width
- Dashboard tabs: scroll ngang hoặc wrap, không bị hidden
- UserManager: table scroll ngang hoặc card layout
- ChangePasswordModal: không bị clip, input usable
- App cards: grid collapse về 1-2 cột

---

## 5. DocMgr — RTL Tests

**Auth trong RTL:** Render components với mock session context. Không test `api_ssoLogin` flow ở RTL.

### 5.1 Documents (`Documents.test.jsx`) — Happy path + role
- Table render với grouped documents
- WorkflowButtons render theo role + status (extend từ WorkflowButtons.test.jsx logic, không duplicate)
- Search: input keyword → list lọc
- Filter by status/category

### 5.2 DocumentModal (`DocumentModal.test.jsx`) — Full behavior
- Form fields render (tiêu đề, danh mục, nhà cung cấp, dự án, nội dung)
- Submit không có tiêu đề → validation error
- Submit hợp lệ → `gasCall` được gọi với đúng payload → success toast

### 5.3 DocumentPreview (`DocumentPreview.test.jsx`) — Full behavior
- Document details hiển thị (tên, ngày, trạng thái, người tạo)
- Workflow buttons theo role + status (Văn thư, GĐ, Phụ trách)
- Publish button: visible cho role có quyền, hidden cho role không có
- Comment box render, submit comment → comment xuất hiện trong list
- File links render và clickable

### 5.4 PublishDialog (`PublishDialog.test.jsx`) — Full behavior
- UserPickerDropdown grouped by dept render
- Submit không chọn người nhận → validation error
- Submit hợp lệ → `gasCall` gọi với recipient list

### 5.5 Categories / Groups / Suppliers / Projects — Happy path
- Table/tree render với mock data
- Add form render, required validation, success

### 5.6 UserManager (`UserManager.test.jsx`) — Full behavior
- Danh sách user với role + canPublish flag
- Toggle canPublish → `gasCall` được gọi
- Permission assignment

### 5.7 Settings (`Settings.test.jsx`) — Happy path
- Form render, save gọi đúng API

### 5.8 AuditLog (`AuditLog.test.jsx`) — Happy path
- Table render, filter by action type

---

## 6. DocMgr — Playwright E2E

**Playwright config:** Giống SSO Portal (desktop + mobile projects).
**baseURL:** `http://localhost:5173`
**Auth setup fixture:** inject mock access token vào `localStorage` trước mỗi test (bypass SSO flow), trừ `auth.spec.js`.

### 6.1 `auth.spec.js`
- Token hợp lệ trong URL → DocMgr authenticate thành công
- Token sai → error page hoặc redirect
- Token hết hạn → error
- User bị lock → error message
- **Token reuse**: mở DocMgr tab 2 khi token cha còn hạn → `api_ssoLogin` gọi đúng 0 lần thêm (token cũ còn hạn, không mint mới)
- **Parent logout → child expires**: SSO logout → `page.clock.fastForward(61_000)` trigger DocMgr background sync → nhận lỗi token → "phiên hết hạn" hiển thị

### 6.2 `sync-cache.spec.js`
- Background sync gọi mỗi 60s — dùng `page.clock.fastForward(61_000)` + intercept `api_getDocs` hoặc equivalent
- `localStorage` có token sau auth
- Logout → localStorage cleared

### 6.3 `documents.spec.js`
- Tạo document mới → xuất hiện trong list
- Search + filter hoạt động
- Batch select + bulk action

### 6.4 `workflow.spec.js` — Full document lifecycle
1. Login as Văn thư → tạo document → assign người phụ trách → nộp → status "Chờ duyệt"
2. Login as GĐ → phê duyệt → status "Đã duyệt"
3. Login as người phụ trách → nhận việc → document xuất hiện trong "Công việc của tôi"
4. Thêm người phối hợp → người phối hợp thấy document trong danh sách của mình
5. GĐ publish → chọn người nhận → success → publish history ghi nhận
6. **Comments**: mở DocumentPreview → post comment → comment hiển thị → user khác (login lại) thấy cùng comment

### 6.5 `responsive.spec.js` (mobile project)
- Sidebar collapse → hamburger button visible
- DocumentModal không bị clip, scroll được
- Comment box usable trên mobile
- Workflow buttons không bị hidden
- Table scroll ngang

---

## 7. Test Depth Summary

| App | Screen | RTL | Playwright |
|---|---|---|---|
| SSO | LoginPage | Full | login.spec |
| SSO | ChangePasswordModal | Full | forced-password.spec |
| SSO | Dashboard (tabs + role matrix) | Full | — |
| SSO | Apps tab (token injection) | Full | session.spec |
| SSO | UserManager | Full | users.spec |
| SSO | OrgStructure | Happy path | — |
| SSO | AppManager | Happy path | — |
| SSO | AuditLog | Happy path | — |
| SSO | Settings | Happy path | — |
| SSO | Session flows | — | session.spec |
| SSO | Sync + cache | — | sync-cache.spec |
| SSO | Responsive | — | responsive.spec |
| DocMgr | Documents | Happy path | documents.spec |
| DocMgr | DocumentModal | Full | — |
| DocMgr | DocumentPreview + comments | Full | workflow.spec |
| DocMgr | PublishDialog | Full | workflow.spec |
| DocMgr | Categories/Groups/Suppliers/Projects | Happy path | — |
| DocMgr | UserManager | Full | — |
| DocMgr | Settings | Happy path | — |
| DocMgr | AuditLog | Happy path | — |
| DocMgr | Auth + token flows | — | auth.spec |
| DocMgr | Sync + cache | — | sync-cache.spec |
| DocMgr | Workflow lifecycle | — | workflow.spec |
| DocMgr | Responsive | — | responsive.spec |
