# API Contracts (GAS `api_*`)

Tất cả qua `gasCall(name, token, ...args)`. Quyền re-check server mỗi call.

## api_browseDrive(token, parentFolderId) — mở rộng (hoặc API mới song song)

Mở rộng `api_browseDriveFolders` để trả thêm files. Để không phá `FolderPicker` cũ, thêm field `files` (FolderPicker bỏ qua field thừa).

- **Auth**: yêu cầu `canPickDrive` (full-access hoặc cờ). *(api cũ dùng `requireAdmin`; bản mở rộng nới cho user có quyền pick.)*
- **Args**: `parentFolderId` (`''` = My Drive root)
- **Returns**:
```js
{
  current: { id, name },
  folders: [{ id, name }],
  files:   [{ id, name, mimeType, size }]   // mới
}
```

## api_copyDriveFiles(token, fileIds, categoryId, draftId) — MỚI

Copy mỗi file Drive owner vào thư mục danh mục rồi gắn vào hồ sơ nháp.

- **Auth**: `_checkPickDrivePermission(session)` — ném nếu không quyền.
- **Args**:
  - `fileIds`: `string[]` — id file trên Drive owner
  - `categoryId`: id danh mục hồ sơ (đích copy)
  - `draftId`: `'edit'` | id nháp | falsy — như `uploadFileEager`
- **Behavior**: với mỗi fileId: `makeCopy` vào `resolveFolderId(catPath)`, `setSharing(ANYONE_WITH_LINK, VIEW)`, `_attachFileToDraft`. Lỗi 1 file không chặn file khác.
- **Returns**:
```js
{
  draftId,                 // id nháp (mới tạo hoặc đã có) nếu áp dụng
  results: [
    { fileId, ok: true,  fileInfo: { fileId, fileName, mimeType, size } },
    { fileId, ok: false, error: 'message' }
  ]
}
```

## Session (api_ssoLogin / api_resume) — thêm field

`session.canPickDrive: boolean` trả về cho client (gate hiển thị nút).

## api_updateUser(token, id, data) — thêm xử lý cờ

Nhận `data['Được chọn từ Drive']` (boolean) → lưu `'TRUE'`/`''` vào APP_ROLES, giống `Được phát hành`.
