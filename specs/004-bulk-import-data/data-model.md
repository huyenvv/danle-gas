# Data Model: Bulk Import Data

## Entities

### ParseResult (server → client, từ api_parseImportFile)

Server đọc file Excel qua SpreadsheetApp, trả về rows JSON cho client.

```
{
  rows: ImportRow[],         // array of row objects (header mapped to keys)
  totalRows: number,         // tổng số dòng (không tính header)
  fileName: string           // tên file gốc
}
```

### ImportRow (client-side, nhận từ server)

Server map header row → key bằng **normalize** (bỏ phần trong ngoặc `(...)`, trim, lowercase) trước khi so khớp. Tên header thực tế ở tab `FileMoi` có hậu tố `(tự động lấy)` / `(Tự động)`, nên KHÔNG so khớp chuỗi nguyên văn.

| Field | Type | Header thực tế (cột) | Normalize key | Required |
|-------|------|---------------------|---------------|----------|
| tenHoSo | string | `Tên hồ sơ` (A) | tên hồ sơ | Yes |
| tenFile | string | `Tên file (tự động lấy)` (B) | tên file | No (auto) |
| link | string | `link (tự động lấy, để xem)` (C) | link | No (chỉ để xem) |
| soHoSo | string | `Số hồ sơ` (D) | số hồ sơ | No |
| ngayBanHanh | string | `Ngày ban hành` (E) | ngày ban hành | No |
| ngayKetThuc | string | `Ngày kết thúc` (F) | ngày kết thúc | No |
| ghiChu | string | `Ghi chú` (G) | ghi chú | No |
| noiLuu | string | `Nơi lưu hồ sơ cứng` (H) | nơi lưu hồ sơ cứng | No |
| duAn | string | `Dự án (Phòng ban)` (I) | dự án | No |
| nhaCungCap | string | `Nhà cung cấp` (J) | nhà cung cấp | No |
| phuTrach | string | `Phụ trách` (K) - 1 email | phụ trách | No |
| nguoiPhoiHop | string | `Người phối hợp` (L) - emails, dấu phẩy | người phối hợp | No |
| giaTriHD | number | `Giá trị HĐ` (M) | giá trị hđ | No |
| gId | string | `G_ID (Tự động)` (N) | g_id | Yes |
| mimeType | string | `MimeType (Tự động)` (O) | mimetype | No (auto) |
| size | number | `Size (Tự động)` (P) | size | No (auto) |
| danhMuc | string | `Danh mục (tự động lấy)` (Q) - path "Cha / Con / Cháu" | danh mục | Yes |
| rowIndex | number | (computed, 1-based dòng Excel) | — | - |

**Lưu ý:** Tab nguồn là `FileMoi` (17 cột A–Q). Cột `Name` đã bị bỏ (trước đây trùng `Tên file`). `Dự án (Phòng ban)` normalize key match bằng tiền tố `dự án`. Cột không có header (R, S...) được bỏ qua.

### ImportGroup (client-side, grouped from ImportRow[])

Các dòng cùng `tenHoSo` được gom lại.

| Field | Type | Description |
|-------|------|-------------|
| tenHoSo | string | Key nhóm — tên document |
| docData | object | Thông tin document từ dòng đầu tiên |
| files | FileRef[] | Danh sách file gom từ tất cả dòng |
| danhMucPath | string | Chuỗi danh mục gốc (từ dòng đầu) |
| warnings | string[] | Cảnh báo khác biệt document-level giữa các dòng |
| errors | string[] | Lỗi validation (empty G_ID, missing category...) |
| rowIndices | number[] | Vị trí dòng trong Excel (để báo lỗi) |

### FileRef (file reference, không upload)

| Field | Type | Maps to HO_SO |
|-------|------|---------------|
| fileId | string | → Tệp đính kèm JSON array `.fileId` |
| fileName | string | → Tệp đính kèm JSON array `.fileName`, Tên file column |
| mimeType | string | → Tệp đính kèm JSON array `.mimeType` |
| size | number | → Tệp đính kèm JSON array `.size` |
| link | string | chỉ dùng ở popup preview (mở tab mới); **không lưu** vào HO_SO (strip trước khi gửi) |

### ImportPayload (client → server, đã resolve sẵn)

Client resolve hết lookups trước khi gửi. Server chỉ validate + save.

```
{
  groups: [
    {
      docData: {
        'Tên hồ sơ': string,
        'Danh mục': number,              // category ID (đã resolve từ path)
        'Số hồ sơ': string,
        'Ngày ban hành': string,
        'Ngày kết thúc': string,
        'Ghi chú': string,
        'Nơi lưu hồ sơ cứng': string,
        'Dự án (Phòng ban)': string,     // tên hoặc ID (đã match từ lookups)
        'Nhà cung cấp (Nơi ban hành)': string,  // tên hoặc ID
        'Phụ trách': string,             // userId (đã resolve từ email)
        'Người phối hợp': string,        // JSON array userIds (đã resolve)
        'Giá trị HĐ': number
      },
      files: [
        { fileId: string, fileName: string, mimeType: string, size: number }
      ]
    }
  ]
}
```

### ImportResult (server → client)

```
{
  success: boolean,
  created: number,           // số documents đã tạo
  totalFiles: number,        // tổng số file đã liên kết
  errors: [
    { group: string, message: string, rowIndices: number[] }
  ],
  warnings: [
    { group: string, message: string, rowIndices: number[] }
  ]
}
```

## Mapping: ImportGroup → HO_SO Row

| ImportGroup field | HO_SO column | Transform |
|-------------------|-------------|-----------|
| docData['Tên hồ sơ'] | Tên hồ sơ | direct |
| docData['Danh mục'] | Danh mục | direct (client đã resolve → leaf ID) |
| docData['Ngày ban hành'] | Ngày ban hành | direct (ISO string) |
| docData['Ngày kết thúc'] | Ngày kết thúc | direct (ISO string) |
| files[] | Tệp đính kèm | `JSON.stringify(files)` |
| files[].fileName joined | Tên file | join bằng `, ` |
| docData['Số hồ sơ'] | Số hồ sơ | direct |
| docData['Dự án (Phòng ban)'] | Dự án (Phòng ban) | direct |
| docData['Nhà cung cấp'] | Nhà cung cấp (Nơi ban hành) | direct |
| docData['Giá trị HĐ'] | Giá trị HĐ | direct |
| (hardcoded) | Tình trạng | `'Hoàn thành'` |
| docData['Phụ trách'] | Phụ trách | direct → `JSON.stringify([userId])` (client đã resolve email→ID) |
| docData['Người phối hợp'] | Người phối hợp | direct → JSON array userIds (client đã resolve) |
| docData['Ghi chú'] | Ghi chú | direct |
| docData['Nơi lưu hồ sơ cứng'] | Nơi lưu hồ sơ cứng | direct |
| (auto) | Ngày cập nhật | current ISO timestamp |
| (auto) | Người tạo | session.username |
| (auto) | Người cập nhật | session.username |
| (empty) | Lịch sử phát hành | `''` |
| (empty) | Lý do từ chối | `''` |
| (empty) | Khẩn | `''` |

## State Transitions

Import flow không thay đổi document workflow hiện tại. Documents tạo ra ở trạng thái "Hoàn thành" — không đi qua approval flow.

## Data Flow

```
1. Client: FileReader → base64 string
2. Client: google.script.run.api_parseImportFile(token, base64, fileName)
3. Server: DriveApp.createFile(blob) → fileId (temp Google Sheet)
4. Server: SpreadsheetApp.openById(fileId) → getValues() → rows[]
5. Server: DriveApp.getFileById(fileId).setTrashed(true) → cleanup
6. Server: return ParseResult { rows, totalRows, fileName }
7. Client: groupAndResolve(rows, lookups) → ImportGroup[]
8. Client: Preview → user confirm
9. Client: google.script.run.api_bulkImportDocuments(token, payload)
10. Server: validate + addRow() per group → return ImportResult
```
