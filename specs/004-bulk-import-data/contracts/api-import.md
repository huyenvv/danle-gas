# API Contract: Bulk Import Documents

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
