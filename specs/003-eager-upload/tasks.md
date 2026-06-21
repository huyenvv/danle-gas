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
- [X] T030 [US2] Sửa message chặn (bỏ hướng dẫn sai "bấm Hủy") + thêm nút "Lưu nháp" (tắt khi chưa có tệp), gom logic lưu nháp `handleSaveDraft` dùng chung với nút X (FR-014) in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [X] T031 Test nút "Lưu nháp": tắt khi chưa có tệp; lưu status Nháp sau khi đính kèm in `apps/docmgr/src/client/__tests__/DocumentModal.test.jsx`
- [X] T032 [US2] Thêm `createDraft(token, formData)` (tạo hàng Nháp không tệp, cần Tên hoặc Danh mục) + `api_createDraft` in `apps/docmgr/src/server/documents.js`, `apps/docmgr/src/server/main.js`; nút "Lưu nháp" gọi `createDraft` khi chưa có draft, chỉ tắt khi trống cả Tên+Danh mục (FR-014/FR-015) in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [X] T033 Test `createDraft` (server) + "Lưu nháp" không tệp gọi `api_createDraft` (client) + mock dev `gasClient.js`
- [X] T034 [US3] Sửa cảnh báo X-close: `_hasUnsavedFieldChanges` chỉ xét field nhập tay (bỏ đếm tệp đã upload), bỏ thoát-sớm `!draftId` để cảnh báo cả khi chưa có draft (gõ field → tắt X → lưu `createDraft`) in `apps/docmgr/src/client/components/DocumentModal.jsx` + test
- [X] T035 [US3] Mở rộng phát hiện thay đổi sang **MỌI field**: so `form` (+ phụ trách/phối hợp/người xem) với snapshot ban đầu; rebase Danh mục+người-xem khi draft tạo qua upload; gate `requireFullForFinalize` (non-draft edit X chỉ đóng) in `apps/docmgr/src/client/components/DocumentModal.jsx` + test (Khẩn, non-draft edit)
- [X] T036 [US3] Gỡ file SẴN CÓ (`removeExistingFile`, chưa persist) cũng tính là thay đổi: so `existingFiles` vs snapshot trong `_hasUnsavedFieldChanges` in `apps/docmgr/src/client/components/DocumentModal.jsx` + test (draft edit gỡ file → X hỏi lưu)
- [X] T037 [US3] `finalizeDraft` nhận `keepFileIds`: trash file bị gỡ + cập nhật cột `Tệp đính kèm` (FR-016) in `apps/docmgr/src/server/documents.js`, `main.js`; client truyền keepFileIds ở `handleSaveDraft` + nhánh draft `handleSubmit` + mock `gasClient.js` + test (server keep/remove, client keepFileIds không chứa file đã gỡ)
- [X] T038 [US3] Hợp nhất gỡ file: `removeEagerUpload` (file vừa upload) cũng **xác nhận** + **hoãn trash** (không xoá Drive ngay) + đánh dấu `fileRemovedRef` như `removeExistingFile` → đóng X có hỏi lưu nháp; lưu thì `finalizeDraft keepFileIds` trash thật in `apps/docmgr/src/client/components/DocumentModal.jsx` + test
- [X] T039 [US1] Phục hồi upload khi response mất (`'Lỗi không xác định'`): `_verifyEagerUpload` đọc lại nháp tìm file theo tên, đánh dấu thành công thay vì báo lỗi (FR-017) in `apps/docmgr/src/client/components/DocumentModal.jsx` + test

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
