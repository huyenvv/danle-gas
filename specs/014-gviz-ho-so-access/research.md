# Phase 0 Research: Truy cập hồ sơ qua gviz

## R1 — Công cụ đúng cho từng access pattern (cốt lõi)

**Decision**:
- **SINGLE-ID** (lấy 1 hồ sơ theo ID, dù đọc thuần hay đọc-trước-khi-ghi) → **đọc-điểm trực tiếp trên sheet sống** (`TextFinder` định vị dòng theo ID → đọc đúng 1 dòng đó). KHÔNG dùng gviz.
- **SUBSET / AGGREGATE read-only** (kiểm tra ràng buộc tham chiếu, thống kê) → **gviz** đẩy lọc/đếm xuống nguồn.
- **Định vị dòng để GHI** (update/delete) → cùng `TextFinder` như SINGLE-ID.

**Rationale**:
- FR-011/FR-012 yêu cầu **read-after-write tức thì**. gviz có tầng cache + độ trễ phía Google → có thể trả dữ liệu cũ ngay sau khi ghi. Do đó gviz **không thể** đứng ở đường đọc-trước/đọc-sau-ghi.
- gviz **chỉ đọc** và **không trả số dòng vật lý** → không thể dùng để định vị dòng cần ghi.
- `TextFinder` đọc trạng thái **sống** của sheet (nhất quán, đặc biệt khi chạy trong `LockService`) và **không kéo cả sheet vào JS** (việc tìm chạy phía Google), nên thỏa cả "không full-read" lẫn "read-after-write".
- gviz vẫn là công cụ đúng cho truy vấn **nhiều dòng**/đếm read-only (đã chứng minh ở tính năng doc list 012): tránh kéo N dòng về chỉ để lọc/đếm; độ trễ nhỏ chấp nhận được cho kiểm tra-trước-khi-xoá và thống kê (vốn đã có độ trễ với cache 10').

**Lưu ý hợp đồng với spec**: FR-001 ghi "truy vấn bản ghi qua gviz". Nghiên cứu này **tinh chỉnh**: đường một-bản-ghi dùng đọc-điểm sống thay vì gviz, để không mâu thuẫn FR-011/FR-012. Mục tiêu gốc của người dùng ("không đọc toàn bộ sheet") **vẫn đạt**. → cần xác nhận/được phản ánh khi review plan.

**Alternatives considered**:
- *gviz cho cả single-record*: loại — vi phạm read-after-write; không cho số dòng để ghi.
- *Developer Metadata gắn theo ID để O(1) tra dòng*: mạnh nhưng phức tạp (phải gắn metadata khi thêm/sửa, migration cho 10k dòng cũ) — quá mức cho nhu cầu; để dành nếu TextFinder thành nút cổ chai.
- *Giữ map ID→row trong ScriptProperties*: dễ lệch khi sheet bị sửa tay (xoá/chèn dòng) → rủi ro ghi nhầm dòng; loại.

## R2 — Tối ưu gas-core vs override ở docmgr (đường ghi)

**Decision**: Sửa trực tiếp `_updateRowUnlocked` và `_deleteRowUnlocked` trong `packages/gas-core/sheets-crud.js` để định vị dòng bằng helper mới `_findRowIndexById(sheet, id)` (TextFinder), thay cho `getDataRange().getValues()` + quét tuyến tính. Thêm `_findRowIndexById` vào gas-core.

**Rationale**:
- Thay đổi **giữ nguyên ngữ nghĩa** (tìm dòng theo cột `ID` → ghi/xoá), chỉ đổi cách tìm → app-agnostic, hợp Constitution II.
- Override theo tên-sheet ở docmgr phải bọc 2 hàm và rẽ nhánh `if (sheetName === HO_SO)`, để lại full-scan cho các sheet khác và rối mã — vi phạm tinh thần Simplicity (V).
- Lợi ích lan sang sso-portal/license-server là phụ phẩm tích cực, không phải mục tiêu.

**Nghĩa vụ**: chạy test **cả 3 app** (docmgr/sso-portal/license-server) — Constitution VII. `addRow`/`_addRowUnlocked` dùng `appendRow`, không full-read → không đụng.

**Alternatives considered**: override docmgr-only (loại như trên); để nguyên gas-core và chỉ tối ưu đọc (loại — FR-010 yêu cầu ghi cũng không full-scan).

## R3 — Định vị dòng theo ID không full-scan trong GAS

**Decision**: `_findRowIndexById(sheet, id)`:
1. Xác định cột `ID` từ hàng tiêu đề (`indexOf('ID')`).
2. `lastRow = sheet.getLastRow()`; nếu `<= 1` → không có dữ liệu → trả `-1`.
3. Tạo TextFinder **chỉ trên range cột ID** từ dòng 2: `sheet.getRange(2, idCol+1, lastRow-1, 1).createTextFinder(String(id)).matchEntireCell(true)`.
4. `findNext()` → nếu null trả `-1`; ngược lại `range.getRow()` (số dòng tuyệt đối 1-based).
- Caller đọc đúng 1 dòng: `sheet.getRange(row, 1, 1, lastCol).getValues()[0]` → ghép với header thành object (dùng `rowsToObjects([header, row])[0]` hoặc map thủ công).

**Rationale**:
- `matchEntireCell(true)` tránh khớp một phần (ID `1` không khớp `10`, `21`).
- Giới hạn range vào cột ID tránh khớp nhầm giá trị ID ở cột khác (Constitution VI integrity).
- ID trong sheet có thể là số hoặc chuỗi → so khớp bằng `String(id)`; TextFinder so trên giá trị hiển thị nên khớp cả số. (Edge: định dạng số có thể hiển thị khác — ID hệ thống là số nguyên tăng dần, an toàn; ghi nhận ở data-model edge cases.)

**Alternatives considered**: TextFinder toàn sheet rồi lọc cột (rủi ro khớp nhầm cột); đọc riêng cột ID `getRange(...).getValues()` rồi indexOf (vẫn kéo N ô cột ID về JS — tốt hơn full-row nhưng vẫn O(N) truyền; TextFinder tìm phía server tốt hơn).

## R4 — gviz subset/aggregate, gộp nhiều ID, escape, kiểu cột

**Decision** — thêm vào seam `doc-query.js` **đúng những gì có chỗ dùng** (Constitution V):
- `_countDocsWhere(whereClause)` → dùng `select count(<idCol>) where ... ` (aggregate phía nguồn) → trả số nguyên. Dùng cho kiểm tra tham chiếu ("tồn tại?" = count>0).
- Thống kê (`getDocumentStats`): truy vấn gviz group-by **tại chỗ** `select <Tình trạng>, count(<ID>), sum(<Giá trị HĐ>) group by <Tình trạng>` → tổng hợp phía nguồn, trả bảng nhỏ thay vì kéo mọi dòng. Không tách helper chung.
- Escape: tái dùng `_gvizEscape` (nháy đơn → 2 nháy đơn). Cột số+chuỗi: id thuần số dựng cả `= n` lẫn `= 'n'` (pattern sẵn có ở `_buildDocTq`).

**DEFERRED (cập nhật sau /speckit-analyze)**: KHÔNG cài `_queryDocsWhere` (không call-site dùng) và `_getDocsByIds`/gộp-nhiều-ID (FR-013 — không luồng nào trong phạm vi cần gộp). Chỉ thêm khi xuất hiện nhu cầu thật → tránh code suy đoán.

**Rationale**: đẩy lọc/đếm/tổng hợp xuống nguồn = "filter bằng gviz" đúng nghĩa cho đường nhiều-dòng; chi phí không phụ thuộc N (SC-001).

**Edge — kiểu cột hỗn hợp (memory `reference_gviz_column_type`)**: gviz suy 1 kiểu/cột; cột lẫn số+chuỗi trả rỗng cho ô chuỗi. Cột `ID`, `Danh mục` đã xử lý kiểu kép. `Giá trị HĐ` cần là số để `sum` đúng; nếu lẫn chuỗi, `sum` có thể lệch → giữ logic tổng hợp hiện có làm chuẩn so sánh trong test.

## R5 — No-cache, retry, no-fallback

**Decision**:
- Đọc-điểm (TextFinder) và truy vấn gviz subset/aggregate **không** ghi vào CacheService (FR-014). Cache `data_<sheet>` hiện có chỉ còn phục vụ các đường ALL-ROWS ngoài phạm vi (export/backfill/rebuild) và `_getDocumentsInRam` (tham chiếu/đường lùi).
- gviz lỗi: thử lại hữu hạn (vd 2 lần, đã có tiền lệ xử lý "response rớt" ở commit ab07097) rồi **ném lỗi rõ ràng**; **không** fallback đọc toàn bộ sheet (FR-007).

**Rationale**: đọc-điểm vốn rẻ, cache thêm chỉ tạo rủi ro stale (FR-011). No-fallback giữ đúng mục tiêu loại bỏ full-read (SC-004) và tránh che giấu lỗi.

## R6 — Chiến lược test (giữ SC-005)

**Decision**:
- Thêm `createTextFinder` vào mock `__tests__/mocks/gas.js` cho cả Sheet và Range: tìm trên `_rows` (hỗ trợ `matchEntireCell`), trả đối tượng có `findNext()` → range giả với `getRow()`.
- Vì `_getDocById`/`_findRowIndexById` đọc-điểm sống từ mock sheet (không qua UrlFetchApp), test SINGLE-ID/ghi hiện có chạy nguyên đường mới mà **không** cần set `UrlFetchApp._nextResponse`.
- Test cho `_countDocsWhere`/stats: mock gviz qua `UrlFetchApp._nextResponse` (pattern sẵn có ở `docQuery.test.js`). Mỗi flow US3 chỉ gọi gviz 1 lần → `_nextResponse` đủ; chỉ nâng thành hàng đợi `_responses[]` nếu một test cần >1 phản hồi.
- Bổ sung test: đọc-điểm theo ID không-tồn-tại; ghi định vị đúng dòng trên sheet nhiều dòng; referential count khớp ngữ nghĩa cũ; read-after-write (ghi rồi `_getDocById` thấy giá trị mới).

**Rationale**: bám Constitution VII; tối thiểu hoá churn; chứng minh tương đương ngữ nghĩa (FR-004/FR-008) và read-after-write (FR-011).

## Tổng hợp quyết định

| # | Quyết định | FR thỏa |
|---|---|---|
| R1 | single-record & ghi: đọc-điểm sống (TextFinder); nhiều-dòng/đếm: gviz | FR-001,002,011,012 |
| R2 | tối ưu đường ghi ở gas-core (app-agnostic) | FR-005,010 |
| R3 | `_findRowIndexById` qua TextFinder cột ID, matchEntireCell | FR-005,010 |
| R4 | `_countDocsWhere` + stats group-by tại chỗ + escape (gộp-ID/_queryDocsWhere DEFERRED) | FR-002,003 |
| R5 | no-cache đọc-điểm/subset; retry rồi lỗi, no full-read fallback | FR-007,014 |
| R6 | mock createTextFinder + hàng đợi gviz; test tương đương + RAW | FR-004,008; SC-005 |
