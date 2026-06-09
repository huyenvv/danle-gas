# Data Model

## APP_ROLES (`_Phân Quyền`) — cột mới

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `Được chọn từ Drive` | `'TRUE'` \| `''` | Bật/tắt quyền chọn file từ Drive owner cho user. Mặc định coi-như-bật cho full-access. |

- Thêm vào `tabDefs[APP_ROLES].headers` trong `config.js`; `ensureMissingColumns` thêm cột cho sheet đã tồn tại.
- Bump `SCHEMA_V` `'6' → '7'`.

## Session object (mở rộng `_buildSessionFromRows`)

```js
{
  ...,
  canCreate, canCreateSubCat, canPublish,
  canPickDrive: roleRow['Được chọn từ Drive'] === 'TRUE' || roleRow['Được chọn từ Drive'] === true
}
```
Client coi full-access là mặc định bật: `isAdminRole || isVanThu || session.canPickDrive`.

## fileInfo (không đổi — tái dùng)

```js
{ fileId, fileName, mimeType, size }
```
File copy sinh ra cùng shape, gắn vào `Hồ Sơ.Tệp đính kèm` (JSON array) qua `_attachFileToDraft`.

## DriveItem (DTO trả về client khi browse — mới, chỉ in-memory)

```js
// folders: như cũ { id, name }
// files (mới):
{ id, name, mimeType, size }   // size = getSize() bytes
```

## Validation rules

- `canPickDrive` (server) bắt buộc trước copy (FR-011). Role ∈ full-access bỏ qua cờ.
- `categoryId` bắt buộc (đích copy xác định) — như upload thường.
- File không đọc được (xóa/mất quyền/trash) → kết quả `{ ok:false, error }` cho file đó, không ném toàn cục.
