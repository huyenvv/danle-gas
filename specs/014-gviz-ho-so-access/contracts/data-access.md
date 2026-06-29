# Contract: Hàm seam truy cập Hồ Sơ

Hợp đồng nội bộ (server GAS). Tất cả ES5 `var`/`function`. Không có interface mạng mới — đây là API hàm dùng nội bộ trong concat scope.

## gas-core — `sheets-crud.js`

### `_findRowIndexById(sheet, id) → number`
- **In**: `sheet` (đối tượng Sheet), `id` (số|chuỗi).
- **Out**: số dòng tuyệt đối 1-based; `-1` nếu không có.
- **Ngữ nghĩa**: tìm `String(id)` trong cột `ID` (từ dòng 2) bằng `createTextFinder(...).matchEntireCell(true)`. Không kéo cả sheet vào JS. Ném nếu sheet không có cột `ID`.
- **Dùng bởi**: `_updateRowUnlocked`, `_deleteRowUnlocked` (thay full-scan). Gọi trong lock.

### `_updateRowUnlocked(sheetName, id, updatedFields)` (SỬA) — hợp đồng GIỮ NGUYÊN
- Hành vi đối ngoại không đổi: cập nhật các cột khớp tên trong `updatedFields` cho dòng có `ID===id`; invalidate cache; trả `true`; ném `'Không tìm thấy bản ghi ID: '+id` nếu không có. Chỉ đổi cách định vị dòng (TextFinder).

### `_deleteRowUnlocked(sheetName, id)` (SỬA) — hợp đồng GIỮ NGUYÊN
- Xoá dòng có `ID===id`; invalidate cache; trả `true`; ném nếu không có. Định vị qua `_findRowIndexById`.

## docmgr — `doc-query.js` (seam)

### `_getDocById(id) → object | null`
- **Ngữ nghĩa**: đọc **sống** đúng 1 hồ sơ theo `ID` (TextFinder định vị dòng → đọc 1 dòng → ghép header thành object). KHÔNG gviz, KHÔNG cache.
- **Out**: object hồ sơ (khoá = tên cột) hoặc `null`.
- **Bảo đảm**: phản ánh thay đổi vừa ghi trong cùng request (FR-011/012).

### `_countDocsWhere(whereClause) → number` *(KẾ HOẠCH BAN ĐẦU — KHÔNG cài; xem `_countDocRefs` ở "Seam thực tế")*
- **Ngữ nghĩa (dự kiến)**: `select count(<cột ID>) where <whereClause>` → số nguyên. Thực tế checkReferences cần trả thêm tên hồ sơ mẫu + khớp phần tử mảng JSON nên dùng `_countDocRefs` (trả `{count, sampleDocuments}`) thay vì helper count thuần.
- **Lỗi**: theo FR-007 — retry hữu hạn rồi ném; không fallback.

> Stats (`getDocumentStats`) dùng truy vấn gviz group-by riêng tại chỗ (`select <Tình trạng>, count(<ID>), sum(<Giá trị HĐ>) group by <Tình trạng>`), KHÔNG tách thành helper chung.
> Tất cả hàm gviz dùng `_sheetCols()` cho chữ-cái-cột thật và `_gvizEscape` cho literal.
> **DEFERRED (Const. V):** `_queryDocsWhere` và `_getDocsByIds` (gộp nhiều ID, FR-013) **không** cài lúc này — không call-site nào trong phạm vi dùng. Chỉ thêm khi có luồng thực sự cần.

## docmgr — điểm gọi đổi
- `documents.js` các hàm SINGLE-ID: thay `getSheetData(SHEETS.HO_SO).find(...)` → `_getDocById(id)`.
- `documents.js:getDocumentStats`: thay full-read + đếm RAM → gviz group-by/`_countDocsWhere`. Kết quả tương đương (FR-004).
- `sheets.js:checkReferences` (target `HO_SO`): thay full-read → `_countDocRefs(targetColumn, matchBy, recordName, id)` (G1, 2026-06-28; xem "Seam thực tế").

## Bất biến chung
- Không đổi hợp đồng API client (`api_*`) — chỉ đổi đường dữ liệu bên trong (FR-008).
- Giữ khoá ghi, đồng bộ chỉ mục tệp, cột phụ trợ, kiểm tra tham chiếu (FR-006).

## Seam thực tế đã cài (cập nhật 2026-06-26)

- `doc-query.js`: `_getDocById` (đọc-điểm sống) · `_gvizQueryBuilder(cols)` (builder chainable) · `_buildDocListQuery` + `_clauseDraftGuard/ViewToken/Category/Keyword` · `_fetchDocPage` · `_fetchGvizTable` (có `_cb` cache-buster) · `_gvizQueryWithRetry` · `_docColLetters` (suy từ `DOC_COLS_DEF`) · `_gvizCellValue`/`_gvizDateToStr` (`DOC_DATE_COLS`) · **`_countDocRefs(targetColumn, matchBy, recordName, id)`** (đếm tham chiếu QUA gviz cho checkReferences; `matchBy:'id'` khớp `=` số, `matchBy:'name'` khớp `=` + `matches '.*"v".*'` neo dấu nháy JSON; fail-closed) + `_reEscape` (escape RE2).
- `documents.js`: **`getDocById(token,id)`** (đọc-điểm + quyền xem) · `getDocumentStats` (gviz group-by tại chỗ) · `_resolveUserIds` (username/email→userId qua SSO).
- `main.js`: **`api_getDocById`** (read-only). Client `DocumentPreview` dùng cho **publish** verify theo ID; **transition** nay cập-nhật-lạc-quan khi response rớt (cross-execution có thể đọc cũ → không đọc-lại — xem spec §"Ổn định ghi khi response rớt").
- `config.js`: `DOC_COLS_DEF`/`HO_SO_HEADERS` (nguồn cột) · `_assertDocColsOrder` (guard) · `_migrateDaDocSheetName` + `_migrateDaDocUserIdEmails` (migration trong `ensureInitialized`, SCHEMA_V 16) · `SHEETS.CHUA_DOC`.
- `sheets.js`: **`checkReferences`** (G1, 2026-06-28) nay đếm QUA `_countDocRefs` (không full-read); `REFERENCE_MAP` thêm `matchBy` ('id' cho Danh Mục / 'name' cho Dự Án·NCC); guard chỉ hỗ trợ target Hồ Sơ.
- **NOT cài** (defer/YAGNI): `_countDocsWhere`/`_queryDocsWhere`/`_getDocsByIds` (FR-013 chưa có consumer; checkReferences dùng `_countDocRefs` riêng vì cần khớp tên-hoặc-id + phần tử mảng JSON + tên hồ sơ mẫu). `getDocumentStats` dùng truy vấn group-by riêng, không qua helper chung.
