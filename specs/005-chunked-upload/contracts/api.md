# API Contracts: Chunked Resumable Upload

Hai endpoint GAS mới (gọi qua `gasCall` → `google.script.run`). Trả về qua `_wrap` → `{ success, payload }` hoặc `{ success: false, error }`.

## `api_startResumableUpload(token, mimeType, fileName, fileSize, categoryId)`

Mở phiên resumable upload trên Drive cho file lớn (> 25MB).

| Param | Type | Note |
|-------|------|------|
| token | string | Access token |
| mimeType | string | MIME của file |
| fileName | string | Tên file |
| fileSize | number | Bytes |
| categoryId | string\|number | ID danh mục (bắt buộc) |

**Payload trả về**: `{ uploadUri: string, accessToken: string }`

- `uploadUri`: URL resumable Drive trả về (Location header)
- `accessToken`: OAuth token để client gắn `Authorization: Bearer` khi PUT chunk

**Errors**: `'Danh mục là bắt buộc'`, `'Bạn không có quyền tạo hồ sơ'`, `'Không khởi tạo được phiên tải lên (HTTP xxx)'`

## Client PUT trực tiếp lên Drive (không qua GAS)

```
PUT <uploadUri>
Authorization: Bearer <accessToken>
Content-Range: bytes <start>-<end>/<total>
Body: <raw chunk bytes — file.slice(start, end)>
```

- `308` → chunk lưu, gửi tiếp
- `200/201` → file tạo xong, body chứa `{ id: fileId }`

## `api_finalizeChunkedUpload(token, fileId, fileName, mimeType, fileSize, categoryId, draftId)`

Sau khi PUT hết chunk: set sharing + gắn file vào draft.

| Param | Type | Note |
|-------|------|------|
| fileId | string | ID Drive trả về ở chunk cuối |
| draftId | string\|null\|'edit' | `'edit'`=chỉ upload; truthy=append; null=tạo Nháp mới |

**Payload trả về**: `{ fileInfo }` hoặc `{ draftId, fileInfo }` — giống `api_uploadFileEager`

`fileInfo = { fileId, fileName, mimeType, size }`
