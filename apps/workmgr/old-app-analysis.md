# Phân Tích App Quản Lý Dự Án (Old WorkMgr)

> **Nguồn:** `apps/workmgr/old/` — 21 files (10 `.gs` server + 11 `.html` client)
> **Tên sản phẩm:** Quản Lý Dự Án — Sheetkhoinghiep.com (Phiên bản 5.1)
> **Nền tảng:** Google Apps Script (container-bound to Google Sheet)
> **Frontend:** Vue 3 (CDN) + Chart.js 4 + Material Icons + Be Vietnam Pro font

---

## 1. Kiến Trúc Tổng Quan

```
┌──────────────────────────────────────────────┐
│              Google Sheets (DB)              │
│  9 sheets: Cài Đặt, Phòng Ban, Thành Viên,  │
│  Dự Án, Công Việc, Bình Luận, Hoạt Động,    │
│  Thông Báo, Nhãn                             │
└──────────────┬───────────────────────────────┘
               │ SpreadsheetApp API
┌──────────────┴───────────────────────────────┐
│           GAS Server (.gs files)             │
│  Code.gs → SetupService → AuthService →      │
│  ProjectService → TaskService →              │
│  MemberService → CommentService →            │
│  DashboardService → NotifyService            │
│  SampleData.gs (50 rows/sheet generator)     │
└──────────────┬───────────────────────────────┘
               │ google.script.run (RPC)
┌──────────────┴───────────────────────────────┐
│           Client (HTML/Vue 3)                │
│  Index.html (shell + login + layout)         │
│  AppScript.html (Vue app logic ~556 lines)   │
│  Stylesheet.html (~45KB CSS)                 │
│  7 view components (HTML templates)          │
└──────────────────────────────────────────────┘
```

**Đặc điểm:**
- App GAS standalone (không dùng gas-core, không SSO, không license)
- Toàn bộ HTML templating dùng `<?!= include('...') ?>` (GAS scriptlets)
- Auth bằng username/password (plaintext trong sheet), session lưu `localStorage`
- Không có build pipeline — deploy trực tiếp qua clasp

---

## 2. Data Model (Google Sheets Schema)

### 2.1 Sheet `Cài Đặt` (Key-Value)
| Khóa | Giá Trị (mẫu) |
|---|---|
| Tên công ty | Công Ty Phần Mềm Thành Đạt |
| Email công ty | info@thanhdat.vn |
| Số điện thoại | 028 3825 6789 |
| Địa chỉ | 123 Nguyễn Huệ, Q1, HCM |
| Website | https://thanhdat.vn |
| admin_username | admin |
| admin_password | admin123 |
| Số ngày phép tối đa | 12 |
| Giờ làm việc | 08:00 - 17:30 |

### 2.2 Sheet `Phòng Ban`
| Cột | Mô tả |
|---|---|
| Mã PB | ID prefix `PB` (PB001, PB002...) |
| Tên Phòng Ban | Tên phòng ban |
| Mô Tả | Mô tả chức năng |
| Trưởng Phòng | Tên người (text) |
| Mã Trưởng Phòng | FK → Thành Viên.Mã TV |
| Ngày Tạo | Date |

### 2.3 Sheet `Thành Viên` (50 rows mẫu)
| Cột | Mô tả |
|---|---|
| Mã TV | ID prefix `TV` (TV001..TV050) |
| Họ và Tên | Fullname |
| Email | Email |
| Số Điện Thoại | Phone |
| Chức Vụ | Giám Đốc / Trưởng Phòng / Phó Phòng / Nhân Viên |
| Phòng Ban | FK text → Phòng Ban.Tên |
| Vai Trò | `Chủ Doanh Nghiệp` / `Leader` / `Thành Viên` |
| Tên Đăng Nhập | Username (unique) |
| Mật Khẩu | Plaintext password (mặc định: 123456) |
| Trạng Thái | `Hoạt Động` / `Vô Hiệu` |
| Ảnh Đại Diện | URL (optional) |
| Ngày Tham Gia | Date |
| Ghi Chú | Text |

### 2.4 Sheet `Dự Án` (15 rows mẫu)
| Cột | Mô tả |
|---|---|
| Mã DA | ID prefix `DA` |
| Tên Dự Án | Tên |
| Mô Tả | Description |
| Trạng Thái | `Lên Kế Hoạch` / `Đang Thực Hiện` / `Hoàn Thành` / `Tạm Dừng` / `Đã Hủy` |
| Mức Độ Ưu Tiên | `Cao` / `Trung Bình` / `Thấp` |
| Ngân Sách | Number (VNĐ) |
| Chi Phí Thực Tế | Number (VNĐ) |
| Ngày Bắt Đầu | Date |
| Ngày Kết Thúc Dự Kiến | Date |
| Ngày Hoàn Thành | Date (thực tế) |
| Leader | Tên người (text) |
| Mã Leader | FK → Thành Viên.Mã TV |
| Thành Viên Tham Gia | CSV of Mã TV (e.g. "TV002,TV005,TV011") |
| Tiến Độ | 0-100 (%) |
| Ngày Tạo | Date |
| Người Tạo | Mã TV |
| Ghi Chú | Text |

### 2.5 Sheet `Công Việc` (50 rows mẫu)
| Cột | Mô tả |
|---|---|
| Mã CV | ID prefix `CV` |
| Tiêu Đề | Task title |
| Mô Tả | Description |
| Mã Dự Án | FK → Dự Án.Mã DA |
| Tên Dự Án | Denormalized |
| Người Thực Hiện | Tên (denormalized) |
| Mã Người Thực Hiện | FK → Thành Viên.Mã TV |
| Người Giao | Tên (denormalized) |
| Mã Người Giao | FK → Thành Viên.Mã TV |
| Trạng Thái | `Cần Làm` / `Đang Thực Hiện` / `Đang Xem Xét` / `Hoàn Thành` |
| Mức Độ Ưu Tiên | `Cao` / `Trung Bình` / `Thấp` |
| Ngày Bắt Đầu | Date |
| Ngày Hết Hạn | Date |
| Ngày Hoàn Thành | Date (auto-fill khi status = Hoàn Thành) |
| Chi Phí Ước Tính | Number (VNĐ) |
| Chi Phí Thực Tế | Number (VNĐ) |
| Nhãn | CSV tags (e.g. "Backend,API") |
| Tiến Độ | 0-100 (%) |
| Ngày Tạo | Date |
| Ghi Chú | Text |

### 2.6 Sheet `Bình Luận` (50 rows mẫu)
| Cột | Mô tả |
|---|---|
| Mã BL | ID prefix `BL` |
| Mã Công Việc | FK → Công Việc.Mã CV |
| Nội Dung | Comment text |
| Người Bình Luận | Tên (denormalized) |
| Mã Người Bình Luận | FK → Thành Viên.Mã TV |
| Ngày Tạo | Date |
| Đã Chỉnh Sửa | `Có` / `Không` |

### 2.7 Sheet `Hoạt Động` (50 rows mẫu)
| Cột | Mô tả |
|---|---|
| Mã HĐ | ID prefix `HD` |
| Loại | Event type (Tạo Dự Án, Cập Nhật Trạng Thái, etc.) |
| Mô Tả | Description |
| Đối Tượng | Entity type (Dự Án, Công Việc, Thành Viên) |
| Mã Đối Tượng | Entity ID |
| Người Thực Hiện | Tên |
| Mã Người Thực Hiện | FK → Mã TV |
| Ngày Tạo | Date |

### 2.8 Sheet `Thông Báo` (50 rows mẫu)
| Cột | Mô tả |
|---|---|
| Mã TB | ID prefix `TB` |
| Tiêu Đề | Notification title |
| Nội Dung | Body text |
| Loại | `Giao Việc` / `Bình Luận` / `Hệ Thống` |
| Người Nhận | Tên |
| Mã Người Nhận | FK → Mã TV |
| Đã Đọc | `Chưa` / `Đã Đọc` |
| Ngày Tạo | Date |

### 2.9 Sheet `Nhãn` (15 rows mẫu)
| Cột | Mô tả |
|---|---|
| Mã Nhãn | ID prefix `N` |
| Tên Nhãn | Bug, Feature, Design, UI/UX, Backend, Frontend, API, Testing, QA, DevOps... |
| Màu Sắc | Hex color |
| Ngày Tạo | Date |

---

## 3. Hệ Thống Phân Quyền (3 vai trò)

| Vai Trò | Quyền |
|---|---|
| **Chủ Doanh Nghiệp** | Xem tất cả dự án/task. Tạo/sửa/xóa dự án, task, thành viên. Xem Dashboard ngân sách. Xem Timeline, Hoạt Động. |
| **Leader** | Xem dự án mình quản lý + tham gia. Tạo/sửa dự án, task. Xem Timeline, Hoạt Động. Không xóa dự án/thành viên. |
| **Thành Viên** | Chỉ xem dự án tham gia + task được giao. Sửa task mình được giao. Không thấy menu Timeline, Thành Viên, Hoạt Động. |

**Xác thực:**
1. Kiểm tra admin account trong sheet `Cài Đặt` (admin_username/admin_password)
2. Nếu không match → tìm trong sheet `Thành Viên` (username + password + trạng thái = Hoạt Động)
3. Session lưu `localStorage` key `qlda_user`

---

## 4. Tính Năng & Views (8 màn hình)

### 4.1 Dashboard (Tổng Quan)
- 4 stat cards: Tổng Dự Án, Tổng Công Việc, Thành Viên, Quá Hạn
- 2 budget cards (chỉ hiện cho Chủ DN/Leader): Tổng Ngân Sách, Chi Phí Thực Tế
- 6 biểu đồ Chart.js:
  - Doughnut: Trạng thái công việc
  - Bar: Công việc theo mức độ ưu tiên
  - Line: Xu hướng tuần (tạo mới vs hoàn thành, 4 tuần gần nhất)
  - Pie: Trạng thái dự án
  - Stacked Bar: Phân bổ công việc theo thành viên (top 8)
  - Progress bars: Tiến độ từng dự án
- Danh sách: Công việc quá hạn (top 10), Sắp đến hạn 7 ngày (top 10)
- Hoạt động gần đây (8 mục cuối)

### 4.2 Dự Án (ProjectList)
- Bảng dữ liệu sortable (Mã, Tên, Trạng Thái, Ưu Tiên, Ngân Sách, Leader, Tiến Độ)
- Tìm kiếm theo tên/mã
- Lọc theo trạng thái
- Dialog tạo/sửa dự án (form fields: tên, mô tả, trạng thái, ưu tiên, ngân sách, chi phí, ngày, leader, thành viên, tiến độ, ghi chú)
- Chọn leader từ dropdown (chỉ Leader/Chủ DN)
- Multi-select thành viên tham gia
- Nút xem task của dự án → chuyển sang view Tasks với filter

### 4.3 Kanban Board
- 4 cột: Cần Làm → Đang Thực Hiện → Đang Xem Xét → Hoàn Thành
- Drag & drop card giữa các cột (HTML5 Drag API) → auto-update trạng thái
- Lọc theo: dự án, thành viên, khoảng thời gian (from-to date)
- Quick filter: Tuần này, Tháng này, Tất cả
- Card hiển thị: ưu tiên, tiêu đề, dự án, hạn, nhãn, người thực hiện
- Click card → mở Task Detail dialog

### 4.4 Công Việc (TaskList)
- Bảng sortable (Mã, Tiêu Đề, Dự Án, Người TH, Trạng Thái, Ưu Tiên, Hạn)
- Tìm kiếm theo tiêu đề/mã/người
- Lọc theo dự án, trạng thái
- Highlight viền đỏ cho task quá hạn
- Dialog tạo/sửa task
- Click tiêu đề → mở Task Detail (với bình luận)

### 4.5 Task Detail Dialog (shared)
- Hiển thị 10 field chi tiết (grid 2 cột)
- Progress bar tiến độ
- Phần bình luận:
  - Danh sách comment (avatar, tên, thời gian, nội dung, trạng thái đã sửa)
  - Input gửi bình luận mới
  - Sửa/xóa comment (chỉ comment của mình)
  - Auto thông báo cho chủ task khi có comment mới

### 4.6 Timeline (Gantt-like)
- View tuần hoặc tháng
- Navigate prev/next/today
- Lọc theo dự án
- Horizontal bars cho mỗi task (vị trí/width tính theo ngày)
- Today line indicator
- Chỉ hiện cho Chủ DN và Leader

### 4.7 Lịch (Calendar)
- Calendar grid 7×6 (CN-T7)
- Navigate tháng, nút "Hôm Nay"
- Lọc theo dự án
- Events: task bắt đầu (màu task) + deadline sắp tới (icon ⏰)
- Click event → mở Task Detail
- Max 3 events/cell, hiện "+N khác" nếu nhiều hơn

### 4.8 Hoạt Động (Activity Log)
- Timeline feed toàn bộ hoạt động
- Tìm kiếm theo mô tả/loại
- Icon + color theo loại (Tạo, Cập Nhật, Xóa...)
- Hiển thị: Loại, Mô Tả, Người, Thời gian, Đối tượng
- Chỉ hiện cho Chủ DN và Leader

---

## 5. Server API Surface

### SetupService.gs (Utilities)
| Function | Mô tả |
|---|---|
| `setup()` | Tạo 9 sheets với sample data (50 rows/sheet) |
| `sheetToJSON(sheetName)` | Đọc sheet → array of objects (xử lý Date → format `dd/MM/yyyy HH:mm`) |
| `generateId(prefix)` | Auto-increment ID (TV001, DA002...) |
| `getSettings()` | Đọc sheet Cài Đặt → key-value object |
| `logActivity(...)` | Ghi 1 dòng vào sheet Hoạt Động |
| `safeParseNumber(val)` | Parse số an toàn |
| `ensureDateString(val)` | Format date an toàn |

### AuthService.gs
| Function | Params | Return |
|---|---|---|
| `login(username, password)` | string, string | `{success, user: {id, name, role, ...}}` |
| `changePassword(userId, oldPass, newPass)` | string×3 | `{success, message}` |

### ProjectService.gs
| Function | Params | Return |
|---|---|---|
| `getProjects(filters)` | `{role, userId, status}` | JSON string `{success, data[]}` |
| `addProject(project)` | object | JSON string `{success, id, message}` |
| `updateProject(project)` | object | JSON string `{success, message}` |
| `deleteProject(id)` | string | JSON string `{success, message}` |

### TaskService.gs
| Function | Params | Return |
|---|---|---|
| `getTasks(filters)` | `{role, userId, projectId, status, dateFrom, dateTo, assigneeId}` | JSON string |
| `addTask(task)` | object | JSON string (auto tạo thông báo) |
| `updateTask(task)` | object | JSON string (auto ngày hoàn thành) |
| `updateTaskStatus(taskId, newStatus, userId, userName)` | strings | JSON string (Kanban drag) |
| `deleteTask(id)` | string | JSON string (cascade xóa bình luận) |

### MemberService.gs
| Function | Params | Return |
|---|---|---|
| `getMembers(filters)` | `{department, status}` | JSON string (ẩn mật khẩu) |
| `addMember(member)` | object | JSON string (check trùng username/email) |
| `updateMember(member)` | object | JSON string |
| `deleteMember(id)` | string | JSON string |
| `getDepartments()` | — | JSON string |
| `addDepartment(dept)` | object | JSON string |

### CommentService.gs
| Function | Params | Return |
|---|---|---|
| `getComments(taskId)` | string | JSON string (sort cũ→mới) |
| `addComment(comment)` | object | JSON string (auto thông báo chủ task) |
| `updateComment(commentId, newContent)` | string, string | JSON string (đánh dấu đã sửa) |
| `deleteComment(commentId)` | string | JSON string |

### DashboardService.gs
| Function | Params | Return |
|---|---|---|
| `getDashboard(userId, userRole)` | string, string | JSON string (tổng hợp toàn bộ thống kê) |

### NotifyService.gs
| Function | Params | Return |
|---|---|---|
| `getNotifications(userId)` | string | JSON string |
| `addNotification(notif)` | object | JSON string |
| `markNotificationRead(notifId)` | string | JSON string |
| `markAllNotificationsRead(userId)` | string | JSON string |
| `getLabels()` | — | JSON string |
| `getAllData(userId, userRole)` | string, string | JSON string (batch: members, departments, labels, settings) |
| `getActivities(limit)` | number | JSON string |

---

## 6. UI/UX Layout

### Desktop
- **Sidebar trái** (collapsible): Logo + menu items + user card + logout
- **Header bar**: Search + notifications bell + user info
- **Main content**: Breadcrumb + page view
- **Notification panel**: Slide-in từ phải

### Mobile
- **Top header**: Hamburger menu + title + notification bell
- **Drawer menu**: Slide-in từ trái (user info + nav + logout)
- **Bottom nav**: 5 items đầu tiên của menu
- Tables responsive (data-label attribute)

### UI Components
- Toast notifications (success/error/info, auto-dismiss 4s)
- Modal dialogs (add/edit forms, delete confirmation)
- Loading overlays + skeleton states
- Progress bars with color coding
- Badge system (status, priority, role)
- Material Icons (Outlined + Filled)

---

## 7. Điểm Yếu & Hạn Chế

| Vấn đề | Chi tiết |
|---|---|
| **Bảo mật** | Mật khẩu plaintext trong sheet. Admin password hardcoded. Session chỉ localStorage (dễ giả mạo). |
| **Hiệu năng** | Mỗi API call đọc toàn bộ sheet (`getDataRange`). Dashboard đọc 4 sheets cùng lúc. Không cache. |
| **Kiến trúc** | Monolithic — tất cả trong 1 scope GAS. Không có gas-core. Không test. |
| **Data integrity** | Denormalized data nhiều (tên người lưu text ở nhiều sheet). Xóa member không cascade task/project. |
| **Scalability** | `TextFinder` cho update/delete. `appendRow` cho insert. Không pagination. |
| **UX** | Kanban drag drop cơ bản (HTML5 native). Calendar không tạo task trực tiếp. Timeline đơn giản. |
| **Code quality** | AppScript.html 556 dòng compressed. CSS 45KB inline. Không module/component tách biệt. |

---

## 8. Sample Data Generator

File `SampleData.gs` tạo dữ liệu mẫu liên kết chặt chẽ:
- **10 phòng ban** (Ban GĐ, Công Nghệ, Thiết Kế, Kinh Doanh, Nhân Sự, Marketing, Tài Chính, QA, DevOps, Sản Phẩm)
- **50 thành viên** (tên Việt Nam random, phân bổ theo phòng ban, role logic)
- **15 dự án** (E-commerce, Mobile, CRM, ERP, Chatbot AI, Security Audit...)
- **50 công việc** (mapping chính xác vào dự án + team members)
- **50 bình luận** (nội dung kỹ thuật thực tế)
- **50 hoạt động** (log events đa dạng)
- **50 thông báo** (5 loại xoay vòng)
- **15 nhãn** (Bug, Feature, Design, UI/UX, Backend, Frontend, API, Testing, QA, DevOps, Documentation, Urgent, Security, SEO, AI)

---

## 9. Tech Stack Summary

| Layer | Technology |
|---|---|
| Runtime | Google Apps Script V8 |
| Database | Google Sheets (9 tabs) |
| Frontend Framework | Vue 3 (CDN, Composition API) |
| Charts | Chart.js 4.4.0 |
| Icons | Material Icons (Outlined + Filled) |
| Font | Be Vietnam Pro (Google Fonts) |
| CSS | Vanilla CSS (~45KB inline, custom variables) |
| Auth | Username/password (plaintext) + localStorage |
| Deployment | Direct GAS Web App (`doGet`) |
