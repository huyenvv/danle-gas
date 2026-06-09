# Research: Chunked Resumable Upload

## R1: Resumable Upload URI có self-authenticating không?

**Decision**: Resumable upload URI từ Drive API v3 **yêu cầu** Authorization header cho các PUT tiếp theo. Client trong GAS web app không có OAuth token trực tiếp.

**Giải pháp**: Server trả OAuth token cùng uploadUri. Token từ `ScriptApp.getOAuthToken()` có thời hạn ~1 giờ, scoped theo `appsscript.json`. Trong context internal app (user đã authenticated qua SSO), rủi ro chấp nhận được.

**Alternatives considered**:
- Proxy chunks qua server: quá chậm, tốn GAS quota, mỗi chunk phải qua `google.script.run` → Base64 overhead
- Service Account: phức tạp setup, file thuộc service account thay vì user

## R2: CORS cho Drive API từ GAS web app

**Decision**: GAS web apps chạy trên `*.googleusercontent.com`. Google APIs (`googleapis.com`) hỗ trợ CORS cho authorized requests. Client gửi `fetch()` với `Authorization: Bearer <token>` → CORS preflight được accept.

**Rationale**: Google Picker API và nhiều web app khác đã dùng pattern này.

## R3: Chunk size tối ưu

**Decision**: 5MB per chunk.

**Rationale**:
- Drive API yêu cầu chunk size là bội của 256KB
- 5MB đủ nhỏ cho progress granularity tốt (100MB = 20 chunks)
- Đủ lớn để không quá nhiều HTTP requests
- Nằm an toàn trong memory limit của browser

**Alternatives**: 10MB (ít requests hơn nhưng progress kém), 1MB (quá nhiều requests)

## R4: Ngưỡng chunked upload

**Decision**: 25MB.

**Rationale**: 25MB raw = ~33MB Base64, an toàn dưới giới hạn ~50MB của `google.script.run`. File ≤25MB dùng flow cũ (đã proven, đơn giản hơn).

## R5: OAuth scope

**Decision**: PHẢI thêm `https://www.googleapis.com/auth/script.external_request` vào `appsscript.json` — bắt buộc cho `UrlFetchApp.fetch` (server gọi Drive API mở phiên resumable). Scope `drive` chưa đủ.

⚠️ Sau khi thêm scope + deploy, app cần **re-authorize**: vì `executeAs: USER_DEPLOYING`, chủ deploy phải vào Apps Script editor chạy 1 hàm (vd doGet) để cấp lại quyền, nếu không sẽ lỗi "Các quyền không đủ để gọi UrlFetchApp.fetch".

## R6: Token expiry handling

**Decision**: Token sống ~1 giờ. Nếu upload file rất lớn (>1GB, >1 giờ), token hết hạn giữa chừng. Xử lý: nếu chunk trả 401, client gọi lại `api_startResumableUpload` để lấy token mới, rồi retry chunk đó.

**Rationale**: File 1GB+ hiếm trong context quản lý tài liệu. Token refresh là safety net, không phải flow chính.
