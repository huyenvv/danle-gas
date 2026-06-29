# Implementation Plan: Truy cập hồ sơ qua gviz thay vì đọc toàn bộ sheet

**Branch**: `014-gviz-ho-so-access` | **Date**: 2026-06-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-gviz-ho-so-access/spec.md`

## Summary

Loại bỏ các chỗ đọc **toàn bộ** sheet `Hồ Sơ` chỉ để lấy một bản ghi hoặc một tập con. Áp dụng đúng công cụ cho từng loại truy cập:

- **Một bản ghi theo ID (đọc thuần hoặc đọc-trước-khi-ghi)** + **định vị dòng để ghi** → đọc-điểm **trực tiếp trên sheet sống** bằng `TextFinder` trên cột ID (không kéo cả sheet, luôn nhất quán → thỏa read-after-write FR-011/FR-012).
- **Truy vấn nhiều dòng theo điều kiện / đếm-tổng hợp** (kiểm tra ràng buộc tham chiếu, thống kê) → **gviz** (đẩy lọc/đếm xuống nguồn), gộp 1 truy vấn (FR-013), không cache (FR-014).
- **Thao tác cần TẤT CẢ các dòng** (xuất danh mục, backfill/rebuild cột phụ trợ, rebuild chỉ mục tệp) → **ngoài phạm vi** (FR-009), giữ nguyên.

> **Quyết định thiết kế cốt lõi (xem research.md R1):** gviz **không** thể dùng cho đường single-record-rồi-ghi và đọc-lại-sau-ghi vì (a) gviz chỉ đọc, không trả số dòng vật lý để ghi; (b) gviz có độ trễ/cache → vi phạm FR-011/FR-012. Vì vậy đường một-bản-ghi & ghi dùng `TextFinder` (đọc-điểm sống); gviz dành cho truy vấn nhiều-dòng/đếm read-only. Cả hai đều thỏa mục tiêu "không đọc toàn bộ sheet". Đây là tinh chỉnh cách hiểu chữ "qua gviz" ở FR-001.

## Technical Context

**Language/Version**: JavaScript ES5 (`var`/`function`) — GAS V8 runtime, files concat ở build (Constitution I)

**Primary Dependencies**: SpreadsheetApp (TextFinder), UrlFetchApp + gviz/tq endpoint, Sheets Advanced Service (đã dùng ở `batchGetSheetData`), CacheService, LockService

**Storage**: Google Sheets — sheet `Hồ Sơ` (~30 cột, có thể 10k+ dòng)

**Testing**: Jest qua `vm.runInContext` (Constitution VII); mock GAS ở `__tests__/mocks/gas.js`. **Cần bổ sung mock `createTextFinder`** (chưa có).

**Target Platform**: Google Apps Script Web App (docmgr, SSO child)

**Project Type**: web — React client + GAS server; thay đổi **chỉ ở server** (`apps/docmgr/src/server/` + có thể `packages/gas-core/sheets-crud.js`)

**Performance Goals**: Chi phí truy cập một-bản-ghi/ghi **không phụ thuộc N** (tổng số hồ sơ); không timeout ở 10k+ dòng (SC-001/SC-002)

**Constraints**: Read-after-write tức thì (FR-011/012); giữ nguyên khoá ghi, đồng bộ chỉ mục tệp, cột phụ trợ, kiểm tra tham chiếu (FR-006); không đổi hành vi người dùng cuối (FR-008); không fallback full-read khi gviz lỗi (FR-007)

**Scale/Scope**: ~11 điểm SINGLE-ID + 1 điểm SUBSET (referential) + 1 điểm aggregate (stats) trong `apps/docmgr/src/server/`; 2 hàm ghi lõi (`_updateRowUnlocked`/`_deleteRowUnlocked`) ở gas-core

## Constitution Check

*GATE: phải đạt trước Phase 0; tái kiểm sau Phase 1.*

| Nguyên tắc | Liên quan | Đánh giá |
|---|---|---|
| I. GAS Concatenation Discipline | Có | PASS — chỉ sửa thân hàm sẵn có + thêm helper trong file đã nằm đúng thứ tự concat; ES5 thuần; không thêm file mới vào concat order. |
| II. Shared Core, App Override | Có | ⚠️ Cân nhắc — tối ưu `_updateRowUnlocked`/`_deleteRowUnlocked` trong gas-core ảnh hưởng sso-portal & license-server. Hợp lệ vì thay đổi **giữ nguyên ngữ nghĩa** (tìm dòng theo ID → ghi), app-agnostic, chỉ đổi cách tìm dòng. Bắt buộc chạy test cả 3 app. Xem research.md R2. |
| III. Security-First Secrets | Không | N/A — không đụng secrets. |
| IV. SSO Parent-Child | Không trực tiếp | PASS — không đổi luồng auth; gviz/TextFinder chạy trên sheet docmgr hiện hành. |
| V. Surgical Changes, Simplicity | Có | PASS — mỗi thay đổi truy về FR; không refactor lan man; tái dùng seam `doc-query.js` sẵn có. |
| VI. Sheets-as-Database Integrity | Có | PASS — kiểm tra tham chiếu (xoá Danh Mục/Dự Án/NCC) giữ nguyên về ngữ nghĩa, chỉ đổi cách dò (gviz count thay vì full scan). |
| VII. Test via vm.runInContext | Có | PASS với điều kiện thêm mock `createTextFinder`; cập nhật không cần đổi `GAS_CORE_FILES` (không thêm module). |
| VIII. Shared Design System | Không | N/A — không đụng client/UI. |

**Kết luận gate**: PASS (điểm II có justification + nghĩa vụ test 3 app; ghi ở Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/014-gviz-ho-so-access/
├── plan.md              # File này
├── research.md          # Phase 0 — quyết định kỹ thuật
├── data-model.md        # Phase 1 — thực thể + bản đồ call-site + access pattern
├── quickstart.md        # Phase 1 — cách chạy/kiểm thử
├── contracts/
│   └── data-access.md    # Phase 1 — hợp đồng các hàm seam (đọc-điểm/subset/đếm/định vị dòng)
└── checklists/
    └── requirements.md   # Đã có từ /speckit-specify
```

### Source Code (repository root)

```text
packages/gas-core/
└── sheets-crud.js        # SỬA: _updateRowUnlocked / _deleteRowUnlocked → định vị dòng bằng TextFinder
                          #      (THÊM helper _findRowIndexById app-agnostic)

apps/docmgr/src/server/
├── doc-query.js          # THÊM seam đọc: _getDocById (đọc-điểm sống) + _countDocsWhere (gviz count,
│                          #   no-cache); stats group-by tại chỗ. (_queryDocsWhere/_getDocsByIds DEFERRED)
├── documents.js          # SỬA: ~11 điểm SINGLE-ID getSheetData(HO_SO).find(...) → _getDocById;
│                          #   getDocumentStats → _countDocsWhere (gviz aggregate)
├── sheets.js             # SỬA: checkReferences cho target HO_SO → _countDocsWhere (gviz exists)
└── __tests__/
    ├── mocks/gas.js       # THÊM: createTextFinder cho mock Sheet + Range; gviz mock đa-phản-hồi nếu cần
    └── *.test.js          # CẬP NHẬT khi cần để phản ánh đường dữ liệu mới (giữ SC-005: tất cả pass)
```

**Structure Decision**: Web app server-only change. Tái dùng "seam" `doc-query.js` (đã được thiết kế để cô lập truy cập nguồn). Đường ghi tối ưu ở gas-core vì bản chất app-agnostic; mọi thứ khác ở docmgr.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Sửa gas-core `_updateRowUnlocked`/`_deleteRowUnlocked` (ảnh hưởng 3 app) thay vì override riêng docmgr | Full-scan tìm dòng là điểm tốn kém chung; TextFinder thay thế trực tiếp, giữ nguyên ngữ nghĩa, app-agnostic | Override theo tên-sheet ở docmgr phải bọc 2 hàm + rẽ nhánh theo `sheetName`, rối hơn và để lại full-scan cho HO_SO khi gọi qua các đường khác; lợi ích nhỏ hơn rủi ro mã rối |

## Phase 0 — Outline & Research

Xuất → [research.md](research.md). Giải quyết:
- R1: Công cụ cho từng access pattern (gviz vs đọc-điểm sống) + read-after-write.
- R2: Tối ưu gas-core vs override docmgr cho đường ghi.
- R3: Định vị dòng theo ID không full-scan trong GAS (TextFinder; chọn range cột ID; xử lý không-tìm-thấy).
- R4: gviz subset/aggregate (count/exists, group by) + escape + kiểu cột hỗn hợp + gộp nhiều ID (FR-013).
- R5: Chính sách no-cache cho đọc-điểm/subset (FR-014) + retry, no-fallback (FR-007).
- R6: Chiến lược test — mock `createTextFinder`, giữ toàn bộ test hiện có pass (SC-005).

## Phase 1 — Design & Contracts

Xuất → [data-model.md](data-model.md), [contracts/data-access.md](contracts/data-access.md), [quickstart.md](quickstart.md).

- data-model: thực thể `Hồ Sơ` + bảng phân loại từng call-site (SINGLE-ID / SUBSET / AGGREGATE / ALL-ROWS-ngoài-phạm-vi).
- contracts: chữ ký + ngữ nghĩa các hàm seam mới.
- quickstart: lệnh build/test, cách kiểm thử thủ công ở sheet lớn.
- Cập nhật con trỏ plan trong `CLAUDE.md` (giữa SPECKIT markers).
