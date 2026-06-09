# Feature Spec: Chunked Resumable Upload

## Problem

Upload file trong docmgr gửi toàn bộ Base64 qua 1 lần `google.script.run`. GAS giới hạn payload ~50MB, Base64 phình 33% → file thực tế chỉ upload được ~37MB. User cần upload file lớn hơn (50-200MB+).

## Solution

Client upload trực tiếp lên Google Drive qua resumable upload URI, server chỉ làm trung gian tạo phiên upload và finalize metadata.

### Flow

1. Client báo server: cần upload file X, size Y, danh mục Z
2. Server tạo resumable upload session qua Drive API v3 → trả `uploadUri`
3. Client chia file thành chunks 5MB, upload trực tiếp lên Drive qua `fetch(uploadUri)`
4. Upload xong → client báo server fileId để set sharing + tạo/update draft row

### Requirements

- File ≤ 25MB: giữ nguyên flow cũ (`api_uploadFileEager`)
- File > 25MB: chunked upload trực tiếp lên Drive
- Hiển thị progress chunk (3/24) trên badge
- Retry chunk lỗi (tối đa 2 lần)
- Backward compatible — không đổi data format, không đổi `handleSubmit`
