# Quickstart: Chunked Resumable Upload

## Test trong dev mode (mock)

```bash
npm run dev:docmgr   # port 5173
```

1. Mở modal tạo/sửa hồ sơ → chọn Danh mục
2. Kéo file BẤT KỲ vào (dev mock không đọc size thật từ Drive, nhưng nếu file >25MB sẽ chạy nhánh chunked giả lập)
3. Quan sát badge hiển thị progress `(x/y)` rồi chuyển ✓

> Dev mock: `api_startResumableUpload` trả `uploadUri` không phải http → `uploadChunked` giả lập progress, không PUT thật.

## Test thật (sau deploy)

1. `npm run deploy:docmgr`
2. Mở app qua SSO Portal
3. Tạo hồ sơ, upload file **> 25MB** (vd video 100MB)
4. Verify:
   - Badge hiển thị progress chunk (vd `7/20`)
   - Upload hoàn tất → ✓
   - File xuất hiện trên Google Drive đúng thư mục danh mục
   - Sheet `Hồ Sơ` cột `Tệp đính kèm` có metadata đúng (fileId, size thật)
   - Preview/download link hoạt động (sharing = ANYONE_WITH_LINK)
5. Upload file **< 25MB** → vẫn dùng flow cũ, không có progress chunk

## Chạy test

```bash
npx jest --config apps/docmgr/jest.config.js documents.test
```

## Rollback nếu CORS/CSP chặn direct upload

Nếu browser chặn `fetch` trực tiếp lên `googleapis.com` từ iframe GAS:
→ Fallback: proxy chunk qua server (thêm `api_uploadChunk` decode Base64 → `UrlFetchApp` PUT). Xem research.md R2.
