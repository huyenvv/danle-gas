# Tasks: Nghiệm thu trước hoàn thành

## Phase 1: Server Foundation

- [x] T001 Add "Chờ xác nhận HT", "Từ chối kết quả" to VALID_STATUSES in `apps/docmgr/src/server/documents.js`
- [x] T002 Change `hoanThanh` target from "Hoàn thành" to "Chờ xác nhận HT" + add hoanThanh handler to notify GĐ + clear "Lý do từ chối" in `apps/docmgr/src/server/documents.js`
- [x] T003 Add `hoanThanhLai`, `xacNhanHT`, `tuChoiKetQua` to WORKFLOW_ACTIONS in `apps/docmgr/src/server/documents.js`
- [x] T004 Add handlers: hoanThanhLai (clear reason, notify GĐ, support updateData), xacNhanHT (no notify), tuChoiKetQua (require+save lyDoTuChoi, notify PT) in `apps/docmgr/src/server/documents.js`
- [x] T005 Add `tuChoiKetQua` to `_DEFAULT_MAIL_TEMPLATES` in `apps/docmgr/src/server/documents.js`
- [x] T006 Block publish + Hoàn thành on "Từ chối kết quả" for PT in `updateDocument` in `apps/docmgr/src/server/documents.js`

## Phase 2: Client — workflowPermissions + badges

- [x] T007 Add xacNhanHT, tuChoiKetQua, hoanThanhLai to ACTIONS; update GIAM_DOC_ACTIONS, ADMIN_ACTIONS, PHUTRACH_ACTIONS in `apps/docmgr/src/client/lib/workflowPermissions.js`
- [x] T008 Add rose color to WorkflowButtons COLOR_MAP in `apps/docmgr/src/client/components/documents/WorkflowButtons.jsx`
- [x] T009 Add "Chờ xác nhận HT" (`bg-teal-100 text-teal-800`) + "Từ chối kết quả" (`bg-rose-100 text-rose-800`) to statusColor in `apps/docmgr/src/client/utils/format.js`

## Phase 3: Client — DocumentPreview

- [x] T010 Handle tuChoiKetQua in DocumentPreview: reason dialog (same pattern as tuChoi) in `apps/docmgr/src/client/components/documents/DocumentPreview.jsx`
- [x] T011 PT (assigned) on "Từ chối kết quả": show edit + "Hoàn thành" in grid, rejection banner, hide publish in `apps/docmgr/src/client/components/documents/DocumentPreview.jsx`
- [x] T012 Add tooltip "Chờ xác nhận hoàn thành" on "Chờ xác nhận HT" badge in `apps/docmgr/src/client/utils/format.js` or DocumentPreview

## Phase 4: Client — DocumentModal + MainApp

- [x] T013 PT editing "Từ chối kết quả": only "Hoàn thành" button, calls transitionDocument('hoanThanhLai', {}, updateData) in `apps/docmgr/src/client/components/DocumentModal.jsx`
- [x] T014 PT sees edit in context menu for "Từ chối kết quả" docs in `apps/docmgr/src/client/components/MainApp.jsx`

## Phase 5: Settings

- [x] T015 Add `tuChoiKetQua` to DEFAULT_TEMPLATES + email tabs in `apps/docmgr/src/client/components/SettingsPage.jsx`

## Phase 6: Tests

- [x] T016 [P] Server: hoanThanh→"Chờ xác nhận HT" + notify GĐ, xacNhanHT→"Hoàn thành" no notify, tuChoiKetQua requires reason + notify PT, hoanThanhLai clears reason + updateData in `apps/docmgr/src/server/__tests__/documents.test.js`
- [x] T017 [P] Email: tuChoiKetQua email with {lyDoTuChoi} in `apps/docmgr/src/server/__tests__/notification.test.js`
- [x] T018 [P] Client: workflowPermissions for new statuses in `apps/docmgr/src/client/__tests__/workflowPermissions.test.js`
- [x] T019 [P] Client: DocumentPreview PT edit/publish/banner on Từ chối kết quả in `apps/docmgr/src/client/__tests__/DocumentPreview.test.jsx`
- [x] T020 [P] Client: DocumentModal PT Hoàn thành on Từ chối kết quả (single API) in `apps/docmgr/src/client/__tests__/DocumentModal.test.jsx`
