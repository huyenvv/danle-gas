# Tasks: Trạng thái Từ chối

**Input**: Design documents from `specs/001-reject-status/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md

---

## Phase 1: Schema & Server Foundation

**Purpose**: Add "Từ chối" column and status to server-side workflow

- [x] T001 Add "Lý do từ chối" column to HO_SO tabDefs and bump SCHEMA_V 3→4 in `apps/docmgr/src/server/config.js`
- [x] T002 Add "Từ chối" to VALID_STATUSES array in `apps/docmgr/src/server/documents.js`
- [x] T003 Add `tuChoi` and `trinhDuyetLai` entries to WORKFLOW_ACTIONS in `apps/docmgr/src/server/documents.js`
- [x] T004 Add `tuChoi` default mail template to `_DEFAULT_MAIL_TEMPLATES` in `apps/docmgr/src/server/documents.js`

**Checkpoint**: Server recognizes "Từ chối" status and new workflow actions.

---

## Phase 2: User Story 1 — GĐ từ chối document (P1) 🎯 MVP

**Goal**: GĐ can reject a "Chờ duyệt" document with a reason

**Independent Test**: Call `transitionDocument(token, id, 'tuChoi', {lyDoTuChoi})` → status changes + reason saved + creator notified

- [x] T005 [US1] Add `tuChoi` handler in `transitionDocument` — require `data['lyDoTuChoi']`, set `updates['Lý do từ chối']`, add `{lyDoTuChoi}` to `_sendNotificationEmails` template vars, notify doc creator via email + unread in `apps/docmgr/src/server/documents.js`
- [x] T006 [US1] Add "Từ chối" button (error style) for GĐ on "Chờ duyệt" documents in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [x] T007 [US1] Add rejection reason dialog (textarea required + Xác nhận/Hủy) that calls `transitionDocument('tuChoi', {lyDoTuChoi})` in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [x] T008 [US1] Add `tuChoi` transition test — verify status→"Từ chối", lyDoTuChoi saved, reject without reason throws, `_markUnreadForUsers` called for creator in `apps/docmgr/src/server/__tests__/documents.test.js`

**Checkpoint**: GĐ clicks Từ chối → enters reason → doc status changes → VT gets notification.

---

## Phase 3: User Story 2 — VT trình duyệt lại (P1)

**Goal**: VT sees rejected doc, reads reason, edits, resubmits

**Independent Test**: VT opens "Từ chối" doc → sees reason → edits → clicks Trình duyệt → status back to "Chờ duyệt"

- [x] T009 [US2] Add `trinhDuyetLai` handler in `transitionDocument` — clear "Lý do từ chối", notify all GĐ (reuse trinhDuyet pattern) in `apps/docmgr/src/server/documents.js`
- [x] T010 [US2] Show rejection reason banner + editable fields + "Trình duyệt" button for VT (creator) on "Từ chối" documents in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [x] T011 [US2] Add `trinhDuyetLai` transition test — verify status→"Chờ duyệt", reason cleared, GĐ notified in `apps/docmgr/src/server/__tests__/documents.test.js`

**Checkpoint**: Full reject→resubmit loop works.

---

## Phase 4: User Story 3 — Email từ chối (P2)

**Goal**: VT receives email with rejection reason

**Independent Test**: GĐ tuChoi → VT receives email containing doc name + reason + link

- [x] T012 [US3] Verify tuChoi email includes `{lyDoTuChoi}` variable in subject/body — add test in `apps/docmgr/src/server/__tests__/notification.test.js`

**Checkpoint**: Email contains rejection reason. (Server logic already in T006, this is test verification.)

---

## Phase 5: User Story 4 — Settings email template (P2)

**Goal**: Admin configures rejection email template in Settings

**Independent Test**: Admin edits tuChoi template → saved → next rejection uses new template

- [x] T013 [US4] Add `tuChoi` to DEFAULT_TEMPLATES in `apps/docmgr/src/client/components/SettingsPage.jsx`
- [x] T014 [US4] Add "Từ chối" tab/section in email settings UI in `apps/docmgr/src/client/components/SettingsPage.jsx`

**Checkpoint**: Admin can view and edit rejection email template.

---

## Phase 6: Polish

- [x] T015 Add "Từ chối" status badge color `bg-red-100 text-red-800` to STATUS_COLORS map in `apps/docmgr/src/client/utils/format.js`
- [x] T016 Verify "Công việc của tôi" filter — VT branch uses `d['Người tạo'] === me` (no status filter), confirm "Từ chối" docs appear automatically in `apps/docmgr/src/client/components/MainApp.jsx` line ~232

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Schema): No dependencies — start immediately
- **Phase 2** (US1 — GĐ reject): Depends on Phase 1
- **Phase 3** (US2 — VT resubmit): Depends on Phase 1 (can parallel with Phase 2 on server, sequential on client)
- **Phase 4** (US3 — Email): Depends on Phase 2 T006
- **Phase 5** (US4 — Settings): Depends on Phase 1 T004 only
- **Phase 6** (Polish): Depends on Phase 2

### Parallel Opportunities

```
Phase 1: T001, T002, T003, T004 — sequential (same files, dependent)

After Phase 1:
  T005 + T009 — sequential (same file, same function)
  T006 + T007 — sequential (same component)
  T010       — after T006/T007 (same component)
  T008 + T011 + T012 — [P] parallel (test files, independent)
  T013 + T014 — [P] parallel with Phase 2 (different component)
  T015 + T016 — after Phase 2 (different files from DocumentModal)
```

---

## Implementation Strategy

### MVP (Phase 1 + Phase 2 only)

1. Phase 1: Schema + server foundation
2. Phase 2: GĐ reject flow (server + client + test)
3. **STOP and VALIDATE**: GĐ can reject, doc changes status, reason saved

### Full Feature

1. MVP above
2. Phase 3: VT resubmit
3. Phase 4: Email verification
4. Phase 5: Settings UI
5. Phase 6: Polish
