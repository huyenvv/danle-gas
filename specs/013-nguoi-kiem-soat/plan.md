# Implementation Plan: Người kiểm soát hồ sơ

**Branch**: `013-nguoi-kiem-soat` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-nguoi-kiem-soat/spec.md`

## Summary

Bổ sung vai trò **uỷ quyền theo từng hồ sơ** ("Người kiểm soát" / NKS). GĐ/QTV chọn NKS (tuỳ chọn, tối đa 1) khi giao việc. Trên hồ sơ được gán, NKS có thể: (a) **thêm người phối hợp** (chỉ-thêm, không đổi/xoá PT·PH, **không đổi trạng thái**) ở `Chờ xử lý`/`Đang xử lý`; (b) **duyệt tới Hoàn thành** thay GĐ (`xacNhanHT`/`tuChoiKetQua`) — song song với GĐ. Email giao việc thêm đoạn NKS hiển thị theo điều kiện (`[[...]]`); NKS mới được gán nhận chuông + email riêng.

**Cách tiếp cận kỹ thuật**: thêm 1 cột `Người kiểm soát` vào sheet `Hồ Sơ` (bump `SCHEMA_V` 13→14, auto-migrate qua `ensureMissingColumns`); thêm helper `_isController(doc, session)`; gắn token role `_kiemSoat` vào `xacNhanHT`/`tuChoiKetQua`; thêm action mới `ksThemPhoiHop` (`to='_keep'`, chỉ-thêm PH, không transition, chạy ở `Chờ xử lý`/`Đang xử lý`, logic mượn từ `nhanViec`); mở rộng `_applyTemplate` hỗ trợ đoạn điều kiện `[[...]]`; thêm template email `kiemSoat` + biến `{tênNgườiKiểmSoát}`/`{vaiTròNgườiKiểmSoát}`. Client: ô chọn NKS trong popup giao việc (chỉ GĐ/QTV); popup "thêm phối hợp" cho NKS (PT khoá, PH chỉ-thêm, nút Lưu) tái dùng popup giao việc; mở rộng `workflowPermissions.js`; đồng bộ biến + template trong `SettingsPage.jsx`; hiển thị NKS ở `DocumentPreview`.

## Technical Context

**Language/Version**: JavaScript ES5 (`var`/`function`) cho server GAS V8; React JSX + hooks cho client.

**Primary Dependencies**: Google Apps Script runtime, GmailApp, SpreadsheetApp; React + Tailwind; Vite build; Jest (server=node, client=jsdom).

**Storage**: Google Sheets — sheet `Hồ Sơ` (HO_SO) trong file của docmgr; cấu hình email `MAIL_TEMPLATES` trong SSO `_Hệ Thống`; vai trò/người dùng đọc cross-script từ SSO `_Phân Bổ` / `_Người Dùng`.

**Testing**: Jest qua `vm.runInContext` (server), React Testing Library (client). Config: `apps/docmgr/jest.config.js`.

**Target Platform**: Google Apps Script Web App (child app SSO).

**Project Type**: Web app (React client + GAS server) trong npm-workspaces monorepo.

**Performance Goals**: Không thay đổi đặc tính hiệu năng; thao tác NKS dùng lại đường `transitionDocument` hiện có (1 lần đọc/ghi sheet/giao dịch).

**Constraints**: ES5 server code; giữ nguyên hành vi hồ sơ không có NKS (SC-005); gửi email best-effort không rollback; không xoá code (hide = conditional).

**Scale/Scope**: ~6 file server/client chính + tests. 1 cột schema mới. 1 template email mới + 2 biến mới + cú pháp điều kiện.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Đánh giá |
|---|---|
| I. GAS Concatenation Discipline | PASS — chỉ sửa file app docmgr (`config/sheets/documents`), giữ ES5 `var`/`function`; không đổi concat order. |
| II. Shared Core, App Override | PASS — logic NKS là app-specific (docmgr). `_applyTemplate` nằm trong `documents.js` (app), không động gas-core. `ensureMissingColumns` (gas-core) dùng lại, không sửa. |
| III. Security-First Secrets | PASS — không liên quan secrets. |
| IV. SSO Parent-Child Separation | PASS — NKS là **authorization theo hồ sơ** (lưu ở child docmgr), không đụng login/credentials. Vai trò NKS đọc từ SSO `_Phân Bổ` (read-only) như các email var khác. |
| V. Surgical Changes, Simplicity First | PASS — thêm tối thiểu: 1 cột, 1 token role, 1 template, 1 cú pháp điều kiện. Không refactor. |
| VI. Sheets-as-Database Integrity | PASS — thêm cột → **bump `SCHEMA_V` 13→14** (bắt buộc). Không phá `_Đã Đọc`. NKS tham chiếu UserID/username như PT/PH. |
| VII. Test via vm.runInContext | PASS — thêm test server cho quyền NKS + email điều kiện; test client cho `workflowPermissions` + popup. |
| VIII. Shared Design System | PASS — UI dùng lại component/token hiện có (ô chọn người như PT/PH). |

**Kết luận**: Không vi phạm. Không cần mục Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/013-nguoi-kiem-soat/
├── plan.md              # File này (/speckit-plan)
├── research.md          # Phase 0 — quyết định thiết kế
├── data-model.md        # Phase 1 — cột mới, template, biến
├── quickstart.md        # Phase 1 — cách kiểm thử thủ công
├── contracts/
│   └── server-api.md    # Phase 1 — hợp đồng transitionDocument/updateDocument + email
├── checklists/
│   └── requirements.md  # (đã có từ /speckit-specify)
└── tasks.md             # Phase 2 (/speckit-tasks — KHÔNG tạo ở bước này)
```

### Source Code (repository root)

```text
apps/docmgr/src/server/
├── config.js          # SCHEMA_V 13→14; thêm 'Người kiểm soát' vào HO_SO headers
├── documents.js       # _isController(); _kiemSoat ở xacNhanHT/tuChoiKetQua; action ksThemPhoiHop (to=_keep);
│                      #   giaoViec ghi NKS (GĐ/QTV) + gửi email kiemSoat; _applyTemplate [[...]];
│                      #   biến {tên/vaiTròNgườiKiểmSoát}; template 'kiemSoat'; đoạn điều kiện trong email giaoViec
└── __tests__/
    ├── workflow.test.js (hoặc tương đương)  # quyền NKS theo trạng thái
    └── notification.test.js                 # email điều kiện + email NKS

apps/docmgr/src/client/
├── lib/workflowPermissions.js   # isController() + union action NKS (ksThemPhoiHop, xacNhanHT, tuChoiKetQua)
├── components/DocumentModal.jsx # ô chọn NKS (giao việc, GĐ/QTV) + popup "thêm phối hợp" NKS (PT khoá, PH chỉ-thêm)
├── components/documents/DocumentPreview.jsx # hiển thị NKS; nút workflow theo quyền NKS
├── components/SettingsPage.jsx  # đồng bộ TEMPLATE_VARS + DEFAULT_MAIL_TEMPLATES (template kiemSoat + biến + đoạn [[...]])
└── __tests__/
    ├── workflowPermissions.test.js
    └── (DocumentModal / SettingsPage tests)
```

**Structure Decision**: Web-app docmgr hiện hữu. Toàn bộ thay đổi nằm trong `apps/docmgr` (server + client) — không tạo project mới, không sửa gas-core ngoài việc dùng lại `ensureMissingColumns`.

## Phase 0 — Research

Xem [research.md](research.md). Các quyết định chính đã chốt:

1. **Tập hành động NKS** (chốt v1): (a) `ksThemPhoiHop` — action MỚI, thêm PH chỉ-thêm, `to='_keep'` (không transition), chạy ở `Chờ xử lý`/`Đang xử lý`, PT bất biến, logic mượn `nhanViec`; (b) `xacNhanHT`/`tuChoiKetQua` (gắn token `_kiemSoat`). NKS **không** dùng `giaoViec`/`thuHoi`, không đổi/xoá PT, không xoá PH cũ.
2. **Lưu NKS**: 1 cột `Người kiểm soát` trong HO_SO, lưu 1 UserID (chuỗi rỗng = không có). Tái dùng `_parseAssignees`/`_buildAssignees` (mảng ≤1) để nhất quán.
3. **Cơ chế email điều kiện**: mở rộng `_applyTemplate` xử lý `[[...]]` — giữ đoạn nếu mọi `{biến}` bên trong đều khác rỗng sau khi thay; ngược lại bỏ cả đoạn. Tự động phủ FR-009/FR-010 mà không cần cờ riêng.
4. **Thông báo NKS (FR-013)**: template mới `kiemSoat`; gửi khi NKS chuyển sang giá trị mới khác rỗng (lúc `giaoViec`; đổi NKS = thu hồi → giao lại). Best-effort.
5. **`{vaiTròNgườiKiểmSoát}`** = chức danh thực từ SSO `_Phân Bổ` qua `_getDeptInfo`.

## Phase 1 — Design & Contracts

- **[data-model.md](data-model.md)** — cột mới, ràng buộc, template/biến, state×role matrix.
- **[contracts/server-api.md](contracts/server-api.md)** — thay đổi hợp đồng `transitionDocument`, định dạng template & biến (v1: `updateDocument` không đổi).
- **[quickstart.md](quickstart.md)** — kịch bản kiểm thử thủ công map tới acceptance scenarios.
- Cập nhật con trỏ plan trong `CLAUDE.md` (SPECKIT markers) → file này.
