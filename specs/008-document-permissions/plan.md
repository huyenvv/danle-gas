# Implementation Plan: Phân quyền xem đến từng tài liệu

**Branch**: `008-document-permissions` | **Date**: 2026-06-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-document-permissions/spec.md`

## Summary

> **Revise 2026-06-18** (chỉ theo người) **+ 2026-06-19** (snapshot là nguồn chân lý) — xem Clarifications/FR mới trong spec. Tóm tắt cập nhật bên dưới.

Thêm phân quyền **xem** ở cấp tài liệu (Hồ Sơ), theo **mô hình vòng đời + snapshot danh sách người**:

1. **Chưa hoàn thành** (`Tình trạng` ≠ `Hoàn thành`, ≠ `Nháp`): chỉ **người tham gia** (Người tạo, Phụ trách, Người phối hợp đã gắn) + vai trò toàn quyền xem.
2. **Hoàn thành**: `Người được xem` (chỉ theo người) là **nguồn chân lý**. Không rỗng → chỉ người trong danh sách (+ người tham gia + toàn quyền), **bất kể danh mục**; **rỗng → chỉ toàn quyền + người tham gia** — **KHÔNG** fallback kế thừa danh mục động (FR-003 mới).
3. **Tạo mới**: snapshot `Người được xem` = người-xem-của-danh-mục (khai triển nhóm danh mục → người, **+ kế thừa danh mục cha**); chỉnh được ở màn tạo/sửa. Snapshot lưu cùng tài liệu → đổi/xoá quyền danh mục về sau không ảnh hưởng tài liệu cũ (FR-008a).
4. **Phát hành** (VT/GĐ/admin): thêm **mọi** người nhận chưa có vào `Người được xem`, **kể cả khi rỗng** (revise 2026-06-19 — rỗng = chưa nhân viên nào thấy nên không khóa nhầm ai).
5. **Import Excel**: cột "Phân quyền" (một/nhiều tên nhóm, **CSV-style**: tên có dấu phẩy bọc trong `"..."`) → **khai triển thành viên** vào `Người được xem`; tên không tồn tại → không tạo + cảnh báo.
6. **Migration backfill** (FR-013): một lần, với mỗi tài liệu đang có `Người được xem` rỗng → snapshot người-xem của danh mục cha vào danh sách riêng (để dữ liệu cũ không bị ẩn khi bỏ fallback động).

**Kỹ thuật**: thêm 2 cột `Người được xem` + `Nhóm được xem` vào sheet `Hồ Sơ` (mirror sheet `Danh Mục`), bump `SCHEMA_V` 10→11 (cột tự thêm qua `ensureMissingColumns`). Tập trung logic hiển thị vào một helper `_canViewDocument()` dùng trong `getDocuments` — **bỏ nhánh fallback danh mục động** (rỗng = chỉ toàn quyền + người tham gia). Thêm helper khai triển `_categoryViewerIds(catId)` (người trực tiếp + thành viên nhóm danh mục **+ kế thừa ngược chuỗi `Danh mục cha`**) dùng chung cho snapshot lúc tạo (server) và migration backfill; client `categoryViewerIds` (DocumentModal/DocumentPreview) mirror logic này. Mở rộng `publishDocument`, `import.js` (parser CSV-quoting cho cột Phân quyền). Thêm `setDocumentViewers()` + `api_setDocumentViewers`. Thêm migration backfill chạy 1 lần trong `ensureInitialized()`/sau migrate cột. Không thêm module gas-core, không đổi luồng SSO/login.

## Technical Context

**Language/Version**: Server JavaScript ES5-style (`var`/`function`, GAS V8 runtime); Client React 18 + JSX.

**Primary Dependencies**: gas-core (concat), Google Apps Script APIs (SpreadsheetApp, GmailApp); React + Vite + Tailwind (MD3 tokens).

**Storage**: Google Sheets — `Hồ Sơ` (tài liệu), `Danh Mục` (đã có viewer fields), `Nhóm` (groups). Không DB ngoài.

**Testing**: Jest — server qua `vm.runInContext` (`setup.js` load gas-core→app), client jsdom. Mirror `categoryPerms.test.js`. E2E Playwright (tuỳ chọn).

**Target Platform**: Google Apps Script Web App (child SSO app `docmgr`).

**Project Type**: Web (React client + GAS server) trong monorepo, app `apps/docmgr/`.

**Performance Goals**: Lọc danh sách O(số tài liệu); group membership của user tính 1 lần/request (như hiện tại). Không thêm vòng quét toàn cục mỗi tài liệu.

**Constraints**: ES5 only; thứ tự concat (`config → sheets → auth → others → main`, `main.js` cuối); thay đổi schema phải bump `SCHEMA_V`; thay đổi surgical, tái dùng pattern phân quyền danh mục.

**Scale/Scope**: Quy mô tổ chức nhỏ; vài nghìn tài liệu; ~vài chục người dùng/nhóm.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá |
|-----------|----------|
| I. GAS Concatenation Discipline | PASS — sửa `config.js`/`documents.js`/`import.js`/`main.js` (thêm `api_setDocumentViewers`); ES5; không đụng thứ tự concat. |
| II. Shared Core, App Override | PASS — không thêm/sửa gas-core. Logic thuần app-level. |
| III. Security-First Secrets | PASS — không liên quan secrets. |
| IV. SSO Parent-Child Separation | PASS — không đụng login/token; chỉ authorization cục bộ (xem). Group/user lookup đọc sheet cục bộ + SSO `_Người Dùng` như hiện tại. |
| V. Surgical Changes, Simplicity First | PASS — tái dùng `_parseAssignees`, mirror cột `Danh Mục`. Trích helper `_canViewDocument` + `_categoryViewerIds` (dùng chung snapshot lúc tạo + backfill, tránh lặp). **Bỏ** nhánh fallback danh mục động + helper `_matchPerm`/`_recipientCanViewCategory` không còn cần ở đường tài liệu (chỉ giữ nếu vẫn dùng cho danh mục). Không thêm endpoint mới. |
| VI. Sheets-as-Database Integrity | PASS — bump `SCHEMA_V` 10→11; cột mới thêm qua `ensureMissingColumns`; không phá ref. **Migration backfill** (FR-013) chạy **1 lần**, **idempotent** (chỉ ghi tài liệu đang rỗng, danh mục cha có người), gắn cờ đã-chạy trong ScriptProperties để không lặp. |
| VII. Test via vm.runInContext | PASS — thêm `documentPerms.test.js`; cập nhật `DOC_HEADERS` trong `__tests__/helpers.js`. Không thêm gas-core nên `GAS_CORE_FILES` không đổi. |
| VIII. Shared Design System | PASS — dùng lại Tailwind tokens + pattern chip picker của `CategoryManager`. |

**Kết quả**: Không vi phạm → không cần Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/008-document-permissions/
├── plan.md              # File này
├── research.md          # Phase 0 — quyết định kỹ thuật
├── data-model.md        # Phase 1 — schema Hồ Sơ + entity quyền
├── quickstart.md        # Phase 1 — cách chạy/test/deploy
├── contracts/
│   └── api.md           # Phase 1 — thay đổi hợp đồng API (getDocuments/publish/create/update/import)
├── checklists/
│   └── requirements.md  # Đã có từ /speckit-specify
└── tasks.md             # Phase 2 — /speckit-tasks (CHƯA tạo ở bước này)
```

### Source Code (repository root)

```text
apps/docmgr/src/server/
├── documents.js         # + helper _isParticipant / _canViewDocument / _categoryViewerIds(catId);
│                        #   _canViewDocument: rỗng → chỉ toàn quyền + người tham gia (BỎ fallback danh mục động);
│                        #   sửa getDocuments (lọc qua _canViewDocument);
│                        #   sửa publishDocument (auto-add khi danh sách không rỗng + gate VT/GĐ/admin);
│                        #   + setDocumentViewers(nguoiDuocXem) (gate toàn quyền, tách khỏi sửa hồ sơ);
│                        #   create/updateDocument ghi 'Người được xem' (snapshot lúc tạo);
│                        #   + _backfillDocViewers() migration 1 lần (FR-013) snapshot danh mục → tài liệu rỗng
├── config.js            # + 2 cột HO_SO; bump SCHEMA_V 10→11; gọi _backfillDocViewers sau migrate cột
├── main.js              # + api_setDocumentViewers wrapper
├── sheets.js            # (revise) getAllData: BỎ lọc danh mục theo quyền user → trả về tất cả danh mục
│                        #   (quyền danh mục chỉ còn là template snapshot; client ẩn danh mục rỗng)
├── import.js            # + 'phân quyền' header map; parser CSV-quoting (tách phẩy ngoài, "..." giữ phẩy trong tên);
│                        #   map groupMembersByName → khai triển thành viên; reject nếu thiếu tên nhóm
└── __tests__/
    ├── helpers.js       # + 'Người được xem'/'Nhóm được xem' vào DOC_HEADERS
    └── documentPerms.test.js   # MỚI — phủ lifecycle/override/inherit/publish/import

apps/docmgr/src/client/
├── components/common/DeptUserMultiPicker.jsx  # (cũ) dropdown inline — DocumentModal thôi dùng (giữ file)
├── components/common/ViewerPickerModal.jsx    # MỚI (revise picker): popup chọn người theo phòng ban +
│                        #   "chọn tất cả" mỗi phòng + tìm kiếm + 2 chế độ "Tất cả"/"Theo danh mục" + lưu tạm/Chọn-Hủy
├── components/DocumentModal.jsx          # nút "Phân quyền xem — N người" mở ViewerPickerModal; đổi danh mục
│                        #   (tạo & sửa) → re-snapshot + toast cảnh báo (bỏ section gập inline)
├── components/documents/DocumentPreview.jsx  # khối "Phân quyền xem": chip người (read-only) + (toàn quyền) nút "Sửa" mở
│                        #   CÙNG ViewerPickerModal → onConfirm gọi api_setDocumentViewers (consistency add/edit ↔ chi tiết)
├── components/MainApp.jsx                # badge 🔒 đầu cột Ghi chú khi có Người được xem
├── utils/importResolver.js               # + field 'Phân quyền' + validate tên nhóm tồn tại, mang vào docData
└── gasClient.js                          # cập nhật mock cho field mới (dev/test)
```

**Structure Decision**: Giữ nguyên layout app `apps/docmgr/` (server GAS concat + client React). Mọi thay đổi nằm trong các file hiện có; chỉ thêm 1 file test mới. Không tạo thư mục/lớp mới (tuân thủ Surgical Changes).

## Complexity Tracking

> Không có vi phạm hiến pháp — bảng này để trống.
