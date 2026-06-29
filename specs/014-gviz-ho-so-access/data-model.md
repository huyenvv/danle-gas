# Phase 1 Data Model: Truy cập hồ sơ qua gviz

## Thực thể

### Hồ Sơ (document record)
- **Sheet**: `Hồ Sơ` (hằng `SHEETS.HO_SO` ở `config.js`). Schema 29 cột (xem `config.js:59` / `DOC_QUERY_HEADERS`).
- **Khoá**: cột `ID` — số nguyên duy nhất, tăng dần (`getNextId`).
- **Cột phụ trợ (012/013)**: `Hạng ưu tiên`, `Token xem`, `Blob tìm kiếm` — tính sẵn khi ghi (`_docDerivedColumns`), KHÔNG đổi trong tính năng này.
- **Bất biến cần giữ**: thứ tự cột thật do `_sheetCols()` đọc từ header (không hardcode); kiểu cột `ID`/`Danh mục` có thể số hoặc chuỗi.

### Truy vấn (filtered query) — khái niệm, không phải bản ghi
- **single-id**: định vị + đọc đúng 1 dòng theo `ID` (sống).
- **subset**: tập dòng khớp điều kiện (gviz).
- **aggregate**: count/sum/group-by phía nguồn (gviz).

## Bản đồ call-site & access pattern (nguồn: khảo sát code)

### TRONG PHẠM VI

| File:line | Hàm | Pattern | Đổi sang |
|---|---|---|---|
| documents.js:498 | `_updateDocRow` | SINGLE-ID (đọc-trước-ghi) | `_getDocById` |
| documents.js:749 | `updateDocument` | SINGLE-ID | `_getDocById` |
| documents.js:900 | `deleteDocument` | SINGLE-ID | `_getDocById` |
| documents.js:1240 | `_attachFileToDraft` | SINGLE-ID | `_getDocById` |
| documents.js:1313 | `finalizeDraft` | SINGLE-ID | `_getDocById` |
| documents.js:1439 | `cancelDraft` | SINGLE-ID | `_getDocById` |
| documents.js:1510 | `transitionDocument` | SINGLE-ID | `_getDocById` |
| documents.js:1757 | `publishDocument` | SINGLE-ID | `_getDocById` |
| documents.js:1819 | `setDocumentViewers` | SINGLE-ID | `_getDocById` |
| documents.js:1853 | `addComment` (perm) | SINGLE-ID | `_getDocById` |
| documents.js:1875 | `addComment` (assignees) | SINGLE-ID | tái dùng kết quả `_getDocById` của 1853 (1 lần đọc) |
| documents.js:918 | `getDocumentStats` | AGGREGATE | `_countDocsWhere`/group-by gviz |
| sheets.js:122+ | `checkReferences` (target `HO_SO`) | SUBSET/exists | `_countDocsWhere` |
| gas-core sheets-crud.js:166 | `_updateRowUnlocked` | định vị-dòng-ghi | `_findRowIndexById` (TextFinder) |
| gas-core sheets-crud.js:187 | `_deleteRowUnlocked` | định vị-dòng-ghi | `_findRowIndexById` (TextFinder) |

> `addComment` đọc HO_SO 2 lần (1853 perm + 1875 assignees) → gộp còn **1** lần đọc-điểm.

### NGOÀI PHẠM VI (giữ nguyên — FR-009)

| File:line | Hàm | Lý do |
|---|---|---|
| documents.js:512 | `backfillDocDerived` | ALL-ROWS, chạy 1 lần / thủ công |
| documents.js:566 | `_getDocumentsInRam` | ALL-ROWS — đường lùi & tham chiếu ngữ nghĩa test |
| documents.js:1082 | `_backfillDocViewers` | ALL-ROWS, thủ công/diagnostic |
| export-catalog.js:94 | `_buildCatalogRows` | "xuất danh mục" — FR-009 nêu đích danh |

> Đường list chính `getDocuments`/`_queryDocPage` đã dùng gviz từ 012 — không đổi.

## Quy tắc chuyển đổi (validation rules)

1. **SINGLE-ID**: `getSheetData(SHEETS.HO_SO).find(d => String(d.ID)===String(id))` → `_getDocById(id)`. Trả `null` nếu không có (caller giữ nguyên nhánh "không tìm thấy").
2. **Đọc-trước-ghi**: object trả về dùng để merge + tính cột phụ trợ → phải là dữ liệu **sống** (TextFinder), không gviz.
3. **Ghi**: `_findRowIndexById` chạy **trong lock** (đã có ở `updateRow`/`deleteRow`) → nhất quán.
4. **AGGREGATE/SUBSET**: kết quả phải **tương đương ngữ nghĩa** kết quả full-read cũ (FR-004) — test so trực tiếp.
5. **No-cache** cho đường mới (FR-014).
6. **Không tìm thấy khi ghi**: giữ nguyên hành vi hiện tại — ném `'Không tìm thấy bản ghi ID: ' + id`.

## Edge cases (kiểm thử)
- ID không tồn tại → `_getDocById` trả `null`; ghi → ném lỗi như cũ.
- Sheet chỉ có header (`getLastRow() <= 1`) → `_getDocById` `null`, `_countDocsWhere` `0`, không lỗi.
- `matchEntireCell` → ID `1` không khớp `10`/`21`.
- Giá trị có dấu nháy/diacritics trong điều kiện gviz → `_gvizEscape`.
- gviz lỗi sau retry → ném lỗi, KHÔNG full-read fallback.
- Read-after-write: ghi field rồi `_getDocById` thấy giá trị mới (cùng request).
