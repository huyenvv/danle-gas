# Implementation Plan: Đảm bảo mỗi file Drive chỉ thuộc một hồ sơ

**Branch**: `007-file-ownership-index` | **Date**: 2026-06-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-file-ownership-index/spec.md`

## Summary

Thiết lập bất biến **"mỗi file Drive chỉ thuộc đúng một hồ sơ"** để thao tác đổi danh mục (di chuyển file) luôn an toàn. Cách tiếp cận: một sheet index nhỏ `_FileIndex` (FileID → DocID) làm bản ghi sở hữu, được **đồng bộ tự động ở tầng ghi dữ liệu** bằng cách override `addRow`/`updateRow`/`deleteRow` cho riêng sheet `HO_SO` (theo app-override pattern của codebase) — nên mọi tính năng tương lai gắn/gỡ file đều giữ index đúng mà không cần biết tới nó. Trên nền đó: chặn link file đã có chủ, import bỏ-file-kèm-cảnh-báo, và bỏ "nuốt lỗi" khi move file lúc đổi danh mục (fail-loud). Kèm hàm `rebuildFileIndex()` self-heal và assertion kiểm tra nhất quán cho test.

## Technical Context

**Language/Version**: JavaScript ES5-style (`var`/`function`) cho server GAS V8 (concat 1 scope); React/JSX client (không đổi trong feature này).

**Primary Dependencies**: gas-core (`sheets-crud`, `cache`, `drive-io`), Google Apps Script services (SpreadsheetApp, DriveApp, CacheService, LockService).

**Storage**: Google Sheets. Sheet mới `_FileIndex` (2 cột `FileID`, `DocID`) trong cùng spreadsheet trung tâm của docmgr.

**Testing**: Jest qua `vm.runInContext` (server project = node). Mocks `mocks/gas.js`.

**Target Platform**: GAS Web App (docmgr child app).

**Project Type**: Web app brownfield — chỉ đụng server docmgr (`apps/docmgr/src/server`).

**Performance Goals**: Kiểm tra "file đã có chủ chưa" khi link/import KHÔNG phụ thuộc số lượng hồ sơ (đọc `_FileIndex` nhỏ, cached; không quét `HO_SO`).

**Constraints**: ES5 only; no classes/arrow/let/const (Constitution I). Sheet mới ⇒ bump `SCHEMA_V` (Constitution VI). Index ghi dưới LockService như CRUD hiện có.

**Scale/Scope**: Vài nghìn hồ sơ, mỗi hồ sơ ≤ vài chục file. `_FileIndex` ~ tổng số file đính kèm.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Đánh giá |
|-----------|----------|
| I. GAS Concatenation Discipline | ✅ Code mới là ES5 `var`/`function`. File app mới `file-index.js` auto-include bởi bundle-server (alphabetical giữa nhóm "others": `documents → file-index → import`), chạy sau gas-core. Override dùng late-binding global — đúng cơ chế. |
| II. Shared Core, App Override | ✅ Logic index là app-specific (tên sheet, tiếng Việt) → đặt ở app docmgr, KHÔNG đụng gas-core. Override `addRow/updateRow/deleteRow` đúng pattern `var _coreFn = fn; fn = function(){...}`. |
| V. Surgical Changes | ✅ Không tạo lớp repository (đã thống nhất); chỉ thêm 1 file + sửa tối thiểu ở các điểm policy. |
| VI. Sheets-as-Database Integrity | ✅ Bất biến tham chiếu enforce trong app code; thêm sheet ⇒ bump `SCHEMA_V` 8→9 + tabDef. |
| VII. Test via vm.runInContext | ✅ Thêm `file-index.js` vào `APP_FILES` trong `setup.js`. Mocks DriveApp/SpreadsheetApp đã đủ. |

**Kết luận**: Không có vi phạm cần justify. (Phương án repository đã cân nhắc & loại — xem Complexity Tracking.)

## Project Structure

### Documentation (this feature)

```text
specs/007-file-ownership-index/
├── plan.md              # This file
├── spec.md              # Feature spec
├── research.md          # Phase 0 — quyết định kỹ thuật
├── data-model.md        # Phase 1 — _FileIndex + quan hệ HO_SO
├── contracts/
│   └── file-index.md    # Phase 1 — hợp đồng các helper + override + policy
├── quickstart.md        # Phase 1 — cách chạy/verify
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
apps/docmgr/src/server/
├── config.js            # SỬA: thêm SHEETS.FILE_INDEX, tabDef _FileIndex, bump SCHEMA_V 8→9
├── file-index.js        # MỚI: helpers index + rebuild + assertion + override CRUD cho HO_SO
├── documents.js         # SỬA: linkDriveFiles (orphaned-check); updateDocument & finalizeDraft (fail-loud move)
├── import.js            # SỬA: bulkImportDocuments (orphaned-check: drop file + warning)
└── __tests__/
    ├── setup.js         # SỬA: thêm 'file-index.js' vào APP_FILES (sau documents.js, trước import.js)
    ├── file-index.test.js   # MỚI: helpers, override sync qua addRow/updateRow/deleteRow, rebuild, assertion
    ├── file-deletion.test.js# (giữ) — bổ sung nếu cần cho move fail-loud
    ├── import.test.js       # SỬA: orphaned drop+warning
    └── documents.test.js    # SỬA/THÊM: link orphaned reject; đổi danh mục move OK & move-fail → fail
```

**Structure Decision**: Brownfield, chỉ tầng server docmgr. Thêm đúng một file mới `file-index.js`; các sửa đổi còn lại là tối thiểu tại các điểm policy. Index sync nằm hoàn toàn trong `file-index.js` để tập trung và dễ kiểm thử.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (Không có vi phạm) | — | Repository-per-sheet bị loại: vi phạm Constitution I (no classes) + blast-radius lớn ngoài phạm vi feature; override đạt cùng mục tiêu "1 choke point ở tầng ghi" với thay đổi tối thiểu, và là bước đệm nếu sau này muốn repository. |
