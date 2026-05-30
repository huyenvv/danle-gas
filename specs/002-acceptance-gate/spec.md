# Feature Specification: Nghiệm thu trước hoàn thành

**Feature Branch**: `002-acceptance-gate`
**Created**: 2026-05-30
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - PT trình nghiệm thu (Priority: P1)

PT hoàn tất xử lý hồ sơ, click "Hoàn thành" → trạng thái chuyển thành "Chờ xác nhận HT" thay vì trực tiếp "Hoàn thành". GĐ nhận thông báo.

**Why this priority**: Thay đổi core flow — PT không còn tự kết thúc doc.

**Independent Test**: PT click Hoàn thành → status = "Chờ xác nhận HT" → GĐ nhận email + unread.

**Acceptance Scenarios**:

1. **Given** doc ở "Đang xử lý" và user là PT, **When** click "Hoàn thành", **Then** trạng thái → "Chờ xác nhận HT", GĐ nhận email + notification.
2. **Given** doc ở "Từ chối kết quả" và user là PT, **When** sửa doc + click "Hoàn thành", **Then** edits saved + trạng thái → "Chờ xác nhận HT" (single API call).

---

### User Story 2 - GĐ xác nhận hoàn thành (Priority: P1)

GĐ mở doc "Chờ xác nhận HT", thấy ổn, click "Xác nhận HT" → trạng thái → "Hoàn thành" (kết thúc flow). PT nhận thông báo.

**Why this priority**: Hoàn thành vòng nghiệm thu happy path.

**Independent Test**: GĐ click "Xác nhận HT" → status = "Hoàn thành", doc locked.

**Acceptance Scenarios**:

1. **Given** doc ở "Chờ xác nhận HT", **When** GĐ click "Xác nhận HT", **Then** trạng thái → "Hoàn thành", doc locked. Không gửi email/notification cho PT.

---

### User Story 3 - GĐ từ chối kết quả (Priority: P1)

GĐ mở doc "Chờ xác nhận HT", thấy chưa ổn, click "Từ chối" → nhập lý do → trạng thái → "Từ chối kết quả". PT nhận thông báo kèm lý do.

**Why this priority**: Hoàn thành reject loop.

**Independent Test**: GĐ từ chối → status = "Từ chối kết quả" + lý do saved → PT nhận email.

**Acceptance Scenarios**:

1. **Given** doc ở "Chờ xác nhận HT", **When** GĐ click "Từ chối" và nhập lý do, **Then** trạng thái → "Từ chối kết quả", lý do saved, PT nhận email + notification.
2. **Given** doc ở "Chờ xác nhận HT", **When** GĐ click "Từ chối" không nhập lý do, **Then** hiện lỗi yêu cầu nhập lý do.

---

### User Story 4 - PT sửa và trình lại sau từ chối kết quả (Priority: P1)

PT thấy doc "Từ chối kết quả", đọc lý do, sửa doc, click "Hoàn thành" lại → quay về "Chờ xác nhận HT".

**Why this priority**: Hoàn thành reject→resubmit loop.

**Independent Test**: PT mở doc Từ chối kết quả → thấy lý do + edit + Hoàn thành → status = "Chờ xác nhận HT".

**Acceptance Scenarios**:

1. **Given** doc ở "Từ chối kết quả" và user là PT, **When** mở doc, **Then** thấy lý do từ chối + có thể sửa + nút "Hoàn thành".
2. **Given** doc ở "Từ chối kết quả", **When** PT sửa + click "Hoàn thành", **Then** edits saved + trạng thái → "Chờ xác nhận HT" + GĐ nhận thông báo.

---

### User Story 5 - UI badge + email template (Priority: P2)

Badge "Chờ xác nhận HT" có màu riêng (teal/indigo), hover hiện "Chờ xác nhận hoàn thành". Badge "Từ chối kết quả" dùng rose để phân biệt với "Từ chối" (đỏ đậm). Email template "Từ chối kết quả" cấu hình được trong Settings.

**Why this priority**: Bổ trợ — mặc định hoạt động, admin tune sau.

**Independent Test**: Badges hiển thị đúng màu + hover. Admin chỉnh template trong Settings.

**Acceptance Scenarios**:

1. **Given** doc ở "Chờ xác nhận HT", **When** xem list/detail, **Then** badge teal/indigo + hover tooltip "Chờ xác nhận hoàn thành".
2. **Given** doc ở "Từ chối kết quả", **When** xem list/detail, **Then** badge rose (khác màu "Từ chối").
3. **Given** admin mở Settings, **When** chỉnh email "Từ chối kết quả", **Then** template saved + dùng cho lần từ chối tiếp.

---

### Edge Cases

- PT ở "Từ chối kết quả" có thấy nút Phát hành không? → Không — tương tự VT ở "Từ chối".
- GĐ ở "Chờ xác nhận HT" có thể edit doc không? → Không — chỉ Xác nhận HT hoặc Từ chối.
- NV/PH có thấy nút gì ở "Chờ xác nhận HT"? → Không — chỉ GĐ và admin.

## Requirements

### Functional Requirements

- **FR-001**: PT click "Hoàn thành" trên doc "Đang xử lý" MUST chuyển trạng thái → "Chờ xác nhận HT" (không trực tiếp "Hoàn thành").
- **FR-002**: GĐ MUST thấy nút "Xác nhận HT" + "Từ chối" trên doc "Chờ xác nhận HT".
- **FR-003**: GĐ click "Xác nhận HT" MUST chuyển trạng thái → "Hoàn thành". MUST NOT gửi email/notification cho PT.
- **FR-004**: GĐ click "Từ chối" MUST yêu cầu nhập lý do (required) + chuyển → "Từ chối kết quả" + notify PT.
- **FR-005**: "Từ chối kết quả" MUST dùng chung column "Lý do từ chối" trong Hồ Sơ sheet.
- **FR-006**: PT (assigned) ở "Từ chối kết quả" chỉ thấy nút "Hoàn thành" (saves edits + transitions via updateData, single API call). MUST NOT thấy nút "Chỉnh sửa" riêng, "Lưu tài liệu", hoặc "Phát hành".
- **FR-007**: Badge "Chờ xác nhận HT" MUST hiện màu teal/indigo + hover tooltip "Chờ xác nhận hoàn thành".
- **FR-008**: Badge "Từ chối kết quả" MUST hiện màu rose, phân biệt với "Từ chối" (đỏ đậm).
- **FR-009**: Email template "Từ chối kết quả" MUST cấu hình được trong Settings (dùng {lyDoTuChoi}).

### Key Entities

- **Hồ Sơ**: Thêm 2 status mới vào VALID_STATUSES: "Chờ xác nhận HT", "Từ chối kết quả". Reuse column "Lý do từ chối".
- **WORKFLOW_ACTIONS**: Đổi `hoanThanh` target (Đang xử lý → Chờ xác nhận HT), thêm `hoanThanhLai` (Từ chối kết quả → Chờ xác nhận HT), `xacNhanHT` (Chờ xác nhận HT → Hoàn thành), `tuChoiKetQua` (Chờ xác nhận HT → Từ chối kết quả).
- **MAIL_TEMPLATES**: Thêm key `tuChoiKetQua`.

## Success Criteria

- **SC-001**: PT click Hoàn thành → doc không kết thúc ngay, chờ GĐ xác nhận.
- **SC-002**: Full loop: PT Hoàn thành → GĐ từ chối → PT sửa + Hoàn thành lại → GĐ xác nhận → doc kết thúc.
- **SC-003**: Badge "Chờ xác nhận HT" và "Từ chối kết quả" phân biệt rõ ràng bằng mắt thường.

## Assumptions

- Chỉ GĐ (và admin) có quyền xác nhận/từ chối kết quả.
- PT assigned là người duy nhất thấy nút Hoàn thành (giống hiện tại).
- Email "Từ chối kết quả" dùng chung {lyDoTuChoi} variable — template riêng nhưng cùng field dữ liệu.
- "Chờ xác nhận HT" là trạng thái chờ — doc locked cho PT (chỉ GĐ action).
- SCHEMA_V không cần bump — không thêm column mới (reuse "Lý do từ chối").
