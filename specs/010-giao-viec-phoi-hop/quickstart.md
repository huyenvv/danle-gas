# Quickstart: kiểm thử feature giao việc người phối hợp

Worktree: `Appscripts-010-giao-viec`, branch `010-giao-viec-phoi-hop`.

## Chạy test server

```bash
npm run test:docmgr            # toàn bộ (server + client)
# hoặc chỉ file liên quan:
npx jest --config apps/docmgr/jest.config.js documents.test.js notification.test.js
```

## Test cần thêm (theo contract)

Server — theo pattern `resetAll()`/`setupRoleSheets()`/`setupDocSheets()`/`seedUser()`/`createSession()`, mock `GmailApp._sent`:

1. **D1 — bắt buộc nội dung (giaoViec)**
   - GĐ `giaoViec` với ≥1 người phối hợp + `Nội dung` rỗng → `throw 'Phải nhập nội dung giao việc khi có người phối hợp'`.
   - GĐ `giaoViec` với ≥1 người phối hợp + có nội dung → OK, lưu `Nội dung giao việc`.
   - GĐ `giaoViec` với 0 người phối hợp + nội dung rỗng → OK.

2. **D2 — chỉ thêm (nhanViec)**
   - Tài liệu `Chờ xử lý` có PH `[A]`. PT `nhanViec` gửi `[]` hoặc `[B]` (thiếu A) → `throw 'Không thể xoá người phối hợp đã có'`.
   - PT `nhanViec` gửi `[A, B]` → OK (chỉ thêm).
   - admin `nhanViec` gửi `[]` (bỏ A) → OK (bypass).

3. **D3 — chuông + email phối hợp mới (nhanViec)**
   - Tài liệu `Chờ xử lý` PH `[A]`, `Nội dung giao việc='GĐ giao'`. PT `nhanViec` thêm `[A, B]` + `data['Nội dung']='Phối hợp X'` → cột **`Nội dung phối hợp`='Phối hợp X'**, cột `Nội dung giao việc` **vẫn ='GĐ giao'** (không bị đè). `GmailApp._sent` có email template **`phoiHop`** với **B là TO**, body chứa tên B + tên PT + 'Phối hợp X'; **không** gửi lại cho A. B được đánh dấu unread.
   - PT `nhanViec` không thêm ai (`[A]`) → không có email mới (và client không hiện popup).
   - Email gửi lỗi (mock throw) → thao tác vẫn thành công, `result.emailError` ≠ null (best-effort, FR-011).

4. **D3b — bắt buộc nội dung popup (nhanViec)**
   - PT `nhanViec` thêm `[A, B]` nhưng `data['Nội dung']` rỗng → `throw 'Phải nhập nội dung gửi tới người phối hợp'`.
   - PT `nhanViec` không thêm ai + nội dung rỗng → OK (không yêu cầu).

## Kiểm thử thủ công (client)

Sau `npm run dev:docmgr` (hoặc bản build), với tài khoản tương ứng:

- **C1 — form giao việc (GĐ, tài liệu `Chờ duyệt`)**: chọn ≥1 người phối hợp, để trống "Nội dung giao việc" → nút lưu chặn + thông báo. Nhập nội dung → lưu được. Bỏ hết người phối hợp → nội dung để trống vẫn lưu được.
- **C2 — form nhận việc (PT, tài liệu `Chờ xử lý`)**: bấm "Nhận việc" → danh sách người phối hợp đã có hiển thị **khoá** (không có nút xoá); chỉ thêm người mới được. Khi **có bổ sung** PH mới → hiện **popup giao việc (dùng lại)** để nhập nội dung (bắt buộc); khi **không** bổ sung → không popup. Sau khi nhận việc (→ `Đang xử lý`), mỗi PH mới là **người nhận chính (TO)** của **chuông + email** template `phoiHop` mang nội dung vừa nhập.
- **C3 — preview detail**: mở chi tiết tài liệu đã qua nhận việc → thấy **2 mục tách biệt**: "Nội dung giao việc" (nội dung GĐ) và "Nội dung phối hợp" (nội dung chủ trì), tiêu đề khác nhau; mục rỗng được ẩn.

## Schema

- Sau khi sửa `config.js` (thêm cột `Nội dung phối hợp`, `SCHEMA_V='12'`): mở app (doGet → `ensureInitialized`) tự thêm cột vào `HO_SO`; tài liệu cũ có giá trị rỗng. Không chạy rebuild nặng (vì `prevSchema='11'`).

## Tiêu chí hoàn thành (map Success Criteria)

- SC-001: D2 + test 2 → 100% PT bỏ PH cũ bị từ chối (kể cả gọi trực tiếp server).
- SC-002: D1 + test 1 → bắt buộc nội dung khi có PH; cho trống khi không có.
- SC-003: D3 + test 3 → mỗi PH mới nhận đúng 1 email; PH cũ không nhận lại.
- SC-004: test best-effort → 0 email khi thao tác lưu thất bại (lưu trước email; lưu lỗi → không tới nhánh email).
