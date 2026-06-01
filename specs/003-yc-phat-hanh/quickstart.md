# Quickstart: YC Phát hành

**Date**: 2026-05-31 | **Feature**: 003-yc-phat-hanh

## What This Feature Does

GĐ can request VT to publish a completed document ("YC Phát hành"). This adds a communication channel between GĐ and VT, similar to the existing "Từ chối" flow but for publishing instead of rejection.

## Files to Change

### Server (apps/docmgr/src/server/)

1. **documents.js** — Core workflow logic:
   - Add `'YC Phát hành'` to `VALID_STATUSES`
   - Add `ycPhatHanh` action to `WORKFLOW_ACTIONS`
   - Add `ycPhatHanh` default email template to `_DEFAULT_MAIL_TEMPLATES`
   - Add reason capture logic (reuse `lyDoTuChoi` field pattern from `tuChoi`)
   - Add email notification logic (notify doc creator)
   - Allow publish from "YC Phát hành" status (update `publishDocument` validation)

### Client (apps/docmgr/src/client/)

2. **workflowPermissions.js** — Action definitions:
   - Add `ycPhatHanh` to `ACTIONS` object
   - Add `ycPhatHanh` to `GIAM_DOC_ACTIONS` for "Hoàn thành" status

3. **DocumentPreview.jsx** — UI changes:
   - Update `showPublishBtn` logic: add "YC Phát hành" status for creator
   - Update `canEditDoc` logic: block edit on "YC Phát hành"
   - Update reason banner: show for "YC Phát hành" status (reuse rejection banner style, different label)
   - Reuse `tuChoiForm` dialog pattern for reason input (or extend it)

4. **SettingsPage.jsx** — Email template tab:
   - Add `ycPhatHanh` entry to `MAIL_TABS` array

### Tests (apps/docmgr/src/server/__tests__/)

5. **documents.test.js** — Test the new workflow action and publish visibility rules

## Development Flow

```bash
npm run dev:docmgr    # Start dev server (port 5173)
npm run test:docmgr   # Run tests after changes
```

## Verification Checklist

1. GĐ sees "YC Phát hành" button on "Hoàn thành" docs
2. Clicking shows reason dialog, requires non-empty reason
3. Submit transitions to "YC Phát hành", saves reason, sends email
4. VT (creator) sees "Phát hành" button, no edit button
5. VT (non-creator) sees no "Phát hành" button, no edit button
6. Publishing from "YC Phát hành" works like normal publish
7. Settings has new email template tab for "YC Phát hành"
8. Reason displays in banner (similar to rejection banner)
