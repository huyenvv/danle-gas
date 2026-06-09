# Data Model: Chunked Resumable Upload

## Không thay đổi data model

Feature này không thêm entity hay field mới vào Sheets. Format `fileInfo` giữ nguyên:

```js
// Stored in 'File ID' column as JSON array — UNCHANGED
[
  { fileId: "abc123", fileName: "video.mp4", mimeType: "video/mp4", size: 104857600 }
]
```

## Client State: eagerUploads entry

Thêm 2 field vào upload entry state (client-only, không persist):

```js
{
  id: 1,
  fileName: "video.mp4",
  mimeType: "video/mp4",
  size: 104857600,
  status: "uploading" | "done" | "error",
  fileId: null | "abc123",
  error: null | "message",
  file: File,              // existing — browser File object
  // NEW:
  progress: null | 7,     // current chunk index (0-based, displayed as 1-based)
  totalChunks: null | 20,  // total number of chunks
}
```

## API Contracts

### `api_startResumableUpload(token, mimeType, fileName, fileSize, categoryId)`

**Request**: token, mimeType, fileName, fileSize (bytes), categoryId
**Response**: `{ uploadUri: string, accessToken: string }`

### `api_finalizeChunkedUpload(token, fileId, fileName, mimeType, fileSize, categoryId, draftId)`

**Request**: token, fileId (from Drive), fileName, mimeType, fileSize, categoryId, draftId (null | string | 'edit')
**Response**: `{ fileInfo: object }` or `{ draftId: string, fileInfo: object }` — same shape as `uploadFileEager`
