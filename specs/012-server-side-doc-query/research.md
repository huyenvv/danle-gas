# Research — Truy vấn doc list phía máy chủ (gviz/tq)

**Date**: 2026-06-23 · **Feature**: 012-server-side-doc-query

Mọi quyết định dưới đây phục vụ mục tiêu: server chỉ kéo về DOC_PAGE_SIZE (=20) dòng/trang, ngữ nghĩa khớp 011.

---

## R1. Cơ chế truy vấn nguồn: Google Visualization API (gviz/tq)

**Decision**: Dùng endpoint gviz/tq của chính spreadsheet container-bound:
```
https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?gid={GID}&headers=1&tq={ENCODED_TQ}
```
gọi bằng `UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true })`.

**Rationale**: gviz query language hỗ trợ đầy đủ `WHERE / ORDER BY / LIMIT / OFFSET / CONTAINS / IN` chạy phía Google → đúng yêu cầu đẩy lọc+sắp+phân trang. Cùng họ kỹ thuật (UrlFetchApp + OAuth) mà `export-catalog.js` đã dùng cho endpoint export, nên rủi ro hạ tầng thấp.

**Alternatives**:
- *Sheets API `values.get`/`batchGet`*: không có WHERE/ORDER BY → loại.
- *Sheet phụ chứa `=QUERY(...)`*: QUERY có `limit/offset` nhưng phải ghi chuỗi tq vào ô + đọc lại → kẹt race khi nhiều người, kích thước ô, phức tạp hơn → loại làm phương án chính, giữ làm fallback B.

**⚠️ Rủi ro then chốt phải spike TRƯỚC**: gviz/tq cho spreadsheet PRIVATE có chấp nhận `Authorization: Bearer <ScriptApp OAuth token>` không? Nhiều báo cáo cộng đồng: **CÓ**, khi OAuth scope gồm `https://www.googleapis.com/auth/spreadsheets` (hoặc drive.readonly). Container-bound script mặc định có scope spreadsheet hiện hành.
- **Hành động**: Task đầu tiên của implementation là một spike: gọi gviz/tq với `tq=select A limit 1` trên sheet Hồ Sơ, log `getResponseCode()` + 200 ký tự đầu body. Nếu 200 + body `google.visualization.Query.setResponse(...)` → xác nhận. Nếu 401/302→login → kích hoạt **Fallback**.
- **Fallback A**: thêm scope vào manifest (`appsscript.json` oauthScopes: `.../auth/spreadsheets`) rồi re-authorize.
- **Fallback B**: sheet phụ `_DocQuery` với `=QUERY(Hồ Sơ!A2:AB, <tq>, 0)`, ghi tq qua `setFormula`, `SpreadsheetApp.flush()`, đọc `getValues()`; bọc trong `LockService` để tránh race. Cùng API nội bộ `_queryDocPage`, chỉ khác thân.

✅ **KẾT QUẢ SPIKE LIVE (2026-06-23)**: `code=200`, body `...google.visualization.Query.setResponse({"status":"ok",...})`. **gviz/tq xác thực OAuth Bearer trên sheet private OK** — scope `auth/spreadsheets` + `auth/script.external_request` đã có sẵn trong manifest, KHÔNG cần Fallback.

---

## R2. Tham chiếu cột & parse response

**Decision**:
- gviz tham chiếu cột theo **chữ cái** (A, B, …), KHÔNG theo tên header (cũng KHÔNG có cách query theo tên cho sheet).
- ⚠️ **SỬA KHI HIỆN THỰC**: ban đầu định tính letter theo thứ tự hardcode trong config.js. **SAI** — sheet thật có thứ tự cột KHÁC config.js (cột thêm dần qua thời gian, có `Nhóm được xem`, đảo `Người được xem`/`Nội dung phối hợp`) → Token xem thực ở **AB** chứ không phải AA → query đọc nhầm cột → user thường luôn trống. **Fix**: `_sheetCols()` đọc **HÀNG TIÊU ĐỀ THẬT** của sheet → `{tên cột → chữ cái}`, cache 2 tầng (memo-request → ScriptProperties `DOC_COLS_MAP`), tự xoá khi migration đổi cột (+ hàm `clearDocColsCache()` gọi tay).
- Parse: body có tiền tố `/*O_o*/\ngoogle.visualization.Query.setResponse(` và hậu tố `);`. Cắt bằng `indexOf('{')` … `lastIndexOf('}')` rồi `JSON.parse`. `obj.table.cols[i].label` = tên header; map `row.c[i].v` theo **label** (không phụ thuộc thứ tự) → object `{ '<header>': v }`.

**Rationale**: dùng `label` của response để map giá trị (an toàn theo tên); dùng `_sheetCols()` để build WHERE/ORDER theo letter thật.

**Lưu ý — ô ngày (SỬA KHI HIỆN THỰC)**: `Ngày ban hành`/`Ngày kết thúc` là **ô DATE thật** → gviz trả `v = "Date(2026,5,20)"` (tháng 0-based), KHÔNG phải ISO. `_gvizCellValue` đổi `Date(y,m,d[,h,mi,s])` → `'YYYY-MM-DD'` (date) / `'YYYY-MM-DD HH:MM:SS'` (datetime), tránh lệch múi giờ, khớp `formatDate` client. (`Ngày cập nhật` lưu chuỗi ISO → trả string, không đụng.)

---

## R3. Câu truy vấn (ORDER BY, phân trang, tie-breaker)

**Decision** — khung tq (ký hiệu cột minh hoạ):
```
select *
where {visibilityClause} and {draftGuard} [and {categoryIn}] [and {searchClause}]
order by {rankCol} asc, {ngayCapNhatCol} desc, {idCol} desc
limit {DOC_PAGE_SIZE+1} offset {(page-1)*DOC_PAGE_SIZE}
```
- **rankCol** = cột `Hạng ưu tiên` (0..3) tính sẵn → `order by rank asc` thay cho CASE.
- **ngayCapNhatCol** `desc`: cột lưu chuỗi ISO → so sánh chuỗi; ISO 8601 desc == mới nhất trước; chuỗi rỗng nhỏ nhất → xuống cuối nhóm (khớp FR-006). Coi như cột **text** (không để gviz ép kiểu date).
- **idCol** `desc`: tie-breaker xác định (FR-003a).
- **limit DOC_PAGE_SIZE+1**: lấy dư 1 để suy `hasNext`, trả DOC_PAGE_SIZE (=20) dòng đầu. Tránh query COUNT riêng (đúng "không cần tổng số" — FR-010).

**Rationale**: ORDER BY theo cột tính sẵn là cách duy nhất cho 4-nhóm-ưu-tiên vì tq không có CASE/IF. `limit DOC_PAGE_SIZE+1` cho `hasNext` rẻ.

**Alternatives**: query `count()` để biết tổng — bỏ (thừa, tốn thêm 1 round-trip, spec không cần tổng).

---

## R4. Quyền xem mức tài liệu → `visibilityClause` + `draftGuard`

**Decision**:
- **draftGuard** (mọi vai trò): `(L != 'Nháp' or L is null or {creatorCol} = '{me}')` — ẩn Nháp người khác kể cả full quyền (FR-012a). `{me}` = username người tạo. ⚠️ **`L is null` thêm khi hiện thực**: gviz coi `null != 'Nháp'` là null → loại nhầm hồ sơ có Tình trạng rỗng; thêm nhánh này để giữ chúng.
- **Vai trò full quyền** (`admin, Quản trị viên, Giám đốc, Văn thư`): bỏ token → `visibilityClause` = `true` (chỉ còn draftGuard).
- **Vai trò thường**: `visibilityClause` = `{tokenCol} contains '|{userId}|'`.
- **Token canonical theo userId** — mọi định danh (Người tạo/Phụ trách/Người phối hợp/Người được xem) **quy đổi về userId** để query chỉ cần `contains '|<session.userId>|'`.
- ⚠️ **SỬA KHI HIỆN THỰC** (2 vòng):
  - *Delimiter*: ban đầu dùng `_` (`_a_b_`). **SAI** — định danh thật là **email** (`hco_nhanvien_12@gmail.com`) chứa dấu `_` → vỡ ranh giới. **Fix**: đổi sang `|` (ký tự không có trong email/username/userId): `|a|b|c|`.
  - *Resolve*: ban đầu chỉ tra `_Phân Quyền` (docmgr) → email không resolve. **Fix**: `_getDocUserIdMap()` tra **cả `_Người Dùng` của SSO cha** (đủ `Tên đăng nhập`/`Email`/`ID`); memo **theo-request** (không CacheService) → không staleness, user mới nhận ngay ở lần ghi kế.

**Rationale**: token tính sẵn theo Tình trạng (xem data-model) → `contains '|userId|'` đơn đủ thể hiện `_canViewDocument`. Vì người query đã login (chắc chắn có trong `_Người Dùng`), `session.userId` luôn khớp id trong token.

**Risk còn lại**: định danh không resolve được (user off-board / sai chính tả) → giữ thô trong token; query theo id sẽ không khớp → người đó không thấy hồ sơ đó (chấp nhận, hiếm). Backfill log cảnh báo.

---

## R5. Lọc danh mục đệ quy → `categoryIn`

**Decision**: Tính tập hậu duệ trong Apps Script bằng `_categoryDescendantSet(danhMucId)` (đã có ở export-catalog), giới hạn truy vấn theo tập đó. Bỏ qua mệnh đề khi không lọc danh mục.

⚠️ **SỬA KHI HIỆN THỰC**: gviz query language **KHÔNG có toán tử `IN`** (ban đầu định dùng `in (...)` → live báo `PARSE_ERROR`). **Fix**: dùng chuỗi `OR`: `(C = id1 or C = id2 or ...)`. Thêm: cột Danh mục có thể là **số hoặc chuỗi** → với id thuần số phát `(C = 5 or C = '5')` để khớp cả hai kiểu.

**Risk — độ dài URL**: tq nằm trên query string; tập danh mục lớn → URL dài. Giới hạn thực tế URL ~ vài nghìn ký tự. Cây danh mục dự kiến hàng chục–trăm node → an toàn. **Mitigation nếu vượt**: dùng POST? gviz chỉ GET. Phương án: nếu `in (...)` > N phần tử, rơi về lọc danh mục phía server sau khi lấy trang (hiếm) HOẶC chia trang theo nhánh. Ghi nhận, chưa hiện thực (YAGNI) — thêm guard log khi set > 300.

---

## R6. Tìm kiếm toàn tập → `searchClause` + cột Blob

**Decision**: Materialize cột `Blob tìm kiếm` = `_viNormalize(gộp 7 trường: Tên hồ sơ, Số hồ sơ, Dự án, NCC, Ghi chú, Phụ trách, Tên file)` ngăn cách bằng khoảng trắng. Query: `where ... and {blobCol} contains '{viNormalize(keyword)}'`.
- Escape: gviz dùng dấu nháy đơn cho chuỗi; **thay `'` → `''`** trong từ khóa đã chuẩn hóa. `_viNormalize` đã bỏ dấu + lowercase nên ký tự còn lại an toàn; vẫn escape nháy đơn để chắc.
- Từ khóa rỗng → bỏ mệnh đề (trả danh sách thường).

**Rationale**: `contains` của gviz phân biệt dấu/hoa-thường → phải so trên dữ liệu đã chuẩn hóa giống hệt client `viMatch` (cùng thuật toán `_viNormalize`). Giữ đúng 7 trường của 011 (FR-016b).

**Alternatives**: `matches` (regex) — mạnh hơn nhưng dễ injection/khó escape; `contains` đủ cho substring → chọn contains.

---

## R7. Caching & nhất quán

**Decision**: KHÔNG cache kết quả trang ở CacheService trong phạm vi 012 (mỗi trang là truy vấn nhẹ phía Google). Giữ cache hiện có của `getSheetData` cho các tra cứu phụ (danh mục). Polling client (`api_pollUpdates`) vẫn lấy trang-1 không lọc như hiện tại.

**Rationale**: mục tiêu là không đọc cả sheet; gviz đã rẻ. Thêm cache trang dễ gây lệch khi hồ sơ đổi → YAGNI.

**Lưu ý nhất quán**: gviz đọc trực tiếp Sheet → thấy ghi mới nhất sau `SpreadsheetApp.flush()`. Sau khi tạo/sửa hồ sơ, đảm bảo flush trước khi client reload (đã có invalidateSheetCache; thêm flush nếu cần).

---

## R8. Vòng đời 3 cột tính sẵn (đồng bộ)

**Decision**: Một helper thuần `_docDerivedColumns(fullDoc)` trả `{ 'Hạng ưu tiên', 'Token xem', 'Blob tìm kiếm' }` tính từ object hồ sơ ĐẦY ĐỦ (đã merge). Mọi điểm ghi HO_SO đi qua 2 wrapper app:
- `_addDocRow(record)` = gán derived vào record rồi `addRow`.
- `_updateDocRow(id, updates, existingDoc)` = `merged = Object.assign({}, existingDoc, updates)`; gán derived(merged) vào updates rồi `updateRow`.

11 điểm ghi hiện tại (10 ở documents.js: create/update/setViewers/3 nhánh draft/finalize/publish/workflow; 1 ở import.js) thay bằng wrapper. `_docPriorityRank` tái dùng cho cột Hạng.

**Rationale**: tập trung 1 nguồn chân lý cho derived → không sót điểm ghi; khớp constitution "surgical + app override". Vì quyền chỉ mức tài liệu, không phát sinh cập nhật hàng loạt (FR-014b).

**Backfill**: hàm `backfillDocDerived()` chạy một lần (gọi tay qua editor hoặc trong `ensureInitialized` khi nâng SCHEMA_V): duyệt mọi hồ sơ, `_updateDocRow` (hoặc batch) để nạp 3 cột. Idempotent.

---

## R9. Thay đổi phía client

**Decision**: `MainApp.jsx` gửi `searchKeyword` xuống `api_getDocuments` như `filters.keyword`; **bỏ lọc keyword client toàn-cục** (giờ server tìm toàn tập); giữ các lọc phụ (tình trạng/dự án/NCC/phụ trách/đọc/deadline/"Công việc của tôi") áp client trên trang hiện tại; icon ⓘ chú thích phạm vi. Khi search đổi → reset về trang 1.

⚠️ **SỬA KHI HIỆN THỰC**:
- Tìm kiếm **CHỈ chạy khi nhấn Enter** (ban đầu định debounce 400ms). `onChange` chỉ cập nhật ô nhập; `commitSearch(keyword)` chạy khi Enter / xoá (X) / bật "Công việc của tôi".
- **Poll nền tôn trọng filter**: poll lấy trang-1 không lọc; guard áp-trực-tiếp phải kiểm `!keyword && !category && trang===1`, ngược lại silent reload đúng query (gửi keyword + danhMucId) → không đè kết quả đang search.
- **PAGE_SIZE client = 20** (khớp `DOC_PAGE_SIZE` server) — dùng cho suy `hasNext` ở initial-data/poll và đánh số STT.

**Rationale**: FR-016 yêu cầu tìm kiếm toàn tập ⇒ keyword phải xuống server. Các lọc phụ giữ 011 (FR-016a). Enter tránh fire query mỗi lần gõ.

---

## Tóm tắt quyết định

| # | Quyết định |
|---|---|
| R1 | gviz/tq + OAuth Bearer ✅ spike live OK (200); không cần fallback |
| R2 | parse theo `label`; **chữ cái cột đọc từ header THẬT** (`_sheetCols` + cache `DOC_COLS_MAP`); ô ngày `Date(..)` → `YYYY-MM-DD` |
| R3 | order by rank asc, ngàyCN desc, id desc; limit DOC_PAGE_SIZE+1 → hasNext |
| R4 | draftGuard (`+ L is null`); full quyền bỏ token; thường `contains '|userId|'` (delimiter `|`, map về userId qua `_Người Dùng` cha) |
| R5 | `_categoryDescendantSet` → **OR-chain** (gviz không có IN), khớp số/chuỗi |
| R6 | cột Blob = `_viNormalize(7 trường)`; `contains` từ khóa đã normalize; escape `'`→`''` |
| R7 | không cache trang; flush sau ghi |
| R8 | `_docDerivedColumns` + wrapper `_addDocRow`/`_updateDocRow`; backfill idempotent (cờ V3) |
| R9 | client gửi keyword toàn tập **khi nhấn Enter**; lọc phụ giữ client per-page |

---

## R10. Tổng hợp deltas khi hiện thực (live, 2026-06-23)

| # | Vấn đề phát hiện live | Sửa |
|---|---|---|
| D1 | gviz **không có `IN`** → PARSE_ERROR | `(C = a or C = b …)`; khớp cả số lẫn chuỗi |
| D2 | Ô ngày trả `Date(y,m,d)` (tháng 0-based), không phải ISO | `_gvizCellValue` → `YYYY-MM-DD` |
| D3 | **Lệch cột**: sheet thật 29 cột, thứ tự khác config → Token ở AB không phải AA → user thường trống | `_sheetCols()` đọc header thật + cache `DOC_COLS_MAP` (tự xoá khi migration / `clearDocColsCache()`) |
| D4 | Token delimiter `_` vỡ vì email chứa `_` | đổi sang `\|` |
| D5 | Email không resolve qua `_Phân Quyền` | `_getDocUserIdMap` tra thêm `_Người Dùng` SSO cha; memo theo-request (bỏ staleness) |
| D6 | `null != 'Nháp'` loại nhầm hồ sơ trạng thái rỗng | thêm `L is null` vào draftGuard |
| D7 | Search debounce tự chạy | đổi sang **nhấn Enter** |
| D8 | Đợt 3: page size 100→**20**; bộ chọn danh mục **mọi cấp + co gọn** + fix đơ (chặn vòng cha-con); poll nền đè kết quả search; `PAGE_SIZE` client lệch | page-size dùng hằng 2 phía; guard poll thêm `!keyword`; `byId` + cycle-guard ở picker |

**Đã xác minh live**: spike auth OK; VT thấy 260/264 (4 Nháp loại đúng); user 21 thấy 4 (Hoàn thành được xem); user 5 trống đúng (không gán hồ sơ nào). 663 test xanh.
