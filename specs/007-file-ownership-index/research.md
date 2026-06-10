# Phase 0 — Research & Decisions

Hầu hết quyết định đã chốt trong quá trình brainstorm với người dùng. Phần này ghi lại lý do và các phương án đã loại.

## D1 — Cơ chế bản ghi sở hữu: sheet `_FileIndex`

- **Decision**: Một sheet riêng `_FileIndex` gồm 2 cột `FileID`, `DocID`. Tra cứu qua `getSheetData(SHEETS.FILE_INDEX)` (đã cache sẵn trong gas-core).
- **Rationale**: Index nhỏ, không chứa blob JSON như `HO_SO` nên vừa giới hạn ~100KB của CacheService và quét nhanh; không phụ thuộc số lượng hồ sơ (SC-003).
- **Alternatives considered**:
  - *Quét toàn bộ `HO_SO` mỗi lần link/import*: `getSheetData(HO_SO)` là blob lớn (mỗi row có `Tệp đính kèm` JSON) → dễ vượt 100KB → đọc lại sheet qua Sheets API mỗi lần. Chậm dần theo dữ liệu. Bị loại.
  - *"Folder = trạng thái" (Inbox)*: đổi UX chọn file (không từ cây danh mục). Người dùng chọn giữ UX hiện tại. Bị loại.
  - *Cache Set fileId dựng từ HO_SO*: lần đầu sau mỗi thay đổi vẫn phải quét HO_SO (vẫn dính 100KB). Bị loại.

## D2 — Đồng bộ index: override CRUD ở tầng dữ liệu (không phải gọi thủ công ở từng hàm)

- **Decision**: Override `addRow`/`updateRow`/`deleteRow` cho riêng `SHEETS.HO_SO` (app-override pattern). Bất kỳ thao tác ghi row hồ sơ nào cũng tự đồng bộ index từ cột `Tệp đính kèm`.
- **Rationale**: Loại bỏ rủi ro "feature tương lai quên cập nhật index" (FR-002): muốn gắn/gỡ file thì bắt buộc ghi row `HO_SO`, mà việc ghi đó tự kéo theo đồng bộ. Hàm nghiệp vụ chỉ còn giữ phần *policy* (reject/drop), không còn *bookkeeping*. Co 6 choke point xuống 3 thao tác CRUD.
- **Cơ chế (late binding)**: Các hàm như `createDocument`, `_attachFileToDraft`, `bulkImportDocuments` gọi global `addRow`/`updateRow`/`deleteRow` theo tên; khi `file-index.js` reassign chúng lúc load, mọi lời gọi runtime về sau dùng bản override. Đã xác minh: app files load sau gas-core, và lời gọi xảy ra ở runtime API.
- **Quy tắc override**:
  - `addRow(HO_SO, record)` → `_indexSetDocFiles(added.ID, parse(record['Tệp đính kèm']))`.
  - `updateRow(HO_SO, id, changes)` → chỉ đồng bộ khi `changes['Tệp đính kèm'] !== undefined` (file thực sự đổi; tránh chi phí thừa khi chỉ đổi field khác).
  - `deleteRow(HO_SO, id)` → `_indexRemoveDoc(id)` (xoá theo DocID, không cần đọc trước).
- **Alternatives considered**: *Gọi `_indexSetDocFiles` thủ công ở từng hàm nghiệp vụ* — đúng nhưng dễ quên ở feature mới (chính nỗi lo của người dùng). *Repository-per-sheet (class)* — vi phạm Constitution I (no classes) + blast-radius lớn. Cả hai bị loại; override là điểm cân bằng.

## D3 — Self-heal: `rebuildFileIndex()` + assertion test

- **Decision**: `rebuildFileIndex()` quét `HO_SO`, dựng lại `_FileIndex` từ nguồn sự thật là cột `Tệp đính kèm`. Test helper `_assertIndexMatchesDocs()` so index lưu == index suy từ docs.
- **Rationale**: Coi `_FileIndex` như *materialized view* rebuild được → mọi sai lệch (kể cả ai đó ghi sheet thô bằng SpreadsheetApp) đều sửa được, không hỏng vĩnh viễn (FR-002a). Assertion làm "quên đồng bộ" thành test đỏ ngay lúc dev (SC-004).
- **Alternatives considered**: Trigger định kỳ gọi `rebuildFileIndex()` — hữu ích nhưng là hạ tầng thêm; để **ngoài phạm vi**, chỉ cung cấp hàm rebuild gọi được thủ công/khi cần.

## D4 — Quy tắc orphaned khi LINK (linkDriveFiles)

- **Decision**: Với mỗi fileId, `owner = _indexFindDoc(fileId)`; nếu `owner` tồn tại và **khác** hồ sơ đích → ném lỗi chặn link, thông báo rõ.
- **Edge — chế độ sửa hồ sơ ('edit')**: `linkDriveFiles` nhận `draftId='edit'` (không phải id thật) nên không tự biết hồ sơ đích. Để re-link file đã thuộc chính hồ sơ đang sửa không bị coi là xung đột: truyền id hồ sơ đang sửa xuống (hoặc loại trừ các fileId đã có trong `Tệp đính kèm` hiện tại của hồ sơ đích). **Decision**: truyền `docId` đang sửa vào `linkDriveFiles` và bỏ qua xung đột khi `owner === docId`.
- **Rationale**: FR-003 + FR-007.

## D5 — Quy tắc orphaned khi IMPORT (bulkImportDocuments)

- **Decision**: Kiểm tra phía **server** trong `bulkImportDocuments`: với mỗi file của group, nếu `_indexFindDoc(gId)` đã tồn tại (thuộc hồ sơ khác) → bỏ file đó + thêm warning (giống xử lý G_ID trùng). Group hết file hợp lệ → lỗi "Không có file đính kèm".
- **Cross-group trong cùng batch**: vì override cập nhật index ngay sau mỗi `addRow`, group sau sẽ thấy file đã có chủ → tự động không thể chiếm lại. Yêu cầu `_indexSetDocFiles` invalidate cache để lần đọc kế tiếp thấy thay đổi.
- **Rationale**: FR-004; giữ mô hình lỗi/cảnh báo theo group sẵn có. Dedup trong-batch ở client (`importResolver`) giữ nguyên.

## D6 — Đổi danh mục: move + fail-loud

- **Decision**: Trong `updateDocument` và `finalizeDraft`, bỏ `try/catch` nuốt lỗi ở vòng `moveFile`. Nếu move thất bại → để lỗi nổi lên, không lưu việc đổi danh mục (không cập nhật một phần).
- **Rationale**: FR-005, FR-006, SC-002. An toàn vì bất biến 1-file-1-doc (D4/D5) khiến move không phá hồ sơ khác.
- **Lưu ý thứ tự**: việc move cần xảy ra **trước** khi ghi row đổi danh mục (hoặc đảm bảo nếu move ném thì không có write nào được commit). Xác minh thứ tự hiện tại trong `updateDocument`/`finalizeDraft` khi implement.

## D7 — Helper xoá trên `_FileIndex`

- **Decision**: `_FileIndex` nhiều row/doc, không khớp ngữ nghĩa `deleteRow(by ID)` của sheets-crud → helper thao tác trực tiếp sheet: đọc range, lọc row theo `DocID`/`FileID`, ghi lại; `invalidateSheetCache(SHEETS.FILE_INDEX)` sau mỗi thay đổi; bọc trong LockService như CRUD chuẩn.
- **Rationale**: Tránh lạm dụng sheets-crud ngoài hợp đồng của nó.

## Mục ngoài phạm vi (xác nhận)

- Lọc/ẩn file đã thuộc hồ sơ khác trong Drive picker (server reject là đủ).
- Đổi mô hình suy danh mục từ folder (`_resolveCategoryForFile`).
- Import tự move file về folder danh mục lúc nhập.
- Trigger định kỳ rebuild (chỉ cung cấp hàm, chưa gắn lịch).
- Tách lớp repository (refactor tương lai).
