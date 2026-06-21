# Implementation Plan: Workflow giao việc cho người phối hợp

**Branch**: `010-giao-viec-phoi-hop` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-giao-viec-phoi-hop/spec.md`

## Summary

Phần lớn workflow giao việc **đã tồn tại** trong `apps/docmgr/src/server/documents.js` (action `giaoViec`/`nhanViec`, cột `Nội dung giao việc` ở SCHEMA_V 11, template email `giaoViec` tách biệt với `phatHanh`). Feature này là **3 delta phẫu thuật** để khớp đúng spec, KHÔNG xây mới:

1. **Khoá xoá cho người phụ trách (US1/FR-002)**: `nhanViec` hiện *thay thế* danh sách người phối hợp → cho phép PT xoá. Thêm ràng buộc **tập cũ ⊆ tập mới** (chỉ thêm) ở server, áp cho PT (không áp cho admin).
2. **Bắt buộc nội dung giao việc (US2/FR-005,FR-012)**: `giaoViec` lưu nội dung không kiểm tra. Thêm validate: nếu kết quả có ≥1 người phối hợp mà nội dung trống → chặn.
3. **Email + popup người phối hợp mới khi nhận việc (US3/FR-009,FR-010,FR-014)**: `nhanViec` hiện chỉ đánh dấu unread cho PH mới. Thêm **template email `phoiHop` riêng** (cấu hình được), gửi cho từng PH *mới* với **PH mới là người nhận chính (TO)** — khác `giaoViec` (PH chỉ CC). Nội dung lấy từ **popup giao việc dùng lại** do người chủ trì nhập lúc nhận việc (bắt buộc khi có bổ sung; không bổ sung → không popup). Chuông + email, best-effort.

Kèm **schema** (thêm cột `Nội dung phối hợp` + bump SCHEMA_V 12), 4 delta client (form `giaoViec`: bắt buộc nội dung khi có PH; form `nhanViec`: khoá xoá PH đã có + dùng lại popup giao việc; **preview detail: hiển thị 2 nội dung tách biệt**; **Settings → Email thông báo: thêm tab "Phối hợp"**) và bộ test.

**Thêm cột mới** `Nội dung phối hợp` (bump SCHEMA_V 11→12) để lưu nội dung popup nhận việc, KHÔNG đè "Nội dung giao việc" của GĐ. **Thêm 1 template email `phoiHop`** (cấu hình). **Không** đổi cơ chế email phát hành của Văn thư cũng như email `giaoViec` của GĐ.

## Technical Context

**Language/Version**: JavaScript — server ES5-style `var`/`function` (GAS V8, concat 1 scope); client React/JSX + hooks.

**Primary Dependencies**: Google Apps Script runtime; React + Vite + Tailwind (client); Jest (test).

**Storage**: Google Sheets — sheet `HO_SO`. Cột liên quan (đã tồn tại): `Phụ trách` (JSON array 1 phần tử), `Người phối hợp` (JSON array nhiều phần tử), `Nội dung giao việc`, `Tình trạng`.

**Testing**: Jest. Server: `vm.runInContext` global scope (gas-core → app), mock `GmailApp._sent`, `setSheetData`/`resetAll`. Client: jsdom.

**Target Platform**: Google Apps Script Web App (SSO child app docmgr).

**Project Type**: Web (GAS server + React client trong cùng app).

**Performance Goals**: N/A (thao tác đơn lẻ theo tài liệu, không có yêu cầu throughput).

**Constraints**: GAS ES5 discipline; email best-effort (không rollback khi gửi lỗi); ràng buộc thực thi phía server (không chỉ ẩn UI).

**Scale/Scope**: Ứng dụng nội bộ; thay đổi gói gọn trong `transitionDocument` (server) + 1 form preview (client) + test. ~3 delta server, ~2 delta client, ~6 test.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá |
|---|---|
| **I. GAS Concatenation / ES5** | PASS — sửa trong `documents.js` giữ `var`/`function`, không thêm file/đảo thứ tự concat. |
| **V. Surgical Changes, Simplicity First** | PASS — chỉ chạm `transitionDocument` (3 nhánh đã có) + 1 form client; tái dùng template + cột sẵn có; không abstraction mới. |
| **VI. Sheets-as-Database Integrity** | PASS — thêm cột `Nội dung phối hợp` vào `HO_SO` và **bump SCHEMA_V 11→12** theo đúng pattern (`ensureMissingColumns`). `prevSchema='11'`≠null nên KHÔNG chạy rebuild nặng (chỉ thêm cột + backfill nhẹ). |
| **VII. Test via vm.runInContext** | PASS — thêm test server theo đúng pattern `resetAll`/`setSheetData`/`GmailApp._sent`. |
| **IV. SSO Parent-Child** | N/A — không đụng auth/login; chỉ dùng `session.role`/`_phuTrach` sẵn có. |
| **VIII. Shared Design System** | PASS — không thêm token/icon; chỉ thay đổi hành vi form sẵn có. |

→ **Không vi phạm.** Complexity Tracking bỏ trống.

## Project Structure

### Documentation (this feature)

```text
specs/010-giao-viec-phoi-hop/
├── plan.md              # This file
├── research.md          # Phase 0 — FR↔code mapping + quyết định
├── data-model.md        # Phase 1 — cột HO_SO liên quan + state machine
├── quickstart.md        # Phase 1 — cách chạy/kiểm thử delta
├── contracts/
│   └── transition-actions.md   # Hợp đồng action giaoViec/nhanViec sau thay đổi
└── tasks.md             # /speckit-tasks (chưa tạo)
```

### Source Code (repository root)

```text
apps/docmgr/src/server/
├── config.js            # S1: thêm cột 'Nội dung phối hợp' vào HO_SO + bump SCHEMA_V '11'→'12'
├── documents.js         # _DEFAULT_MAIL_TEMPLATES: thêm 'phoiHop' (+ var {nộiDungPhoiHop}); transitionDocument(): giaoViec (D1 validate), nhanViec (D2 subset, D3 lưu cột + email phoiHop với PH=TO, D3b validate nội dung)
└── __tests__/
    ├── documents.test.js     # test D1/D2/D3b + lưu cột 'Nội dung phối hợp'
    └── notification.test.js  # test D3 (email phoiHop, PH mới = TO)

apps/docmgr/src/client/components/
├── documents/DocumentPreview.jsx  # C1: form giaoViec bắt buộc nội dung khi có PH; C2: form nhanViec khoá xoá PH đã có + dùng lại popup giao việc; C3: preview detail hiển thị 'Nội dung giao việc' và 'Nội dung phối hợp' tách biệt
└── SettingsPage.jsx               # C4: thêm tab cấu hình email 'Phối hợp' (template phoiHop) + biến {nộiDungPhoiHop} vào danh sách biến
```

**Structure Decision**: Web app GAS hiện hữu. Toàn bộ thay đổi nằm trong `transitionDocument` (server) và form workflow trong `DocumentPreview.jsx` (client), cộng test. Không tạo module/file mới.

## Complexity Tracking

> Không có vi phạm Constitution — bảng để trống.
