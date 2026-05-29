# Feature Specification: Trạng thái Từ chối

**Feature Branch**: `001-reject-status`
**Created**: 2026-05-29
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - GĐ từ chối document (Priority: P1)

GĐ mở document ở trạng thái "Chờ duyệt", thấy chưa ổn, click nút "Từ chối", nhập lý do từ chối, submit.

**Why this priority**: Core flow — không có từ chối thì feature vô nghĩa.

**Independent Test**: GĐ click Từ chối → nhập lý do → document chuyển trạng thái → VT nhận email.

**Acceptance Scenarios**:

1. **Given** document ở "Chờ duyệt", **When** GĐ click "Từ chối" và nhập lý do, **Then** trạng thái → "Từ chối", lý do được lưu, VT nhận email + notification.
2. **Given** document ở "Chờ duyệt", **When** GĐ click "Từ chối" nhưng không nhập lý do, **Then** hiện lỗi yêu cầu nhập lý do.

---

### User Story 2 - VT bổ sung và trình duyệt lại (Priority: P1)

VT nhìn thấy document bị từ chối, đọc lý do từ chối, chỉnh sửa/bổ sung, rồi gửi trình duyệt lại.

**Why this priority**: Hoàn thành vòng lặp reject → resubmit.

**Independent Test**: VT mở doc Từ chối → sửa → trình duyệt lại → doc quay về "Chờ duyệt".

**Acceptance Scenarios**:

1. **Given** document ở "Từ chối", **When** VT mở document, **Then** thấy lý do từ chối + có thể sửa + nút "Trình duyệt".
2. **Given** document ở "Từ chối", **When** VT click "Trình duyệt", **Then** trạng thái → "Chờ duyệt", GĐ nhận email/notification.

---

### User Story 3 - Email thông báo từ chối (Priority: P2)

VT nhận email khi document bị từ chối, email chứa lý do từ chối.

**Why this priority**: Bổ trợ — VT cần biết ngay mà không cần mở app.

**Independent Test**: GĐ từ chối → VT nhận email với lý do.

**Acceptance Scenarios**:

1. **Given** GĐ từ chối document, **When** email gửi, **Then** email chứa tên hồ sơ + lý do từ chối + link mở app.

---

### User Story 4 - Cài đặt email template từ chối (Priority: P2)

Admin có thể chỉnh nội dung email thông báo từ chối trong Settings.

**Why this priority**: Tùy chỉnh — mặc định hoạt động, admin tune sau.

**Independent Test**: Admin vào Settings → sửa email template từ chối → GĐ từ chối → email dùng template mới.

**Acceptance Scenarios**:

1. **Given** admin mở Settings, **When** chỉnh email từ chối, **Then** template được lưu.
2. **Given** template mới đã lưu, **When** GĐ từ chối document, **Then** email dùng template mới.

---

### Edge Cases

- GĐ từ chối khi VT đang edit cùng lúc?
  → Không xảy ra: VT không edit được doc ở trạng thái "Chờ duyệt".
- Document đã bị từ chối, GĐ có từ chối lại được không?
  → Không — chỉ "Chờ duyệt" mới hiện nút Từ chối.

## Requirements

### Functional Requirements

- **FR-001**: GĐ MUST thấy nút "Từ chối" trên document ở trạng thái "Chờ duyệt".
- **FR-002**: Click "Từ chối" MUST hiện dialog yêu cầu nhập lý do (required).
- **FR-003**: Submit từ chối MUST chuyển trạng thái → "Từ chối" + lưu lý do.
- **FR-004**: VT MUST nhận email kèm lý do từ chối.
- **FR-005**: VT MUST nhận unread notification cho document bị từ chối.
- **FR-006**: VT (creator) MUST có thể sửa document ở trạng thái "Từ chối" và trình duyệt lại. VT khác (không phải creator) MUST NOT thấy nút chỉnh sửa.
- **FR-007**: Trình duyệt lại MUST chuyển trạng thái → "Chờ duyệt".
- **FR-008**: Admin MUST có thể cài đặt email template từ chối trong Settings.

### Key Entities

- **Hồ Sơ**: Thêm trạng thái "Từ chối" vào field Tình trạng. Thêm field "Lý do từ chối".
- **MAIL_TEMPLATES**: Thêm key `tuChoi` cho email template từ chối.

## Success Criteria

- **SC-001**: GĐ có thể từ chối document trong < 30 giây (click + nhập lý do + submit).
- **SC-002**: VT nhận email trong < 60 giây sau khi GĐ từ chối.
- **SC-003**: VT có thể sửa và trình duyệt lại document bị từ chối.

## Assumptions

- Chỉ GĐ (và admin) có quyền từ chối.
- Lý do từ chối là text tự do (không có template lý do).
- Email từ chối dùng cùng infrastructure MailApp hiện tại.
- Trạng thái "Từ chối" là trạng thái mới, tách biệt khỏi flow hiện tại.
