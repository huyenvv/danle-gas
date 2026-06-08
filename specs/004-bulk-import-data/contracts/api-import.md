# API Contracts: Bulk Import

## Endpoint: `api_parseImportFile`

**Access**: `google.script.run.api_parseImportFile(token, base64Data, fileName)`

**Authorization**: Role `Quản trị viên` hoặc `Văn thư`

### Request

```
token: string       // SSO access token
base64Data: string  // file content as base64 string (from FileReader)
fileName: string    // original file name (e.g. "import-data.xlsx")
```

### Response (success)

```
{
  success: true,
  rows: [
    {
      tenHoSo: string,
      tenFile: string,
      soHoSo: string,
      ngayBanHanh: string,
      ngayKetThuc: string,
      ghiChu: string,
      noiLuu: string,
      duAn: string,
      nhaCungCap: string,
      phuTrach: string,
      nguoiPhoiHop: string,
      giaTriHD: number,
      gId: string,
      mimeType: string,
      size: number,
      danhMuc: string,
      rowIndex: number          // 1-based row in original Excel (for error reporting)
    }
  ],
  totalRows: number,
  fileName: string
}
```

### Response (error)

```
{
  success: false,
  error: "File không đúng định dạng hoặc không có dữ liệu"
}
```

### Server Logic

1. Decode base64 → Blob
2. `Drive.Files.insert({mimeType: GOOGLE_SHEETS}, blob, {convert: true})` — Drive Advanced Service convert .xlsx → Google Sheet
3. `SpreadsheetApp.openById(id)`, đọc tab `FileMoi` (fallback: sheet đầu tiên nếu không có): `getDataRange().getValues()`
4. Map header row (row 0) → keys bằng **normalize** (bỏ phần trong ngoặc `(...)`, trim, lowercase). Header thực tế có hậu tố `(tự động lấy)` / `(Tự động)` nên KHÔNG match nguyên văn. Remaining rows → ImportRow objects (gắn `rowIndex` 1-based)
5. `DriveApp.getFileById(fileId).setTrashed(true)` — cleanup temp file
6. Return rows JSON

### Error Codes

| Error | Cause |
|-------|-------|
| `Bạn không có quyền import` | Role không phải Quản trị/Văn thư |
| `File không đúng định dạng` | Không thể đọc hoặc convert file |
| `File không có dữ liệu` | Sheet trống hoặc chỉ có header |
| `Header không đúng format` | Thiếu cột bắt buộc (Tên hồ sơ, G_ID, Danh mục) |

---

## Endpoint: `api_bulkImportDocuments`

**Access**: `google.script.run.api_bulkImportDocuments(token, payload)`

**Authorization**: Role `Quản trị viên` hoặc `Văn thư`

### Request

```
token: string  // SSO access token

payload: {
  groups: Array<{
    docData: {
      'Tên hồ sơ': string,                    // required
      'Danh mục': number,                      // required, category ID (client đã resolve từ path)
      'Số hồ sơ': string,
      'Ngày ban hành': string,                 // ISO date
      'Ngày kết thúc': string,                 // ISO date
      'Ghi chú': string,
      'Nơi lưu hồ sơ cứng': string,
      'Dự án (Phòng ban)': string,
      'Nhà cung cấp (Nơi ban hành)': string,
      'Phụ trách': string,                     // userId (client đã resolve từ email)
      'Người phối hợp': string,                // JSON array userIds (client đã resolve)
      'Giá trị HĐ': number
    },
    files: Array<{
      fileId: string,                          // required, Google Drive file ID
      fileName: string,
      mimeType: string,
      size: number
    }>
  }>
}
```

### Response (success)

```
{
  success: true,
  created: number,
  totalFiles: number,
  errors: [],
  warnings: [
    { group: string, message: string, rowIndices: number[] }
  ]
}
```

### Response (partial success)

```
{
  success: true,
  created: number,          // < total groups
  totalFiles: number,
  errors: [
    { group: "Hợp đồng XYZ", message: "Danh mục 'ABC / DEF' không tồn tại", rowIndices: [5, 6] }
  ],
  warnings: [...]
}
```

### Response (auth error)

```
{
  success: false,
  error: "Chỉ Văn thư và Quản trị viên có quyền import"
}
```

### Error Codes

| Error | Cause |
|-------|-------|
| `Bạn không có quyền import` | Role không phải Quản trị/Văn thư |
| `Danh mục '...' không tồn tại` | Path không resolve được trong sheet Danh mục |
| `Email '...' không tìm thấy` | Email không có trong hệ thống (warning, vẫn tạo doc) |
| `Tên hồ sơ không được để trống` | Group có docData['Tên hồ sơ'] rỗng |
| `Không có file đính kèm` | Group có files array rỗng |

### Validation Rules

1. `payload.groups` phải có ít nhất 1 group
2. Mỗi group phải có `docData['Tên hồ sơ']` non-empty
3. Mỗi group phải có `docData['Danh mục']` non-empty và resolve được
4. Mỗi group phải có ít nhất 1 file với `fileId` non-empty
5. Email không tìm thấy → warning (vẫn tạo doc, để Phụ trách/Người phối hợp trống)
6. Mỗi group xử lý độc lập — group lỗi không ảnh hưởng group khác
