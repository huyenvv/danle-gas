# Data Model: Bulk Import Data

## Entities

### ImportRow (client-side, parsed from Excel)

Một dòng trong file Excel sau khi parse bởi SheetJS.

| Field | Type | Source Column | Required |
|-------|------|--------------|----------|
| tenHoSo | string | Tên hồ sơ (A) | Yes |
| tenFile | string | Tên file (B) | No (auto) |
| soHoSo | string | Số hồ sơ (D) | No |
| ngayBanHanh | string | Ngày ban hành (E) | No |
| ngayKetThuc | string | Ngày kết thúc (F) | No |
| ghiChu | string | Ghi chú (G) | No |
| noiLuu | string | Nơi lưu hồ sơ cứng (H) | No |
| duAn | string | Dự án/Phòng ban (I) | No |
| nhaCungCap | string | Nhà cung cấp (J) | No |
| phuTrach | string | Phụ trách (K) - 1 email | No |
| nguoiPhoiHop | string | Người phối hợp (L) - emails, dấu phẩy | No |
| giaTriHD | number | Giá trị HĐ (M) | No |
| gId | string | G_ID (N) | Yes |
| name | string | Name (O) | No (auto) |
| mimeType | string | MimeType (P) | No (auto) |
| size | number | Size (Q) | No (auto) |
| danhMuc | string | Danh mục (R) - path dạng "Cha / Con / Cháu" | Yes |
| rowIndex | number | (computed) | - |

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
| fileId | string | → File ID JSON array `.fileId` |
| fileName | string | → File ID JSON array `.fileName`, Tên file column |
| mimeType | string | → File ID JSON array `.mimeType`, Loại file column |
| size | number | → File ID JSON array `.size`, Kích thước column |

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
| files[] | File ID | `JSON.stringify(files)` |
| files[].fileName joined | Tên file | join bằng `, ` |
| files[0].mimeType | Loại file | first file's type |
| files[].size sum | Kích thước | tổng size |
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
