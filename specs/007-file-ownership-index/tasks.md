---
description: "Task list — Đảm bảo mỗi file Drive chỉ thuộc một hồ sơ"
---

# Tasks: Đảm bảo mỗi file Drive chỉ thuộc một hồ sơ

**Input**: Design documents from `specs/007-file-ownership-index/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/file-index.md, quickstart.md

**Tests**: CÓ — SC-004 yêu cầu test phủ mọi đường + nhánh; Constitution VII (test qua `vm.runInContext`).

**Lưu ý kiến trúc (quan trọng)**: Vì `_FileIndex` được đồng bộ **tự động** qua override `addRow`/`updateRow`/`deleteRow` (Phase 2), các đường tạo/sửa/xoá/huỷ/import KHÔNG cần thêm lời gọi index thủ công — chúng được phủ "miễn phí". Các phase user story vì thế chỉ chứa phần **policy** (reject/drop/fail-loud) + test.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1 = move fail-loud · US2 = chặn link file đã có chủ · US3 = import drop+warning

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Thêm hằng `SHEETS.FILE_INDEX = '_FileIndex'`, tabDef `{ name: SHEETS.FILE_INDEX, headers: ['FileID','DocID'] }` trong `_ensureAllTabsExist`, và bump `SCHEMA_V` `8`→`9` (cả điều kiện kiểm tra lẫn `setProperty`) trong `apps/docmgr/src/server/config.js`.

---

## Phase 2: Foundational (Blocking Prerequisites) ⚠️

**Purpose**: Bộ máy `_FileIndex` + đồng bộ tự động. US2 và US3 phụ thuộc phase này. (US1 không phụ thuộc index nhưng giá trị an toàn đầy đủ chỉ có khi invariant tồn tại.)

**Lưu ý**: Loader test (`setup.js`) dùng chung cho toàn bộ suite; override bọc global `addRow`/`updateRow`/`deleteRow`. Do đó module phải hoạt động đúng ngay khi nạp (không để skeleton ném lỗi làm hỏng mọi test). Vì vậy triển khai module như một đơn vị (T003–T006) rồi phủ test (T007–T008).

- [x] T002 [P] Kiểm tra/bổ sung `apps/docmgr/src/server/__tests__/mocks/gas.js` hỗ trợ thao tác trực tiếp trên sheet `_FileIndex` mà helper cần (đọc `getDataRange().getValues()`, `appendRow`, ghi đè/xoá row theo điều kiện). Bổ sung nếu thiếu.
- [x] T003 Tạo `apps/docmgr/src/server/file-index.js` với các helper bookkeeping: `_indexFindDoc(fileId)→docId|null` (đọc qua `getSheetData(SHEETS.FILE_INDEX)`), `_indexSetDocFiles(docId, fileInfos)` và `_indexRemoveDoc(docId)` (thao tác sheet trực tiếp, bọc `LockService`, `invalidateSheetCache(SHEETS.FILE_INDEX)` sau ghi). Theo hợp đồng [contracts/file-index.md](contracts/file-index.md).
- [x] T004 Thêm override CRUD cho `HO_SO` vào `apps/docmgr/src/server/file-index.js` theo pattern `var _coreFn = fn; fn = function(){...}`: `addRow`→set index từ `record['Tệp đính kèm']`; `updateRow`→chỉ đồng bộ khi `changes['Tệp đính kèm'] !== undefined`; `deleteRow`→`_indexRemoveDoc(id)`. Giữ nguyên giá trị trả về; nhánh khác `HO_SO` delegate nguyên trạng.
- [x] T005 Thêm `rebuildFileIndex()` (quét `HO_SO`, dựng lại `_FileIndex` từ `Tệp đính kèm`, `logAudit`) và `_assertIndexMatchesDocs()` (throw khi lệch) vào `apps/docmgr/src/server/file-index.js`.
- [x] T006 Đăng ký `'file-index.js'` vào `APP_FILES` trong `apps/docmgr/src/server/__tests__/setup.js` — đặt **sau** `'documents.js'`, **trước** `'import.js'` (khớp thứ tự bundle-server: documents → file-index → import).
- [x] T007 [P] Viết test bộ máy index trong `apps/docmgr/src/server/__tests__/file-index.test.js`: (a) helper `_indexSetDocFiles`/`_indexRemoveDoc`/`_indexFindDoc`; (b) override tự đồng bộ: `addRow(HO_SO,…)` thêm index, `updateRow` có `Tệp đính kèm` đặt-lại tập file, `updateRow` không có `Tệp đính kèm` → index không đổi, `deleteRow(HO_SO,…)` xoá theo DocID; (c) `rebuildFileIndex` self-heal từ trạng thái lệch; (d) `_assertIndexMatchesDocs` pass sau mỗi case; (e) **[SC-003]** `_indexFindDoc` chỉ đọc `_FileIndex`: trả đúng owner dựa trên dữ liệu `_FileIndex` mà KHÔNG cần `HO_SO` có dữ liệu (không quét `HO_SO`).
- [x] T008 [P] Thêm test end-to-end "đồng bộ miễn phí" trong `apps/docmgr/src/server/__tests__/file-index.test.js`: gọi `createDocument`, `_attachFileToDraft`, `bulkImportDocuments`, `deleteDocument`, `cancelDraft` (KHÔNG gọi index thủ công) rồi `_assertIndexMatchesDocs()` không throw.
- [x] T009 Chạy `npx jest --config apps/docmgr/jest.config.js file-index` → xanh, và chạy toàn bộ suite docmgr xác nhận override không phá test cũ.

**Checkpoint**: `_FileIndex` đồng bộ tự động qua mọi đường ghi `HO_SO`. US2/US3 có thể bắt đầu.

---

## Phase 3: User Story 1 — Đổi danh mục không để lệch âm thầm (Priority: P1) 🎯 MVP

**Goal**: Đổi `Danh mục` thì file di chuyển theo; nếu move bắt buộc thất bại thì thao tác cập nhật/hoàn tất thất bại rõ ràng, không lưu một phần.

**Independent Test**: Đổi danh mục với move ok → file ở folder mới + doc mang danh mục mới; mock move ném lỗi → `updateDocument`/`finalizeDraft` throw, doc giữ danh mục cũ.

**Phụ thuộc**: Không phụ thuộc Phase 2 (chỉ sửa logic move sẵn có). Có thể chạy song song US2.

- [x] T010 [US1] Viết test (fail trước) trong `apps/docmgr/src/server/__tests__/file-deletion.test.js` (hoặc `documents.test.js`): đổi danh mục — (a) move ok → file ở `newCatPath` + doc đổi danh mục; (b) `moveFile` ném → `updateDocument` throw & doc giữ danh mục cũ (không ghi một phần); (c) tương tự cho `finalizeDraft`.
- [x] T011 [US1] Bỏ `try/catch` nuốt lỗi quanh vòng `moveFile` trong `updateDocument` tại `apps/docmgr/src/server/documents.js`; đảm bảo move xảy ra trước/được kiểm trước khi commit đổi danh mục, lỗi move → ném ra (không lưu).
- [x] T012 [US1] Áp cùng xử lý fail-loud cho vòng `moveFile` trong `finalizeDraft` tại `apps/docmgr/src/server/documents.js`.
- [x] T013 [US1] Chạy test US1 → xanh.

**Checkpoint**: Đổi danh mục an toàn hoặc thất bại rõ ràng (SC-002).

---

## Phase 4: User Story 2 — Không thể gắn một file vào hai hồ sơ (Priority: P1)

**Goal**: `linkDriveFiles` từ chối file đã thuộc hồ sơ khác; cho phép re-link file của chính hồ sơ đang thao tác.

**Independent Test**: Link file orphaned → ok; link file đang thuộc doc khác → throw "đã thuộc hồ sơ khác"; re-link file của chính doc đang sửa → ok.

**Phụ thuộc**: Phase 2 (`_indexFindDoc`).

> **Đã xác minh luồng edit-mode (gỡ U1)**: Khi sửa hồ sơ không-nháp, `DocumentModal.jsx:288` gọi `api_linkDriveFiles(..., draftArg='edit')` → `linkDriveFiles` chạy **upload-only** (không ghi row, không biết docId); quyền sở hữu được ghi sau ở `updateDocument` qua override. Vì vậy check ở `linkDriveFiles` là *cổng UX*; client phải truyền `docId` của hồ sơ đang sửa để không tự-xung-đột (FR-007).

- [x] T014 [US2] Viết test (fail trước) trong `apps/docmgr/src/server/__tests__/documents.test.js`: link orphaned → ok; link file owned-by-other → throw; re-link file owned-by-current-doc (truyền docId) → ok.
- [x] T015 [US2] Trong `linkDriveFiles` (`apps/docmgr/src/server/documents.js:859`): thêm tham số thứ 5 `docId` (mặc định null). Với mỗi fileId, `owner = _indexFindDoc(fileId)`; nếu `owner` tồn tại và `String(owner) !== String(docId || draftId)` → ném lỗi rõ ("File … đã thuộc hồ sơ khác"). `owner === docId/draftId hiện tại` → hợp lệ (FR-007).
- [x] T016 [US2] Thread `docId` từ client: thêm tham số `docId` vào wrapper `api_linkDriveFiles` (`apps/docmgr/src/server/main.js:428`) và forward trong `apps/docmgr/src/client/gasClient.js` (case `api_linkDriveFiles`, ~L575); tại `apps/docmgr/src/client/components/DocumentModal.jsx:288` truyền `isEdit && !isDraftEdit ? <doc ID> : null` làm `docId`. Giữ tương thích luồng tạo nháp (docId null → dùng draftId).
- [x] T017 [US2] Chạy test US2 → xanh.

**Checkpoint**: Một file không thể thuộc hai hồ sơ (SC-001) — móc nối an toàn cho US1.

---

## Phase 5: User Story 3 — Import bỏ file đã dùng + cảnh báo (Priority: P2)

**Goal**: `bulkImportDocuments` bỏ qua file đã thuộc hồ sơ khác kèm warning; group hết file → lỗi "Không có file đính kèm".

**Independent Test**: Dòng import trỏ file đã dùng → bỏ + warning, file khác vẫn nhập; group toàn file đã dùng → lỗi; 2 group cùng batch cùng fileId → group sau bị drop+warning.

**Phụ thuộc**: Phase 2 (`_indexFindDoc`).

- [x] T018 [US3] Viết test (fail trước) trong `apps/docmgr/src/server/__tests__/import.test.js`: (a) file owned-by-other → drop + warning, file orphaned khác vẫn tạo; (b) group toàn file đã dùng → lỗi; (c) 2 group cùng batch cùng fileId → group sau drop+warning (nhờ override cập nhật index sau addRow group đầu).
- [x] T019 [US3] Trong `bulkImportDocuments` (`apps/docmgr/src/server/import.js`): trước khi build `validFiles`, lọc file mà `_indexFindDoc(fileId)` đã tồn tại → bỏ + push warning (`"File … đã thuộc hồ sơ khác — bỏ qua"`). Giữ dedup trong-batch ở client; group hết file vẫn rơi vào nhánh lỗi "Không có file đính kèm" sẵn có.
- [x] T020 [US3] Chạy test US3 → xanh.

**Checkpoint**: Import tuân bất biến mà không làm hỏng cả lần nhập (FR-004).

---

## Phase 6: Polish & Cross-Cutting

- [x] T021 [P] Bổ sung `_assertIndexMatchesDocs()` vào cuối các test path mới (US1/US2/US3) để bắt regression "quên đồng bộ" (SC-004).
- [x] T022 [P] Cập nhật `specs/007-file-ownership-index/quickstart.md` nếu chữ ký `linkDriveFiles` đổi (thêm docId); ghi rõ bước backfill `rebuildFileIndex()` một lần sau khi `SCHEMA_V` lên 9 trên spreadsheet đã có dữ liệu.
- [x] T023 Chạy `npm run test:docmgr` toàn bộ → xanh; xác nhận không hồi quy.
- [ ] T024 Verify thủ công theo quickstart sau khi build (`npm run build:docmgr`): link orphaned ok, link trùng bị chặn, đổi danh mục move, import bỏ-file-kèm-cảnh-báo.

---

## Dependencies & Execution Order

- **Phase 1 (Setup)**: T001 — chạy ngay.
- **Phase 2 (Foundational)**: T002–T009 — sau T001. **Chặn US2, US3.** (US1 không bị chặn.)
  - Trong phase: T002 [P] song song với T003; T003→T004→T005 tuần tự (cùng file `file-index.js`); T006 sau T003 (file tồn tại); T007/T008 [P] sau T006; T009 chốt.
- **Phase 3 (US1)**: T010→T011→T012→T013. Có thể song song với Phase 2/Phase 4 (khác file logic, chỉ đụng `documents.js` move).
- **Phase 4 (US2)**: sau Phase 2. T014→T015→T016→T017.
- **Phase 5 (US3)**: sau Phase 2. T018→T019→T020. Song song được với US2 (khác file: `import.js` vs `documents.js`).
- **Phase 6 (Polish)**: sau các story mong muốn.

⚠️ Lưu ý xung đột file: US1 (T011/T012) và US2 (T015) cùng sửa `documents.js` → KHÔNG đánh [P] với nhau; làm tuần tự hoặc cùng một người.

## Parallel Opportunities

- T002 ∥ (bắt đầu) T003 trong foundational.
- T007 ∥ T008 (cùng file test nhưng có thể viết song song rồi gộp; an toàn nhất tuần tự).
- US3 (`import.js`) ∥ US2 (`documents.js`) sau khi foundational xong.
- T021 ∥ T022 trong polish.

## Implementation Strategy

- **MVP (đề xuất)**: Phase 1 + Phase 2 + Phase 4 (US2) — thiết lập bất biến 1-file-1-doc, là nền cho mọi thứ. Sau đó US1 (fail-loud) để hoàn thiện đổi danh mục, rồi US3 (import).
- **Lý do US2 trước US1 dù cùng P1**: move ở US1 chỉ thực sự an toàn khi invariant (US2) tồn tại; nếu chỉ làm US1, move thành công vẫn có thể kéo file đang dùng ở hồ sơ khác đi. US1 vẫn ship/test độc lập được, nhưng giá trị đầy đủ cần US2.
- **Incremental**: mỗi story test độc lập, commit sau mỗi nhóm task; dừng ở checkpoint để verify.
