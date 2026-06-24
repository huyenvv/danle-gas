# Implementation Plan: Truy vấn doc list phía máy chủ — 10.000+ hồ sơ

**Branch**: `worktree-012-server-side-doc-query` | **Date**: 2026-06-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-server-side-doc-query/spec.md`

## Summary

Thay cách `getDocuments` lấy dữ liệu: thay vì `getSheetData(HO_SO)` đọc TOÀN BỘ sheet rồi lọc/sắp/cắt trang trong RAM, **đẩy lọc + sắp xếp + phân trang xuống Google qua endpoint gviz/tq** (`UrlFetchApp` + OAuth Bearer của `ScriptApp.getOAuthToken()`), chỉ kéo về đúng 100 dòng của trang cần. Để truy vấn nguồn (không có CASE trong ORDER BY, không có hàm JS, phân biệt dấu) làm đúng ngữ nghĩa 011, **materialize 3 cột tính sẵn** trên sheet Hồ Sơ — `Hạng ưu tiên`, `Token xem`, `Blob tìm kiếm` — cập nhật tại MỌI điểm ghi hồ sơ qua một wrapper tập trung, và backfill một lần cho hồ sơ cũ. Quyền xem là **mức tài liệu** (token theo Tình trạng); vai trò full quyền bỏ token nhưng vẫn ẩn Nháp người khác. Hợp đồng trả về client giữ nguyên (`{ data, page, hasNext }`); client gửi thêm `keyword` để tìm kiếm toàn tập.

## Technical Context

**Language/Version**: JavaScript ES5 (`var`/`function`) phía server GAS V8; React + JSX + hooks phía client (Vite).

**Primary Dependencies**: Google Apps Script runtime (`UrlFetchApp`, `ScriptApp.getOAuthToken`, `SpreadsheetApp`, `CacheService`, `LockService`); gas-core (`sheets-crud`, `cache`); không thêm thư viện ngoài.

**Storage**: Google Sheets (sheet `Hồ Sơ`) làm DB. Thêm 3 cột tính sẵn. Truy vấn đọc qua gviz/tq; ghi qua `addRow`/`updateRow` của gas-core.

**Testing**: Jest qua `vm.runInContext` (server), mock GAS trong `mocks/gas.js`. Cần mock `UrlFetchApp.fetch` trả response gviz mẫu cho test `getDocuments`.

**Target Platform**: GAS Web App (child app docmgr) chạy trong iframe SSO; container-bound spreadsheet.

**Project Type**: Web (React client + GAS server) trong monorepo npm workspaces.

**Performance Goals**: Thời gian tải 1 trang gần như phẳng theo tổng số hồ sơ (chênh ≤20% giữa 1k và 10k — SC-001); không chạm giới hạn ~30s của GAS ở 10k+ (SC-002).

**Constraints**: ES5 server-only; giữ hợp đồng `{ data, page, hasNext }` (FR-019); gviz **không có toán tử `IN`** → lọc danh mục bằng OR-chain (giới hạn độ dài URL `tq`); `contains` của gviz phân biệt dấu/hoa-thường → chuẩn hóa cùng `_viNormalize`; gviz tham chiếu cột theo **chữ cái** (đọc header thật, không hardcode); ô ngày trả `Date(y,m,d)`; OAuth scope đã đủ.

> 📌 **Deltas khi hiện thực live** (lệch so với plan gốc) được ghi đầy đủ ở [research.md §R10](research.md). Tóm tắt: IN→OR, ngày `Date(..)`→`YYYY-MM-DD`, chữ cái cột đọc header thật + cache `DOC_COLS_MAP`, token delimiter `|` + map userId qua `_Người Dùng` cha, `L is null` guard, search nhấn Enter.

**Scale/Scope**: 10.000+ hồ sơ; trang 100; sheet `Hồ Sơ` 25 cột hiện có → 28 cột sau khi thêm 3 cột.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá |
|---|---|
| I. GAS Concatenation Discipline | PASS — chỉ sửa file app (`documents.js`, `config.js`, có thể tách `doc-query.js` đặt trước `main.js`); ES5; không đụng entry points ngoài thêm route nếu cần. |
| II. Shared Core, App Override | PASS — logic gviz/tq là app-specific (sheet tên `Hồ Sơ`, tiếng Việt) → đặt ở app, KHÔNG cho vào gas-core. Dùng `getSheetData`/`updateRow` sẵn có. |
| III. Security-First Secrets | PASS — không thêm secret; dùng OAuth token runtime (`ScriptApp.getOAuthToken`), không lưu. |
| IV. SSO Parent-Child Separation | PASS — không đụng auth; `requireAuth(token)` giữ nguyên. |
| V. Surgical Changes, Simplicity First | PASS — tái dùng `_categoryDescendantSet`, `_viNormalize`, `_docPriorityRank`; wrapper ghi tập trung thay vì rải logic. Không refactor ngoài seam dữ liệu doc list. |
| VI. Sheets-as-Database Integrity | PASS — thêm cột ⇒ **bump SCHEMA_V** + `ensureMissingColumns`; backfill một lần; 3 cột là dữ liệu dẫn xuất, không phá referential. |
| VII. Test via vm.runInContext | PASS — thêm mock `UrlFetchApp.fetch`; test parse response + build query + derived columns. |
| VIII. Shared Design System | PASS — thay đổi client tối thiểu (gửi keyword, chỉ báo phạm vi lọc), không đổi token thiết kế. |

**DataStore abstraction (định hướng spec)**: Quyết định — **KHÔNG** dựng lớp DataStore đầy đủ trong tính năng này (YAGNI/V). Thay vào đó cô lập toàn bộ truy vấn nguồn trong một module app `doc-query.js` với API hẹp (`_queryDocPage(...)`), để sau này nhánh `develop` gắn vào adapter SOLID chỉ cần thay phần thân — đúng tinh thần "1 seam" mà không kéo refactor lớn vào đây. Ghi nhận ở research.md.

→ **Gate PASS** (không có vi phạm cần Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/012-server-side-doc-query/
├── plan.md              # File này
├── research.md          # Phase 0 — quyết định gviz/tq, auth, parse, fallback
├── data-model.md        # Phase 1 — 3 cột tính sẵn, công thức, vòng đời
├── quickstart.md        # Phase 1 — cách chạy/kiểm thử thủ công
├── contracts/
│   └── api-getDocuments.md   # Hợp đồng api_getDocuments (req/res) + nội bộ _queryDocPage
└── checklists/requirements.md
```

### Source Code (repository root)

```text
apps/docmgr/src/server/
├── config.js          # +3 cột header HO_SO; bump SCHEMA_V; (ensureMissingColumns tự thêm cột)
├── documents.js       # getDocuments → gọi _queryDocPage; wrapper ghi _addDocRow/_updateDocRow;
│                      #   helper _docViewToken, _docSearchBlob, _docDerivedColumns; backfill
├── doc-query.js       # MỚI — gviz/tq: build query, fetch (OAuth), parse response, map rows→objects
│                      #   (đặt trong concat order TRƯỚC main.js, SAU documents.js)
└── __tests__/
    ├── docQuery.test.js        # MỚI — build query string, parse gviz, derived columns
    ├── documents.test.js       # cập nhật — getDocuments qua mock UrlFetchApp
    └── mocks/gas.js            # +mock UrlFetchApp.fetch (gviz response)

apps/docmgr/src/client/components/
└── MainApp.jsx        # gửi searchKeyword xuống server (keyword); bỏ lọc keyword client toàn-cục;
                       #   giữ các lọc phụ client per-page; chỉ báo "lọc trong trang" cho lọc phụ

scripts/bundle-server.js  # thêm doc-query.js vào danh sách concat app (nếu không auto-glob)
```

**Structure Decision**: Giữ nguyên bố cục monorepo. Tách riêng `doc-query.js` (1 seam truy vấn nguồn) để cô lập rủi ro gviz và mở đường cho adapter DataStore sau này, đúng "Shared Core, App Override" + "Surgical".

## Complexity Tracking

> Không có vi phạm hiến pháp cần biện minh.
