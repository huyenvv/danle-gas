# Implementation Plan: Nghiệm thu trước hoàn thành

**Branch**: `002-acceptance-gate` | **Date**: 2026-05-30 | **Spec**: [spec.md](spec.md)

## Summary

Thêm bước nghiệm thu: PT "Hoàn thành" → "Chờ xác nhận HT" → GĐ "Xác nhận HT" → "Hoàn thành" hoặc GĐ "Từ chối" → "Từ chối kết quả" → PT sửa + "Hoàn thành" lại (loop).

## Technical Context

**Language/Version**: JavaScript ES5 (GAS server) + React JSX (client)
**Storage**: Google Sheets (reuse "Lý do từ chối" column). No SCHEMA_V bump.
**Testing**: Jest + vm.runInContext (server), Playwright E2E
**Constraints**: ES5 var/function only. Single global scope. Follows existing transitionDocument + updateData pattern from 001-reject-status.

## Constitution Check

| Principle | Status |
|---|---|
| I. Concat | ✅ No new modules |
| II. Shared Core | ✅ App-specific only |
| III. Secrets | ✅ No new secrets |
| IV. SSO | ✅ Auth unchanged |
| V. Surgical | ✅ Follows existing patterns |
| VI. Sheets | ✅ Reuse "Lý do từ chối" column, no schema change |
| VII. Test | ✅ Mirrors existing tuChoi tests |
| VIII. Design | ✅ New badge colors follow MD3 system |

## Affected Files

```text
apps/docmgr/src/server/documents.js         — VALID_STATUSES, WORKFLOW_ACTIONS, handlers
apps/docmgr/src/server/main.js              — no changes (api_transitionDocument already accepts 5 params)
apps/docmgr/src/client/lib/workflowPermissions.js — ACTIONS, PHUTRACH_ACTIONS, GIAM_DOC_ACTIONS, ADMIN_ACTIONS
apps/docmgr/src/client/components/documents/WorkflowButtons.jsx — new colors
apps/docmgr/src/client/components/documents/DocumentPreview.jsx — PT edit on Từ chối kết quả, rejection banner, publish hide
apps/docmgr/src/client/components/DocumentModal.jsx — PT Hoàn thành on Từ chối kết quả (updateData pattern)
apps/docmgr/src/client/components/SettingsPage.jsx — tuChoiKetQua template
apps/docmgr/src/client/components/MainApp.jsx — PT edit on Từ chối kết quả in context menu
apps/docmgr/src/client/utils/format.js — 2 new badge colors
apps/docmgr/src/server/__tests__/documents.test.js — transition tests
apps/docmgr/src/server/__tests__/notification.test.js — email tests
apps/docmgr/src/client/__tests__/workflowPermissions.test.js — action tests
apps/docmgr/src/client/__tests__/DocumentPreview.test.jsx — UI tests
apps/docmgr/src/client/__tests__/DocumentModal.test.jsx — modal tests
```
