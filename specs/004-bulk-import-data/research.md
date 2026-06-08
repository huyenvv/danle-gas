# Research: Bulk Import Data

## R1: Excel Parsing trong GAS Environment

**Decision**: Client-side parsing bằng SheetJS (xlsx npm package)

**Rationale**:
- GAS không có native xlsx parsing
- Client-side parsing cho phép preview trước khi gửi server
- SheetJS là library phổ biến, nhẹ (~300KB minified), parse nhanh
- Có thể dùng `XLSX.read()` với FileReader API trên client
- Chỉ gửi JSON data (đã parse) lên server qua `google.script.run`

**Alternatives considered**:
- SpreadsheetApp.openById() (đọc Google Sheet thay vì Excel) — cần thêm bước import thủ công vào Sheet, phức tạp cho user
- Server-side parsing bằng DriveApp — GAS không có xlsx parser, chỉ đọc được native Google Sheets

**Implementation**: `npm install xlsx` trong `apps/docmgr`, import trong `xlsxParser.js`, build bằng Vite

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
