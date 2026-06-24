# Specification Quality Checklist: Truy vấn doc list phía máy chủ — 10.000+ hồ sơ

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-06-23
**Feature**: [spec.md](../spec.md)

## Content Quality

- [~] No implementation details (languages, frameworks, APIs) — xem Notes
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [~] No implementation details leak into specification — xem Notes

## Notes

- **Clarifications đã giải quyết (Session 2026-06-23)**:
  - Lọc quyền vai trò thường → Materialize "token ai được xem" **mức tài liệu** → fast-path mọi vai trò (FR-014).
  - Mô hình quyền → CHỈ mức tài liệu (nhóm/vòng đời là code chết feature 008, bỏ ở revise 2026-06-19); token có nội dung **phụ thuộc Tình trạng** (FR-012/FR-014a), tính lại cục bộ khi sửa hồ sơ, không cập nhật hàng loạt (FR-014b).
  - Hồ sơ Nháp → ẩn với mọi vai trò kể cả full quyền; guard `Tình trạng != 'Nháp' OR Người tạo = me` (FR-012a).
  - Phạm vi tìm kiếm → chỉ TÌM KIẾM TỪ KHÓA server-side toàn tập, **giữ ngữ nghĩa 011 không dấu/không hoa-thường trên 7 trường** qua cột "blob tìm kiếm" chuẩn hóa (FR-016/FR-016b); "Công việc của tôi" + lọc phụ giữ client per-page (FR-015/FR-016a).
  - Tie-breaker → ID hồ sơ giảm dần khi trùng (hạng, Ngày cập nhật) để phân trang không trùng/sót (FR-003a).
- **Implementation-detail note (chấp nhận có chủ đích)**: Theo brief của người dùng, spec nêu định hướng kỹ thuật (Google Sheets Query/gviz, cột "hạng ưu tiên" materialized, "token ai được xem", lớp DataStore). Các tên tech cụ thể (gviz, cột sheet) nằm ở phần **Assumptions như định hướng KHÔNG bắt buộc** để planning quyết định. Khái niệm "hạng ưu tiên"/"token ai được xem" xuất hiện trong FR vì chúng là *yêu cầu hành vi* (giá trị tính sẵn phải đồng bộ → thứ tự/quyền đúng), không ràng buộc cách hiện thực. Để mục này ở trạng thái "~" để người duyệt xác nhận mức chấp nhận trước `/speckit-plan`.
