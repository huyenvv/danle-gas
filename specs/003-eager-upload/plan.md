# Implementation Plan: Eager Upload với Draft Status

**Branch**: `003-eager-upload` | **Date**: 2026-05-31 | **Spec**: [spec.md](spec.md)

## Summary

Upload files ngay khi chọn (eager upload) thay vì chờ đến submit form. 4 server APIs mới (`uploadFileEager`, `finalizeDraft`, `cancelDraft`, `deleteFiles`), client DocumentModal thêm eager upload state + progress UI, `updateDocument` nhận thêm param `eagerFileInfos`.

## Technical Context

**Language/Version**: JavaScript ES5 (GAS server) + React JSX (client)
**Storage**: Google Sheets (thêm status "Nháp" vào HO_SO). Google Drive (files).
**Testing**: Jest + vm.runInContext (server)
**Constraints**: ES5 var/function only. Single global scope. Sequential upload (GAS concurrency). `google.script.run` không có progress callback.

## Constitution Check

| Principle | Status |
|---|---|
| I. Concat | ✅ No new modules — all in existing documents.js + main.js |
| II. Shared Core | ✅ App-specific only, gas-core drive-io.js unchanged |
| III. Secrets | ✅ No new secrets |
| IV. SSO | ✅ Auth unchanged — requireAuth for all new APIs |
| V. Surgical | ✅ Follows existing uploadFile/deleteFile patterns |
| VI. Sheets | ✅ No new columns — Nháp is a new value for existing Tình trạng column |
| VII. Test | ✅ Mirrors existing createDocument/updateDocument test patterns |
| VIII. Design | ✅ New badge follows MD3 system (gray dashed) |

## Affected Files

```text
apps/docmgr/src/server/documents.js         — 4 new functions + modify updateDocument
apps/docmgr/src/server/main.js              — 4 new API wrappers + modify api_updateDocument
apps/docmgr/src/client/components/DocumentModal.jsx — eager upload state, handleFileChange, submit, cancel, UI
apps/docmgr/src/client/gasClient.js          — mock implementations for dev server
apps/docmgr/src/client/utils/format.js       — Nháp badge color
apps/docmgr/src/server/__tests__/documents.test.js — tests for new functions
```

## API Design

### `uploadFileEager(token, base64Data, mimeType, fileName, categoryId, draftId)`

| draftId | Behavior | Returns |
|---------|----------|---------|
| `null` | Upload file + create Nháp row | `{ draftId, fileInfo }` |
| `<id>` | Upload file + append to Nháp row | `{ fileInfo }` |
| `'edit'` | Upload file only (no row changes) | `{ fileInfo }` |

### `finalizeDraft(token, draftId, formData, notifyTarget)`

- Verify status=Nháp + creator matches
- Update all form fields + change status Nháp → target
- Move files if category changed
- Handle notifications (same as createDocument)

### `cancelDraft(token, draftId)`

- Verify status=Nháp + creator matches
- Delete files from Drive + delete row

### `deleteFiles(token, fileIds)`

- Delete specified files from Drive (edit mode cleanup)

### `updateDocument` (modified)

- 7th param: `eagerFileInfos` — array of `{ fileId, fileName, mimeType, size }`
- Merged with `newlyUploaded`, no base64 re-upload
- Backward compatible — existing 6-param calls still work

## Implementation Notes (post-plan changes)

### Draft Visibility
- `getDocuments` filters Nháp docs: chỉ hiện cho `Người tạo`, user khác không thấy.
- `STATUS_MIGRATION_MAP` đã xoá entry `'Nháp' → 'Chờ duyệt'` (legacy). `VALID_STATUSES` include `'Nháp'`.

### Draft Edit UX
- Click vào Nháp trong danh sách → mở modal với **giao diện tạo mới** (Lưu tài liệu / Phát hành / Trình duyệt), ẩn dropdown Tình trạng.
- Submit gọi `finalizeDraft` (không phải `updateDocument`).
- Upload file khi edit draft → append vào row Nháp (dùng `draftId`, không dùng `'edit'` mode).

### Modal Close vs Cancel
- **Nút X** (đóng modal):
  - Không có draft hoặc không thay đổi → đóng ngay.
  - Có thay đổi → confirm "Lưu thông tin vừa thay đổi vào hồ sơ nháp?" → Có: `finalizeDraft` với `Tình trạng: 'Nháp'`, toast-only (đóng modal ngay, không loading overlay) → Không: đóng không lưu.
  - Detect thay đổi: so sánh form fields vs initial state, check `phuTrach`, check eager uploads done.
- **Nút Huỷ**: confirm dialog liệt kê file sẽ bị xoá → `cancelDraft` xoá row + files → toast thành công.

### Upload Toast
- File đầu tiên (create mode): toast "Đang tạo hồ sơ nháp + upload file..." → "Đã tạo hồ sơ nháp".
- File tiếp theo: chỉ spinner trên chip, không toast thêm.

### finalizeDraft Validation
- `Tên hồ sơ` chỉ bắt buộc khi finalize (status ≠ Nháp). Lưu nháp cho phép tên trống → hiện "(Chưa có tên)" trong danh sách.

### finalizeDraft Category Move
- So sánh `oldCatId` vs `newCatId` bằng String, set `updates['Danh mục']` trước khi check.
- Di chuyển tất cả files sang folder danh mục mới khi đổi danh mục.

### Affected Files (bổ sung)
- `apps/docmgr/src/client/components/MainApp.jsx` — hiện "(Chưa có tên)" cho doc không có tên.
- `apps/docmgr/src/client/__tests__/DocumentModal.test.jsx` — cập nhật assertion cho `eagerFileInfos` param.
