---
description: "Task list — Truy cập hồ sơ qua gviz thay vì đọc toàn bộ sheet"
---

# Tasks: Truy cập hồ sơ qua gviz thay vì đọc toàn bộ sheet

**Input**: Design documents from `specs/014-gviz-ho-so-access/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/data-access.md](contracts/data-access.md)

**Tests**: BẮT BUỘC — dự án dùng TDD qua `vm.runInContext` (Constitution VII) và SC-005 yêu cầu toàn bộ test hiện có pass. Mỗi story có test viết TRƯỚC.

**Organization**: Theo user story (US1/US2/US3) để triển khai & kiểm thử độc lập.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1/US2/US3
- Đường dẫn file tuyệt đối-tương-đối-repo nêu rõ trong mô tả

## Đường dẫn chính
- gas-core: `packages/gas-core/sheets-crud.js`
- docmgr server: `apps/docmgr/src/server/{doc-query.js, documents.js, sheets.js}`
- mock test: `apps/docmgr/src/server/__tests__/mocks/gas.js`
- tests: `apps/docmgr/src/server/__tests__/*.test.js`

---

## Phase 1: Setup (Shared)

**Purpose**: chốt baseline xanh + danh sách điểm sửa.

- [X] T001 Chạy `npx jest --config apps/docmgr/jest.config.js` ghi lại số test pass làm baseline (SC-005); xác nhận xanh trước khi sửa.
- [X] T002 Đối chiếu danh sách call-site trong [data-model.md](data-model.md) bằng `grep -rn "getSheetData(SHEETS.HO_SO)" apps/docmgr/src/server` (bỏ `__tests__`) — xác nhận đúng 15 điểm production và phân loại IN/OUT scope.

---

## Phase 2: Foundational (Blocking — chặn US1 & US2)

**Purpose**: cơ chế định vị-dòng-theo-ID (TextFinder) + hỗ trợ mock. US1 và US2 đều dựng trên đây.

**⚠️ US1 và US2 KHÔNG bắt đầu cho tới khi phase này xong.** (US3 KHÔNG phụ thuộc phase này — xem Dependencies.)

- [X] T003 [P] Thêm mock `createTextFinder` cho Sheet và Range trong `apps/docmgr/src/server/__tests__/mocks/gas.js`: tìm trên `_rows`, hỗ trợ `matchEntireCell(true)`, trả object có `findNext()` → range giả `{ getRow() }` (null nếu không khớp).
- [X] T004 Thêm `_findRowIndexById(sheet, id)` trong `packages/gas-core/sheets-crud.js`: xác định cột `ID` từ header; `getLastRow()<=1` → trả `-1`; TextFinder trên range cột ID từ dòng 2 `getRange(2, idCol+1, lastRow-1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext()` → `range.getRow()` hoặc `-1`; ném nếu thiếu cột `ID`.
- [X] T005 [P] Test `_findRowIndexById` trong `apps/docmgr/src/server/__tests__/` (file mới `findRowById.test.js`): tìm thấy đúng dòng; ID không tồn tại → `-1`; `matchEntireCell` (`1` không khớp `10`/`21`); sheet chỉ header → `-1`.

**Checkpoint**: định vị-dòng sẵn sàng → US1 & US2 chạy được (có thể song song).

---

## Phase 3: User Story 1 — Tra cứu một hồ sơ theo mã không nạp cả sheet (P1) 🎯 MVP

**Goal**: mọi chỗ lấy 1 hồ sơ theo ID đọc-điểm sống (TextFinder), không full-read, nhất quán read-after-write.

**Independent Test**: trên sheet nhiều dòng, mở/sửa-trước 1 hồ sơ → đúng bản ghi, không phụ thuộc N; ghi rồi đọc lại thấy giá trị mới.

### Tests for US1 (viết TRƯỚC)

- [X] T006 [US1] Test `_getDocById` trong `apps/docmgr/src/server/__tests__/docQuery.test.js`: trả đúng object theo ID; `null` khi không có; **read-after-write** (ghi field qua `updateRow` rồi `_getDocById` thấy giá trị mới); không set `UrlFetchApp._nextResponse` (không đi qua gviz). Bảo đảm FAIL trước khi cài T007.

### Implementation for US1

- [X] T007 [US1] Cài `_getDocById(id)` trong `apps/docmgr/src/server/doc-query.js`: dùng `_findRowIndexById(getSheet(SHEETS.HO_SO), id)`; nếu `-1` trả `null`; đọc đúng 1 dòng `getRange(row,1,1,lastCol)` + header → object (qua `rowsToObjects([header,row])[0]`); KHÔNG cache (FR-014).
- [X] T008 [US1] `apps/docmgr/src/server/documents.js` — `_updateDocRow` (≈ln 498): thay `getSheetData(SHEETS.HO_SO).find(...)` → `_getDocById(id)`.
- [X] T009 [US1] `apps/docmgr/src/server/documents.js` — `updateDocument` (≈ln 749) và `deleteDocument` (≈ln 900): thay tra-1-dòng → `_getDocById(id)`.
- [X] T010 [US1] `apps/docmgr/src/server/documents.js` — luồng nháp `_attachFileToDraft` (≈ln 1240), `finalizeDraft` (≈ln 1313), `cancelDraft` (≈ln 1439): thay → `_getDocById(id)`.
- [X] T011 [US1] `apps/docmgr/src/server/documents.js` — `transitionDocument` (≈ln 1510), `publishDocument` (≈ln 1757), `setDocumentViewers` (≈ln 1819): thay → `_getDocById(id)`.
- [X] T012 [US1] `apps/docmgr/src/server/documents.js` — `addComment` (≈ln 1853 + 1875): gộp còn **một** `_getDocById(id)`, tái dùng cho cả kiểm tra quyền lẫn lấy danh sách phụ trách.
- [X] T013 [US1] Chạy jest docmgr; bảo đảm các suite chạm điểm SINGLE-ID xanh: `documents.test.js`, `controller.test.js`, `documentPerms.test.js`, `file-deletion.test.js`, `drive-picker.test.js`, `import.test.js`.

**Checkpoint US1**: đường đọc 1-hồ-sơ không còn full-read; MVP giao được.

---

## Phase 4: User Story 2 — Cập nhật / xoá một hồ sơ không quét cả sheet (P2)

**Goal**: định vị dòng để update/delete bằng TextFinder, không full-scan; giữ nguyên khoá ghi + ngữ nghĩa.

**Independent Test**: trên sheet lớn, sửa 1 trường → đúng dòng đổi, dòng khác nguyên; xoá → đúng dòng; 2 ghi đồng thời khác ID không clobber.

### Tests for US2 (viết TRƯỚC)

- [X] T014 [US2] Test trong `apps/docmgr/src/server/__tests__/documents.test.js`: update/delete định vị đúng dòng trên sheet nhiều dòng; ID không tồn tại → ném `'Không tìm thấy bản ghi ID'`; xoá đúng dòng giữa sheet (không lệch index). Bảo đảm phản ánh đường mới.

### Implementation for US2

- [X] T015 [US2] `packages/gas-core/sheets-crud.js` — `_updateRowUnlocked` (≈ln 166): thay `getDataRange().getValues()` + quét tuyến tính bằng `_findRowIndexById`; đọc header để map cột; `setValue` các cột khớp `updatedFields`; giữ `invalidateSheetCache` + ném khi không tìm thấy; trả `true`.
- [X] T016 [US2] `packages/gas-core/sheets-crud.js` — `_deleteRowUnlocked` (≈ln 187): định vị qua `_findRowIndexById` → `sheet.deleteRow(row)`; giữ `invalidateSheetCache` + ném khi không tìm thấy; trả `true`.
- [X] T017 [US2] Chạy jest **cả 3 app** dùng chung gas-core (Constitution VII): `apps/docmgr` (bắt buộc), `apps/sso-portal`, `apps/license-server` (nếu có cấu hình jest) — tất cả xanh.

**Checkpoint US2**: đường ghi không còn full-scan; an toàn ở 10k+ dòng.

---

## Phase 5: User Story 3 — Tra cứu tập con / thống kê qua gviz (P3)

**Goal**: kiểm tra ràng buộc tham chiếu + thống kê đẩy lọc/đếm xuống nguồn (gviz), gộp 1 truy vấn, no-cache, retry-rồi-lỗi không fallback.

**Independent Test**: xoá Danh Mục đang được hồ sơ dùng → bị chặn; danh mục trống → cho xoá; thống kê khớp số liệu cũ; gviz lỗi → báo lỗi rõ, không full-read.

### Tests for US3 (viết TRƯỚC)

- [X] T018 [US3] ~~Nâng mock `UrlFetchApp` hàng đợi~~ — KHÔNG cần: stats chỉ gọi gviz 1 lần, `_nextResponse` đủ. Bỏ.
- [X] T019 [US3] Test FR-007 (retry → ném lỗi, KHÔNG fallback full-read) — phủ qua ca `getDocumentStats` "gviz lỗi sau retry → ném" trong `documents.test.js`. (`_countDocsWhere` không build — xem T020/T022.)

### Implementation for US3

- [X] T020 [US3] Cài `_gvizQueryWithRetry(tq)` trong `apps/docmgr/src/server/doc-query.js` (retry hữu hạn FR-007, NO fallback, no-cache) — consumer: `getDocumentStats`. **KHÔNG** build `_countDocsWhere` (consumer duy nhất là `checkReferences` đã DEFER — T022) và `_queryDocsWhere`/`_getDocsByIds` (FR-013 deferred) → tránh code suy đoán (Constitution V).
- [X] T021 [US3] `apps/docmgr/src/server/documents.js` — `getDocumentStats` (≈ln 918): thay full-read + đếm RAM bằng gviz group-by/`count`+`sum`; kết quả tương đương ngữ nghĩa cũ (FR-004) — khẳng định bằng test so sánh.
- [X] T022 [US3] **ĐÃ LÀM** (đảo defer 2026-06-28, xem T035): `checkReferences` (target `SHEETS.HO_SO`) chuyển sang đếm QUA gviz `_countDocRefs`, không full-read. Khớp an toàn cho cả 3 cột: `matchBy:'id'` (Danh Mục, `=` số) và `matchBy:'name'` (Dự Án/NCC, `=` + `matches '.*"v".*'` neo dấu nháy JSON chống khớp chuỗi con). fail-closed khi gviz lỗi. Test: `documents.test.js` describe "checkReferences — ... QUA gviz" + `sheets.test.js` deleteRow in-use.
- [X] T023 [US3] Test ràng buộc tham chiếu + thống kê tương đương; chạy jest docmgr xanh.

**Checkpoint US3**: tra cứu tập con/thống kê qua gviz; hoàn tất phạm vi.

---

## Phase 6: Polish & Verification

- [X] T024 [P] Xác minh SC-004: `grep -rn "getSheetData(SHEETS.HO_SO)" apps/docmgr/src/server` (bỏ `__tests__`) chỉ còn các điểm ALL-ROWS ngoài phạm vi (backfill 512, _getDocumentsInRam 566, _backfillDocViewers 1082, export-catalog 94, file-index 97/119).
  - ⚠️ **Giới hạn cách verify (V1):** grep literal `getSheetData(SHEETS.HO_SO)` KHÔNG bắt được `checkReferences` vì hàm đó đọc `Hồ Sơ` qua biến `getSheetData(ref.targetSheet)`, không qua hằng `SHEETS.HO_SO`. Khi soát SC-004 phải kiểm thêm các đường đọc gián tiếp qua `REFERENCE_MAP`/`ref.targetSheet`.
- [X] T025 [P] Chạy đầy đủ jest 3 app lần cuối; cập nhật trạng thái [checklists/requirements.md](checklists/requirements.md) nếu cần.
- [ ] T026 Smoke test thủ công trên sheet lớn (sau `npm run deploy:docmgr`, chỉ khi user yêu cầu) theo [quickstart.md](quickstart.md): read-after-write, xoá đúng dòng, ràng buộc tham chiếu, gviz lỗi báo rõ.

---

## Dependencies

- **Setup (P1)** → tất cả.
- **Foundational (P2: T003–T005)** → chặn **US1** và **US2**.
- **US3 KHÔNG phụ thuộc Foundational** (dùng gviz, không dùng TextFinder) — chỉ cần Setup + T018. Có thể chạy song song với US1/US2.
- **US1 ⟂ US2**: độc lập nhau (cùng dựa T004). US2 sửa gas-core (khác file documents.js của US1) nhưng cả hai đụng `documents.js` gián tiếp qua test → khuyến nghị làm US1 trước (MVP), rồi US2.
- Trong một story, task cùng file `documents.js`/`sheets-crud.js` chạy **tuần tự** (không [P]).

## Parallel opportunities

- T003 [P] (mock) ∥ T004 (gas-core) — khác file.
- US3 (toàn bộ) ∥ US1/US2 sau khi Setup xong — nếu có 2 người/agent.
- T019 [P] test ∥ T020 cài (test viết trước, file test khác file nguồn).
- Polish T024 [P] ∥ T025 [P].

## Implementation Strategy

- **MVP = US1** (P1): đọc-điểm sống cho 1-hồ-sơ — bỏ phần lớn full-read ở hot path.
- Tăng dần: + US2 (ghi) → + US3 (subset/stats).
- Mỗi story xanh test trước khi sang story sau (TDD; SC-005).

---

## Phase 7: Hoàn thiện & phát sinh khi triển khai (ĐÃ LÀM — cập nhật 2026-06-26)

Phát sinh trong lúc làm; đều đã code + test (docmgr **733 pass**). Xem chi tiết ở [spec.md](spec.md) mục "Triển khai thực tế".

- [X] T027 Hardcode `DOC_COLS_DEF` (config.js) + guard `_assertDocColsOrder` + bump SCHEMA_V 16 (sửa bug thiếu cột "Người kiểm soát" trong map cũ).
- [X] T028 Builder gviz `_gvizQueryBuilder` + `_clause*`; đổi tên rõ nghĩa (`_buildDocListQuery`/`_docColLetters`/`_pad2`/`_fetchDocPage`); tách `_gvizCellValue`/`_gvizDateToStr` (+ `DOC_DATE_COLS`).
- [X] T029 Bỏ snap trang ở server (`_queryDocPage`) → client lo UX; thêm cache-buster `_cb` ở `_fetchGvizTable`.
- [X] T030 `getDocById` + `api_getDocById` (đọc-điểm + quyền xem) + verify đổi-trạng-thái/phát-hành theo ID (DocumentPreview).
- [X] T031 Phần chưa-đọc: rename tab `_Chưa Đọc` + `SHEETS.CHUA_DOC` + migration `_migrateDaDocSheetName`.
- [X] T032 `_resolveUserIds` chuẩn hoá username/email→userId (SSO) + migration `_migrateDaDocUserIdEmails` (RAM-light) + bump SCHEMA_V 16.
- [X] T033 Fix bug `addComment` (delete→`_markUnreadForUsers` báo chưa-đọc).
- [X] T034 Tests bổ sung: builder/guard/migration/resolve/addComment/cache-buster; mock (`createTextFinder`, `setName` re-key, `getValues` đa-dòng).
- [X] T035 `checkReferences` → gviz (đảo defer 2026-06-28): `_countDocRefs` + `REFERENCE_MAP.matchBy`; khớp phần tử mảng JSON bằng `matches` neo dấu nháy (chống khớp chuỗi con); fail-closed. Xem T022.
- [ ] T036 *(thủ công, sau deploy)* Smoke test sheet lớn + xác nhận migration chạy đúng trên copy thật.

### Phase 8: Ổn định ghi + phát sinh khi smoke (ĐÃ LÀM — cập nhật 2026-06-29)

- [X] T037 Sửa thứ tự `DOC_COLS_DEF` khớp sheet thật (`X`=Người được xem … `AC`=Người kiểm soát ở **cuối**) + cập nhật test letter↔tên và `order by Z` (Hạng ưu tiên). Xem spec §"Bổ sung phát sinh".
- [X] T038 Ổn định ghi khi *response rớt* (cross-execution): `gasClient` mutation **không** auto-retry (tránh double-execute → xung đột); client **optimistic** + **xung đột-tại-đích** coi như thành công; `gasRetry` **verify trước khi báo lỗi** + delay `[500,1500,3000]`; server **tách side-effect khỏi save** + **bỏ `flush()`** ở `transitionDocument`/`setDocumentViewers`; bổ sung xử lý `hoanThanhLai` cho nhất quán. Test: `gasClient`/`gasRetry`/`DocumentPreview`/`DocumentModal`/`documentPerms`/`documents` (side-effect resilience). Xem spec §"Ổn định ghi khi response rớt".
- [X] T039 *(ngoài phạm vi gviz)* Phân quyền xem chỉ vai trò toàn quyền (`_canManageViewers`) + snapshot theo danh mục khi tạo (`_viewersForCreate`); `updateDocument` gated; UI ẩn nút phân quyền với người không đủ quyền.
- [X] T040 *(ngoài phạm vi gviz)* Giới hạn ~50 người nhận mỗi lần phát hành (`PublishDialog`): chặn khi TO∪CC > 50 + chỉ báo `n/50`.
- [X] T041 *(huỷ feature 007)* Bỏ hẳn `_FileIndex` + guard "1 file 1 hồ sơ": xoá `file-index.js` (3 override CRUD + `rebuildFileIndex`/`_index*`/`_assertIndexMatchesDocs`), sheet `_FileIndex` (config tab + SHEETS.FILE_INDEX), `_indexFindDoc` ở linkDriveFiles/import. Spec 007 → Superseded. Tests: xoá `file-index.test.js`, cập nhật drive-picker/import/file-deletion.

**Trạng thái:** US1/US2/US3 (gồm checkReferences — T022/T035 đảo defer 2026-06-28) + Phase 7 + Phase 8 hoàn tất; **đã deploy @193**. Còn T036/T026 smoke test thủ công trên sheet lớn (chưa xác nhận).
