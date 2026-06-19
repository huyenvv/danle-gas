---
description: "Task list — In / Xuất danh mục hồ sơ ra Excel cho Văn thư"
---

# Tasks: In / Xuất danh mục hồ sơ ra Excel cho Văn thư

**Input**: Design documents from `specs/009-in-danh-muc-ho-so/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api_exportCatalog.md

**Tests**: ĐƯỢC bao gồm — Constitution VII bắt buộc test qua `vm.runInContext`; spec có tiêu chí Independent Test cho mỗi story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1 / US2 (theo spec.md)

## Path Conventions

App docmgr (web: React client + GAS server) trong monorepo:
- Server: `apps/docmgr/src/server/`
- Tests server: `apps/docmgr/src/server/__tests__/`
- Client: `apps/docmgr/src/client/components/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Khởi tạo file server mới và đăng ký vào hạ tầng test/build.

- [X] T001 [P] Tạo file server scaffold `apps/docmgr/src/server/export-catalog.js` — chỉ header comment + khai báo hàm rỗng `function exportCatalog(token, categoryId) {}` theo ES5 `var`/`function` (không arrow/const/let). Tên file KHÔNG bắt đầu bằng `_` (để `bundle-server.js` tự gom).
- [X] T002 [P] Đăng ký `'export-catalog.js'` vào mảng `APP_FILES` trong `apps/docmgr/src/server/__tests__/setup.js`, đặt **ngay trước** `'main.js'` (sau `'import.js'`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire endpoint dùng chung cho cả hai story. Phải xong trước US1/US2.

- [X] T003 Thêm `api_exportCatalog(token, categoryId)` vào `apps/docmgr/src/server/main.js` (gần các api_* khác): bọc `_wrap(function(){ _requireAdminOrVanThu(token); return exportCatalog(token, categoryId) })`. Tái dùng `_requireAdminOrVanThu` đã có (allowed: `admin/Quản trị viên/Giám đốc/Văn thư`).

**Checkpoint**: endpoint tồn tại + gác quyền; sẵn sàng cho US1 và US2.

---

## Phase 3: User Story 1 — Văn thư xuất mục lục hồ sơ ra Excel (Priority: P1) 🎯 MVP

**Goal**: Chọn danh mục → tải file .xlsx (sheet "Danh mục", 7 cột, STT tự đánh số) gồm hồ sơ (mọi trạng thái trừ Nháp) của danh mục + danh mục con.

**Independent Test**: Đăng nhập VT, chọn danh mục có hồ sơ (cả ở con), bấm xuất → file mở được, đúng cột/thứ tự, STT 1..n theo Số hồ sơ, gồm mọi trạng thái trừ Nháp, gồm danh mục con, ngày `yyyy-mm-dd HH:mm`.

### Tests (viết trước — TDD)

- [X] T004 [P] [US1] Tạo `apps/docmgr/src/server/__tests__/exportCatalog.test.js` phủ: (a) lọc đúng — loại "Nháp", giữ mọi trạng thái khác (Chờ duyệt/Chờ xử lý/Đang xử lý/Hoàn thành/Từ chối); (b) gộp đệ quy hồ sơ ở danh mục con nhiều cấp; (c) sắp theo `Số hồ sơ` tăng dần + STT 1..n, Số hồ sơ rỗng xuống cuối; (d) ánh xạ đúng 7 cột, cột "Danh mục" = tên danh mục theo ID, ngày format `yyyy-mm-dd HH:mm`; (e) danh mục rỗng → ném `Không có hồ sơ để xuất`; (f) Sheet tạm bị trashed sau khi xuất kể cả khi lỗi (mock `SpreadsheetApp.create`/`UrlFetchApp`/`DriveApp`). Chạy `npm run test:docmgr` → các test này FAIL.

### Implementation

- [X] T005 [US1] Trong `apps/docmgr/src/server/export-catalog.js` thêm helper thuần (đọc/lọc): `_categoryDescendantSet(selectedId)` (đệ quy theo `Danh mục cha`, pattern `sheets.js:156`), lọc `Hồ Sơ` theo `_normalizeStatus(...) !== 'Nháp'` ∧ thuộc tập danh mục, sắp theo `Số hồ sơ` tăng dần (chuỗi, rỗng cuối), map 7 cột với tên danh mục từ ID và `Ngày ban hành` → `yyyy-mm-dd HH:mm` (`Utilities.formatDate` nếu Date). Trả mảng dòng + header. (Làm các sub-test a–d của T004 pass.)
- [X] T006 [US1] Trong `apps/docmgr/src/server/export-catalog.js` hoàn thiện `exportCatalog(token, categoryId)`: thiếu `categoryId` → `throw new Error('Vui lòng chọn danh mục để xuất')` (bắt buộc chọn danh mục); nếu 0 dòng → `throw new Error('Không có hồ sơ để xuất')`; ngược lại tạo Sheet tạm (`SpreadsheetApp.create`), đổi tên sheet đầu thành `"Danh mục"`, `setValues` header+rows, export xlsx qua `UrlFetchApp.fetch('.../export?format=xlsx', { headers:{ Authorization:'Bearer '+ScriptApp.getOAuthToken() }})`, `Utilities.base64Encode(blob.getBytes())`, **xoá Sheet tạm trong `finally`** (`DriveApp.getFileById(id).setTrashed(true)`). Trả `{ base64, fileName: 'danh-muc-ho-so-<slug>-<yyyymmdd>.xlsx', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', count }`. (Làm sub-test e–f của T004 pass.)
- [X] T007 [US1] Tạo **modal** `apps/docmgr/src/client/components/ExportCatalogModal.jsx` (dựng trên `FormModal` dùng chung; thêm prop `saveDisabled` vào FormModal): `CategoryPickerDropdown` (lookups.danhMuc, placeholder "-- Chọn danh mục --", **bắt buộc** — không có rootOption "tất cả") + nút lưu "Tải Excel" (`saveDisabled={!categoryId}`); gọi `gasCall('api_exportCatalog', token, categoryId)`; giải mã base64 → `Uint8Array` → `Blob(mimeType)` → `<a download=res.fileName>` click → `revokeObjectURL`; toast lỗi `err.message`; đóng modal sau khi tải xong.
- [X] T008 [US1] Wire modal vào `apps/docmgr/src/client/components/MainApp.jsx`: state `exportModalOpen`; render `{canExport && <ExportCatalogModal open={exportModalOpen} onClose=... token=... lookups=... />}` cạnh các modal khác; `onExport` (sidebar + toolbar) gọi `setExportModalOpen(true)`.

**Checkpoint**: VT xuất được file đúng đặc tả — MVP hoàn chỉnh, demo được độc lập.

---

## Phase 4: User Story 2 — Chỉ Văn thư/Admin/Giám đốc thấy & dùng được (Priority: P1)

**Goal**: Chức năng chỉ hiển thị + dùng được với 3 vai trò; vai trò khác không thấy và bị chặn server.

**Independent Test**: Đăng nhập từng vai trò: VT/Admin/GĐ thấy & dùng được; vai trò khác không thấy mục nav và bị chặn khi gọi trực tiếp.

### Tests

- [X] T009 [P] [US2] Bổ sung vào `apps/docmgr/src/server/__tests__/exportCatalog.test.js`: gọi `api_exportCatalog` với session vai trò `Văn thư`/`admin`/`Quản trị viên`/`Giám đốc` → không ném quyền; với `Nhân viên`/`Trưởng phòng` → ném `Không có quyền thực hiện thao tác này` (dùng `seedUser`/`createSession`/`setupRoleSheets`).

### Implementation

- [X] T010 [US2] Gác hiển thị ở client (KHÔNG tạo mục menu trái): thêm tùy chọn "In danh mục hồ sơ" (`onExport`, icon `file_download`) vào dropdown của `apps/docmgr/src/client/components/CreateMenu.jsx`; `Sidebar.jsx` chuyển tiếp `onExport` xuống `CreateMenu`; `MainApp.jsx` định nghĩa `const canExport = ['admin','Quản trị viên','Giám đốc','Văn thư'].includes(session.role)` và chỉ truyền `onExport` (cả ở sidebar CTA lẫn toolbar danh sách) khi `canExport`. Server vẫn gác bằng `_requireAdminOrVanThu` (T003).

**Checkpoint**: phân quyền đúng ở cả client (ẩn) lẫn server (chặn).

---

## Phase 5: Polish & Cross-Cutting

- [X] T011 [P] Kiểm icon: đảm bảo icon `file_download` được `sync-icons` đưa vào và tổng icon ≤ ~71 (`node scripts/sync-icons.js --app docmgr` hoặc qua build); tránh vỡ toàn bộ icon.
- [X] T012 Verify cuối: `npm run test:docmgr` (toàn bộ xanh) + `npm run build:docmgr` (xác nhận `export-catalog.js` được bundle, `main.js` cuối); chạy nhanh kịch bản thủ công trong `quickstart.md`.

---

## Dependencies & Execution Order

- **Setup (T001, T002)** → trước mọi thứ. T001 và T002 song song được ([P], khác file).
- **Foundational (T003)** → sau Setup; chặn US1 và US2.
- **US1 (T004→T005→T006→T007→T008)**: T004 viết trước (TDD). T005 trước T006 (xlsx cần dữ liệu). T007 trước/song song T008 (T008 import component). T004 [P] với client tasks (khác file).
- **US2 (T009, T010)**: phụ thuộc T003 (endpoint) và T010 phụ thuộc T008 (`canExport` dùng chung MainApp). T009 [P] (file test).
- **Polish (T011, T012)**: sau khi US1+US2 xong. T011 [P].

### Story Independence

- US1 và US2 đều P1 nhưng **US1 là MVP** (giá trị cốt lõi). US2 chồng thêm lớp phân quyền hiển thị; server-guard đã có từ T003 nên US1 vẫn an toàn nếu triển khai trước.

## Parallel Opportunities

- T001 và T002 (Setup).
- T004 (test server) song song với T007 (client page) — khác file, nhưng cùng thuộc US1.
- T009 (test quyền) song song T010 (client nav) — khác file.

## Implementation Strategy

1. **MVP = US1** (T001–T008): VT xuất file đúng đặc tả.
2. **+US2** (T009–T010): khoá hiển thị theo vai trò.
3. **Polish** (T011–T012): icon + verify build/test/manual.
