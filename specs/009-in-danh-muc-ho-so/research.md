# Phase 0 — Research: In / Xuất danh mục hồ sơ ra Excel

Tổng hợp các quyết định kỹ thuật. Mọi điểm "NEEDS CLARIFICATION" của Technical Context đã được giải quyết.

## R1. Sinh file .xlsx trong GAS (có sheet tên "Danh mục", giữ tiếng Việt)

- **Decision**: Tạo một **Google Sheet tạm** bằng `SpreadsheetApp.create(tempName)`, đổi tên sheet đầu thành `"Danh mục"`, ghi 1 dòng header + N dòng dữ liệu bằng `setValues`, rồi **export sang xlsx** qua `UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/<id>/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } })`. Lấy `getBlob()` → `Utilities.base64Encode(blob.getBytes())`. Cuối cùng **xoá sheet tạm** (`DriveApp.getFileById(id).setTrashed(true)`) trong `finally`. Trả `{ base64, fileName, mimeType }` về client.
- **Rationale**: GAS không có thư viện ghi xlsx gốc. Cách "Sheet tạm → export" là pattern đã được dùng ngược lại trong `import.js` (xlsx ↔ Google Sheet qua Drive Advanced Service) và `drive-io.js` (UrlFetchApp + `getOAuthToken`). Google Sheets export giữ nguyên Unicode tiếng Việt (đáp ứng FR-007). Không thêm dependency.
- **Alternatives considered**:
  - *Trả CSV*: đơn giản hơn nhưng KHÔNG phải .xlsx, không có "sheet tên Danh mục", dễ lỗi mã hoá khi mở bằng Excel → loại (vi phạm FR-003/FR-007).
  - *Drive Advanced Service `Drive.Files.export`*: cần bật advanced service; UrlFetchApp đơn giản và đã có tiền lệ → loại.
  - *Tự lắp gói OOXML (zip)*: phức tạp, dễ vỡ Unicode/V8 → loại (vi phạm Principle V).
- **Lưu ý vận hành**: Quyền OAuth `https://www.googleapis.com/auth/drive` và `.../spreadsheets` đã cần cho upload/import hiện hữu; export dùng cùng scope. Sheet tạm tạo ở My Drive của tài khoản chạy script — phải xoá ngay để tránh rác.

## R2. Xác định tập hồ sơ theo danh mục (đệ quy danh mục con)

- **Decision**: `Hồ Sơ['Danh mục']` lưu **ID danh mục** (xác nhận tại `documents.js:371,395`). Dựng tập ID = {danh mục được chọn} ∪ {mọi hậu duệ}. Hậu duệ tính bằng duyệt `Danh Mục` theo `Danh mục cha` (pattern tại `sheets.js:156`: `String(c['Danh mục cha']) === String(id)`), đệ quy/lặp tới khi không còn con. Lọc `Hồ Sơ` có `String(d['Danh mục'])` nằm trong tập đó.
- **Rationale**: Khớp mô hình dữ liệu thật; tránh phụ thuộc đường dẫn thư mục Drive. Một lần đọc 2 sheet, lọc in-memory → đạt SC-001/SC-003.
- **Alternatives considered**: Suy ra theo thư mục Drive — phức tạp, không cần (đã có ID trên hồ sơ) → loại.

## R3. Lọc theo trạng thái

- **Decision**: Xuất **mọi hồ sơ trừ "Nháp"** — `_normalizeStatus(Tình trạng) !== 'Nháp'`. (Chốt 2026-06-19, chỉnh lại từ "chỉ Hoàn thành".)
- **Rationale**: Mục lục lưu trữ cần phản ánh toàn bộ hồ sơ đã trình vào hệ thống, không chỉ bản đã hoàn tất; chỉ bản "Nháp" (chưa trình) là không tính. Các giá trị trạng thái hợp lệ: `Nháp, Chờ duyệt, Chờ xử lý, Đang xử lý, Hoàn thành, Từ chối, YC Phát hành, Chờ xác nhận HT, Từ chối kết quả` (xem `documents.js` `VALID_STATUSES`). Áp `_normalizeStatus` trước khi so sánh để xử lý giá trị legacy (`documents.js:344-346`); giá trị rỗng/không rõ được chuẩn hoá thành 'Chờ duyệt' (≠ Nháp) nên vẫn được xuất.
- **Alternatives considered**: "chỉ Hoàn thành" (quá chặt, bỏ sót hồ sơ đang xử lý) / "trừ Nháp & Từ chối" — người dùng chọn "tất cả trừ Nháp".

## R4. Sắp xếp & đánh STT

- **Decision**: Sắp các dòng theo **Số hồ sơ tăng dần** rồi đánh STT 1..n theo thứ tự đó. So sánh chuỗi kiểu tự nhiên đơn giản: dùng so sánh chuỗi không phân biệt hoa/thường; hồ sơ thiếu "Số hồ sơ" xếp xuống cuối. (Tiebreak/Số hồ sơ rỗng là chi tiết nhỏ, mặc định: rỗng → cuối, giữ ổn định.)
- **Rationale**: Khớp clarification (Q1). STT là cột duy nhất hệ thống tự sinh (FR-004).

## R5. Định dạng cột "Ngày ban hành"

- **Decision**: Hiển thị chuỗi theo `yyyy-mm-dd HH:mm` (chốt Q2). Server tự format từ giá trị `Ngày ban hành` (có thể là Date hoặc chuỗi). Ghi vào ô dạng **text** để tránh Excel tự diễn giải lại locale.
- **Rationale**: Nhất quán khi in/lưu trữ; tránh lệch locale. Dùng `Utilities.formatDate` nếu là Date, hoặc chuẩn hoá chuỗi nếu đã là chuỗi.

## R6. Gác quyền (server + client)

- **Decision**:
  - **Server**: tái dùng `_requireAdminOrVanThu(token)` (đã có tại `main.js:538`, allowed = `['admin','Quản trị viên','Giám đốc','Văn thư']`) — đúng đúng tập 3 vai trò + VT yêu cầu. `api_exportCatalog` gọi helper này đầu tiên, bọc trong `_wrap`.
  - **Client**: KHÔNG tạo mục menu trái mới. Thêm tùy chọn **"In danh mục hồ sơ"** vào dropdown của `CreateMenu` (cụm nút "Tạo hồ sơ mới / Nhập từ Excel" ở sidebar CTA và toolbar danh sách). Chỉ truyền `onExport` khi role được phép (`canExport` ở `MainApp`); chọn → mở **modal** `ExportCatalogModal` (dựng trên `FormModal` dùng chung), không phải trang riêng.
- **Rationale**: "Văn thư + Admin + GĐ, ngoài ra không ai" (FR-002). Server re-check là bắt buộc (Constitution IV/permissions.md "Server re-checks each action"). Ẩn ở client = không render (Constitution V: "hide = conditional render").
- **Lưu ý chuỗi role**: hệ thống dùng cả `'admin'` và `'Quản trị viên'` cho Admin (`auth.js:17`, `main.js:469`). Phải chấp nhận cả hai ở client lẫn server.

## R7. Đường truyền tải file (download)

- **Decision**: Server trả base64 (JSON, qua `gasCall`). Client giải mã base64 → `Uint8Array` → `Blob(mime xlsx)` → tạo `<a download>` click → revoke URL. Tên file mặc định: `danh-muc-ho-so-<tên danh mục>-<yyyymmdd>.xlsx` (tên danh mục làm sạch ký tự đặc biệt). Danh mục là **bắt buộc** — không có trường hợp "tất cả".
- **Rationale**: Khớp tiền lệ upload base64 (`ImportManager.jsx`, `DocumentModal.jsx toBase64`); GAS Web App không stream file trực tiếp nên base64-qua-RPC là cách chuẩn. Tên file là chi tiết nhỏ đã defer ở clarify — chọn mặc định gợi nhớ.

## R8. Vị trí code & build/test

- **Decision**: File server mới `apps/docmgr/src/server/export-catalog.js` (tự bundle nhờ `bundle-server.js` readdirSync; xếp trước `main.js`). Bổ sung `'export-catalog.js'` vào `APP_FILES` trong `__tests__/setup.js` (trước `'main.js'`).
- **Rationale**: Tiền lệ `import.js`/`file-index.js`. Tên KHÔNG bắt đầu bằng `_` (bundler loại file `_*`). Không cần sửa `bundle-server.js`.
- **Alternatives considered**: Nhét vào `documents.js` (đã 1397 dòng) — kém rõ ràng, trộn mối quan tâm → loại.

## Tóm tắt rủi ro

- **Sheet tạm không xoá nếu lỗi giữa chừng** → bọc `try/finally`, luôn trash trong `finally`.
- **Số lượng hồ sơ rất lớn** → `setValues` một lần; nếu quá lớn vượt giới hạn GAS, cân nhắc cảnh báo ngưỡng (defer, không thuộc phạm vi v1; ghi nhận ở Edge Cases spec).
- **Giá trị "Số hồ sơ" không thuần số** → so sánh chuỗi, rỗng xuống cuối; không cố parse số.
