# Implementation Plan: In / Xuất danh mục hồ sơ ra Excel cho Văn thư

**Branch**: `009-in-danh-muc-ho-so` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-in-danh-muc-ho-so/spec.md`

## Summary

Thêm chức năng cho **Văn thư, Quản trị viên (admin), Giám đốc** chọn một danh mục và xuất ra file Excel (.xlsx) liệt kê các hồ sơ **ở mọi trạng thái trừ "Nháp"** thuộc danh mục đó và mọi danh mục con (đệ quy), theo biểu mẫu cố định 7 cột (STT tự đánh số). File có một sheet tên "Danh mục", người dùng tải về máy.

**Cách tiếp cận kỹ thuật**: tận dụng tối đa hạ tầng sẵn có của docmgr. Server thêm một file `export-catalog.js` (app file mới, tự được bundle) với một hàm xuất; `main.js` thêm `api_exportCatalog` gác quyền bằng helper `_requireAdminOrVanThu` đã có. Tạo .xlsx bằng cách dựng một Google Sheet tạm (sheet "Danh mục"), ghi dữ liệu, export qua `UrlFetchApp` + `ScriptApp.getOAuthToken()` thành blob xlsx → base64, xoá sheet tạm, trả base64 + tên file về client. Client thêm **modal** `ExportCatalogModal` (dựng trên `FormModal` dùng chung + CategoryPickerDropdown) gọi `gasCall`, giải mã base64 → tải file. Mở modal từ tùy chọn "In danh mục hồ sơ" trong dropdown `CreateMenu`; gác theo role (`canExport`) trong `MainApp.jsx`.

## Technical Context

**Language/Version**: JavaScript ES5-style (`var`/`function`) cho server GAS V8; React (JSX, hooks) + Tailwind cho client. No TypeScript.

**Primary Dependencies**: Google Apps Script runtime (SpreadsheetApp, DriveApp, UrlFetchApp, ScriptApp, Utilities); gas-core modules; React + Vite; thư viện sẵn có — không thêm dependency mới.

**Storage**: Google Sheets làm DB (sheet `Hồ Sơ`, `Danh Mục`). Tính năng **chỉ đọc**, không ghi dữ liệu nghiệp vụ. Sheet tạm dùng để sinh xlsx được tạo và xoá trong cùng request.

**Testing**: Jest qua `vm.runInContext` (server, node project) — mirror `setup.js`. Mock GAS trong `mocks/gas.js`.

**Target Platform**: Google Apps Script Web App (child app dưới SSO Portal), trình duyệt desktop/mobile.

**Project Type**: Web (React client + GAS server) trong monorepo npm workspaces.

**Performance Goals**: Xuất xong < 1 phút cho vài trăm hồ sơ (SC-001). Một lần đọc `Hồ Sơ` + `Danh Mục`, lọc trong bộ nhớ.

**Constraints**: ES5 server, một global scope (concat); `main.js` concat cuối; secrets không lộ; server tái kiểm quyền; tiếng Việt Unicode phải đúng trong xlsx (export qua Google Sheets giữ Unicode).

**Scale/Scope**: 1 màn hình client mới, 1 file server mới (~120 dòng), 1 api endpoint, 1 mục nav. Vài trăm hồ sơ/lần xuất là quy mô thực tế.

## Constitution Check

*GATE: kiểm trước Phase 0, kiểm lại sau Phase 1.*

| Nguyên tắc | Trạng thái | Ghi chú |
|---|---|---|
| I. GAS Concatenation Discipline | PASS | File mới `export-catalog.js` được `bundle-server.js` tự gom (readdirSync, loại `__tests__` và tên bắt đầu `_`), xếp trước `main.js`. ES5 `var`/`function`, không arrow/const/let. Đặt tên hàm có tiền tố rõ ràng tránh đụng global. |
| II. Shared Core, App Override | PASS | Logic xuất là app-specific (sheet/role/chuỗi tiếng Việt) → nằm ở app, KHÔNG đụng gas-core. Không cần override. |
| III. Security-First Secrets | PASS | Không thêm secret. Dùng `ScriptApp.getOAuthToken()` runtime (như drive-io). |
| IV. SSO Parent-Child Separation | PASS | Không xử lý login. Quyền (authorization) kiểm tại child qua session role — tái dùng `_requireAdminOrVanThu`. |
| V. Surgical Changes, Simplicity | PASS | Chỉ thêm đúng phần cần: 1 api, 1 file server, 1 trang client, 1 mục nav. Không refactor code lân cận. Không trừu tượng hoá thừa. |
| VI. Sheets-as-Database Integrity | PASS (N/A) | Read-only; không xoá/sửa dữ liệu nên không phát sinh ràng buộc referential. Không bump SCHEMA_V (không đổi schema). |
| VII. Test via vm.runInContext | PASS | Thêm `export-catalog.js` vào `APP_FILES` trong `setup.js` (trước `main.js`). Viết test server cho hàm xuất + gác quyền. Mock `SpreadsheetApp.create`/`UrlFetchApp` nếu cần. |
| VIII. Shared Design System | PASS | Trang client dùng token Tailwind/MD3 + Material Symbols sẵn có. Icon mới (`download`/`file_download`) phải nằm trong giới hạn ~71 — kiểm `sync-icons`. |

**Kết luận gate**: Không vi phạm. Không cần mục Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/009-in-danh-muc-ho-so/
├── plan.md              # File này
├── spec.md              # Đặc tả (đã clarify)
├── research.md          # Phase 0 — quyết định kỹ thuật
├── data-model.md        # Phase 1 — entity & mapping cột
├── quickstart.md        # Phase 1 — cách chạy/kiểm thử thủ công
├── contracts/
│   └── api_exportCatalog.md   # Hợp đồng API server↔client
└── checklists/
    └── requirements.md  # Checklist chất lượng spec
```

### Source Code (repository root)

```text
apps/docmgr/
├── src/
│   ├── server/
│   │   ├── export-catalog.js        # MỚI: exportCatalog(token, categoryId) + helpers
│   │   ├── main.js                  # SỬA: thêm api_exportCatalog (gác _requireAdminOrVanThu)
│   │   └── __tests__/
│   │       ├── setup.js             # SỬA: thêm 'export-catalog.js' vào APP_FILES
│   │       └── exportCatalog.test.js # MỚI: test lọc/đệ quy/STT/quyền/bắt buộc danh mục
│   └── client/
│       └── components/
│           ├── ExportCatalogModal.jsx # MỚI: modal (FormModal) chọn danh mục + nút tải Excel
│           ├── common/FormModal.jsx   # SỬA: thêm prop saveDisabled
│           ├── CreateMenu.jsx         # SỬA: thêm tùy chọn "In danh mục hồ sơ" (onExport) vào dropdown
│           ├── MainApp.jsx            # SỬA: state exportModalOpen + render modal + truyền onExport (canExport)
│           └── Sidebar.jsx            # SỬA: chuyển onExport xuống CreateMenu (không tạo mục menu trái)
```

**Structure Decision**: Giữ nguyên cấu trúc web hiện tại của docmgr (React client + GAS server cùng app). Tính năng là một lát cắt nhỏ: một file server mới theo tiền lệ `import.js`/`file-index.js`, một trang client mới theo tiền lệ `ImportManager.jsx`. Không tạo package/lib mới.

## Complexity Tracking

> Không có vi phạm hiến pháp — bỏ trống.
