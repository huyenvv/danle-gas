# Phase 1 — Internal Contracts: `file-index.js`

Feature nội bộ (không có API ngoài mới). Hợp đồng dưới đây là giao diện mà code khác trong docmgr phụ thuộc. Tất cả ES5 `var`/`function`, global scope.

## Helpers (bookkeeping — module `file-index.js`)

### `_indexSetDocFiles(docId, fileInfos)`
- **In**: `docId` (string/number), `fileInfos` (array `{fileId,...}` — có thể rỗng).
- **Hiệu lực**: `_FileIndex` phản ánh đúng: doc `docId` sở hữu chính xác tập `fileId` trong `fileInfos` — xoá row cũ của `docId` không còn trong tập, thêm row mới. Sau đó `invalidateSheetCache(SHEETS.FILE_INDEX)`.
- **Idempotent**: gọi lại với cùng `fileInfos` không đổi kết quả.
- **Lock**: bọc LockService như CRUD chuẩn.

### `_indexRemoveDoc(docId)`
- **Hiệu lực**: xoá mọi row có `DocID === docId`; invalidate cache.

### `_indexFindDoc(fileId) → docId | null`
- **Ra**: `DocID` đang sở hữu `fileId`, hoặc `null` nếu orphaned. Đọc `_FileIndex` (cached).

### `rebuildFileIndex() → { docs, files }`
- **Hiệu lực**: quét toàn bộ `HO_SO`, dựng lại `_FileIndex` từ cột `Tệp đính kèm` (nguồn sự thật). Trả số liệu để log/audit. Dùng để self-heal.

### `_assertIndexMatchesDocs()` *(dùng trong test)*
- **Ra**: throw nếu `_FileIndex` lệch so với index suy từ `HO_SO`; ngược lại không làm gì. Dùng cuối mỗi test path để bắt lỗi "quên đồng bộ".

## Overrides CRUD (tự động — `file-index.js`)

Đặt ngay sau khi `file-index.js` load. Mọi nhánh khác sheet `HO_SO` delegate nguyên trạng về core.

```text
addRow(sheet, record)      → core add; nếu sheet==HO_SO: _indexSetDocFiles(added.ID, parse(record['Tệp đính kèm'])); return added
updateRow(sheet, id, ch)   → core update; nếu sheet==HO_SO && ch['Tệp đính kèm']!==undefined: _indexSetDocFiles(id, parse(ch['Tệp đính kèm'])); return res
deleteRow(sheet, id)       → nếu sheet==HO_SO: _indexRemoveDoc(id); rồi core delete; return res
```

- **Hợp đồng giữ nguyên**: chữ ký & giá trị trả về của `addRow/updateRow/deleteRow` không đổi với caller.
- **Bất biến đạt được**: sau bất kỳ thao tác ghi `HO_SO` nào, INV-2 đúng.

## Policy (ở module nghiệp vụ — không thuộc file-index.js)

### `linkDriveFiles(token, fileIds, categoryId, draftId, docId?)`
- **Thêm**: trước khi attach, với mỗi `fileId`: `owner = _indexFindDoc(fileId)`; nếu `owner` tồn tại và `owner !== docIcurrent` → **throw** `"File "<tên>" đã thuộc hồ sơ khác"`.
- `docIcurrent` = hồ sơ đang thao tác (draft id thật, hoặc `docId` truyền vào khi sửa). `owner === docIcurrent` ⇒ hợp lệ (re-link, FR-007).

### `bulkImportDocuments(token, payload)`
- **Thêm**: với mỗi file của group, nếu `_indexFindDoc(gId)` tồn tại → bỏ file + push warning (`"File ... đã thuộc hồ sơ khác — bỏ qua"`). Group hết file hợp lệ → lỗi `"Không có file đính kèm"` (đã có sẵn).

### `updateDocument` / `finalizeDraft` — move fail-loud
- Vòng `moveFile` khi `Danh mục` đổi: **bỏ try/catch nuốt lỗi**. Move ném ⇒ thao tác thất bại, không commit đổi danh mục.

## Config (`config.js`)
- `SHEETS.FILE_INDEX = '_FileIndex'`; tabDef headers `['FileID','DocID']`; `SCHEMA_V` 8→9.
