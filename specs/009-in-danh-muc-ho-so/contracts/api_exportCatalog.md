# Contract: `api_exportCatalog`

Hợp đồng RPC giữa client (`gasCall`) và server GAS.

## Server entry (main.js)

```js
function api_exportCatalog(token, categoryId) {
  return _wrap(function() {
    _requireAdminOrVanThu(token)            // gác quyền: admin | Quản trị viên | Giám đốc | Văn thư
    return exportCatalog(token, categoryId) // export-catalog.js
  })
}
```

- `_wrap` chuẩn hoá kết quả/lỗi như các `api_*` khác.
- Quyền: chỉ `['admin','Quản trị viên','Giám đốc','Văn thư']`. Vai trò khác → ném `'Không có quyền thực hiện thao tác này'`.

## Request

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---------|------|----------|-------|
| `token` | string | có | Access token (như mọi api_*) |
| `categoryId` | string | **có** | ID danh mục cần xuất (bắt buộc). Gồm cả danh mục con (đệ quy). Thiếu → lỗi. |

## Response (thành công)

```json
{
  "base64": "<chuỗi base64 của file .xlsx>",
  "fileName": "danh-muc-ho-so-<ten-danh-muc>-<yyyymmdd>.xlsx",
  "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "count": 123
}
```

- `count`: số hồ sơ trong file (tiện hiển thị/log).
- Bao bọc trong định dạng trả về chuẩn của `_wrap` (client nhận payload qua `gasCall`).

## Lỗi (ném Error, client bắt qua reject)

| Điều kiện | Thông điệp (vi) |
|-----------|------------------|
| Không đủ quyền | `Không có quyền thực hiện thao tác này` |
| Thiếu `categoryId` (chưa chọn danh mục) | `Vui lòng chọn danh mục để xuất` |
| Không có hồ sơ nào (sau khi loại Nháp) | `Không có hồ sơ để xuất` |
| (token hết hạn) | xử lý bởi cơ chế refresh sẵn có của `gasCall` |

## Hành vi server (tóm tắt)

1. `_requireAdminOrVanThu(token)`.
2. Thiếu `categoryId` → ném `Vui lòng chọn danh mục để xuất`.
3. Đọc `Hồ Sơ` + `Danh Mục`; tính `selectedCategorySet` (categoryId ∪ hậu duệ).
4. Lọc `_normalizeStatus(Tình trạng) !== 'Nháp'` ∧ thuộc tập danh mục.
5. Rỗng → ném `Không có hồ sơ để xuất`.
6. Sắp theo `Số hồ sơ` tăng dần; map 7 cột; format ngày.
7. Tạo Sheet tạm (sheet "Danh mục") → ghi → export xlsx → base64; xoá Sheet tạm (`finally`).
8. Trả `{ base64, fileName, mimeType, count }`.

## Client (ExportCatalogModal.jsx — modal trên FormModal)

```js
// Danh mục bắt buộc: nút "Tải Excel" disabled khi chưa chọn (saveDisabled={!categoryId}).
const res = await gasCall('api_exportCatalog', token, categoryId)
// base64 → Uint8Array → Blob(mimeType) → <a download=res.fileName> click → revokeObjectURL
```

- Bắt buộc chọn danh mục — nút disabled khi `!categoryId`; nếu vẫn gọi → toast "Vui lòng chọn danh mục".
- Lỗi → hiển thị toast với `err.message`.
- Trong lúc chờ: nút disabled, hiện trạng thái “Đang tạo file…”.
