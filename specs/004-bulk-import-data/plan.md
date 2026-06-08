# Implementation Plan: Bulk Import Data

**Branch**: `004-bulk-import-data` | **Date**: 2026-06-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-bulk-import-data/spec.md`

## Summary

Bulk import documents vào docmgr từ file Excel (.xlsx) chứa danh sách file đã upload sẵn lên Drive. Client parse Excel bằng SheetJS → nhóm theo Tên hồ sơ → resolve danh mục phân cấp → validate → preview → server tạo document records với file references (không upload file, chỉ link file ID có sẵn).

## Technical Context

**Language/Version**: JavaScript ES5 (GAS V8 server), React + modern JS (client)

**Primary Dependencies**: SheetJS (xlsx parsing, client-side), existing gas-core modules

**Storage**: Google Sheets (HO_SO, DANH_MUC, APP_ROLES sheets)

**Testing**: Jest via vm.runInContext (server), Jest + jsdom (client)

**Target Platform**: Google Apps Script Web App (iframe trong SSO Portal)

**Project Type**: Web application (GAS server + React client)

**Performance Goals**: Import 100 file (30 docs) trong dưới 5 phút

**Constraints**: GAS 6-minute execution limit, 50MB payload limit cho google.script.run, no ES6+ on server

**Scale/Scope**: Dưới 1000 dòng/lần import, single user operation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. GAS Concatenation | PASS | New server file `import.js` added before `main.js` in concat order |
| II. Shared Core, App Override | PASS | Import logic is app-specific, thuộc `apps/docmgr/src/server/`. Không sửa gas-core |
| III. Security-First Secrets | PASS | Không có secrets mới |
| IV. SSO Parent-Child | PASS | Dùng `requireAuth(token)` hiện có. Email→userId resolve qua parent sheet |
| V. Surgical Changes | PASS | Thêm file mới, chỉ sửa minimal: Sidebar.jsx (thêm nav item), MainApp.jsx (thêm page render), main.js (thêm api endpoint) |
| VI. Sheets-as-Database | PASS | Dùng `addRow()` hiện có. Validate danh mục trước khi insert |
| VII. Test via vm.runInContext | PASS | Test import.js qua vm.runInContext, mock SheetJS data |
| VIII. Shared Design System | PASS | Dùng Tailwind + MD3 tokens hiện có |

## Project Structure

### Documentation (this feature)

```text
specs/004-bulk-import-data/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: technical decisions
├── data-model.md        # Phase 1: data structures
├── quickstart.md        # Phase 1: dev setup guide
├── contracts/           # Phase 1: API contracts
│   └── api-import.md    # Import API endpoint contract
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
apps/docmgr/
├── src/
│   ├── server/
│   │   ├── import.js          # NEW: bulk import logic (server-side)
│   │   ├── documents.js       # MODIFY: extract reusable helpers if needed
│   │   ├── main.js            # MODIFY: add api_bulkImportDocuments endpoint
│   │   └── config.js          # NO CHANGE (reference only)
│   └── client/
│       ├── components/
│       │   ├── ImportManager.jsx   # NEW: import UI (upload, preview, results)
│       │   ├── Sidebar.jsx         # MODIFY: add nav item
│       │   └── MainApp.jsx         # MODIFY: add page routing
│       └── utils/
│           └── xlsxParser.js       # NEW: SheetJS wrapper for Excel parsing
├── package.json                    # MODIFY: add xlsx dependency
└── src/server/__tests__/
    └── import.test.js              # NEW: server-side import tests
```

**Structure Decision**: Thêm 1 server file mới (`import.js`) và 1 client component mới (`ImportManager.jsx`). Minimal touches vào existing files (Sidebar, MainApp, main.js). SheetJS parsing isolated trong client util.
