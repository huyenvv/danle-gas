# Implementation Plan: Trạng thái Từ chối

**Branch**: `001-reject-status` | **Date**: 2026-05-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-reject-status/spec.md`

## Summary

Thêm trạng thái "Từ chối" vào document workflow. GĐ từ chối doc ở "Chờ duyệt" kèm lý do, VT nhận email + notification, VT sửa và trình duyệt lại. Admin cài đặt email template từ chối trong Settings.

## Technical Context

**Language/Version**: JavaScript ES5 (GAS server) + React JSX (client)

**Primary Dependencies**: Google Apps Script APIs, React, Tailwind CSS

**Storage**: Google Sheets (`Hồ Sơ`, `_Đã Đọc`, `_Nhật Ký`, Script Properties for MAIL_TEMPLATES)

**Testing**: Jest + vm.runInContext (server), Playwright E2E

**Target Platform**: Google Apps Script Web App (iframe in SSO Portal)

**Project Type**: GAS monorepo — docmgr app (child of SSO Portal)

**Constraints**: ES5 var/function only on server. Single global scope. GAS concurrent execution limits.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Detail |
|---|---|---|
| I. Concat Discipline | ✅ | Changes in existing app files only (documents.js, main.js, components). No new gas-core modules. |
| II. Shared Core | ✅ | No gas-core changes. "Từ chối" logic is app-specific (docmgr). |
| III. Security-First | ✅ | No new secrets. Uses existing MailApp infrastructure. |
| IV. SSO Separation | ✅ | Auth unchanged. Reject is authz action within docmgr. |
| V. Surgical Changes | ✅ | Touches only workflow-related code. Follows existing patterns (giaoViec, trinhDuyet). |
| VI. Sheets Integrity | ✅ | New status value in existing Tình trạng column. New column "Lý do từ chối" in Hồ Sơ. Bump SCHEMA_V. |
| VII. Test | ✅ | Will add tests mirroring existing transitionDocument tests. |
| VIII. Design System | ✅ | Reject button + dialog follow existing component patterns. |

**GATE: PASS** — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-reject-status/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (affected files)

```text
apps/docmgr/
├── src/server/
│   ├── documents.js        # WORKFLOW_ACTIONS + tuChoi handler + email
│   ├── config.js           # SCHEMA_V bump, ensureInitialized add column
│   └── main.js             # api_transitionDocument already exists
├── src/client/
│   ├── components/
│   │   ├── DocumentModal.jsx     # Reject button + reason dialog
│   │   └── SettingsPage.jsx      # tuChoi email template tab
│   └── services/
│       └── gasClient.js          # (no changes expected)
└── src/server/__tests__/
    └── documents.test.js         # Reject transition tests
```

**Structure Decision**: Existing monorepo structure. No new files needed except tests. All changes within `apps/docmgr/`.

## Complexity Tracking

> No violations — no entries needed.
