# Contract — `api_getDocuments` (và nội bộ `_queryDocPage`)

**Feature**: 012 · **Date**: 2026-06-23

Hợp đồng phía client GIỮ NGUYÊN 011 (FR-019). Chỉ bổ sung tham số `keyword` (đã có chỗ nhận ở server) và thay đổi cách thực thi (gviz thay vì đọc-toàn-bộ).

## `api_getDocuments(token, filters)` → `getDocuments(token, filters)`

### Request `filters`
| Field | Bắt buộc | Ý nghĩa | Server-side? |
|---|---|---|---|
| `page` | không (mặc định 1) | Số trang 1-based | ✅ (offset) |
| `danhMucId` | không | Lọc danh mục (gồm hậu duệ, đệ quy) | ✅ (`in (...)`) |
| `keyword` | không | Tìm kiếm toàn tập, không dấu, 7 trường | ✅ (`blob contains`) |
| `tinhTrang`, `duAn`, `nhaCungCap`, `phuTrach`, `nam`, … | không | Lọc phụ | ❌ giữ client per-page (FR-016a) |

> Server CHỈ áp `page` + `danhMucId` + `keyword` vào truy vấn nguồn. Các filter phụ KHÔNG còn áp ở server (client tự lọc trên trang). Tham số phụ nếu gửi lên được bỏ qua (không gây lỗi).

### Response (không đổi)
```json
{
  "data":   [ { /* object hồ sơ: mọi cột sheet, gồm cả 3 cột tính sẵn */ }, ... ],   // ≤ DOC_PAGE_SIZE (20)
  "page":   2,
  "hasNext": true
}
```
- Thứ tự `data`: (Hạng ưu tiên asc) → (Ngày cập nhật desc) → (ID desc).
- `hasNext`: true nếu truy vấn `limit DOC_PAGE_SIZE+1` trả về > DOC_PAGE_SIZE dòng.
- Không có `total` / `totalPages` (đúng 011 — FR-010).
- Lỗi truy vấn nguồn → ném Error có thông điệp rõ (client hiển thị lỗi tải — FR-018).

### Bất biến quyền (FR-012..014)
- Hồ sơ Nháp người khác KHÔNG bao giờ xuất hiện (mọi vai trò).
- Vai trò thường: chỉ hồ sơ có `Token xem` chứa `|<userId>|`.
- Full quyền (`admin, Quản trị viên, Giám đốc, Văn thư`): mọi hồ sơ trừ Nháp người khác.
- `hasNext`/phân trang tính trên tập đã lọc quyền (do lọc nằm trong WHERE).

## Nội bộ — `_queryDocPage(ctx, opts)` (module `doc-query.js`)

Tách riêng để cô lập gviz (seam cho DataStore tương lai).

```
_queryDocPage(
  ctx:  { role, userId, username },
  opts: { page, danhMucId, keyword }
) → { data: Object[], page: Number, hasNext: Boolean }
```

Trách nhiệm:
1. `_sheetCols()` đọc chữ cái cột từ **header thật** (cache `DOC_COLS_MAP`).
2. Build `tq`: WHERE = draftGuard (`L != 'Nháp' or L is null or R = me`) + quyền (full→bỏ; thường→`token contains '|userId|'`) + danh mục (**OR-chain**, gviz không có IN) + search (`blob contains`); ORDER BY rank asc, ngàyCN desc, id desc; LIMIT DOC_PAGE_SIZE+1 OFFSET.
3. `UrlFetchApp.fetch` gviz endpoint với OAuth Bearer → parse `setResponse(...)`.
4. `_gvizRowsToDocs`: map theo **label** của response; đổi ô ngày `Date(..)` → `YYYY-MM-DD`.
5. Cắt DOC_PAGE_SIZE, suy `hasNext`. **FR-011**: page>1 mà rỗng → query lại page 1.

### Hàm con kiểm thử được (unit)
| Hàm | Vào → Ra | Kiểm |
|---|---|---|
| `_buildDocTq(ctx, opts, descendantIds, page, cols)` | → chuỗi tq | WHERE/ORDER/LIMIT theo vai trò; danh mục OR; escape `'`; cols truyền vào |
| `_sheetCols()` | header thật → `{tên→letter}` | Token ở AB khi cột dịch (không hardcode) |
| `_parseGvizResponse(body)` | text → `table` | cắt prefix/suffix, JSON.parse, status error → throw |
| `_gvizRowsToDocs(table)` | table → objects | map theo label; ô `Date(y,m,d)` → `YYYY-MM-DD` |
| `_docViewToken(doc)` | doc → `\|..\|` | status-aware, map về userId, delimiter `\|` |
| `_docSearchBlob(doc)` | doc → chuỗi normalize | 7 trường |
| `_colLetter(i)` | 0→A, 26→AA, 27→AB | biên |

## Test fixtures (mock `UrlFetchApp.fetch`)
- Trả `HTTP 200` body mẫu `/*O_o*/\ngoogle.visualization.Query.setResponse({"status":"ok","table":{"cols":[...],"rows":[...] }});`.
- Case: DOC_PAGE_SIZE+1 dòng → hasNext true & trả DOC_PAGE_SIZE; ít hơn → hasNext false; 0 dòng → data rỗng.
- Case lỗi: code 401/302 hoặc body `status:"error"` → `getDocuments` ném Error.
