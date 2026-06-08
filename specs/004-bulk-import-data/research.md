# Research: Bulk Import Data

## R1: Excel Parsing trong GAS Environment

**Decision**: Upload file lên Drive → server đọc bằng `SpreadsheetApp.openById()`

**Rationale**:
- SheetJS (xlsx npm) có lỗ hổng bảo mật HIGH severity (Prototype Pollution CVE-2023-30533, DoS) — loại bỏ
- `DriveApp.createFile()` KHÔNG tự convert xlsx → phải dùng **Drive Advanced Service** (`Drive.Files.insert` với `{convert:true}`) để convert xlsx → Google Sheet
- `SpreadsheetApp.openById()` đọc native Google Sheets → trả rows JSON về client
- Không thêm dependency npm nào vào client bundle (chỉ bật advanced service Drive v2, tận dụng scope `drive` đã có)
- Server xóa file tạm trên Drive sau khi đọc xong

**Flow**:
1. Client đọc file thành base64 → gửi lên server qua `google.script.run`
2. Server: `Drive.Files.insert({mimeType: GOOGLE_SHEETS}, blob, {convert:true})` → convert xlsx → Google Sheet, lấy `id`
3. Server: `SpreadsheetApp.openById(id).getSheetByName('FileMoi').getDataRange().getValues()`
4. Server: Map header row (normalize) → trả rows JSON về client
5. Server: `DriveApp.getFileById(id).setTrashed(true)` → xóa file tạm (trong finally)
6. Client: Nhận rows → group/resolve bằng lookups → preview → confirm → gửi payload import

**Setup**: `appsscript.json` thêm `dependencies.enabledAdvancedServices` (Drive v2). Drive API phải được bật trong GCP project liên kết.

**Alternatives considered**:
- SheetJS (xlsx npm package) — HIGH severity vulnerabilities, abandoned on npm. Loại bỏ
- Client-side FileReader + manual xlsx parsing — quá phức tạp, không đáng

**Implementation**: Endpoint mới `api_parseImportFile(token, base64Data, fileName)` trong `import.js`

## R2: Client-Side Resolution Strategy

**Decision**: Resolve hết trên client bằng `lookups` từ `api_getInitialData`, server chỉ validate + save

**Rationale**:
- Client đã có sẵn cache: categories, projects, suppliers, users từ initial load
- Resolve trên client → preview chính xác hơn (user thấy ID thực, lỗi thực trước khi gửi)
- Server code đơn giản hơn — chỉ validate existence + addRow()
- Giảm server processing time (quan trọng với GAS 6-minute limit)

**Client resolves**:
- Danh mục path → leaf ID: tách `/`, duyệt `lookups.categories` theo parent-child
- Dự án, NCC: match tên trong `lookups.projects`, `lookups.suppliers`
- File JSON array: format sẵn `[{fileId, fileName, mimeType, size}]`
- Phụ trách/Người phối hợp: email → userId từ user list trong lookups

**Server chỉ làm**:
- `requireAuth()` + check role
- Validate category ID, file array non-empty
- `addRow()` từng group vào HO_SO

**Alternatives considered**:
- Server-side resolution — thêm code server, chậm hơn, không cần thiết vì client đã có data

## R4: File Reference (no upload)

**Decision**: Tạo file info JSON trực tiếp từ Excel data, không upload lên Drive

**Rationale**:
- File đã có sẵn trên Drive (uploaded bởi app ngoài)
- Chỉ cần construct JSON array format giống createDocument:
  ```json
  [{"fileId": "G_ID", "fileName": "Tên file", "mimeType": "MimeType", "size": Size}]
  ```
- Không cần gọi DriveApp.getFileById() để verify — nếu file ID sai thì link sẽ broken, user sẽ thấy khi mở document
- Validate G_ID format (non-empty string) là đủ

**Alternatives considered**:
- Verify file tồn tại bằng DriveApp.getFileById() — rất chậm cho hàng trăm file (mỗi call ~1-2s), dễ timeout GAS 6-minute limit

## R5: GAS Execution Time Limit

**Decision**: Batch insert, xử lý tuần tự trong 1 API call

**Rationale**:
- GAS limit 6 phút/execution
- addRow() mỗi lần ~200-500ms (write + cache invalidate)
- 30 documents × 500ms = 15s — well within limit
- Nếu cần scale: có thể chunk thành nhiều API calls (mỗi chunk 50 docs)
- Preview/validate chạy riêng (không write) → gần như instant

**Constraints**:
- `google.script.run` payload limit: ~50MB
- 1000 dòng Excel × ~500 bytes/dòng = ~500KB → well within limit
