# [TÁCH RA — chưa tạo feature] Workflow giao việc cho người phối hợp

> **Nguồn**: tách khỏi `008-document-permissions` ngày 2026-06-19 (quyết định: US6 là **workflow giao việc**, trực giao với phân quyền xem — sẽ làm thành feature riêng sau, vd `010-...`).
> Dùng nội dung dưới đây làm input cho `/speckit-specify` khi bắt đầu feature mới. Chưa triển khai.

## User Story - GĐ giao việc cho người phối hợp (khoá xoá + bắt buộc nội dung giao việc + email riêng)

Khi Giám đốc (hoặc vai trò toàn quyền) **thêm người phối hợp** vào một tài liệu để giao việc, hệ thống ràng buộc luồng giao việc: (1) **người phụ trách chỉ được thêm** người phối hợp mới, **không xoá được bất kỳ người phối hợp nào** đã có (kể cả người do chính họ thêm) — chỉ vai trò toàn quyền mới sửa/xoá; (2) khi tài liệu **có ≥1 người phối hợp**, ô **"nội dung giao việc" bắt buộc** trước khi lưu; không có người phối hợp → để trống được; (3) mỗi người phối hợp được thêm nhận **email template riêng** (kèm nội dung giao việc), tách khỏi template phát hành của Văn thư.

## Functional Requirements (dự kiến)

- **FR-A**: Người phụ trách (không toàn quyền) chỉ được **thêm** người phối hợp; tập người phối hợp cũ MUST ⊆ tập mới. Chỉ vai trò toàn quyền (admin/QTV/GĐ/VT) được xoá/sửa người phối hợp.
- **FR-B**: Khi tài liệu có ≥1 người phối hợp, `'Nội dung giao việc'` MUST bắt buộc (chặn lưu nếu trống); không có người phối hợp → cho trống.
- **FR-C**: Mỗi người phối hợp được thêm MUST nhận email theo **template riêng cho người phối hợp** (kèm nội dung giao việc), tách khỏi template phát hành của Văn thư; gửi ngay khi được thêm/giao việc.

## Acceptance Scenarios

1. Tài liệu đã có người phối hợp + người phụ trách mở sửa → chỉ **thêm mới** khả dụng, không xoá được ai.
2. Vai trò toàn quyền mở → xoá/sửa được người phối hợp.
3. Có ≥1 người phối hợp + "nội dung giao việc" trống → **chặn lưu**.
4. Không có người phối hợp + "nội dung giao việc" trống → lưu **thành công**.
5. GĐ thêm người phối hợp → người đó nhận **email template riêng** (chứa nội dung giao việc).

## Tasks gợi ý (từ Phase 9 cũ của 008)

- Server `documents.js` `updateDocument`: gate "chỉ thêm" cho người phụ trách; toàn quyền xoá/sửa tự do.
- Server `documents.js`: validate bắt buộc `'Nội dung giao việc'` khi ≥1 người phối hợp (create/update).
- Server `documents.js` + mail: email template riêng cho người phối hợp khi được thêm.
- Client (DocumentModal/DocumentPreview): ẩn/khoá nút xoá người phối hợp với người phụ trách; chặn lưu nếu thiếu nội dung giao việc.
- Tests: gating xoá; required field; email template.
