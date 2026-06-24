# Data Model — 012 server-side doc query

**Date**: 2026-06-23 · **Feature**: 012-server-side-doc-query

Chỉ **thêm 3 cột tính sẵn** vào sheet `Hồ Sơ`. Không đổi cột hiện có, không đổi luồng nghiệp vụ.

## Sheet `Hồ Sơ` — cột mới

Headers hiện tại (config.js, 25 cột): `ID, Tên hồ sơ, Danh mục, Ngày ban hành, Ngày kết thúc, Tệp đính kèm, Tên file, Số hồ sơ, Dự án (Phòng ban), Nhà cung cấp (Nơi ban hành), Giá trị HĐ, Tình trạng, Phụ trách, Người phối hợp, Ghi chú, Nơi lưu hồ sơ cứng, Ngày cập nhật, Người tạo, Người cập nhật, Lịch sử phát hành, Lý do từ chối, Khẩn, Nội dung giao việc, Nội dung phối hợp, Người được xem`.

**Thêm vào cuối** (`ensureMissingColumns` tự thêm khi nâng SCHEMA_V):

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `Hạng ưu tiên` | số 0..3 | Nhóm ưu tiên hiển thị, tính sẵn để `ORDER BY` |
| `Token xem` | chuỗi `\|a\|b\|c\|` | Tập **userId** được xem (theo Tình trạng), lọc quyền bằng `contains '\|<id>\|'` |
| `Blob tìm kiếm` | chuỗi | Gộp 7 trường đã `_viNormalize` (bỏ dấu + lowercase), để tìm kiếm `contains` |

> **SCHEMA_V**: tăng `'12' → '13'` (config.js) để buộc `ensureInitialized()` chạy `ensureMissingColumns` thêm 3 cột, rồi gọi `backfillDocDerived()` (cờ `BACKFILL_DOCDERIVED_V3`) một lần.

> ⚠️ **THỨ TỰ CỘT THẬT ≠ config.js**: sheet đang chạy có 29 cột, thứ tự khác (thêm `Nhóm được xem`, đảo `Người được xem`/`Nội dung phối hợp`) → 3 cột mới ở **AA/AB/AC** chứ không Z/AA/AB. Vì vậy code KHÔNG hardcode chữ cái — `_sheetCols()` đọc header thật (xem research R2/D3). `ensureMissingColumns` chỉ THÊM vào cuối, không sắp lại.

## Công thức từng cột (tính từ object hồ sơ ĐẦY ĐỦ)

### `Hạng ưu tiên` — tái dùng `_docPriorityRank(doc)`
```
Tình trạng != 'Hoàn thành'            → 0   (Chưa hoàn thành)
Hoàn thành & có Phụ trách             → 1
Hoàn thành & có Lịch sử phát hành     → 2
Hoàn thành, không PT, không phát hành → 3
```
(Đã tồn tại; không viết lại.)

### `Token xem` — `_docViewToken(doc)` (status-aware, canonical userId)
- Lấy định danh của: Người tạo; nếu **không Nháp**: + Phụ trách + Người phối hợp; nếu **Hoàn thành**: + Người được xem.
- **Quy đổi mỗi định danh → userId** qua `_getDocUserIdMap()` (tra `_Phân Quyền` docmgr + `_Người Dùng` SSO cha: `Tên đăng nhập`/`Email`/`ID` → `ID`); memo theo-request. Không resolve được → giữ thô. Khử trùng.
- Chuỗi hoá: `'\|' + ids.join('\|') + '\|'` (vd `\|12\|3\|45\|`). Delimiter **`\|`** vì định danh là email chứa `_` (xem research D4).
- Lọc quyền: vai trò thường → `Token xem contains '\|<session.userId>\|'`; full quyền (`admin/Quản trị viên/Giám đốc/Văn thư`) → bỏ token (vẫn ẩn Nháp người khác qua guard).

| Tình trạng | Thành phần token |
|---|---|
| Nháp | Người tạo |
| Chưa hoàn thành (khác Nháp) | Người tạo + Phụ trách + Người phối hợp |
| Hoàn thành | Người tạo + Phụ trách + Người phối hợp + Người được xem |

### `Blob tìm kiếm` — `_docSearchBlob(doc)`
```
_viNormalize([Tên hồ sơ, Số hồ sơ, Dự án (Phòng ban), Nhà cung cấp (Nơi ban hành),
              Ghi chú, Phụ trách, Tên file].join(' '))
```
(7 trường y hệt `getDocuments` keyword hiện tại — FR-016b.)

### Helper tổng hợp
```
_docDerivedColumns(fullDoc) → {
  'Hạng ưu tiên': _docPriorityRank(fullDoc),
  'Token xem':    _docViewToken(fullDoc),
  'Blob tìm kiếm':_docSearchBlob(fullDoc)
}
```

## Vòng đời / quy tắc cập nhật

- **Tính lại tại MỌI điểm ghi** hồ sơ qua wrapper `_addDocRow` / `_updateDocRow` (11 điểm — xem plan §Project Structure). Trigger điển hình: tạo, sửa, lưu nháp, finalize nháp, đặt Người được xem, phát hành (đổi Lịch sử phát hành → rank/token), chuyển trạng thái workflow (đổi Tình trạng → cả 3 cột), import hàng loạt.
- **Không cập nhật hàng loạt**: quyền mức tài liệu ⇒ đổi nhóm/phòng ban của user KHÔNG đụng token hồ sơ nào (FR-014b).
- **Backfill** `backfillDocDerived()`: idempotent, duyệt mọi hồ sơ tính lại 3 cột; chạy 1 lần khi nâng SCHEMA_V. Log số hồ sơ có định danh không resolve được userId.

## Thực thể truy vấn (không lưu trữ)

- **Trang kết quả**: `{ data: Hồ sơ[≤DOC_PAGE_SIZE (20)], page, hasNext }` — hợp đồng giữ nguyên 011 (FR-019).
- **Ngữ cảnh quyền**: `{ role, userId, username }` từ `requireAuth` → chọn nhánh query (full quyền vs token).

## Ràng buộc / bất biến

- Thứ tự cột cũ KHÔNG đổi (gviz tham chiếu theo letter).
- `Ngày cập nhật` giữ định dạng chuỗi ISO (để ORDER BY text desc đúng).
- `Token xem` luôn bắt đầu & kết thúc bằng `|` (để `contains '|id|'` không khớp nhầm).
- 3 cột luôn có giá trị hợp lệ sau backfill (không rỗng gây sai sắp/lọc/tìm).
