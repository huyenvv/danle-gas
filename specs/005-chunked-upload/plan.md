# Implementation Plan: Chunked Resumable Upload

**Branch**: `005-chunked-upload` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

## Summary

File upload trong docmgr gửi toàn bộ Base64 qua 1 lần `google.script.run` (giới hạn ~50MB, thực ~37MB sau Base64). Giải pháp: file > 25MB upload **trực tiếp** từ browser lên Google Drive qua resumable session URI; server chỉ tạo phiên + finalize metadata. File ≤ 25MB giữ nguyên flow cũ.

## Technical Context

**Language/Version**: Plain ES5 `var`/`function` (server, GAS V8); React + JSX (client)
**Primary Dependencies**: Google Apps Script, Drive API v3 (resumable upload), `UrlFetchApp`, `ScriptApp.getOAuthToken`
**Storage**: Google Sheets (`Hồ Sơ` sheet, cột `Tệp đính kèm` — JSON array), Google Drive (files)
**Testing**: Jest via `vm.runInContext` (server), jsdom (client) — 344 tests
**Target Platform**: GAS Web App (SSO child), browser iframe
**Project Type**: web (React client + GAS server, monorepo)
**Constraints**: `google.script.run` payload ~50MB; chunk 5MB; ngưỡng chunked 25MB
**Scale/Scope**: Internal document management — file lớn 50–200MB+

## Constitution Check

- **I. GAS Concatenation Discipline**: ✅ Server code ES5 `var`/`function`; new functions in `drive-io.js` (gas-core) + `documents.js` (app) + `main.js` (api_ last). No name collisions.
- **II. Shared Core, App Override**: ✅ `resolveFolderId`, `initResumableUpload` in gas-core are app-agnostic (no sheet names, no Vietnamese in logic — chỉ error strings, consistent với uploadFile hiện có).
- **III. Security-First**: ⚠️ accessToken (OAuth) trả về client để PUT trực tiếp. Token ngắn hạn (~1h), scoped bởi appsscript.json, user đã authenticated qua SSO. Documented trong research R1.
- **V. Surgical Changes**: ✅ Refactor `uploadFileEager` → extract `_checkCreatePermission` + `_attachFileToDraft` (reused, không đổi behavior). Data format `fileInfo` không đổi. `handleSubmit` không đổi.
- **VII. Test via vm.runInContext**: ✅ Thêm 5 test; mock `UrlFetchApp` + `ScriptApp.getOAuthToken` + `setSharing`.
- **VIII. Design System**: ✅ Badge progress dùng token hiện có, không thêm component.

**Gate**: PASS (III justified in Complexity Tracking).

## Project Structure

```text
packages/gas-core/drive-io.js          # + resolveFolderId, initResumableUpload
apps/docmgr/src/server/documents.js     # + _checkCreatePermission, _attachFileToDraft,
                                         #   startResumableUpload, finalizeChunkedUpload
apps/docmgr/src/server/main.js          # + api_startResumableUpload, api_finalizeChunkedUpload
apps/docmgr/src/client/components/DocumentModal.jsx  # + uploadChunked, constants, progress UI
apps/docmgr/src/client/gasClient.js     # + dev mocks
apps/docmgr/src/server/__tests__/{documents.test.js,mocks/gas.js}  # + tests + mocks
```

**Structure Decision**: web monorepo — gas-core shared util + docmgr app server/client.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Trả OAuth token cho client (III) | Client PUT trực tiếp lên Drive → tránh proxy chunk qua server (chậm, tốn quota, Base64 overhead) | Proxy qua server: mỗi chunk phải Base64 qua `google.script.run`, gấp đôi băng thông, tốn GAS execution quota |
