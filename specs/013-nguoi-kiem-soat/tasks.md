---
description: "Task list — Người kiểm soát hồ sơ"
---

# Tasks: Người kiểm soát hồ sơ

**Input**: Design documents from `specs/013-nguoi-kiem-soat/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/server-api.md](contracts/server-api.md), [quickstart.md](quickstart.md)

**Tests**: INCLUDED — codebase convention (Jest qua `vm.runInContext`) + SC yêu cầu thực thi phía máy chủ (FR-006/FR-007).

**Organization**: Theo user story (US1, US2, US3). Lưu ý: phần lớn logic server nằm trong **một file** `apps/docmgr/src/server/documents.js` → các task sửa file này **tuần tự** (không [P] với nhau).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1 / US2 / US3
- Mọi task có đường dẫn file cụ thể

## Path Conventions

Monorepo docmgr: server `apps/docmgr/src/server/`, client `apps/docmgr/src/client/`, tests `apps/docmgr/src/{server,client}/__tests__/`.

---

## Phase 1: Setup

**Purpose**: Xác nhận nền sạch trước khi sửa.

- [x] T001 Chạy `npx jest --config apps/docmgr/jest.config.js` và xác nhận toàn bộ test PASS (baseline xanh trước khi thay đổi)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema cột NKS — bắt buộc trước MỌI user story.

**⚠️ CRITICAL**: Không story nào chạy được trước khi xong phase này.

- [x] T002 Bump `SCHEMA_V` `'13'→'14'` (cả nhánh check ở dòng ~25 lẫn `setProperty` ở dòng ~39) và thêm `'Người kiểm soát'` vào mảng headers `HO_SO` trong `_ensureAllTabsExist` tại `apps/docmgr/src/server/config.js` (ensureMissingColumns tự append cột cho file cũ)

**Checkpoint**: Cột `Người kiểm soát` sẵn sàng; hồ sơ cũ = rỗng (SC-005).

---

## Phase 3: User Story 1 — Chọn người kiểm soát khi giao việc (Priority: P1) 🎯 MVP

**Goal**: GĐ/QTV chọn NKS (tuỳ chọn) khi giao việc; lưu bền vững; NKS mới nhận chuông + email riêng (FR-001, FR-002, FR-011, FR-013).

**Independent Test**: GĐ giao việc chọn NKS=X → hồ sơ lưu NKS=X và X nhận chuông + email `[Kiểm soát]`; để trống NKS → workflow như cũ; PT/role khác không thấy ô chọn NKS.

### Implementation for User Story 1

- [x] T003 [US1] Trong nhánh `action === 'giaoViec'` của `transitionDocument` (`apps/docmgr/src/server/documents.js`, ~dòng 1465): nhận `data['Người kiểm soát']`, ghi qua `_buildAssignees([uid])` (rỗng→`''`) **chỉ khi** người gọi là GĐ/admin/QTV; vai trò khác (gồm NKS) bỏ qua trường này (FR-007)
- [x] T004 [US1] Thêm template mặc định `kiemSoat` (subject `{hoảTốc}[Kiểm soát] {tênHồSơ}` + body theo [contracts/server-api.md](contracts/server-api.md) C3) vào `_DEFAULT_MAIL_TEMPLATES` trong `apps/docmgr/src/server/documents.js`
- [x] T005 [US1] Trong nhánh `giaoViec` (sau `_updateDocRow`, khu gửi email ~dòng 1514): nếu NKS chuyển sang UserID mới khác rỗng → `_markUnreadForUsers([nks])` + gửi email `kiemSoat` cho NKS (best-effort, bọc try/catch như các nhánh khác). Vì đổi NKS = giao lại, nhánh này cũng phủ ca "đổi sang NKS mới" — trong `apps/docmgr/src/server/documents.js`
- [x] T006 [P] [US1] Test regression SC-005: `giaoViec` cho hồ sơ **không** NKS giữ nguyên hành vi/email như trước (không đoạn NKS, không gửi `kiemSoat`) — trong `apps/docmgr/src/server/__tests__/notification.test.js`
- [x] T007 [P] [US1] Thêm ô chọn **người kiểm soát** (1 người, tuỳ chọn) trong popup giao việc, **chỉ render cho GĐ/QTV**, và đưa `Người kiểm soát` vào payload `giaoViec` trong `apps/docmgr/src/client/components/DocumentModal.jsx`

### Tests for User Story 1

- [x] T008 [P] [US1] Test server: `giaoViec` ghi NKS khi GĐ/QTV, **bỏ qua** khi vai trò khác (FR-007); NKS mới nhận email `kiemSoat` + unread khi gán; đổi NKS bằng giao lại gửi email cho NKS mới; để trống NKS không gửi — trong `apps/docmgr/src/server/__tests__/notification.test.js`

**Checkpoint**: US1 hoạt động độc lập (gán/đổi/gỡ NKS qua giao việc + thông báo).

---

## Phase 4: User Story 2 — NKS thêm phối hợp & duyệt tới hoàn thành (Priority: P1)

**Goal**: NKS, trên hồ sơ được gán: (a) **thêm PH** (chỉ-thêm, không đổi/xoá PT·PH, KHÔNG đổi trạng thái) ở `Chờ xử lý`/`Đang xử lý`; (b) **duyệt tới Hoàn thành** (`xacNhanHT`/`tuChoiKetQua`). Song song GĐ; chặn ở server (FR-003..007, FR-012).

**Independent Test**: Gán NKS=X cho hồ sơ A. X thêm được PH mới ở `Chờ xử lý`/`Đang xử lý` (không gỡ được PT/PH cũ, không đổi trạng thái), và xác nhận/từ chối kết quả ở `Chờ xác nhận HT`; trên hồ sơ B (không gán) X không có quyền NKS; gọi trực tiếp server bởi người không-NKS bị từ chối; GĐ vẫn thao tác đầy đủ trên A.

### Implementation for User Story 2

- [x] T009 [US2] Thêm helper `_isController(doc, session)` (parse `doc['Người kiểm soát']` qua `_parseAssignees`, so `session.userId`/`username`) trong `apps/docmgr/src/server/documents.js`
- [x] T010 [US2] Thêm token role `'_kiemSoat'` vào `WORKFLOW_ACTIONS` cho **chỉ** `xacNhanHT`, `tuChoiKetQua`; trong vòng kiểm tra quyền của `transitionDocument` (~dòng 1437) thêm nhánh `rule.roles[i] === '_kiemSoat'` → `_isController(doc, session)` trong `apps/docmgr/src/server/documents.js`
- [x] T010a [US2] Thêm action mới `ksThemPhoiHop` vào `WORKFLOW_ACTIONS` (`from/to = '_keep'`, roles `['_kiemSoat']`) + xử lý trong `transitionDocument`: validate trạng thái ∈ {Chờ xử lý, Đang xử lý}; KHÔNG set `Tình trạng` khi `to==='_keep'`; ràng buộc chỉ-thêm PH (tập cũ ⊆ mới, mượn logic `nhanViec`); PT bất biến; bắt buộc nội dung khi có PH mới → `Nội dung phối hợp`; gửi `phoiHop` + unread cho PH *mới* — trong `apps/docmgr/src/server/documents.js`
- [x] T011 [P] [US2] Thêm `isController(doc, session)` + **union** vào `getAvailableActions`: `ksThemPhoiHop` khi trạng thái ∈ {Chờ xử lý, Đang xử lý}, `xacNhanHT`/`tuChoiKetQua` khi `Chờ xác nhận HT` (song song vai trò gốc; KHÔNG có giaoViec/thuHoi) trong `apps/docmgr/src/client/lib/workflowPermissions.js`
- [x] T012 [P] [US2] Popup "thêm phối hợp" cho NKS: tái dùng popup giao việc với **PT khoá** + **PH cũ không gỡ được** (chỉ thêm) + ô nội dung bắt buộc + nút Lưu gọi `ksThemPhoiHop`; bám mẫu UX "Nhận việc" (feature 010) trong `apps/docmgr/src/client/components/DocumentModal.jsx`
- [x] T012a [P] [US2] Hiển thị NKS hiện tại của hồ sơ trên màn chi tiết trong `apps/docmgr/src/client/components/documents/DocumentPreview.jsx` (nút workflow tự lấy từ `getAvailableActions`)

### Tests for User Story 2

- [x] T013 [P] [US2] Test server: NKS thêm PH (`ksThemPhoiHop`) thành công, **không đổi trạng thái**; chặn gỡ PH cũ / đổi PT (FR-004a); chặn trên hồ sơ không gán (FR-005); người không-NKS gọi trực tiếp bị chặn (FR-006); NKS không có giaoViec/thuHoi; xacNhanHT/tuChoiKetQua được; GĐ vẫn song song (FR-012); PH mới nhận `phoiHop` (FR-004b) — trong `apps/docmgr/src/server/__tests__/` (workflow/transition + notification)
- [x] T014 [P] [US2] Test client: `getAvailableActions` trả `ksThemPhoiHop` ở Chờ xử lý/Đang xử lý + xacNhanHT/tuChoiKetQua ở Chờ xác nhận HT cho NKS, union với vai trò gốc, không có giaoViec/thuHoi — trong `apps/docmgr/src/client/__tests__/workflowPermissions.test.js`

**Checkpoint**: US1 + US2 đều hoạt động độc lập.

---

## Phase 5: User Story 3 — Email đoạn người kiểm soát theo điều kiện (Priority: P2)

**Goal**: Email giao việc hiện/ẩn đoạn NKS theo điều kiện `[[...]]`; biến `{tênNgườiKiểmSoát}`/`{vaiTròNgườiKiểmSoát}`; admin sửa được trong Settings (FR-008..010).

**Independent Test**: Giao việc hồ sơ có NKS → email chứa "…và trình duyệt qua Giám đốc - X…"; không NKS → đoạn biến mất, không còn `{...}`; Settings → Email mẫu Giao việc sửa được đoạn `[[...]]` và danh sách biến có 2 biến mới.

### Implementation for User Story 3

- [x] T015 [US3] Mở rộng `_applyTemplate(tpl, vars)` xử lý đoạn `[[ ... ]]`: giữ nội dung (bỏ cặp ngoặc) khi biến NKS có giá trị, xoá cả đoạn khi rỗng; tương thích ngược (template không có `[[...]]` → không đổi) trong `apps/docmgr/src/server/documents.js`
- [x] T016 [US3] Trong `_sendNotificationEmails`, tra cứu NKS (`_getRecipientsByUsernames([nks])[0]`) và thêm `'{tênNgườiKiểmSoát}'`/`'{vaiTròNgườiKiểmSoát}'` vào object `vars` (rỗng nếu không có NKS) trong `apps/docmgr/src/server/documents.js`
- [x] T017 [US3] Cập nhật body mặc định template `giaoViec` trong `_DEFAULT_MAIL_TEMPLATES` thêm đoạn `[[ và trình duyệt qua {vaiTròNgườiKiểmSoát} - {tênNgườiKiểmSoát}]]` trong `apps/docmgr/src/server/documents.js`
- [x] T018 [P] [US3] Đồng bộ client: thêm `{tênNgườiKiểmSoát}`/`{vaiTròNgườiKiểmSoát}` vào `TEMPLATE_VARS`; thêm template `kiemSoat` + cập nhật body `giaoViec` (đoạn `[[...]]`) trong `DEFAULT_MAIL_TEMPLATES` tại `apps/docmgr/src/client/components/SettingsPage.jsx`

### Tests for User Story 3

- [x] T019 [P] [US3] Test server: `_applyTemplate` giữ/ẩn `[[...]]` đúng; email `giaoViec` chứa đoạn NKS khi có NKS và bỏ đoạn (không còn `{...}`) khi không có — trong `apps/docmgr/src/server/__tests__/notification.test.js`
- [x] T020 [P] [US3] Test client: `SettingsPage` liệt kê 2 biến NKS mới và có mục template Kiểm soát — trong `apps/docmgr/src/client/__tests__/SettingsPage.test.jsx`

**Checkpoint**: Cả 3 user story hoạt động độc lập.

---

## Phase 6: Polish & Cross-Cutting

- [x] T021 [P] Cập nhật memory `.specify/memory/document-workflow.md` và `.specify/memory/permissions.md`: ghi vai trò NKS (quyền theo hồ sơ, tập action, email)
- [x] T022 Chạy lại toàn bộ `npx jest --config apps/docmgr/jest.config.js` — tất cả PASS (gồm test mới)
- [x] T023 Build sanity `npm run build:docmgr` và đối chiếu [quickstart.md](quickstart.md) (kịch bản US1–US3 thủ công)

---

## Phase 7: Vá sau triển khai (phát hiện khi test trên production thật)

- [x] T024 [US2] NKS **thấy + mở** được hồ sơ được gán (FR-014): gộp NKS vào `_docViewToken` (cột Token xem) và `_isParticipant` trong `apps/docmgr/src/server/documents.js` + test visibility trong `controller.test.js`
- [x] T025 [US2] "Thấy được ⇒ thao tác được" (FR-015): `_isController` resolve danh tính qua `_getDocUserIdMap` (UserID/tên đăng nhập/email) trong `apps/docmgr/src/server/documents.js` + test ca lưu NKS bằng email
- [x] T026 Hàm bảo trì `rebuildGvizQueryColumns()` + `backfillControllerTokens()` (chạy tay, bulk I/O, KHÔNG trong doGet) trong `apps/docmgr/src/server/documents.js`; nâng mock `getRange().setValues()` đa dòng; test trong `docDerived.test.js`
- [x] T027 Khôi phục `backfillDocDerived` về no-op (gỡ full-scan gây timeout doGet ở 10k+) trong `apps/docmgr/src/server/documents.js`

> **Lưu ý sửa ngược tài liệu**: UI workflow thực tế ở `DocumentPreview.jsx` (không phải `DocumentModal.jsx` như giả định ban đầu của T007/T012). Đã ghi chú trong [contracts/server-api.md](contracts/server-api.md) C4.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: không phụ thuộc.
- **Foundational (T002)**: sau Setup — **BLOCK toàn bộ** user story (mọi story đọc/ghi cột mới).
- **US1 / US2 / US3**: sau T002. Độc lập về *kiểm thử*, nhưng **chia sẻ file `documents.js`** → các task server của 3 story phải sửa file tuần tự (xem dưới).
- **Polish (T021–T023)**: sau khi các story mong muốn hoàn tất.

### Ràng buộc file dùng chung (quan trọng)

- `documents.js` bị sửa bởi: T003–T005 (US1), T009/T010/T010a (US2), T015–T017 (US3). Các task này **KHÔNG [P]** với nhau — thực hiện tuần tự, commit theo nhóm. (T006/T008 là test, khác file.)
- `_isController` (T009) phải có trước nhánh quyền `_kiemSoat` (T010) và action `ksThemPhoiHop` (T010a).
- `_sendNotificationEmails` vars (T016) trước khi body `giaoViec` (T017) dựa vào biến mới.
- FR-007 lock ở T003 được **kiểm chứng lại** bởi test T013 (US2).

### Within Each User Story

- Implementation server (cùng file) tuần tự → client [P] → test [P].
- Test viết để FAIL trước khi code (nếu theo TDD), hoặc ngay sau impl trong cùng phase.

### Parallel Opportunities

- T007 (DocumentModal) ∥ task server US1.
- T011 (workflowPermissions) ∥ T012 (DocumentModal add-PH popup) ∥ T012a (DocumentPreview) ∥ T014 (client test) — khác file. *(Lưu ý: T007 & T012 cùng `DocumentModal.jsx` → tuần tự với nhau.)*
- T018 (SettingsPage) ∥ test US3.
- Các file test khác nhau (T008/T013/T019 server; T014/T020 client) [P] với nhau khi impl tương ứng đã xong.

---

## Parallel Example: User Story 2

```bash
# Sau khi xong T009/T010/T010a (documents.js), chạy song song (khác file):
Task: "T011 workflowPermissions.js — isController + union action NKS"
Task: "T012a DocumentPreview.jsx — hiển thị NKS"
Task: "T014 workflowPermissions.test.js — test action NKS"
```

---

## Implementation Strategy

### MVP (US1)

1. T001 (baseline) → T002 (schema) → T003–T008 (US1) → **STOP & VALIDATE**: GĐ gán NKS, NKS nhận email, lưu bền vững.
2. Demo MVP.

### Incremental

1. Foundation (T002).
2. US1 → test độc lập → demo (gán NKS + thông báo).
3. US2 → test độc lập → demo (NKS hành động như GĐ).
4. US3 → test độc lập → demo (email điều kiện).
5. Polish (T021–T023).

---

## Notes

- [P] = khác file, không phụ thuộc task chưa xong.
- ES5 `var`/`function` cho mọi file server (Constitution I).
- Giữ đồng bộ 3 cặp bản sao client/server: mail templates, TEMPLATE_VARS, workflow actions (research R7).
- "Hide" = conditional render, không xoá code (Constitution V).
- Commit sau mỗi nhóm task; SC-005: hồ sơ không NKS phải hành xử **y hệt** trước.
