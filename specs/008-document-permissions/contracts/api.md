# Phase 1 — API Contracts (thay đổi)

Tất cả là RPC GAS hiện có (`api_*` trong main.js → hàm trong documents.js/import.js). **Signature không đổi** — chỉ mở rộng payload/hành vi. Không thêm endpoint mới.

## getDocuments(token, filters) → { ... }

- **Đầu vào**: không đổi.
- **Hành vi mới**: mỗi tài liệu trả về chỉ khi `_canViewDocument(doc, session)` (xem data-model). Thay block lọc theo danh mục cũ.
- **Đầu ra**: object tài liệu nay **kèm** `Người được xem`. Client dùng để hiển thị/sửa quyền + badge khoá.
- **Bất biến (FR-009)**: tập tài liệu trả về = tập tài liệu user được phép xem; gồm cả tài liệu user nằm trong `Người được xem` dù ngoài quyền danh mục cha.

## createDocument(token, data, fileInfos, notifyTarget) → { success, data }

- Ghi `data['Người được xem']` (client gửi danh sách đã tích sẵn từ danh mục, người dùng có thể chỉnh). Không còn ghi `Nhóm được xem`.

## updateDocument(token, id, data) → { success, data }

- Ghi `data['Người được xem']` nếu có (đã thêm lại vào `textFields`) — dùng cho màn **sửa**. (Màn chi tiết dùng `setDocumentViewers`.)

## setDocumentViewers(token, docId, nguoiDuocXem) → { data } *(mới)*

- **Quyền (FR-008)**: chỉ **vai trò toàn quyền** (admin/Quản trị viên/Giám đốc/Văn thư); vai trò khác → lỗi "không có quyền".
- **Tách khỏi luồng sửa hồ sơ** → đặt được kể cả khi tài liệu đã `Hoàn thành` (khóa sửa). Chỉ ghi `Người được xem` + Người/Ngày cập nhật.
- **Thông báo (fix)**: `_markUnreadForUsers` cho những người **MỚI** thêm vào `Người được xem` (diff new − old) → họ thấy tài liệu là chưa đọc (chuông báo). KHÔNG re-báo người đã có trong danh sách.
- `nguoiDuocXem`: JSON array string userId, hoặc `''` (rỗng ⇒ chỉ toàn quyền + người tham gia thấy; KHÔNG fallback danh mục động).
- API client: `api_setDocumentViewers(token, docId, nguoiDuocXem)`. UI ở màn chi tiết (DocumentPreview).

## publishDocument(token, docId, toUserIds, ccUserIds) → { success, lan, data }

- **Signature**: không đổi.
- **Hành vi (FR-005)**: sau khi ghi lịch sử phát hành, **nếu người phát hành là VT/GĐ/admin/Quản trị viên** **và** `Người được xem` đã **không rỗng** → thêm **mọi** recipient (TO∪CC) **chưa** có vào danh sách (không trùng). Nếu `Người được xem` rỗng (tài liệu mở) ⇒ **không** đổi (tránh khóa tài liệu công khai). Người chỉ có cờ "Được phát hành" ⇒ chỉ gửi email.
- **Đầu ra**: `data` phản ánh `Người được xem` đã cập nhật (nếu có).

## import (parseImportFile + bulkImportDocuments / import.js) → { created, warnings, errors, ... }

- **Header (tuỳ chọn)**: cột `Phân quyền` (một/nhiều tên nhóm, tách **CSV-style**: phẩy là dấu tách ở cấp ngoài, tên chứa phẩy bọc trong `"..."`, trim). Client `importResolver.js` mang thô vào `docData['Phân quyền']` + **cờ đỏ ở preview** nếu tên nhóm không tồn tại; server `parseGroupNames` tách + xác thực + khai triển.
- **Hành vi (FR-010/011/012)**:
  - Trống ⇒ tạo + `Người được xem = ` **snapshot quyền danh mục** (`_categoryViewerIds(cat)`; danh mục trống → `''`).
  - Tên nhóm tồn tại ⇒ `Người được xem = ` hợp **thành viên** các nhóm (khai triển qua `groupMembersByName`).
  - Bất kỳ tên nhóm không tồn tại (hoặc nháy kép lệch cặp) ⇒ tài liệu **không** được tạo, thêm vào `errors`.

## Helper nội bộ (không phải API, để test tham chiếu)

- `_isParticipant(doc, session) → bool`
- `_canViewDocument(doc, session, ctx) → bool` (participant → lifecycle → `Người được xem` không rỗng category-independent → **rỗng = false**, KHÔNG fallback danh mục)
- `_categoryViewerIds(catId) → [userId]` — người trực tiếp + khai triển thành viên nhóm của danh mục **+ kế thừa ngược các danh mục CHA** (đi chuỗi `Danh mục cha`, chống lặp); dùng chung snapshot lúc tạo (server/client) + import-trống + backfill. Client `categoryViewerIds` mirror logic này.
- `_backfillDocViewers()` — migration 1 lần (FR-013), idempotent, gắn cờ ScriptProperties.
- Import: `parseGroupNames(str)` (CSV-quoting) + map `groupMembersByName` nội bộ trong `bulkImportDocuments`.
