# Tasks: Eager Upload với Draft Status

## Phase 1: Server Foundation

- [X] T001 [US1] Add `uploadFileEager` function: upload single file + create/append Nháp row in `apps/docmgr/src/server/documents.js`
- [X] T002 [US2] Add `finalizeDraft` function: update draft with form data + change status in `apps/docmgr/src/server/documents.js`
- [X] T003 [P] [US3] Add `cancelDraft` function: delete files + delete draft row in `apps/docmgr/src/server/documents.js`
- [X] T004 [P] [US3] Add `deleteFiles` function: delete specified files from Drive in `apps/docmgr/src/server/documents.js`
- [X] T005 [US1] Modify `updateDocument` to accept 7th param `eagerFileInfos` (pre-uploaded files, no base64) in `apps/docmgr/src/server/documents.js`
- [X] T006 Register `api_uploadFileEager`, `api_finalizeDraft`, `api_cancelDraft`, `api_deleteFiles` + modify `api_updateDocument` in `apps/docmgr/src/server/main.js`

## Phase 2: Server Tests

- [X] T007 [P] Test `uploadFileEager`: no draftId → creates draft, with draftId → appends, draftId='edit' → no row, permission check in `apps/docmgr/src/server/__tests__/documents.test.js`
- [X] T008 [P] Test `finalizeDraft`: updates form data + status, throws without Tên hồ sơ, throws on non-draft, moves files on category change in `apps/docmgr/src/server/__tests__/documents.test.js`
- [X] T009 [P] Test `cancelDraft`: deletes files + row, throws on non-draft, throws on wrong creator in `apps/docmgr/src/server/__tests__/documents.test.js`
- [X] T010 [P] Test `deleteFiles`: trashes files, handles empty array in `apps/docmgr/src/server/__tests__/documents.test.js`
- [X] T011 [P] Test `updateDocument` eagerFileInfos: merges with kept files, no re-upload in `apps/docmgr/src/server/__tests__/documents.test.js`

## Phase 3: Client — Status Badge + Mocks

- [X] T012 [P] [US2] Add 'Nháp' to `statusColor` map (gray dashed) in `apps/docmgr/src/client/utils/format.js`
- [X] T013 [P] Add mock implementations for `api_uploadFileEager`, `api_finalizeDraft`, `api_cancelDraft`, `api_deleteFiles` in `apps/docmgr/src/client/gasClient.js`

## Phase 4: Client — DocumentModal Core Logic

- [X] T014 [US1] Add state: `draftId`, `eagerUploads[]`, `eagerIdCounter` ref in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [X] T015 [US1] Replace `handleFileChange` with eager upload logic: validate Danh mục, dedup, sequential upload via `api_uploadFileEager` in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [X] T016 [US3] Add `removeEagerUpload` function: delete from Drive + remove from state in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [X] T017 [US1/US2] Replace `handleSubmit`: finalizeDraft (create+draft), updateDocument with eagerFileInfos (edit), fallback createDocument (no files) in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [X] T018 [US3] Add `handleClose` with cleanup: cancelDraft (create+draft) or deleteFiles (edit) in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [X] T019 [US1] Update trinhDuyetLai / hoanThanhLai handlers to use eagerUploads instead of base64 `files` in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [X] T020 Pass `eagerFileInfos` through `transitionDocument` → `updateDocument` in `apps/docmgr/src/server/documents.js`

## Phase 5: Client — UI

- [X] T021 [US1] Replace file chips section: show eagerUploads with status icons (spinner/checkmark/error) in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [X] T022 [US1] Add upload progress text "Đang tải lên... (2/5)" above drop zone in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [X] T023 [US4] Add `hasUploading` computed var + disable all submit buttons while uploading in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [X] T024 Remove old `files` state + `removeNewFile` function (replaced by eagerUploads) in `apps/docmgr/src/client/components/DocumentModal.jsx`

## Phase 6: Verification

- [X] T025 Run full test suite: `npx jest --config apps/docmgr/jest.config.js --no-coverage` — all tests PASS
- [X] T026 Run build: `npm run build:docmgr` — succeeds
- [X] T027 Dev server smoke test: `npm run dev:docmgr` — verify eager upload flow in browser console

## Phase 7: Follow-up — chặn finalize khi thiếu thông tin (FR-013)

- [X] T028 [US4] Thêm `hasAttachment` + `requireFullForFinalize` + `MISSING_ATTACHMENT_MSG`; chặn finalize (Lưu tài liệu / Trình duyệt / Phát hành + nút submit mặc định) khi thiếu Tên hồ sơ / Danh mục / tệp đính kèm; cùng kiểm tra trong `handleSubmit` in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [X] T029 Cập nhật/bổ sung test: tạo mới có tệp → `api_finalizeDraft`; thiếu tệp → chặn, không gọi API in `apps/docmgr/src/client/__tests__/DocumentModal.test.jsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Server Foundation)**: No dependencies — start here
  - T001 → T002 (finalizeDraft depends on uploadFileEager for draft creation)
  - T003, T004 can parallel with T002
  - T005 depends on T001 (same file, uses fileInfo format)
  - T006 depends on T001-T005
- **Phase 2 (Server Tests)**: Depends on Phase 1
  - T007-T011 all [P] — can run in parallel
- **Phase 3 (Client Mocks)**: Can parallel with Phase 2
  - T012, T013 both [P]
- **Phase 4 (Client Logic)**: Depends on Phase 3
  - T014 → T015 → T016 → T017 → T018 → T019 → T020 (sequential, same file)
- **Phase 5 (Client UI)**: Depends on Phase 4
  - T021-T024 sequential (same file, same section)
- **Phase 6 (Verification)**: Depends on all above

### Parallel Opportunities

```text
Phase 1: T003 + T004 can parallel with T002
Phase 2: T007 + T008 + T009 + T010 + T011 all parallel
Phase 3: T012 + T013 parallel, AND can parallel with Phase 2
```
