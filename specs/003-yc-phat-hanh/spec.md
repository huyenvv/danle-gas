# Feature Specification: YC Phát hành

**Feature Branch**: `003-yc-phat-hanh`

**Created**: 2026-05-31

**Status**: Draft

**Input**: User description: "Thêm tính năng YC Phát hành để GĐ yêu cầu VT phát hành tài liệu, tương tự flow Từ chối."

## User Scenarios & Testing

### User Story 1 - GĐ yêu cầu phát hành (Priority: P1)

GĐ mở document ở trạng thái "Chờ duyệt", nhận thấy cần phát hành ngay, click nút "YC Phát hành", nhập lý do yêu cầu, nhấn xác nhận. Document chuyển sang trạng thái "YC Phát hành".

**Why this priority**: Core flow — không có hành động này thì feature không tồn tại.

**Independent Test**: GĐ click YC Phát hành → nhập lý do → document chuyển trạng thái → người tạo doc nhận email thông báo.

**Acceptance Scenarios**:

1. **Given** document ở "Chờ duyệt", **When** GĐ click "YC Phát hành" và nhập lý do, **Then** trạng thái → "YC Phát hành", lý do được lưu vào field "Lý do từ chối", người tạo doc nhận email thông báo.
2. **Given** document ở "Chờ duyệt", **When** GĐ click "YC Phát hành" nhưng không nhập lý do, **Then** hiện lỗi yêu cầu nhập lý do.
3. **Given** document KHÔNG ở "Chờ duyệt", **When** GĐ mở document, **Then** không thấy nút "YC Phát hành".

---

### User Story 2 - Người có quyền phát hành document theo yêu cầu (Priority: P1)

Người có quyền phát hành (VT hoặc user có quyền tạo + quyền "Được phát hành", trừ admin) nhìn thấy document ở trạng thái "YC Phát hành" do mình tạo, đọc lý do yêu cầu, và click nút "Phát hành". Không thấy nút chỉnh sửa document.

**Why this priority**: Hoàn thành vòng lặp GĐ yêu cầu → người tạo doc thực hiện phát hành.

**Independent Test**: Người có quyền mở doc YC Phát hành do mình tạo → thấy lý do → thấy nút Phát hành → phát hành thành công.

**Acceptance Scenarios**:

1. **Given** document ở "YC Phát hành" do mình tạo, **When** người có quyền phát hành (VT hoặc user có canCreate + canPublish) mở document, **Then** thấy lý do yêu cầu + nút "Phát hành", KHÔNG thấy nút chỉnh sửa.
2. **Given** document ở "YC Phát hành" do người khác tạo, **When** người có quyền phát hành mở document, **Then** thấy lý do yêu cầu, KHÔNG thấy nút "Phát hành", KHÔNG thấy nút chỉnh sửa.
3. **Given** document ở "YC Phát hành" do mình tạo, **When** người có quyền phát hành click "Phát hành", **Then** document được phát hành như quy trình phát hành bình thường.
4. **Given** document ở "YC Phát hành", **When** admin mở document, **Then** admin vẫn có thể chỉnh sửa và phát hành (admin không bị hạn chế).

---

### User Story 3 - Email thông báo YC Phát hành (Priority: P2)

Người tạo document nhận email khi GĐ yêu cầu phát hành, email chứa lý do yêu cầu.

**Why this priority**: Bổ trợ — người tạo doc cần biết ngay khi có yêu cầu phát hành mà không cần mở app.

**Independent Test**: GĐ yêu cầu phát hành → người tạo doc nhận email với lý do.

**Acceptance Scenarios**:

1. **Given** GĐ yêu cầu phát hành document, **When** email gửi, **Then** email chứa tên hồ sơ + lý do yêu cầu + link mở app, gửi cho người tạo document.

---

### User Story 4 - Cài đặt email template YC Phát hành (Priority: P2)

Admin có thể chỉnh nội dung email thông báo YC Phát hành trong Settings, ở tab riêng.

**Why this priority**: Tùy chỉnh — mặc định hoạt động, admin tune sau.

**Independent Test**: Admin vào Settings → sửa email template YC Phát hành → GĐ yêu cầu phát hành → email dùng template mới.

**Acceptance Scenarios**:

1. **Given** admin mở Settings, **When** chỉnh email YC Phát hành, **Then** template được lưu.
2. **Given** template mới đã lưu, **When** GĐ yêu cầu phát hành, **Then** email dùng template mới.

---

### User Story 5 - Quy tắc hiển thị nút Phát hành (Priority: P1)

Nút "Phát hành" chỉ hiển thị cho VT và người có quyền "Được phát hành" trong các điều kiện cụ thể.

**Why this priority**: Đảm bảo đúng quyền hạn — sai quyền thì toàn bộ flow bị lỗi.

**Independent Test**: Kiểm tra nút Phát hành hiển thị/ẩn đúng theo từng trường hợp.

**Acceptance Scenarios**:

1. **Given** VT tạo document mới, **When** document ở trạng thái mới (tạo mới), **Then** VT thấy nút "Phát hành".
2. **Given** document ở "Hoàn thành", **When** VT (hoặc user có quyền phát hành) mở document, **Then** thấy nút "Phát hành".
3. **Given** document ở "YC Phát hành" do VT tạo, **When** VT mở document, **Then** thấy nút "Phát hành".
4. **Given** document ở "YC Phát hành" do người khác tạo, **When** VT mở document, **Then** KHÔNG thấy nút "Phát hành".
5. **Given** document ở trạng thái khác (Chờ duyệt, Chờ xử lý, Đang xử lý, Từ chối, etc.), **When** VT mở document, **Then** KHÔNG thấy nút "Phát hành".

---

### Edge Cases

- GĐ yêu cầu phát hành khi document đã có lý do từ chối cũ?
  → Lý do YC Phát hành ghi đè lên field "Lý do từ chối" — chỉ lưu lý do mới nhất.
- VT đang view doc "YC Phát hành" mà GĐ thay đổi trạng thái?
  → Không xảy ra: GĐ không có action nào từ trạng thái "YC Phát hành".
- Document ở "YC Phát hành" nhưng người có quyền phát hành không phải creator?
  → Chỉ creator mới thấy nút Phát hành ở trạng thái "YC Phát hành", bất kể có quyền gì (trừ admin).
- GĐ yêu cầu phát hành nhiều lần?
  → Không xảy ra: nút "YC Phát hành" chỉ hiển thị ở trạng thái "Chờ duyệt".

## Requirements

### Functional Requirements

- **FR-001**: GĐ MUST thấy nút "YC Phát hành" trên document ở trạng thái "Chờ duyệt".
- **FR-002**: Click "YC Phát hành" MUST hiện dialog yêu cầu nhập lý do (required, không được bỏ trống).
- **FR-003**: Submit YC Phát hành MUST chuyển trạng thái → "YC Phát hành" + lưu lý do vào field "Lý do từ chối" (dùng chung field với Từ chối).
- **FR-004**: Người tạo document (creator) MUST nhận email thông báo kèm lý do khi GĐ yêu cầu phát hành.
- **FR-005**: Người tạo document (creator) MUST nhận unread notification cho document bị yêu cầu phát hành.
- **FR-006**: Ở trạng thái "YC Phát hành", người có quyền phát hành (VT hoặc user có canCreate + canPublish, trừ admin) MUST NOT thấy nút chỉnh sửa. Nếu là creator thì MUST thấy nút "Phát hành". Nếu không phải creator thì MUST NOT thấy nút "Phát hành". Admin không bị hạn chế (vẫn edit và phát hành được).
- **FR-007**: Nút "Phát hành" MUST chỉ hiển thị cho VT và người có quyền "Được phát hành" (trừ admin — admin theo logic riêng) khi: (a) tạo mới document, (b) document ở trạng thái "Hoàn thành", (c) document ở trạng thái "YC Phát hành" nhưng chỉ đối với document do chính mình tạo.
- **FR-008**: Phát hành document ở trạng thái "YC Phát hành" MUST hoạt động giống quy trình phát hành bình thường (gửi email, chuyển trạng thái, v.v.).
- **FR-009**: Admin MUST có thể cài đặt email template YC Phát hành trong Settings ở tab riêng.
- **FR-010**: Lý do yêu cầu phát hành MUST hiển thị cho mọi người khi xem document ở trạng thái "YC Phát hành" (tương tự cách hiển thị lý do từ chối).

### Key Entities

- **Hồ Sơ**: Thêm trạng thái "YC Phát hành" vào field Tình trạng. Lý do yêu cầu dùng chung field "Lý do từ chối".
- **MAIL_TEMPLATES**: Thêm key `ycPhatHanh` cho email template YC Phát hành.
- **WORKFLOW_ACTIONS**: Thêm action `ycPhatHanh` (from: "Chờ duyệt", to: "YC Phát hành", roles: ["Giám đốc"]).

## Success Criteria

### Measurable Outcomes

- **SC-001**: GĐ có thể yêu cầu phát hành document trong dưới 30 giây (click + nhập lý do + submit).
- **SC-002**: VT nhận email thông báo trong dưới 60 giây sau khi GĐ yêu cầu phát hành.
- **SC-003**: VT có thể phát hành document từ trạng thái "YC Phát hành" với cùng số bước như phát hành bình thường.
- **SC-004**: Nút "Phát hành" hiển thị đúng 100% theo quy tắc quyền hạn đã định nghĩa.

## Assumptions

- Chỉ GĐ có quyền yêu cầu phát hành (tương tự quyền từ chối).
- Lý do yêu cầu phát hành là text tự do, dùng chung field "Lý do từ chối" — chỉ lưu lý do mới nhất.
- Email YC Phát hành dùng cùng infrastructure MailApp hiện tại.
- Quy trình phát hành từ trạng thái "YC Phát hành" giống hệt phát hành từ trạng thái "Hoàn thành".
- "YC Phát hành" là trạng thái một chiều: chỉ chuyển đến bằng action của GĐ, và thoát ra bằng creator phát hành.
- Trạng thái "YC Phát hành" không cho phép chỉnh sửa bởi bất kỳ ai có quyền phát hành (VT, user có canCreate + canPublish). Chỉ admin mới có thể edit ở trạng thái này.
