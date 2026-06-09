# Implementation Plan: Chọn file đính kèm từ Google Drive của tài khoản deploy

**Branch**: `006-drive-file-picker` | **Date**: 2026-06-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-drive-file-picker/spec.md`

## Summary

Thêm tùy chọn "Chọn từ Google Drive" bên cạnh upload file từ máy trong form hồ sơ. Người có quyền duyệt thư mục Drive của tài khoản chủ app (server chạy as owner), chọn nhiều file, server `makeCopy` từng file vào thư mục danh mục hồ sơ rồi đính kèm qua luồng `_attachFileToDraft` hiện có. Gắn cờ phân quyền mới `Được chọn từ Drive` (APP_ROLES); full-access (admin/Quản trị viên/Giám đốc/Văn thư) mặc định bật. Tái dùng tối đa `api_browseDriveFolders` + `FolderPicker`.

## Technical Context

**Language/Version**: JS — server ES5 `var`/`function` (GAS V8); client React + hooks + Tailwind (Vite)
**Primary Dependencies**: gas-core (`drive-io`, `sheets-crud`, `auth-core`), DriveApp; React client
**Storage**: Google Sheets — `_Phân Quyền` (APP_ROLES) cột quyền mới; file copy vào Drive owner
**Testing**: Jest server (`apps/docmgr/jest.config.js`, vm.runInContext); manual UI
**Target Platform**: GAS Web App (SSO child) + browser
**Project Type**: Web app (React client + GAS server) trong monorepo
**Performance Goals**: Đính kèm 1 file từ Drive < 30s (SC-001); makeCopy đồng bộ phía server
**Constraints**: Server ES5 only; concat order; quyền re-check server mỗi thao tác (không cache session)
**Scale/Scope**: ~1 cờ quyền, 1 API copy mới, mở rộng 1 API browse, 1 picker component, 3 chỗ UI sửa

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Note |
|---|---|---|
| I. GAS Concatenation Discipline | ✅ | Code mới ES5; thêm `api_*` ở `main.js`, helper copy ở `documents.js`. Không đổi concat order. |
| II. Shared Core, App Override | ✅ | Logic copy/quyền là app-specific → đặt ở `apps/docmgr` (không nhét vào gas-core). Có thể thêm 1 helper `copyDriveFile` mỏng vào `drive-io.js` (app-agnostic) nếu cần. |
| III. Security-First Secrets | ✅ | Không secret mới. |
| IV. SSO Parent-Child Separation | ✅ | Quyền là authorization → ở child app. Không đụng login. |
| V. Surgical Changes, Simplicity | ✅ | Tái dùng `_attachFileToDraft`, `api_browseDriveFolders`, `FolderPicker`. Không refactor ngoài phạm vi. |
| VI. Sheets-as-Database Integrity | ⚠️ | Thêm cột `Được chọn từ Drive` vào APP_ROLES → **bump SCHEMA_V** để `ensureInitialized()` tạo cột. |
| VII. Test via vm.runInContext | ✅ | Thêm test cho `_checkPickDrivePermission` + `copyDriveFilesToCategory`. Mock DriveApp đã có. |
| VIII. Shared Design System | ✅ | Picker tái dùng style `FolderPicker`. |

**Gate result**: PASS. Lưu ý bắt buộc: bump `SCHEMA_V` (4→5) khi thêm cột APP_ROLES.

## Project Structure

### Documentation (this feature)

```text
specs/006-drive-file-picker/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md            # /speckit-tasks (chưa tạo ở bước này)
```

### Source Code (repository root)

```text
packages/gas-core/
└── drive-io.js                      # (tùy chọn) helper copyDriveFile(fileId, folderId) app-agnostic

apps/docmgr/src/server/
├── config.js                        # APP_ROLES headers + bump SCHEMA_V
├── sheets.js                        # api_getUsers: trả 'Được chọn từ Drive' (default full-access)
├── documents.js                     # _checkPickDrivePermission + copyDriveFilesToCategory + browse files
└── main.js                          # _buildSessionFromRows.canPickDrive; api_browseDrive (files); api_copyDriveFiles; api_updateUser lưu cờ

apps/docmgr/src/client/components/
├── DocumentModal.jsx                # nút "Chọn từ Google Drive" (gated canPickDrive) + tích hợp picker
├── UserManager.jsx                  # checkbox "Được chọn từ Drive"
└── settings/DriveFilePicker.jsx     # MỚI — mở rộng FolderPicker: liệt kê + multi-select file

apps/docmgr/src/server/__tests__/
└── drive-picker.test.js             # MỚI — quyền + copy
```

**Structure Decision**: Web app trong monorepo. Server logic ở `apps/docmgr/src/server` (app-specific authz + copy), tái dùng gas-core `drive-io`. Client thêm 1 component picker, sửa 2 component (DocumentModal, UserManager).

## Complexity Tracking

> Không có vi phạm hiến pháp cần biện minh. SCHEMA_V bump là yêu cầu bắt buộc của Principle VI, không phải độ phức tạp thừa.
