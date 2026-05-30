# Feature Specification: Cảnh báo sắp hết hạn

**Feature ID**: 002-deadline-warning
**Created**: 2026-05-30
**Status**: Draft

## Summary

Hiển thị cảnh báo trực quan khi hồ sơ gần đến hoặc quá Ngày kết thúc. Áp dụng màu lên tên hồ sơ + hint ngày kết thúc dưới cột Ngày BH trong danh sách.

## User Scenarios

### User Story 1 — Nhìn danh sách biết ngay hồ sơ nào sắp hết hạn (P1)

User mở danh sách hồ sơ, nhìn vào biết ngay doc nào quá hạn (đỏ), sắp hết hạn (vàng), còn thời gian (xanh).

**Acceptance Scenarios**:

1. **Given** doc có Ngày kết thúc < hôm nay và Tình trạng ≠ Hoàn thành, **When** hiển thị danh sách, **Then** tên hồ sơ màu đỏ + hint "KT: dd/mm/yyyy (quá hạn X ngày)" màu đỏ.
2. **Given** doc có Ngày kết thúc trong 1–3 ngày tới, **Then** tên hồ sơ màu amber + hint "KT: dd/mm/yyyy (còn X ngày)" màu amber.
3. **Given** doc có Ngày kết thúc trong 4–7 ngày tới, **Then** tên hồ sơ màu xanh + hint "KT: dd/mm/yyyy (còn X ngày)" màu xanh.
4. **Given** doc có Ngày kết thúc > 7 ngày tới, **Then** tên hồ sơ màu bình thường + hint "KT: dd/mm/yyyy" màu xám (không cảnh báo).
5. **Given** doc không có Ngày kết thúc, **Then** không hiện hint KT.
6. **Given** doc ở trạng thái Hoàn thành, **Then** không áp dụng cảnh báo deadline (dù có Ngày kết thúc).
7. **Given** doc Khẩn + quá hạn, **Then** tên hồ sơ màu đỏ + icon 🚀 (Khẩn ưu tiên), hint KT vẫn đỏ theo deadline.

## Requirements

### Functional Requirements

- **FR-001**: Tên hồ sơ trong danh sách MUST đổi màu theo mức độ deadline khi Tình trạng ≠ Hoàn thành và có Ngày kết thúc.
- **FR-002**: Thứ tự ưu tiên màu tên: Khẩn (đỏ + 🚀) > Quá hạn (đỏ) > ≤3 ngày (amber) > 4–7 ngày (xanh) > bình thường.
- **FR-003**: Cột Ngày BH MUST hiển thị thêm dòng hint "KT: dd/mm/yyyy" bên dưới khi doc có Ngày kết thúc. Hint có màu theo deadline level, độc lập với Khẩn.
- **FR-004**: Hint MUST hiển thị suffix "(quá hạn X ngày)" hoặc "(còn X ngày)" khi ≤ 7 ngày hoặc quá hạn. Khi > 7 ngày chỉ hiện ngày, không suffix.
- **FR-005**: Doc ở trạng thái Hoàn thành MUST NOT hiển thị cảnh báo deadline.

### Color Mapping

| Điều kiện | Tên hồ sơ (nếu không Khẩn) | Hint KT |
|---|---|---|
| Quá hạn | `text-red-600` | `text-red-500` + "(quá hạn X ngày)" |
| ≤ 3 ngày | `text-amber-600` | `text-amber-500` + "(còn X ngày)" |
| 4–7 ngày | `text-blue-600` | `text-blue-500` + "(còn X ngày)" |
| > 7 ngày | bình thường | `text-on-surface-variant` (xám) |
| Không có hạn | bình thường | không hiện |

### Scope

- **Chỉ danh sách doc** (bảng trong MainApp). Preview và Modal không thay đổi.
- **Client-side only** — tính toán deadline từ Ngày kết thúc có sẵn, không cần thay đổi server.
- **Không thêm cột mới** — tận dụng cột Ngày BH hiện có.

## Technical Notes

- Logic tính deadline nên tách thành pure function (dễ test).
- Ngày kết thúc có thể là ISO string hoặc dd/mm/yyyy — cần normalize.
- So sánh ngày dùng local date (bỏ timezone/time), chỉ so ngày.
