# Research: Người kiểm soát hồ sơ

Phase 0 — giải quyết các điểm thiết kế chưa cố định trong spec, dựa trên mã nguồn hiện có.

---

## R1 — Tập hành động cụ thể của Người kiểm soát (NKS)

**Decision (chốt v1 — sau trao đổi với khách 2026-06-24)**: NKS có **hai** khả năng trên hồ sơ được gán, KHÔNG phải toàn bộ quyền GĐ:

| Trạng thái | NKS làm được |
|---|---|
| `Chờ xử lý`, `Đang xử lý` | **ksThemPhoiHop** — thêm người phối hợp (chỉ-thêm), **KHÔNG đổi trạng thái** |
| `Chờ xác nhận HT` | **xacNhanHT**, **tuChoiKetQua** (duyệt tới Hoàn thành thay GĐ) |

NKS **không** đổi/xoá PT, **không** xoá PH cũ, **không** dùng `giaoViec`/`thuHoi`, **không** làm tuChoi/ycPhatHanh/luuTru.

**Rationale**:
- Khách chốt: NKS "điều phối" = **chỉ thêm người phối hợp** (giống ràng buộc chỉ-thêm của PT ở feature 010), không đổi PT, không xoá ai, và **không đổi trạng thái** — chạy được ở cả `Chờ xử lý` lẫn `Đang xử lý`.
- Vì `nhanViec` (add-PH của PT) có **chuyển trạng thái** (`Chờ xử lý→Đang xử lý`) và chỉ ở một trạng thái, không tái dùng trực tiếp được → thêm action mới `ksThemPhoiHop` với `to='_keep'` (không transition) và cho phép ở 2 trạng thái. Logic chỉ-thêm + email PH mới **mượn nguyên** từ `nhanViec`.
- "Duyệt tới Hoàn thành" ⇒ `xacNhanHT` (+ `tuChoiKetQua` đối xứng) gắn token `_kiemSoat`.

**Alternatives considered**:
- *Tái dùng `giaoViec`/`thuHoi` để NKS đổi PT/PH* (phương án trước): bị khách loại — NKS không được đổi PT, không xoá PH, không đổi trạng thái.
- *Cho NKS toàn bộ action GĐ*: trái yêu cầu; bị loại.
- *Reuse `nhanViec` cho NKS*: vướng vì nó chuyển trạng thái & chỉ 1 trạng thái; bị loại.

**Lưu ý ràng buộc**: trường `Người kiểm soát` chỉ GĐ/QTV ghi (qua `giaoViec`); `ksThemPhoiHop` KHÔNG đụng trường này và PT bất biến (FR-004a/FR-007).

---

## R2 — Lưu trữ trường Người kiểm soát

**Decision**: Thêm 1 cột `Người kiểm soát` vào sheet `Hồ Sơ`. Lưu **một** UserID dạng JSON-array-1-phần-tử (tái dùng `_buildAssignees`/`_parseAssignees`), chuỗi rỗng = không có NKS.

**Rationale**:
- Đồng nhất với cách `Phụ trách`/`Người phối hợp` đang lưu (parse/serialize chung helper) → ít mã đặc thù.
- `ensureMissingColumns` (gas-core) tự append cột theo tên khi `SCHEMA_V` đổi; đọc theo tên (`rowsToObjects`) nên vị trí cột không ảnh hưởng.

**Migration**: bump `SCHEMA_V` `'13' → '14'` trong `config.js` (cả nhánh check lẫn `setProperty`), thêm `'Người kiểm soát'` vào `HO_SO` headers def. Hồ sơ cũ → cột rỗng = không có NKS (SC-005).

**Alternatives considered**:
- *Lưu username thay vì UserID*: PT/PH chấp nhận cả hai; giữ nhất quán bằng cách dùng cùng helper, ưu tiên UserID khi resolve. Không cần khác biệt.
- *Sheet phụ riêng cho NKS*: thừa cho quan hệ 1-1 với hồ sơ; bị loại.

---

## R3 — Cơ chế đoạn email điều kiện `[[...]]`

**Decision**: Mở rộng `_applyTemplate(tpl, vars)` trong `documents.js`: sau khi thay biến, xử lý các đoạn bọc trong `[[ ... ]]` — **giữ nội dung (bỏ cặp ngoặc) nếu đoạn không chứa biến chưa-thay/giá-trị-rỗng; xoá cả đoạn nếu bên trong còn rỗng**.

Triển khai gợi ý (ES5):
1. Thay biến như hiện tại (`split/join`).
2. Regex quét `\[\[([\s\S]*?)\]\]`: nếu đoạn con còn ký tự `{...}` (biến không khai báo) HOẶC chứa chuỗi rỗng tại vị trí biến NKS → xoá; ngược lại giữ nội dung.
   - Cách đơn giản & tường minh: trước bước thay biến, đánh dấu rằng biến NKS rỗng → xoá đoạn `[[...]]`; nếu có giá trị → bỏ cặp `[[ ]]`. Vì chỉ NKS dùng đoạn điều kiện, có thể kiểm tra trực tiếp `vars['{tênNgườiKiểmSoát}']` rỗng hay không.

**Rationale**:
- Khớp Q1-clarify (đánh dấu đoạn điều kiện ngay trong thân email; admin sửa trực tiếp; không thêm ô cấu hình riêng).
- Tự phủ FR-008/009/010: có NKS → đoạn hiện với tên+vai trò; không NKS → đoạn biến mất, không để `{...}` thừa.
- Đổi tại một điểm (`_applyTemplate`) áp cho mọi template, nhưng chỉ template `giaoViec` mặc định chứa `[[...]]`.

**Alternatives considered**:
- *Biến gộp `{đoạnKiểmSoát}` cấu hình ở ô riêng*: từng cân nhắc ở /specify nhưng /clarify chốt cách đánh dấu trong thân; bị loại.
- *Hard-code chèn đoạn ở JS*: admin không sửa được câu chữ → trái FR-010; bị loại.

**Edge**: đảm bảo `[[` `]]` không xung đột nội dung email thường (hiếm). Nếu template không có `[[...]]`, hàm hoạt động y như cũ (an toàn ngược).

---

## R4 — Thông báo cho chính NKS (FR-013)

**Decision**: Thêm template `kiemSoat` (subject/body, có `{tênNgườiKiểmSoát}` hoặc `{tênNgườiNhận}`, `{tênHồSơ}`, `{nộiDungGiaoViec}`, `{linkHệThống}`). Gửi chuông + email cho NKS **khi trường `Người kiểm soát` chuyển sang một UserID mới khác rỗng** — xảy ra ở:
- `giaoViec` (GĐ/QTV gán NKS lần đầu), và
- cập nhật hồ sơ bởi GĐ/QTV làm đổi NKS (đổi sang người khác).

Chỉ gửi cho NKS *mới*; gỡ NKS → không gửi email "huỷ" (nhất quán feature 010). Best-effort (lỗi gửi ghi log, không rollback).

**Rationale**: Q2-clarify chốt NKS nhận thông báo riêng, giống PT/PH. Dùng lại `_sendNotificationEmails` + `_markUnreadForUsers` + `_getRecipientsByUsernames`.

**Alternatives considered**: *Không báo NKS* (đã bị Q2 loại). *Gộp vào email giaoViec gửi PT* (sai người nhận chính); bị loại.

---

## R5 — `{vaiTròNgườiKiểmSoát}` lấy từ đâu

**Decision**: Chức danh thực của NKS từ SSO `_Phân Bổ` qua `_getDeptInfo(ss, userId).role` — đúng cơ chế đang dùng cho `{vaiTròNgườiNhận}`/`{vaiTròNgườiGửi}`.

**Rationale**: Q3-clarify chốt "chức danh thực". Hạ tầng `_getRecipientsByUsernames`/`_getRecipientsByIds` đã trả `role` sẵn → dùng lại để lấy cả `name` + `role` của NKS cho biến email.

---

## R6 — Đường GĐ/QTV đổi/gỡ NKS (FR-001) — chốt v1

**Decision (v1, chốt 2026-06-24 sau /analyze)**: GĐ/QTV ghi trường `Người kiểm soát` **chỉ** qua `transitionDocument('giaoViec', ...)` (ở `Chờ duyệt`). Đổi/gỡ NKS = **thu hồi → giao lại** với NKS khác (hoặc để trống = gỡ). KHÔNG thêm đường `updateDocument`/UI sửa NKS trực tiếp ở trạng thái khác.

Server kiểm tra vai trò người gọi là GĐ/admin trước khi ghi trường này; vai trò khác (gồm NKS) → bỏ qua/khoá (FR-007).

**Rationale**: tối giản (Constitution V), tránh thêm endpoint + UI cho một thao tác ít dùng; tái dùng nguyên đường `giaoViec`/`thuHoi` quen thuộc với GĐ. Phù hợp giới hạn vốn có của workflow (không sửa PT/PH/NKS khi đã `Đang xử lý`).

**Đánh đổi**: không đổi được NKS khi hồ sơ đã qua `Chờ duyệt` mà không thu hồi — chấp nhận cho v1 (quyết định của khách).

**Alternatives considered**: *Ghi NKS qua `updateDocument` ở mọi trạng thái* (đề xuất ban đầu theo /clarify Q3): mạnh hơn nhưng cần thêm gating + UI sửa NKS hậu-giao-việc → hoãn khỏi v1. *API riêng `setController`*: thừa.

---

## R7 — Đồng bộ client/server (template + biến)

**Quan sát**: `SettingsPage.jsx` giữ **bản sao** `DEFAULT_MAIL_TEMPLATES` + `TEMPLATE_VARS` (độc lập với `documents.js`). Cả hai phải cập nhật:
- Thêm biến `{tênNgườiKiểmSoát}`, `{vaiTròNgườiKiểmSoát}` vào `TEMPLATE_VARS` (mô tả "chỉ dùng khi có người kiểm soát").
- Thêm template `kiemSoat` vào cả `_DEFAULT_MAIL_TEMPLATES` (server) và `DEFAULT_MAIL_TEMPLATES` (client SettingsPage).
- Mẫu `giaoViec` mặc định (hai nơi) thêm đoạn `[[ và trình duyệt qua {vaiTròNgườiKiểmSoát} - {tênNgườiKiểmSoát}]]`.

`workflowPermissions.js` (client) là **bản sao logic** `WORKFLOW_ACTIONS` (server) — phải thêm nhánh NKS song song ở cả hai và giữ đồng bộ (comment đã yêu cầu "keep in sync").

---

## Tổng hợp rủi ro

- **Lệch client/server**: 3 cặp bản sao (templates, vars, workflow actions) → test cả hai phía để bắt lệch.
- **Cache cột Hồ Sơ (012)**: sau bump schema, `ensureInitialized` đã `_invalidateDocColsCache()` — an toàn.
- **Khoá ghi trường NKS**: chỉ GĐ/QTV ghi `Người kiểm soát` qua `giaoViec`; `ksThemPhoiHop` không đụng trường này (FR-007).
- **`ksThemPhoiHop` không transition**: cẩn thận sentinel `to='_keep'` để KHÔNG set `Tình trạng`; validate trạng thái ∈ {Chờ xử lý, Đang xử lý}; ràng buộc chỉ-thêm + PT bất biến phải ở server (FR-004a).

---

## R8 — Hiển thị NKS & migration token (phát hiện khi triển khai)

**Vấn đề**: 012 lọc danh sách phía server bằng cột "Token xem". NKS không nằm trong token → "đăng nhập không thấy hồ sơ nào".

**Decision**: gộp NKS vào `_docViewToken` + `_isParticipant`. Hồ sơ cũ: tính lại token bằng hàm **thủ công** theo lô.

**Bài học (quan trọng)**: KHÔNG được "ghi lại toàn bộ hồ sơ" trong `ensureInitialized`/`doGet`. Bản đầu bump cờ backfill làm `_updateDocRow` chạy 12k lần (mỗi lần đọc lại cả sheet + ghi từng ô) → vượt 6' → cờ không kịp set → **timeout vĩnh viễn**. Thay bằng `rebuildGvizQueryColumns()` (đọc 1 lần + ghi mỗi cột 1 `setValues`) chạy tay. → Nguyên tắc: **mọi thao tác trên toàn bảng phải bulk I/O và nằm ngoài hot path `doGet`**.

## R9 — Nhất quán nhận diện NKS (phát hiện khi triển khai)

**Vấn đề**: "Token xem" resolve email/tên đăng nhập/ID → UserID (qua `_getDocUserIdMap`), nhưng `_isController` so RAW. Khi SSO lưu NKS dạng email (≠ `session.username` là login) → hồ sơ hiện trong list nhưng bấm hành động báo "không có quyền".

**Decision**: `_isController` resolve qua **cùng `_getDocUserIdMap`** → "thấy được ⇒ thao tác được" (FR-015). An toàn: map chỉ về đúng UserID của chính người đó.
