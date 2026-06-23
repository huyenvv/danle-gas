# Implementation Plan: Danh sách hồ sơ phẳng — phân trang & lọc danh mục online

**Branch**: `011-flat-doc-list-pagination` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-flat-doc-list-pagination/spec.md`

## Summary

Thay lối hiển thị danh sách hồ sơ hiện tại (gom theo cây danh mục, mỗi thư mục gốc 10 hồ sơ + "Xem thêm", tải TOÀN BỘ hồ sơ về client rồi lọc offline) bằng **danh sách phẳng phân trang 100 hồ sơ/trang**, sắp theo 4 nhóm ưu tiên, kèm **bộ lọc Danh mục online (server-side)** chọn từ bộ chọn collapse 2 cấp.

Cách tiếp cận kỹ thuật: mở rộng `getDocuments(token, filters)` ở server để (1) nhận `page` + `danhMucId` (lọc đệ quy theo cây con cháu, tái dùng `_categoryDescendantSet`), (2) sắp xếp theo hạng ưu tiên rồi ngày sửa, (3) cắt lát 100 hồ sơ và trả `{ data, page, hasNext }`. Phía client thay `DocumentTable`/`CatGroup` (cây) bằng bảng phẳng + điều khiển Trước/Sau, gắn `CategoryPickerDropdown` (giới hạn 2 cấp) làm bộ lọc danh mục, và chuyển cơ chế nạp danh sách từ "load-all + poll đẩy toàn bộ" sang "nạp/đổi trang theo yêu cầu + poll nạp lại đúng trang hiện tại". Các bộ lọc còn lại (từ khóa, tình trạng, dự án, NCC, năm, đọc/chưa đọc, công việc của tôi) giữ nguyên cơ chế lọc client nhưng chỉ áp trên 100 hồ sơ của trang đang xem.

## Technical Context

**Language/Version**: Server — JavaScript ES5 (`var`/`function`, GAS V8 runtime, code concat'd). Client — React 18 + JSX + hooks, Tailwind CSS.

**Primary Dependencies**: Google Apps Script (SpreadsheetApp, CacheService), Vite, React, Jest (server=node, client=jsdom), Playwright (E2E).

**Storage**: Google Sheets (`Hồ Sơ`, `Danh Mục`) — read-only cho tính năng này. KHÔNG đổi schema, KHÔNG bump `SCHEMA_V`.

**Testing**: Jest qua `vm.runInContext` (server) — `apps/docmgr/src/server/__tests__/documents.test.js`; React Testing Library (client) — `apps/docmgr/src/client/__tests__/Documents.test.jsx`.

**Target Platform**: Google Apps Script Web App (SSO child app), trình duyệt desktop.

**Project Type**: Web app trong monorepo npm workspaces (client + GAS server cùng app `apps/docmgr`).

**Performance Goals**: Payload danh sách về client cố định ≤100 hồ sơ/trang bất kể tổng số (SC-001, SC-005). Thời gian tải 1 trang không tăng khi tổng hồ sơ tăng.

**Constraints**: GAS đọc toàn bộ dòng sheet mỗi lần (không phân trang ở tầng đọc) → sort + cắt lát ở bộ nhớ. Giữ quy tắc quyền (ẩn Nháp, lọc theo vai trò/quyền danh mục) áp TRƯỚC khi phân trang. Server code phải ES5 thuần.

**Scale/Scope**: 1 hàm server (`getDocuments`) mở rộng + 1 comparator/ranker mới; 1 màn hình client (`MainApp` danh sách) tái cấu trúc hiển thị + phân trang + bộ lọc danh mục. Không đụng luồng tạo/sửa/xóa/giao việc/phát hành.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá | Kết luận |
|---|---|---|
| I. GAS Concatenation Discipline | Sửa `documents.js` (app file, concat trước `main.js`); dùng ES5 `var`/`function`; comparator/ranker là function declaration (hoisted toàn cục). Không đổi concat order. | PASS |
| II. Shared Core, App Override | Không sửa gas-core. Logic thuộc app `docmgr`. | PASS |
| III. Security-First Secrets | Không chạm secrets/token/license. | PASS |
| IV. SSO Parent-Child Separation | Không đụng auth/login; `getDocuments` vẫn `requireAuth(token)` như cũ. | PASS |
| V. Surgical Changes, Simplicity | Thay phần gom-thư-mục bằng danh sách phẳng là đúng phạm vi yêu cầu. Tái dùng `_categoryDescendantSet` và `CategoryPickerDropdown` thay vì viết mới. Code grouping cũ được THAY (ẩn/bỏ theo yêu cầu hiển thị mới), không "cải thiện" vùng khác. | PASS |
| VI. Sheets-as-Database Integrity | Read-only; không xóa/sửa lookup; không đổi schema; không bump `SCHEMA_V`. | PASS |
| VII. Test via vm.runInContext | Bổ sung test server cho ranker/sort, lọc danh mục đệ quy, phân trang; test client cho render phẳng + Trước/Sau. | PASS |
| VIII. Shared Design System | Tái dùng token Tailwind/MD3 + `CategoryPickerDropdown` sẵn có; không thêm icon mới (giữ giới hạn ~71 icon). | PASS |

**Kết quả: PASS — không có vi phạm.** Complexity Tracking để trống.

## Project Structure

### Documentation (this feature)

```text
specs/011-flat-doc-list-pagination/
├── plan.md              # This file
├── research.md          # Phase 0 — quyết định kỹ thuật & tradeoff
├── data-model.md        # Phase 1 — thực thể & quy tắc xếp hạng/lọc
├── quickstart.md        # Phase 1 — cách chạy & kiểm thử thủ công
├── contracts/
│   └── api_getDocuments.md   # Hợp đồng request/response của getDocuments (đã phân trang)
├── checklists/
│   └── requirements.md  # Spec quality checklist (đã có)
└── tasks.md             # Phase 2 (/speckit-tasks — KHÔNG tạo bởi lệnh này)
```

### Source Code (repository root)

```text
apps/docmgr/
├── src/
│   ├── server/
│   │   ├── documents.js          # SỬA: getDocuments (page + danhMucId đệ quy + priority sort + slice 100, trả {data,page,hasNext})
│   │   │                         #      + _docPriorityRank() + _compareByPriority() (ES5, mới)
│   │   ├── export-catalog.js     # ĐỌC: tái dùng _categoryDescendantSet (không sửa)
│   │   ├── main.js               # (có thể) SỬA nhẹ: api_getInitialData/api_pollUpdates truyền page mặc định 1
│   │   └── __tests__/
│   │       └── documents.test.js # SỬA/THÊM: test getDocuments phân trang + sort ưu tiên + lọc danh mục đệ quy
│   └── client/
│       ├── components/
│       │   ├── MainApp.jsx       # SỬA: thay DocumentTable/CatGroup bằng bảng phẳng; thêm state page/hasNext;
│       │   │                     #      điều khiển Trước/Sau; gắn bộ lọc Danh mục online; chỉnh poll → nạp lại trang hiện tại
│       │   └── common/
│       │       └── CategoryPickerDropdown.jsx  # SỬA nhẹ: prop giới hạn hiển thị 2 cấp (maxDepth)
│       └── __tests__/
│           └── Documents.test.jsx # SỬA/THÊM: render danh sách phẳng + Trước/Sau + lọc danh mục
```

**Structure Decision**: Giữ nguyên cấu trúc app `docmgr` (client React + GAS server đồng cư). Thay đổi tập trung ở `documents.js` (server) và `MainApp.jsx` (client list view), tái dùng helper/section sẵn có. Không thêm thư mục/module mới.

## Complexity Tracking

> Không có vi phạm Constitution → bảng để trống.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |
