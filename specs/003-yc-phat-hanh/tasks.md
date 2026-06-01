# Tasks: YC Phát hành

**Input**: Design documents from `specs/003-yc-phat-hanh/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested — skipped.

**Organization**: Tasks grouped by user story. US1+US3 combined (email is part of action handler). US2+US5 combined (same publish/edit logic).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Foundational (Status + Action Registration)

**Purpose**: Register the new status and workflow action so all subsequent tasks can reference them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Add 'YC Phát hành' to VALID_STATUSES array and add `ycPhatHanh` entry to WORKFLOW_ACTIONS (`{ from: 'Chờ duyệt', to: 'YC Phát hành', roles: ['Giám đốc'] }`) in `apps/docmgr/src/server/documents.js`
- [x] T002 [P] Add `ycPhatHanh` action definition to ACTIONS object (`{ key: 'ycPhatHanh', label: 'YC Phát hành', icon: 'publish', color: 'amber' }`) and add `'ycPhatHanh'` to GIAM_DOC_ACTIONS for 'Chờ duyệt' status in `apps/docmgr/src/client/lib/workflowPermissions.js`

**Checkpoint**: Status and action registered — implementation can begin.

---

## Phase 2: US1+US3 — GĐ yêu cầu phát hành + Email thông báo (Priority: P1+P2) 🎯 MVP

**Goal**: GĐ clicks "YC Phát hành" on a "Chờ duyệt" doc → enters reason → doc transitions to "YC Phát hành" → creator receives email with reason.

**Independent Test**: GĐ opens "Chờ duyệt" doc → sees "YC Phát hành" button → clicks → enters reason → submit → status changes → creator gets email.

### Implementation

- [x] T003 [US1] Add `ycPhatHanh` default email template to `_DEFAULT_MAIL_TEMPLATES` (subject: `'{hoảTốc}[YC Phát hành] {tênHồSơ}'`, body with `{lyDoTuChoi}` variable) in `apps/docmgr/src/server/documents.js`
- [x] T004 [US1] Add `ycPhatHanh` handler in the workflow action execution block — validate reason required (`if (!data['lyDoTuChoi']) throw new Error(...)`), save to `updates['Lý do từ chối']`, send email to creator via `_sendNotificationEmails`, mark unread via `_markUnreadForUsers` — mirror the `tuChoi` handler pattern in `apps/docmgr/src/server/documents.js`
- [x] T005 [P] [US1] Extend `tuChoiForm` dialog to support `ycPhatHanh` action — when action key is `'ycPhatHanh'`: change title to "YC Phát hành", change placeholder to "Nhập lý do yêu cầu phát hành…", use amber/primary styling instead of red, change confirm button text to "Xác nhận yêu cầu" in `apps/docmgr/src/client/components/documents/DocumentPreview.jsx`

**Checkpoint**: GĐ can request publish with reason. Creator receives email. Core flow works.

---

## Phase 3: US2+US5 — Publish visibility, edit block, reason display (Priority: P1)

**Goal**: At "YC Phát hành" status — creator (non-admin) sees publish button + reason banner, no edit. Non-creator sees nothing. Admin unrestricted. Publish button overall rules: tạo mới / Hoàn thành / YC Phát hành (creator only).

**Independent Test**: Open doc at "YC Phát hành" as creator → see reason + publish button, no edit. As non-creator → no publish, no edit. As admin → edit + publish.

### Implementation

- [x] T006 [US2] Update `showPublishBtn` logic — for non-admin publishers (`canPublish && !isAdminRole`): show when (a) `canCreate` (tạo mới), (b) `isHoanThanh`, or (c) `isYCPhatHanh && isCreator`. For admin: keep existing logic (show when `isHoanThanh`). Add `const isYCPhatHanh = status === 'YC Phát hành'` and `const isCreator = doc['Người tạo'] === session?.username` in `apps/docmgr/src/client/components/documents/DocumentPreview.jsx`
- [x] T007 [US2] Update `canEditDoc` logic — add `isYCPhatHanh` to the blocked statuses for non-admin users. Ensure `canEditDoc = false` when status is 'YC Phát hành' except for `isFullAdmin` in `apps/docmgr/src/client/components/documents/DocumentPreview.jsx`
- [x] T008 [US2] Add reason banner for 'YC Phát hành' status — extend existing rejection reason banner condition to also show when `status === 'YC Phát hành'`, change label from "Lý do từ chối" to "Lý do yêu cầu phát hành", use amber/primary styling instead of red in `apps/docmgr/src/client/components/documents/DocumentPreview.jsx`
- [x] T009 [P] [US2] Update `publishDocument` server validation — ensure publish is allowed from 'YC Phát hành' status (not blocked by rejected-status checks) in `apps/docmgr/src/server/documents.js`

**Checkpoint**: Full permission matrix works. Creator can publish from "YC Phát hành". Edit blocked for non-admin. Reason displayed.

---

## Phase 4: US4 — Cài đặt email template (Priority: P2)

**Goal**: Admin can configure YC Phát hành email template in Settings.

**Independent Test**: Admin opens Settings → sees "YC Phát hành" tab → edits template → saves.

### Implementation

- [x] T010 [US4] Add `ycPhatHanh` entry to `MAIL_TABS` array (`{ key: 'ycPhatHanh', label: 'YC Phát hành', icon: 'publish', desc: 'Gửi cho người tạo hồ sơ khi Giám đốc yêu cầu phát hành (kèm lý do)' }`) in `apps/docmgr/src/client/components/SettingsPage.jsx`

**Checkpoint**: Settings page shows new email template tab.

---

## Phase 5: Polish & Verification

**Purpose**: End-to-end verification of all acceptance scenarios.

- [x] T011 Verify all acceptance scenarios per quickstart.md checklist — run `npm run test:docmgr` and manually verify: (1) GĐ sees "YC Phát hành" at "Chờ duyệt" only, (2) reason dialog works, (3) status transitions correctly, (4) creator sees publish + reason + no edit, (5) non-creator sees no publish + no edit, (6) admin can edit + publish, (7) publish from "YC Phát hành" works normally, (8) Settings has new tab

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately
- **Phase 2 (US1+US3)**: Depends on Phase 1 (needs VALID_STATUSES + WORKFLOW_ACTIONS)
- **Phase 3 (US2+US5)**: Depends on Phase 1 (needs status registered). Can run in parallel with Phase 2.
- **Phase 4 (US4)**: No dependencies on other phases — can run anytime after Phase 1
- **Phase 5 (Polish)**: Depends on all phases complete

### Within Each Phase

- T001 + T002: **parallel** (different files)
- T003 → T004: sequential (same file, T004 references template from T003)
- T005: **parallel** with T003/T004 (different file)
- T006 → T007 → T008: sequential (same file)
- T009: **parallel** with T006-T008 (different file)
- T010: independent (different file from everything)

### Parallel Opportunities

```
Phase 1:  T001 ──┐
          T002 ──┤── (parallel, different files)
                 │
Phase 2:  T003 → T004 ──┐
          T005 ──────────┤── (T005 parallel with T003/T004)
                         │
Phase 3:  T006 → T007 → T008 ──┐
          T009 ─────────────────┤── (T009 parallel with T006-T008)
                                │
Phase 4:  T010 ─────────────────┤── (T010 parallel with Phase 2 & 3)
                                │
Phase 5:  T011 ─────────────────┘── (after all)
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2)

1. Complete Phase 1: Register status + action
2. Complete Phase 2: GĐ can request publish → email sent
3. **STOP and VALIDATE**: GĐ flow works end-to-end
4. Continue to Phase 3: Publish rules + edit block

### Incremental Delivery

1. Phase 1 → Foundation ready
2. Phase 2 → GĐ can YC Phát hành (MVP!)
3. Phase 3 → Creator can publish, permissions enforced
4. Phase 4 → Admin can customize email
5. Phase 5 → Full verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- All server changes in `documents.js` use ES5 `var`/`function` style
- Client changes in `.jsx` files use React hooks + Tailwind
- `tuChoiForm` dialog is reused/extended — no new component needed
- Reason stored in shared "Lý do từ chối" field — overwrites previous value
