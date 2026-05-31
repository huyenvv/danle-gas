# Eager Upload with Draft Status — Design Spec

## Problem

Current upload flow: user fills form → clicks Save → all files convert to base64 → single `google.script.run` call uploads everything. For 45-50MB total, this means a long wait at submit time with no progress visibility. If the call fails, all work is lost.

## Solution

Upload files to Google Drive **immediately when selected** (eager upload). Show per-file progress. Use a "Nháp" (draft) status to track partially-created documents and prevent orphaned files.

## Flow

### Create Mode

```
1. User clicks "Tạo mới" → form opens (no server call)
2. User fills Tên hồ sơ, Danh mục, etc.
3. User selects file(s):
   - Validate: Danh mục must be selected first (show error if not)
   - File 1 → api_uploadFileEager(file, categoryId, draftId=null)
     → Server creates draft row (status=Nháp) + uploads file to Drive
     → Returns { draftId, fileInfo }
     → Client shows: ⏳ uploading → ✓ done
   - File 2 → api_uploadFileEager(file, categoryId, draftId)
     → Server uploads file + appends to draft's File ID column
     → Returns { fileInfo }
4. User clicks Lưu/Trình duyệt/etc:
   → api_finalizeDraft(draftId, formData, notifyTarget)
   → Updates draft row with full form data + changes status (Nháp → target)
5. User clicks Huỷ:
   → api_cancelDraft(draftId)
   → Deletes files from Drive + deletes draft row
6. No draftId (no files uploaded): falls back to current api_createDocument
```

### Edit Mode

```
1. User opens existing document for editing
2. User selects new file(s):
   - api_uploadFileEager(file, categoryId) — no draftId, no row creation
     → Server uploads file only, returns { fileInfo }
     → Client tracks in eagerUploads state
3. User clicks Lưu:
   → api_updateDocument with eagerFileInfos (pre-uploaded, no base64)
   → Server merges with keepFileIds, skips re-upload
4. User clicks Huỷ:
   → api_deleteFiles(eagerFileIds) — cleanup new uploads only
   → Existing files untouched
```

## Server Changes

### New API: `api_uploadFileEager(token, base64Data, mimeType, fileName, categoryId, draftId)`

- Uploads a single file to the category folder on Drive (using existing `uploadFile()`)
- If `draftId` is null AND this is for create mode:
  - Creates a new row in HO_SO sheet with status='Nháp', minimal data (Người tạo, Danh mục, File ID)
  - Returns `{ draftId: newRowId, fileInfo: { fileId, fileName, mimeType, size } }`
- If `draftId` is provided:
  - Appends fileInfo to existing draft row's File ID column
  - Returns `{ fileInfo: { fileId, fileName, mimeType, size } }`
- If neither (edit mode, no draftId): just uploads and returns `{ fileInfo }`
- Auth: `requireAuth(token)`, same permission check as createDocument

### New API: `api_finalizeDraft(token, draftId, formData, notifyTarget)`

- Reads draft row, verifies status='Nháp' and creator matches session
- Updates all form fields (same fields as createDocument)
- Changes status from 'Nháp' to target (formData['Tình trạng'] or 'Chờ duyệt')
- If category changed since upload: moves files to new category folder
- Handles notification logic (same as current createDocument: directors, publish, none)
- Returns `{ data: updatedRow, emailError }`

### New API: `api_cancelDraft(token, draftId)`

- Reads draft row, verifies status='Nháp' and creator matches session
- Parses File ID column, deletes each file from Drive via `deleteFile()`
- Deletes the draft row via `deleteRow()`
- Returns `{ success: true }`

### New API: `api_deleteFiles(token, fileIds)`

- Deletes specified files from Drive (for edit mode cancel cleanup)
- Auth required, no row changes
- Returns `{ success: true }`

### Modified: `updateDocument`

- Accept new parameter `eagerFileInfos` — array of `{ fileId, fileName, mimeType, size }` (already on Drive)
- These are merged with existing keepFileIds, no base64 re-upload needed
- Still supports legacy base64 `fileInfos` for backward compatibility (trinhDuyetLai, hoanThanhLai flows)

### Status 'Nháp'

- Added to the data model but NOT to `STATUS_OPTIONS` dropdown
- Documents with status 'Nháp' are visible in document list with a badge
- Nháp documents filtered from stats/counts (they're incomplete)
- Creator can delete their own Nháp documents

## Client Changes

### DocumentModal State Additions

```js
const [draftId, setDraftId] = useState(null)
const [eagerUploads, setEagerUploads] = useState([])
// Each: { id: string, fileName: string, size: number, 
//         status: 'uploading'|'done'|'error', fileInfo?: object, error?: string }
```

### handleFileChange → Triggers Eager Upload

```
1. Validate: form['Danh mục'] must be set → show error "Vui lòng chọn Danh mục trước"
2. For each file, add to eagerUploads with status='uploading'
3. Upload sequentially (one at a time):
   a. Convert file to base64
   b. Call api_uploadFileEager(token, base64, mime, name, categoryId, draftId)
   c. On success: update status='done', store fileInfo, set draftId if returned
   d. On error: update status='error', store error message
4. User can remove a failed file and re-select
```

### Remove Eagerly Uploaded File

- If file status='done': call server to delete from Drive + remove from draft row
- If file status='uploading': cancel not possible (GAS has no abort), mark for deletion after upload completes
- If file status='error': just remove from state

### Submit Flow

```
if (draftId) {
  // Create mode with draft: finalize
  api_finalizeDraft(draftId, submitForm, notifyTarget)
} else if (!isEdit && eagerUploads.length === 0) {
  // Create mode, no files: current flow
  api_createDocument(token, submitForm, [], notifyTarget)
} else if (isEdit) {
  // Edit mode: pass eager uploads as pre-uploaded
  const eagerFileInfos = eagerUploads.filter(u => u.status === 'done').map(u => u.fileInfo)
  api_updateDocument(token, doc.ID, submitForm, [], keepFileIds, notifyTarget, eagerFileInfos)
}
```

### Cancel/Close Handler

```
if (draftId) {
  api_cancelDraft(token, draftId)  // cleanup draft + files
} else if (isEdit && eagerUploads.some(u => u.status === 'done')) {
  const ids = eagerUploads.filter(u => u.status === 'done').map(u => u.fileInfo.fileId)
  api_deleteFiles(token, ids)  // cleanup new files only
}
onClose()
```

### UI Changes

**File chips with upload status:**
- Uploading: spinner icon + file name + size
- Done: checkmark icon + file name + size (green)
- Error: error icon + file name + retry button (red)

**Progress text:** "Đang tải lên... (2/5)" shown above drop zone while any file is uploading

**Button states:** All submit buttons (Lưu/Trình duyệt/Phát hành) disabled while any file has status='uploading'

**Category lock:** After first eager upload, changing Danh mục shows a warning that files will be moved. Files are moved on finalize, not immediately.

### Document List Badge

Documents with status='Nháp' show a distinct badge:
- Gray/dashed style badge reading "Nháp"
- Positioned same as other status badges

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Tab closed during upload | Draft row exists with partial files. Visible as Nháp in list. User deletes manually. |
| Upload fails mid-way | Failed file shows error + retry button. Successful files remain on Drive linked to draft. |
| Category changed after upload | Files stay in original folder. Moved to new folder on finalize/save (same as current moveFile logic). |
| User opens form, closes without doing anything | No draft created (draft only created on first file upload). No cleanup needed. |
| Same file selected twice | Client-side check: skip if fileName already in eagerUploads/existingFiles. |
| Edit mode + trinhDuyetLai / hoanThanhLai | These flows still use base64 upload (legacy path). Eager upload is opt-in via the normal file picker. |

## Files to Modify

**Server:**
- `apps/docmgr/src/server/documents.js` — new APIs + modify updateDocument
- `apps/docmgr/src/server/main.js` — register new API endpoints

**Client:**
- `apps/docmgr/src/client/components/DocumentModal.jsx` — eager upload logic + UI
- `apps/docmgr/src/client/gasClient.js` — mock implementations for new APIs

**Shared:**
- `packages/gas-core/drive-io.js` — no changes needed (existing uploadFile/deleteFile sufficient)

## Out of Scope

- Byte-level progress within a single file (GAS limitation)
- Parallel file uploads (GAS concurrency limits make sequential safer)
- Auto-cleanup of old drafts (user manages manually)
- Drag-and-drop reordering of files
