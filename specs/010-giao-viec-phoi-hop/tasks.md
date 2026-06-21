---
description: "Task list for feature 010 — Workflow giao việc cho người phối hợp"
---

# Tasks: Workflow giao việc cho người phối hợp

**Input**: Design documents from `specs/010-giao-viec-phoi-hop/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/transition-actions.md, quickstart.md

**Tests**: CÓ — feature là sửa logic workflow nhạy cảm (quyền + email), test server bằng Jest/`vm.runInContext` theo Constitution VII và quickstart.md.

**Bối cảnh**: Phần lớn workflow đã tồn tại trong `apps/docmgr/src/server/documents.js`. Đây là 7 delta phẫu thuật (S1, D1, D2, D3, D3b, C1–C3). Mọi đường dẫn tương đối repo root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1 / US2 / US3

---

## Phase 1: Setup

**Purpose**: Đảm bảo điểm khởi đầu xanh trước khi sửa.

- [X] T001 Chạy baseline test xác nhận xanh: `npm run test:docmgr` (48 suites / 580 tests) trong worktree `Appscripts-010-giao-viec`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tiền đề chung cho mọi story.

> Không có task foundational chặn tất cả story: 3 story sửa các nhánh **độc lập** trong `transitionDocument` và các form riêng. Thay đổi schema chỉ phục vụ US3 nên nằm trong Phase US3 (T011–T012). Bỏ qua phase này.

**Checkpoint**: Sau T001 xanh, có thể bắt đầu US1.

---

## Phase 3: User Story 1 - Khoá xoá người phối hợp (Priority: P1) 🎯 MVP

**Goal**: Người chủ trì (PT) chỉ được **thêm**, không xoá được người phối hợp đã có (kể cả do GĐ thêm); admin/QTV, GĐ toàn quyền.

**Independent Test**: Ở `nhanViec`, PT gửi danh sách thiếu một PH cũ → server từ chối; thêm PH (giữ cũ) → OK; admin bỏ PH → OK.

### Tests for User Story 1 ⚠️ (viết trước, phải FAIL)

- [X] T002 [P] [US1] Test: ở `nhanViec`, PT bỏ bớt PH cũ → throw `'Không thể xoá người phối hợp đã có'` trong `apps/docmgr/src/server/__tests__/documentPerms.test.js`
- [X] T003 [P] [US1] Test: ở `nhanViec`, PT thêm PH mới mà giữ nguyên PH cũ → OK (tập cũ ⊆ tập mới) trong `apps/docmgr/src/server/__tests__/documentPerms.test.js`
- [X] T004 [P] [US1] Test: admin `nhanViec` bỏ PH cũ → OK (bypass ràng buộc) trong `apps/docmgr/src/server/__tests__/documentPerms.test.js`

### Implementation for User Story 1

- [X] T005 [US1] D2 — Trong nhánh `action === 'nhanViec'` của `transitionDocument` (`apps/docmgr/src/server/documents.js` ~1278): khi không phải admin và `data['Người phối hợp']` được gửi, parse `oldPH = _parseAssignees(doc['Người phối hợp'])` + `newPH`; nếu có phần tử `oldPH` không ∈ `newPH` → `throw 'Không thể xoá người phối hợp đã có'` (so khớp theo userId/username như `_parseAssignees`)
- [X] T006 [US1] C2(khoá) — Trong form "Nhận việc" (`apps/docmgr/src/client/components/documents/DocumentPreview.jsx`): hiển thị PH đã có ở chế độ **khoá** (ẩn/disable nút xoá), chỉ cho thêm người mới

**Checkpoint**: PT không thể bỏ PH cũ ở cả server lẫn UI; admin/GĐ không bị chặn.

---

## Phase 4: User Story 2 - Bắt buộc nội dung giao việc khi có người phối hợp (Priority: P2)

**Goal**: Ở `giaoViec` (Chờ duyệt), khi có ≥1 người phối hợp thì "Nội dung giao việc" bắt buộc; không có PH thì được trống.

**Independent Test**: GĐ `giaoViec` với ≥1 PH + nội dung trống → chặn; có nội dung → OK; 0 PH + trống → OK.

### Tests for User Story 2 ⚠️ (viết trước, phải FAIL)

- [X] T007 [P] [US2] Test: `giaoViec` ≥1 PH + nội dung trống → throw `'Phải nhập nội dung giao việc khi có người phối hợp'`; có nội dung → OK, lưu `Nội dung giao việc` trong `apps/docmgr/src/server/__tests__/documents.test.js`
- [X] T008 [P] [US2] Test: `giaoViec` 0 PH + nội dung trống → OK trong `apps/docmgr/src/server/__tests__/documents.test.js`

### Implementation for User Story 2

- [X] T009 [US2] D1 — Trong nhánh `action === 'giaoViec'` (`apps/docmgr/src/server/documents.js` ~1267): tính số PH kết quả; nếu ≥1 và `trim(data['Nội dung']) === ''` → throw; lưu `updates['Nội dung giao việc'] = trim(data['Nội dung'])`
- [X] T010 [US2] C1 — Form giao việc (`apps/docmgr/src/client/components/documents/DocumentPreview.jsx`): chặn submit + báo lỗi khi `phoiHop.length >= 1` mà nội dung trống

**Checkpoint**: Không lưu được giao việc có PH mà thiếu nội dung (server + UI).

---

## Phase 5: User Story 3 - Email phối hợp + popup + lưu nội dung + hiển thị (Priority: P3)

**Goal**: Khi người chủ trì thêm PH mới lúc nhận việc: nhập nội dung qua popup giao việc (dùng lại), lưu vào cột mới `Nội dung phối hợp`, gửi chuông + email template `phoiHop` cho PH mới (PH = TO); preview hiển thị 2 nội dung tách biệt.

**Independent Test**: PT nhận việc thêm PH + nhập nội dung → cột `Nội dung phối hợp` lưu (không đè `Nội dung giao việc`), PH mới nhận email `phoiHop` (TO), PH cũ không nhận lại; preview hiện 2 mục.

### Schema & fixtures (prerequisite của US3)

- [X] T011 [US3] S1 — Thêm cột `Nội dung phối hợp` vào header `HO_SO` và bump `SCHEMA_V` `'11'`→`'12'` trong `apps/docmgr/src/server/config.js`
- [X] T012 [US3] Cập nhật fixtures/helper test để `HO_SO` có cột `Nội dung phối hợp` (`apps/docmgr/src/server/__tests__/helpers.js` và/hoặc `setup.js`/`mocks/gas.js`)

### Tests for User Story 3 ⚠️ (viết trước, phải FAIL)

- [X] T013 [P] [US3] Test: `nhanViec` thêm PH `[A,B]` từ `[A]` + nội dung → cột `Nội dung phối hợp` lưu đúng, `Nội dung giao việc` (của GĐ) **không đổi**; `GmailApp._sent` có email template `phoiHop` với **B là TO**, A không nhận lại; B unread — trong `apps/docmgr/src/server/__tests__/notification.test.js`
- [X] T014 [P] [US3] Test: `nhanViec` bổ sung PH nhưng nội dung popup trống → throw `'Phải nhập nội dung gửi tới người phối hợp'` trong `apps/docmgr/src/server/__tests__/documents.test.js`
- [X] T015 [P] [US3] Test: `nhanViec` không thêm PH nào → không gửi email phối hợp trong `apps/docmgr/src/server/__tests__/notification.test.js`
- [X] T016 [P] [US3] Test: email gửi lỗi (mock `GmailApp.sendEmail` throw) → thao tác vẫn thành công, `result.emailError` ≠ null (best-effort) trong `apps/docmgr/src/server/__tests__/notification.test.js`

### Implementation for User Story 3

- [X] T017 [US3] Thêm template `phoiHop` vào `_DEFAULT_MAIL_TEMPLATES` (`apps/docmgr/src/server/documents.js` ~43) — subject `{hoảTốc}[Phối hợp] {tênHồSơ}`, body *"Xin chào {tênNgườiNhận}, bạn được {tênNgườiGửi} giao phối hợp xử lý công việc với nội dung: {nộiDungPhoiHop}…"*; thêm biến `{nộiDungPhoiHop}` map `doc['Nội dung phối hợp']` vào `vars` của `_sendNotificationEmails` (~227)
- [X] T018 [US3] D3+D3b — Trong nhánh `nhanViec` (`apps/docmgr/src/server/documents.js`): tính `addedPH`; nếu `addedPH.length >= 1` và `trim(data['Nội dung']) === ''` → throw; lưu `updates['Nội dung phối hợp'] = trim(data['Nội dung'])` (KHÔNG đụng `Nội dung giao việc`)
- [X] T019 [US3] D3(email) — Trong nhánh hậu-cập-nhật `nhanViec` (`apps/docmgr/src/server/documents.js` ~1355): với mỗi PH trong `addedPH` (trừ người thao tác) gửi 1 email template `phoiHop` (TO=1 người, người nhận chính); giữ `_markUnreadForUsers`; bọc try/catch gom `emailError`
- [X] T020 [US3] C2(popup) — Form "Nhận việc" (`apps/docmgr/src/client/components/documents/DocumentPreview.jsx`): khi người chủ trì bổ sung PH mới → mở **popup giao việc dùng lại** để nhập nội dung; chỉ hiện khi có PH mới; truyền `data['Nội dung']` lên `transitionDocument('nhanViec', …)`
- [X] T021 [US3] C3(hiển thị) — Preview detail (`apps/docmgr/src/client/components/documents/DocumentPreview.jsx`): hiển thị 2 mục tách biệt tiêu đề khác nhau — "Nội dung giao việc" (`Nội dung giao việc`) và "Nội dung phối hợp" (`Nội dung phối hợp`); ẩn mục rỗng
- [X] T025 [US3] C4(cấu hình email) — Settings → Email thông báo (`apps/docmgr/src/client/components/SettingsPage.jsx`): thêm tab "Phối hợp" (template `phoiHop`) vào `MAIL_TABS` + `DEFAULT_TEMPLATES`, và biến `{nộiDungPhoiHop}` vào `TEMPLATE_VARS` (FR-017)

**Checkpoint**: Toàn bộ luồng giao việc–phối hợp hoạt động; 2 nội dung lưu/hiển thị tách biệt; email đúng người nhận chính.

---

## Phase 6: Polish & Validation

- [X] T022 Chạy full Jest xanh: `npm run test:docmgr` (mọi test mới + cũ pass)
- [ ] T023 Kiểm thử thủ công theo `specs/010-giao-viec-phoi-hop/quickstart.md` (C1/C2/C3 + 2 luồng email) — *chưa chạy: cần môi trường GAS/SSO trực tiếp; hành vi đã được phủ bởi test tự động + build*
- [X] T024 [P] Build kiểm tra: `npm run build:docmgr` (concat server + obfuscate không lỗi)

---

## Dependencies & Execution Order

### Phase order
- **Setup (T001)** → **US1 (P1)** → **US2 (P2)** → **US3 (P3)** → **Polish**.
- US3 nội bộ: **T011 → T012 → (T013–T016 viết test, fail) → T017 → T018 → T019 → T020 → T021**.

### Cross-story (lưu ý xung đột file)
- US1, US2, US3 cùng sửa `documents.js` và `DocumentPreview.jsx` ở các **vùng/nhánh khác nhau** → hành vi độc lập nhưng **không [P] giữa các story** (tránh xung đột merge). Làm tuần tự theo ưu tiên.
- Trong một story: file test khác nhau → các task test [P]; server vs client là 2 file → có thể [P].

### Within US3
- T011 (schema) + T012 (fixtures) trước mọi test/impl US3.
- T017 (template + biến) trước T019 (gửi email).
- T018/T019 (server, cùng nhánh `nhanViec`) tuần tự, trước T020 (client gọi).

---

## Parallel Example: User Story 1

```bash
# Viết 3 test US1 song song (cùng nằm trong documentPerms.test.js — tách describe, có thể viết đồng thời):
Task: "T002 test PT bỏ PH cũ → throw"
Task: "T003 test PT thêm PH giữ cũ → OK"
Task: "T004 test admin bỏ PH → OK"
```

## Parallel Example: User Story 3 (tests)

```bash
Task: "T013 notification: email phoiHop cho PH mới (TO), cột lưu, GĐ content giữ nguyên"
Task: "T014 documents: bắt buộc nội dung khi bổ sung PH"
Task: "T015 notification: không thêm PH → không email"
Task: "T016 notification: email lỗi → emailError best-effort"
```

---

## Implementation Strategy

### MVP (US1)
1. T001 (baseline) → 2. US1 (T002–T006) → 3. **Dừng & kiểm thử**: PT không bỏ được PH cũ. Đây là giá trị cốt lõi (khoá xoá), có thể demo độc lập.

### Incremental
- + US2 (bắt buộc nội dung) → kiểm thử → + US3 (email/popup/lưu/hiển thị) → kiểm thử → Polish.

---

## Notes

- Server giữ ES5 `var`/`function` (Constitution I). KHÔNG đảo thứ tự concat.
- Email best-effort: lưu sheet trước, email sau, lỗi gửi gom `emailError`, không rollback (FR-011).
- `Nội dung phối hợp` KHÔNG đè `Nội dung giao việc` của GĐ (FR-015).
- Commit sau mỗi nhóm task hợp lý; dừng ở checkpoint để kiểm thử từng story.
