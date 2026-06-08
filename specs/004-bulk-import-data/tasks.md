# Tasks: Bulk Import Data

**Input**: Design documents from `/specs/004-bulk-import-data/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-import.md

**Tests**: Not explicitly requested — test tasks excluded.

**Organization**: Tasks grouped by user story. US1 = core import, US2 = preview, US3 = result report.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Prepare build pipeline for new server file

- [X] T001 Add `import.js` to server concat order in `scripts/bundle-server.js` — insert after `documents` and before `main`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Server-side file parsing + import endpoints — MUST complete before UI work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create `apps/docmgr/src/server/import.js` — `parseImportFile(token, base64Data, fileName)`: requireAuth + check role (Quản trị viên/Văn thư) + decode base64 (Utilities.base64Decode) → Blob + convert xlsx → Google Sheet bằng **Drive Advanced Service** `Drive.Files.insert({mimeType: GOOGLE_SHEETS}, blob, {convert:true})` (cần `enabledAdvancedServices` Drive v2 trong appsscript.json) + open with SpreadsheetApp.openById(id), read tab `FileMoi` (fallback sheet đầu) getDataRange().getValues() + map header row → keys bằng **normalize** (bỏ phần `(...)`, trim, lowercase — vì header có hậu tố `(tự động lấy)`/`(Tự động)`) theo bảng trong data-model.md (cột Name đã bỏ, Danh mục ở cột Q) + attach rowIndex (1-based) + DriveApp.getFileById(id).setTrashed(true) cleanup (trong finally) + return { success, rows, totalRows, fileName }
- [X] T003 [P] Add `bulkImportDocuments(token, payload)` to `apps/docmgr/src/server/import.js` — requireAuth + check role + iterate groups + validate (Tên hồ sơ non-empty, Danh mục ID exists in sheet, files non-empty) + addRow to HO_SO per group with status "Hoàn thành" + return ImportResult (created count, totalFiles, errors, warnings)
- [X] T004 Add `api_parseImportFile` and `api_bulkImportDocuments` endpoints in `apps/docmgr/src/server/main.js` — wrap both with `_wrap()`, call corresponding functions from import.js

**Checkpoint**: Server can parse uploaded Excel files and create documents from pre-resolved payload.

---

## Phase 3: User Story 1 — Import hàng loạt documents từ file Excel (Priority: P1) 🎯 MVP

**Goal**: User uploads Excel → server parses → client groups by Tên hồ sơ, resolves all lookups → sends to server → documents created

**Independent Test**: Upload Excel mẫu 10 dòng / 4 documents → 4 documents tạo thành công với đúng file đính kèm

### Implementation for User Story 1

- [X] T005 [P] [US1] Create `apps/docmgr/src/client/utils/importResolver.js` — `groupAndResolve(rows, lookups)`: group rows by tenHoSo, doc info from first row, build files array [{fileId, fileName, mimeType, size}], resolve Danh mục path→ID (split ` / `, traverse lookups.danhMuc parent-child), resolve Phụ trách email→userId, resolve Người phối hợp emails→userIds (using lookups.users), match Dự án and NCC names, detect doc-level conflicts across rows in same group (warn if values differ)
- [X] T006 [P] [US1] Add nav item "Nhập hồ sơ" with icon `upload_file` in `apps/docmgr/src/client/components/Sidebar.jsx` — visible only for roles admin/Quản trị viên/Văn thư
- [X] T007 [US1] Create `apps/docmgr/src/client/components/ImportManager.jsx` — basic import flow: file input (.xlsx only) + upload button → FileReader.readAsDataURL → extract base64 → call api_parseImportFile(token, base64, fileName) → receive rows → call groupAndResolve(rows, lookups) → call api_bulkImportDocuments → show simple success/error message
- [X] T008 [US1] Add page routing for `page === 'import'` in `apps/docmgr/src/client/components/MainApp.jsx` — render `<ImportManager>` with props: token, lookups, session

**Checkpoint**: User Story 1 fully functional — upload Excel → documents created. Basic success/error feedback.

---

## Phase 4: User Story 2 — Xem trước và xác nhận trước khi import (Priority: P2)

**Goal**: After Excel is parsed and resolved, show preview table before importing. User can confirm or cancel.

**Independent Test**: Upload Excel → preview table shows document names, file counts, category, errors → cancel does nothing, confirm creates documents

### Implementation for User Story 2

- [X] T009 [US2] Add preview state to `apps/docmgr/src/client/components/ImportManager.jsx` — after groupAndResolve, switch to preview mode instead of auto-importing. Show table: Tên hồ sơ, Danh mục (resolved name), Số file, Trạng thái (✅/❌/⚠️). Show warnings (doc-level conflicts between rows) and errors (missing category, empty G_ID) with exact row numbers. Add "Import" and "Hủy" buttons. "Hủy" clears state. "Import" sends only valid groups to server.

**Checkpoint**: User Story 2 complete — preview step with validation, confirm/cancel before import.

---

## Phase 5: User Story 3 — Xem kết quả import (Priority: P3)

**Goal**: After import completes, show detailed result report with success count and error details

**Independent Test**: Import mix of valid and invalid rows → result shows "Đã tạo X hồ sơ (Y file). Z dòng lỗi." with error detail per row

### Implementation for User Story 3

- [X] T010 [US3] Add result state to `apps/docmgr/src/client/components/ImportManager.jsx` — after server returns ImportResult, switch to result mode. Show summary: "Đã tạo {created} hồ sơ ({totalFiles} file)." + error count. Show error detail table: group name, error message, row numbers in Excel. Show warnings list. Add "Import thêm" button to reset state for next import.

**Checkpoint**: All user stories complete. Full flow: upload → preview → confirm → result.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases and UI refinement

- [X] T011 [P] Add loading spinner in `apps/docmgr/src/client/components/ImportManager.jsx` during file upload/parse and server import (reuse existing spinner pattern from DocumentManager)
- [X] T012 [P] Add file size validation in `apps/docmgr/src/client/components/ImportManager.jsx` — reject files > 5MB with clear error message before uploading
- [X] T013 [P] Add row count validation in `apps/docmgr/src/server/import.js` parseImportFile — reject if > 1000 rows with clear error
- [X] T014 Handle duplicate G_ID within import in `apps/docmgr/src/client/utils/importResolver.js` — detect and warn, keep first occurrence only

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core import flow
- **US2 (Phase 4)**: Depends on Phase 3 — adds preview to existing flow
- **US3 (Phase 5)**: Depends on Phase 3 — adds result display to existing flow
- **Polish (Phase 6)**: Depends on Phase 3 minimum

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — MVP standalone
- **US2 (P2)**: Depends on US1 (modifies ImportManager flow to add preview step)
- **US3 (P3)**: Depends on US1 (modifies ImportManager flow to add result step). Can be done in parallel with US2.

### Within Each User Story

- T005 and T006 can run in parallel (different files)
- T007 depends on T005 (needs groupAndResolve) and T002 (needs parseImportFile)
- T008 depends on T007 (needs ImportManager component)

### Parallel Opportunities

```
Phase 2: T002 (parseImportFile) ∥ T003 (bulkImportDocuments) — same file but independent functions
  → Then T004 (main.js api endpoints)

Phase 3: T005 (resolver logic) ∥ T006 (sidebar nav)
  → Then T007 (ImportManager) → T008 (routing)

Phase 4-5: US2 (T009) ∥ US3 (T010) can run in parallel if both
  modify ImportManager in non-conflicting state sections

Phase 6: T011 ∥ T012 ∥ T013 ∥ T014 (all independent)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T004)
3. Complete Phase 3: User Story 1 (T005-T008)
4. **STOP and VALIDATE**: Upload test Excel, verify documents created correctly
5. Deploy if ready — user can already import data

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. Add US1 → basic import works → **Deploy (MVP!)**
3. Add US2 → preview before import → Deploy
4. Add US3 → result report → Deploy
5. Add Polish → edge cases handled → Deploy

---

## Notes

- Server code (import.js, main.js) uses ES5 `var`/`function` — no arrow functions, no const/let
- Client code (ImportManager.jsx, importResolver.js) uses modern React + hooks
- All lookups resolution happens on client using existing `lookups` from `api_getInitialData`
- Server only validates + saves — thin layer
- `import.js` concat order: after `documents`, before `main`
- No npm dependencies added — Excel parsing uses native GAS APIs (DriveApp + SpreadsheetApp)
- Temp file on Drive is auto-deleted after parsing
