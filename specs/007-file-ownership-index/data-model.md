# Phase 1 — Data Model

## Sheet mới: `_FileIndex`

Bản ghi sở hữu file — ánh xạ mỗi file đính kèm tới đúng một hồ sơ.

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `FileID` | string | Định danh file Google Drive (giống `fileId` trong `Tệp đính kèm`). **Duy nhất toàn sheet** — đây là bất biến cốt lõi. |
| `DocID` | string/number | `ID` của hồ sơ (`HO_SO`) đang sở hữu file. |

- Tên sheet: hằng `SHEETS.FILE_INDEX = '_FileIndex'` (tiền tố `_` = sheet hệ thống, ẩn với người dùng — đồng nhất với `_Nhật Ký`, `_Đã Đọc`…).
- Header tabDef: `['FileID', 'DocID']`. Tạo trong `_ensureAllTabsExist` khi `ensureInitialized()` chạy với `SCHEMA_V` mới.
- `SCHEMA_V`: **8 → 9** (cả điều kiện kiểm tra lẫn giá trị set trong `config.js`).
- Quan hệ: nhiều row có cùng `DocID` (một hồ sơ nhiều file); mỗi `FileID` xuất hiện **tối đa một lần**.

## Bất biến (invariants)

- **INV-1 (cốt lõi)**: mỗi `FileID` ánh xạ tối đa một `DocID`.
- **INV-2 (đồng bộ)**: tập `(FileID→DocID)` trong `_FileIndex` == tập suy ra từ cột `Tệp đính kèm` của mọi row `HO_SO`. (`rebuildFileIndex()` tái lập; `_assertIndexMatchesDocs()` kiểm tra.)
- **INV-3 (giải phóng)**: file bị gỡ khỏi hồ sơ / hồ sơ bị xoá/huỷ ⇒ `FileID` không còn trong `_FileIndex` ⇒ orphaned, có thể link lại.

## Sheet liên quan (không đổi cấu trúc): `Hồ Sơ` (`HO_SO`)

- Cột `Tệp đính kèm` (JSON array `{fileId, fileName, mimeType, size, linked?}`) là **nguồn sự thật** mà `_FileIndex` phái sinh từ đó.
- Cột `Danh mục` quyết định folder Drive của các file; đổi `Danh mục` ⇒ move file (D6).
- `ID` ổn định suốt vòng đời (nháp ↔ chính thức cùng row).

## Vòng đời bản ghi sở hữu (theo override CRUD)

| Thao tác trên `HO_SO` | Tác động `_FileIndex` |
|------------------------|------------------------|
| `addRow` (create / new draft / import) | set tất cả `fileId` trong `Tệp đính kèm` → `DocID = ID` mới |
| `updateRow` có `Tệp đính kèm` (update / append draft) | đặt lại đúng tập file hiện tại của doc (xoá file đã gỡ, thêm file mới) |
| `updateRow` không có `Tệp đính kèm` (đổi field khác) | không đụng index |
| `deleteRow` (xoá doc / huỷ nháp) | xoá mọi row có `DocID = id` |

## Thực thể logic

- **Bản ghi sở hữu file (File–Document ownership)** = một row `_FileIndex`.
- **Hồ sơ (Document)** = row `HO_SO`.
- **File đính kèm** = phần tử trong `Tệp đính kèm`; `fileId` của nó là khoá liên kết tới `_FileIndex`.
