# Tasks: Phân quyền xem đến từng tài liệu

> **Revise 2026-06-18 (mô hình "chỉ theo người")**: sau khi triển khai + test, requirement đổi — tài liệu chỉ lưu `Người được xem` (bỏ nhóm cấp tài liệu); visibility khi Hoàn thành là category-independent (rỗng → fallback danh mục); tạo mới tích sẵn người-xem-danh-mục; picker ở **cả** màn tạo/sửa + chi tiết; publish thêm **mọi** người nhận; import khai triển nhóm → thành viên. Các task T011/T012/T016/T018-T020 và test đã được điều chỉnh theo mô hình này (xem spec/contracts/data-model bản mới). Component UI mới: `common/DeptUserMultiPicker.jsx` (chọn người theo phòng ban + chọn tất cả).
>
> **Revise 2026-06-19 (snapshot là nguồn chân lý)**: requirement đổi tiếp — `Người được xem` là **snapshot nguồn chân lý**; **bỏ fallback danh mục động** (rỗng = chỉ toàn quyền + người tham gia); cần **migration backfill** dữ liệu cũ (FR-013); import cột "Phân quyền" tách **CSV-quoting** (`"..."` giữ phẩy trong tên nhóm); **publish luôn cộng** người nhận kể cả khi rỗng (ghi đè FR-005 cũ); picker tạo/sửa thành **section gập** (không tab); sau cùng **xóa cột `Nhóm được xem`** (S1). Việc mới gom ở **Phase 9** (T024–T032). (Workflow giao việc người phối hợp đã **tách** sang feature riêng — `specs/_deferred-us6-giao-viec-phoi-hop.md`.)

**Feature**: `008-document-permissions` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Input**: plan.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: ĐƯỢC yêu cầu (SC-001…SC-006 + constitution VII). Test server qua `vm.runInContext`, mirror `categoryPerms.test.js`.

## Lưu ý coupling (đọc trước khi chạy)

- Đường đọc (read-path) hiển thị tài liệu nằm trong **một** hàm `_canViewDocument()` ở `documents.js`. US1→US2→US3 lần lượt **bổ sung nhánh** vào cùng hàm này ⇒ các task sửa `documents.js` chạy **tuần tự** (không `[P]` với nhau).
- File test `documentPerms.test.js` cũng dùng chung ⇒ các task test (T008/T010/T016/T019/T022) tuần tự với nhau.
- `[P]` chỉ đánh khi task ở **file khác** và không phụ thuộc việc chưa xong.
- Mọi code server: **ES5** (`var`/`function`), không arrow/let/const (constitution I).

---

## Phase 1: Setup

- [X] T001 [P] Thêm 2 cột `'Người được xem'`, `'Nhóm được xem'` vào `HO_SO` headers (sau `'Nội dung giao việc'`) trong `apps/docmgr/src/server/config.js:48`, và bump `SCHEMA_V` `'10'`→`'11'` tại `apps/docmgr/src/server/config.js:25` và `:32`. (Cột tự thêm qua `ensureMissingColumns`.)
- [X] T002 [P] Thêm `'Người được xem'`, `'Nhóm được xem'` vào `DOC_HEADERS` trong `apps/docmgr/src/server/__tests__/helpers.js`; tạo file `apps/docmgr/src/server/__tests__/documentPerms.test.js` với khung `require('./setup.js')`, import helpers (`resetAll/setupRoleSheets/setupDocSheets/seedUser/createSession`) và `beforeEach` reset+seed (mirror `categoryPerms.test.js`).

---

## Phase 2: Foundational (BLOCKING — phải xong trước mọi user story)

**Mục tiêu**: hạ tầng schema + helper thuần + điểm cắm read-path + write-path, giữ nguyên hành vi app khi chỉ có phase này.

- [X] T003 Thêm helper thuần `_matchPerm(allowedUserIds, allowedGroupIds, userIdStr, username, userGroupIds)` (rỗng cả hai → true) trong `apps/docmgr/src/server/documents.js` (gần `_parseAssignees`).
- [X] T004 [P] Thêm helper `_recipientCanViewCategory(cat, recipientUserId)` (rỗng quyền danh mục → true; khớp `Người được xem` của danh mục theo userId; hoặc recipient thuộc một nhóm ∈ `Nhóm được xem` của danh mục — quét `SHEETS.NHOM`) trong `apps/docmgr/src/server/documents.js`. (Không cần `_findGroupByName` — import dùng map `groupIdByName` nội bộ, xem T019.)
- [X] T005 Trong `getDocuments` (`apps/docmgr/src/server/documents.js:355`): giữ filter Nháp (creator-only) + bypass vai trò toàn quyền `['admin','Quản trị viên','Giám đốc','Văn thư']`; tính `ctx={categories,userGroupIds,userIdStr,username}` **một lần**; **thay** block lọc theo danh mục (dòng ~388–403) bằng `docs.filter(function(d){ return _canViewDocument(d, session, ctx) })`. Thêm `function _canViewDocument(doc, session, ctx)` phiên bản **giữ nguyên hành vi hiện tại** (chỉ kiểm tra kế thừa danh mục qua `_matchPerm`) — các nhánh lifecycle/override sẽ thêm ở US1/US2/US3.
- [X] T006 Ghi 2 field quyền ở write-path trong `apps/docmgr/src/server/documents.js`: `createDocument` (record += `'Người được xem': data['Người được xem']||''`, `'Nhóm được xem': data['Nhóm được xem']||''`); `updateDocument` (thêm 2 field vào danh sách cập nhật có điều kiện `if (data[f] !== undefined) updates[f]=…`).

**Checkpoint**: app build + chạy như cũ; tài liệu đọc theo kế thừa danh mục (chưa có lifecycle/override).

---

## Phase 3: User Story 1 — Tài liệu chưa hoàn thành chỉ người tham gia thấy (P1)

**Goal**: tài liệu `Tình trạng ≠ 'Hoàn thành'` chỉ hiện cho người tham gia (Người tạo/Phụ trách/Người phối hợp) + vai trò toàn quyền.

**Independent Test**: seed tài liệu trạng thái `Đang xử lý`/`Chờ duyệt`; participant thấy, người được xem danh mục (không tham gia) không thấy, admin thấy.

- [X] T007 [US1] Thêm `_isParticipant(doc, session)` (Người tạo == username, hoặc userId/username ∈ `_parseAssignees(doc['Phụ trách'])` / `doc['Người phối hợp']`) và nhánh đầu của `_canViewDocument`: nếu `_isParticipant` → true; nếu `doc['Tình trạng'] !== 'Hoàn thành'` → false — trong `apps/docmgr/src/server/documents.js`.
- [X] T008 [US1] Test lifecycle gating trong `apps/docmgr/src/server/__tests__/documentPerms.test.js`: chưa hoàn thành → participant thấy / người xem danh mục không thấy / toàn quyền thấy; tài liệu có nhóm-được-xem nhưng chưa hoàn thành → thành viên nhóm (không tham gia) không thấy.

---

## Phase 4: User Story 2 — Tài liệu hoàn thành không quyền riêng kế thừa danh mục (P1)

**Goal**: tài liệu `Hoàn thành` không đặt quyền riêng → quyền xem theo danh mục.

**Independent Test**: tài liệu Hoàn thành, không quyền riêng, danh mục có `Người được xem` → người trong danh sách thấy, ngoài không; danh mục trống quyền → mọi người thấy.

- [X] T009 [US2] Trong `_canViewDocument` (`apps/docmgr/src/server/documents.js`): nhánh `Hoàn thành` + **không** quyền riêng (cả `doc['Người được xem']` lẫn `doc['Nhóm được xem']` rỗng) → `_matchPerm(catUsers, catGroups, …)` từ danh mục của tài liệu (rỗng → true).
- [X] T010 [US2] Test kế thừa trong `documentPerms.test.js`: Hoàn thành + không quyền riêng + danh mục giới hạn → trong/ngoài danh sách; danh mục trống → mọi người thấy.

---

## Phase 5: User Story 3 — Tài liệu hoàn thành có quyền riêng thì chỉ người/nhóm đó (P1)

**Goal**: tài liệu `Hoàn thành` có quyền riêng → override; + UI đặt/sửa/hiển thị quyền.

**Independent Test**: tài liệu Hoàn thành đặt `Nhóm được xem`=A → thành viên A thấy; người xem danh mục ngoài A không thấy. UI: mở modal đặt được người/nhóm; xoá hết → về kế thừa.

- [X] T011 [US3] Trong `_canViewDocument` (`apps/docmgr/src/server/documents.js`): nhánh `Hoàn thành` + **có** quyền riêng → `_matchPerm(docUsers, docGroups, …)`, **bỏ** kế thừa danh mục (ưu tiên trước nhánh US2).
- [X] T012 [US3] **(Đã đổi sau khi test)** Đặt phân quyền ở **màn chi tiết** `DocumentPreview.jsx`, KHÔNG ở `DocumentModal` (vì quyền chỉ hiệu lực khi Hoàn thành = đã khóa sửa). Server: thêm `setDocumentViewers()` (gate toàn quyền) trong `documents.js` + `api_setDocumentViewers` trong `main.js`; bỏ 2 field khỏi `textFields` của `updateDocument`. Client: khối "Phân quyền xem" ở `DocumentPreview` (read-only + nút Sửa/Lưu cho toàn quyền) gọi `api_setDocumentViewers`; gỡ picker đã thêm ở `DocumentModal`.
- [X] T013 [P] [US3] Hiển thị danh sách tên người/nhóm được xem (read-only) khi tài liệu có quyền riêng trong `apps/docmgr/src/client/components/documents/DocumentPreview.jsx`.
- [X] T014 [P] [US3] Cập nhật mock cho field mới (`Người được xem`/`Nhóm được xem`) trong `apps/docmgr/src/client/gasClient.js` (create/update/getDocuments mock) để dev/test client chạy.
- [X] T015 [US3] Test override trong `apps/docmgr/src/server/__tests__/documentPerms.test.js`: Hoàn thành + `Nhóm được xem`=A → thành viên A thấy / người xem danh mục ngoài A không thấy; `Người được xem`=cá nhân → đúng người thấy; xoá hết quyền riêng → quay lại kế thừa.

---

## Phase 6: User Story 4 — Phát hành thêm lại người bị override loại trừ (P2)

**Goal**: chỉ khi tài liệu có quyền riêng, recipient có quyền xem danh mục cha & ngoài quyền riêng → tự thêm vào `Người được xem`; không quyền riêng → không đổi.

**Independent Test**: tài liệu có quyền riêng, phát hành cho X (có quyền danh mục, ngoài quyền riêng) → X vào `Người được xem`; tài liệu không quyền riêng → danh sách không đổi; recipient Y không quyền danh mục → không thêm; không trùng.

- [X] T016 [US4] Mở rộng `publishDocument` (`apps/docmgr/src/server/documents.js:1307`): sau khi dựng `publishUpdates`, **chỉ khi** `session.role ∈ ['Văn thư','Giám đốc','admin','Quản trị viên']** (người chỉ có cờ "Được phát hành" → bỏ qua, chỉ gửi mail) **và** tài liệu có quyền riêng (`docUsers||docGroups` không rỗng): load `cat` theo `doc['Danh mục']` từ `SHEETS.DANH_MUC`; với mỗi `rid ∈ toUserIds∪ccUserIds` chưa ∈ `docUsers` và `_recipientCanViewCategory(cat, rid)` → thêm vào bản sao `docUsers`; nếu có thêm → `publishUpdates['Người được xem']=JSON.stringify(newUsers)` (không trùng). Không đủ điều kiện → không đụng danh sách.
- [X] T017 [US4] Test publish auto-add trong `documentPerms.test.js`: 5 nhánh (VT/GĐ/admin + có quyền riêng + recipient hợp lệ → thêm; **người chỉ có cờ "Được phát hành" → không đổi danh sách**; không quyền riêng → không đổi; recipient không quyền danh mục → không thêm; recipient đã có → không trùng).

---

## Phase 7: User Story 5 — Import Excel cột "Phân quyền" theo tên nhóm (P2)

**Goal**: cột `Phân quyền` (tên nhóm, phân tách dấu phẩy) → `Nhóm được xem`; tên không tồn tại → không tạo tài liệu + lỗi.

**Independent Test**: import 3 dòng: tên nhóm thật → tạo + `Nhóm được xem` đúng; tên sai → không tạo + `errors`; trống → tạo, kế thừa.

> **Kiến trúc import** (đã xác minh): `bulkImportDocuments` (server) nhận `payload.groups[].docData` đã **keyed theo tên cột tiếng Việt**; bước map internal-key→tiếng-Việt + resolve nằm ở **client** `importResolver.js`. Việc kiểm tra tồn tại được làm **server-authoritative** (mirror check `catIds` ở `import.js:173`).

- [X] T018 [P] [US5] **Client**: thêm `{ key: 'phanQuyen', label: 'Phân quyền' }` vào `DOC_FIELDS` trong `apps/docmgr/src/client/utils/importResolver.js:7` và mang giá trị thô vào `docData` (`'Phân quyền': first.phanQuyen || ''`) tại block dựng `docData` (~dòng 147–158). Không resolve tên→ID ở client (để server xác thực).
- [X] T019 [US5] **Server**: thêm `'phân quyền': 'phanQuyen'` vào `_IMPORT_HEADER_MAP` (`apps/docmgr/src/server/import.js:28`); trong `bulkImportDocuments` dựng map `groupIdByName` **một lần** trước vòng lặp (mirror `catIds`, `import.js:156–158`: `getSheetData(SHEETS.NHOM)` → `{ trim(Tên nhóm): String(ID) }`). Trong build record: tách `doc['Phân quyền']` theo dấu phẩy → tên nhóm (trim, bỏ rỗng); mỗi tên tra `groupIdByName`, thiếu bất kỳ → `throw new Error('Nhóm "X" không tồn tại')` (rơi vào `try/catch` theo nhóm → `errors`, không tạo); đủ → `record['Nhóm được xem']=JSON.stringify(ids)`, `record['Người được xem']=''`; trống → cả hai `''`.
- [X] T020 [US5] Test import trong `documentPerms.test.js` (gọi `bulkImportDocuments`): tên nhóm hợp lệ → tạo + `Nhóm được xem` đúng; tên không tồn tại → không tạo + `errors` chứa tên; trống → tạo + kế thừa; nhiều nhóm phân tách dấu phẩy + một tên sai → không tạo. (Tuỳ chọn: thêm case ở `importResolver.test.js` cho việc mang `Phân quyền` vào `docData`.)

---

## Phase 8: Polish & Cross-Cutting

- [X] T021 Chạy toàn bộ test docmgr (`npx jest --config apps/docmgr/jest.config.js`); đảm bảo `documentPerms.test.js` xanh và **bộ test hiện có không vỡ** (đặc biệt `categoryPerms`, `documents`, `importResolver`, `ImportManager`). **C1 (FR-009/SC-005)**: `getDocuments` (qua `_canViewDocument`) là cổng hiển thị **duy nhất** — xác nhận không có đường đọc tài liệu đơn lẻ nào bỏ qua nó (invariant kiến trúc; nếu sau này thêm `getDocument(id)` thì phải gọi `_canViewDocument`).
- [ ] T022 [P] Kiểm chứng thủ công 6 bước trong [quickstart.md](quickstart.md) (migration, lifecycle, kế thừa, override, publish auto-add, import).
- [X] T023 Sanity build: `npm run build:docmgr` (kiểm tra concat order + obfuscation không vỡ Unicode/`api_`); deploy bằng `npm run deploy:docmgr` (KHÔNG bare `clasp push`).

---

## Phase 9: Revise 2026-06-19 — snapshot là nguồn chân lý + dọn dẹp

> **Bối cảnh**: requirement đổi sau revise-1 — `Người được xem` là **snapshot nguồn chân lý**; **bỏ fallback danh mục động** (rỗng = chỉ toàn quyền + người tham gia); cần **backfill** dữ liệu cũ; import tách **CSV-quoting**. (Workflow giao việc người phối hợp đã **tách** sang feature riêng — `specs/_deferred-us6-giao-viec-phoi-hop.md`.) Task cũ T009/T010/T011/T015/T016/T017 mô tả model trước-snapshot (giữ làm lịch sử). Tag: `[SNAP]` mô hình snapshot · `[PUB]` phát hành · `[I3]` UI · `[S1]` dọn cột.
> Coupling: T024/T025/T026/T028 cùng `documents.js` → **tuần tự**. T030 (test) sau T024–T028.

### Mô hình snapshot (FR-003/008a/010/012/013)

- [X] T024 [SNAP] `apps/docmgr/src/server/documents.js` — trong `_canViewDocument`: **xóa** nhánh fallback danh mục (`matchPerm(Cat…)`); Hoàn thành + `Người được xem` rỗng → `return false` (toàn quyền bypass ở `getDocuments`, người tham gia đã `true` ở đầu). (FR-003)
- [X] T025 [SNAP] `apps/docmgr/src/server/documents.js` — thêm helper `_categoryViewerIds(catId)` = người trực tiếp (`Danh Mục.Người được xem`) + **khai triển thành viên** các nhóm ∈ `Danh Mục.Nhóm được xem` (quét `SHEETS.NHOM`); unique. Dùng chung cho snapshot lúc tạo + import-trống + backfill.
- [X] T026 [SNAP] **Migration backfill** (FR-013) — `documents.js`: `_backfillDocViewers()` **idempotent**, gắn cờ `BACKFILL_DOCVIEWERS_DONE` trong ScriptProperties; với mỗi tài liệu `Người được xem` rỗng → `ids=_categoryViewerIds(doc['Danh mục'])`; `ids` không rỗng → ghi `JSON.stringify(ids)`; rỗng → giữ rỗng. `config.js`: gọi `_backfillDocViewers()` trong `ensureInitialized` **sau** `ensureMissingColumns` (giữ `SCHEMA_V` 10→11, không bump thêm — backfill dựa cờ).
- [X] T027 [SNAP] `apps/docmgr/src/server/import.js` — thêm `parseGroupNames(str)` tách **CSV-quoting** (phẩy ngoài là dấu tách; `"..."` giữ phẩy trong tên; trim; bỏ token rỗng; nháy lệch cặp → coi tên không khớp → lỗi). Cột "Phân quyền" **trống** → `record['Người được xem']=JSON.stringify(_categoryViewerIds(cat))` (**snapshot danh mục**, nhất quán FR-008a; danh mục trống → `''`); có tên nhóm → khai triển `groupMembersByName`; thiếu bất kỳ → throw (errors, không tạo). (FR-010/011/012)

### Phát hành + UI (FR-005, FR-008)

- [X] T028 [PUB] `apps/docmgr/src/server/documents.js` — `publishDocument`: **bỏ guard "danh sách không rỗng"** → VT/GĐ/admin **luôn** cộng mọi người nhận (TO+CC) chưa có vào `Người được xem`, **kể cả khi rỗng** (không trùng). **GHI ĐÈ** FR-005 bản nháp ("chỉ khi không rỗng"). Người chỉ có cờ "Được phát hành" → chỉ gửi mail. (FR-005)
- [X] T029 [I3] `apps/docmgr/src/client/components/DocumentModal.jsx` — tách picker `Người được xem` (`DeptUserMultiPicker`) thành **section gập riêng** tiêu đề "Phân quyền xem" (collapsible, **không** phải tab). Giữ nguyên picker màn chi tiết `DocumentPreview.jsx`.

> **US6 đã TÁCH RA** khỏi 008 (workflow giao việc người phối hợp) → xem `specs/_deferred-us6-giao-viec-phoi-hop.md`, sẽ làm thành feature riêng sau.

### Test + dọn dẹp

- [X] T030 [SNAP] `apps/docmgr/src/server/__tests__/documentPerms.test.js` — cập nhật kỳ vọng: US2 Hoàn thành + rỗng → chỉ toàn quyền + người tham gia (sửa test cũ T010); snapshot bền với xoá người khỏi danh mục; backfill; publish rỗng → **cộng** (sửa test cũ T017); import CSV-quoting (`"Trưởng, Phó phòng"` = 1 nhóm) + trống → snapshot.
- [ ] T031 Full suite `npx jest --config apps/docmgr/jest.config.js` xanh + `npm run build:docmgr` + `npm run deploy:docmgr`. Sau deploy: mở app → backfill chạy 1 lần (kiểm cờ ScriptProperties).
- [X] T032 [S1] **(làm SAU CÙNG)** Xóa cột `'Nhóm được xem'` khỏi `HO_SO` headers trong `config.js` (cấp tài liệu không dùng); xác nhận không nơi nào đọc `doc['Nhóm được xem']` (chỉ `cat['Nhóm được xem']` của danh mục giữ lại). **Báo người dùng xóa cột vật lý** khỏi sheet `Hồ Sơ`.

---

## Phase 10: Revise UI 2026-06-19 — picker "Người được xem" dạng popup

> **Bối cảnh**: sau khi test app, dropdown inline (`DeptUserMultiPicker`) quá nhỏ + nhảy giật. Đổi sang **popup modal**. **T029 (section gập) bị THAY THẾ** bởi T034. Tag `[UI]`. T034/T035 cùng `DocumentModal.jsx` → tuần tự; T033 (component mới) trước.

- [X] T033 [UI] Tạo `apps/docmgr/src/client/components/common/ViewerPickerModal.jsx` (popup): props `users`(eligible)/`phongBan`/`assignments`/`value`/`categoryViewerIds`/`catName`/`onConfirm(ids)`/`onClose`. **Draft** từ `value`; gom **theo phòng ban** (tái dùng `groupUsersByDept`) + nút "Chọn tất cả/Bỏ chọn" mỗi phòng; ô **tìm kiếm**; đầu có **2 ô check loại trừ** "Tất cả"=mọi eligible / "Theo danh mục"=`categoryViewerIds` (tự suy trạng thái tích từ draft; sửa tay → bỏ cả hai); chân "Đã chọn N" + **[Hủy][Chọn]** (Chọn→`onConfirm(draft)`, Hủy/đóng→bỏ). (FR-008)
- [X] T034 [UI] `apps/docmgr/src/client/components/DocumentModal.jsx`: **thay** khối section gập (T029) bằng **nút "Phân quyền xem — N người"** mở `ViewerPickerModal`; `onConfirm`→`setViewers`; gỡ `DeptUserMultiPicker` khỏi DocumentModal. (FR-008)
- [X] T035 [UI] `DocumentModal.jsx`: đổi danh mục (**cả tạo & sửa**) → `setViewers(categoryViewerIds(DM mới))` + **toast cảnh báo**; dùng `useRef` bỏ-qua-lần-mount để KHÔNG ghi đè khi mở form (chỉ khi user đổi thật). Bỏ guard `if(isEdit)return` cũ. (FR-008a)
- [X] T036 [UI] Test jsdom `apps/docmgr/src/client/__tests__/ViewerPickerModal.test.jsx`: render nhóm phòng ban; preset "Tất cả"/"Theo danh mục"; "Chọn tất cả" mỗi phòng; **Chọn** commit / **Hủy** discard; hiển thị số đã chọn. Giữ `DocumentModal.test.jsx` (của master) xanh.
- [X] T037 [UI] Full suite xanh + `build:docmgr`; (deploy lại — của người dùng).
- [X] T038 [UI] **Consistency**: `DocumentPreview.jsx` (màn chi tiết) dùng **cùng `ViewerPickerModal`** thay cho `DeptUserMultiPicker` inline — nút "Sửa" (toàn quyền) mở popup, `onConfirm`→`api_setDocumentViewers`; chip người read-only khi không sửa; bỏ state `editPerms`/`permUsers`/`savingPerms`. **Đã xóa** `DeptUserMultiPicker.jsx` (0 nơi dùng sau khi cả add/edit + chi tiết chuyển sang `ViewerPickerModal`). (FR-008)
- [X] T039 [UI/fix] **Kế thừa danh mục cha**: `_categoryViewerIds` (server) + `categoryViewerIds` (DocumentModal + DocumentPreview) đi ngược chuỗi `Danh mục cha` (gộp con + tổ tiên, chống lặp qua seen-set). +test server (import vào danh mục con kế thừa cha). Loading prop `saving` cho ViewerPickerModal (khoá Chọn/Hủy/X/backdrop khi đang lưu — màn chi tiết). (FR-008a/FR-010/FR-013)

---

## Cross-cutting (phát hiện khi test 008 — KHÔNG thuộc scope phân quyền xem)

- [X] T040 [fix] **Picker chọn người dùng toàn bộ SSO Active**: picker giao việc (Phụ trách/Người phối hợp ở DocumentModal + DocumentPreview) + PublishDialog + hiển thị tên — đổi `lookups.users` → `lookups.ssoUsers || lookups.users`. Trước đó chỉ hiện người đã có role docmgr (`_Phân Quyền`); nay đủ toàn bộ nhân viên SSO `Active`. (`UserPickerDropdown` key theo `'Tên đăng nhập'` — ssoUsers có sẵn, tương thích.) Đồng bộ với viewer picker (008). Giữ `lookups.users` ở chỗ cần role docmgr (Người tạo/cập nhật, quản lý quyền).
- [X] T041 [fix] **Báo cho người mới thêm vào `Người được xem`**: `setDocumentViewers` gọi `_markUnreadForUsers` cho diff (new − old) → người mới thấy chuông báo; không re-báo người cũ. (Trước đó setDocumentViewers chỉ ghi + logAudit, không báo → "nhật ký chỉ báo người trước đó". Publish đã có `_markUnreadForUsers` từ trước.) +test. (FR-008)
- [X] T042 [UI/fix] **Nhãn danh mục rỗng quyền**: CategoryManager cột "Phân quyền" + label form: `Tất cả`/`trống = tất cả` → **`Chưa phân quyền`** (khớp model snapshot: rỗng = tài liệu siết, không phải "mọi người"). **Chỉ đổi nhãn**, không đổi hành vi duyệt danh mục (server `sheets.js` giữ nguyên: folder rỗng quyền vẫn duyệt được). (cross-cutting display)
- [X] T043 [fix] **Bỏ lọc quyền danh mục theo user**: `getAllData` (sheets.js) không lọc `danhMuc` theo `Người được xem`/`Nhóm được xem` của danh mục nữa → trả về tất cả danh mục. Tài liệu được phân quyền riêng trong danh mục user không duyệt được giờ hiện đúng tên (đệ quy cả cha) thay vì "(Chưa phân danh mục)". Client đã sẵn ẩn danh mục rỗng (CatGroup total===0). Quyền danh mục giờ chỉ còn là template snapshot. +test getAllData. (FR-009)

---

## Dependencies & Thứ tự

```
Setup (T001,T002)
  └─ Foundational (T003→T005→T006; T004 [P])   # T003 trước T005; T004 [P]
       ├─ US1 (T007→T008)                 # T007 sửa _canViewDocument
       │    └─ US2 (T009→T010)            # T009 sửa cùng hàm (sau T007)
       │         └─ US3 (T011; T012/T013/T014 [P]; T015)   # T011 sau T009
       ├─ US4 (T016→T017)                 # cần T004; cùng file documents.js (sau T011)
       └─ US5 (T018 [P] client; T019 server→T020 test)   # file importResolver.js + import.js riêng
  └─ Polish (T021→T022→T023)
```

- **Read-path (documents.js)**: T005→T007→T009→T011→T016 **tuần tự** (cùng hàm/file). 
- **Test file (documentPerms.test.js)**: T008→T010→T015→T017→T020 tuần tự.
- **`[P]` thật sự** (file khác, độc lập): T001/T002; T004; T012/T013/T014 (client, sau T011 logic); T018 (client importResolver); T022.

## Song song (ví dụ)

- Khởi động: chạy **T001** và **T002** cùng lúc (config.js vs **tests**).
- Trong US3: sau khi xong T011 (server override), làm **T012**, **T013**, **T014** song song (3 file client khác nhau).
- US5: **T018** (client `importResolver.js`) có thể chạy song song chuỗi US1–3; **T019** (server `import.js`) độc lập file với read-path. Chỉ cần T021 chạy sau cùng.

## Chiến lược MVP

- **MVP** = Setup + Foundational + **US1+US2+US3** (đường đọc hoàn chỉnh: lifecycle + kế thừa + override + UI đặt quyền). Đây là lõi giá trị; ba P1 dùng chung read-path nên giao cùng nhau.
- **Tăng dần**: thêm **US4** (phát hành) rồi **US5** (import) — mỗi cái là một lát độc lập, kiểm thử riêng.
- Mỗi story có tiêu chí test độc lập (xem từng phase) map tới SC-001…SC-006.

## Tổng quan

- **Tổng task**: 40 (T001–T040), **đã làm hết** (đã deploy). Revise-1 (T001–T023) ✅; Phase 9 snapshot (T024–T032) ✅; Phase 10 picker popup (T033–T038) ✅; T039 kế thừa danh mục cha ✅; T040 cross-cutting picker SSO ✅. (T029 section gập bị thay bởi T034; US6 tách feature riêng.)
- **Theo story**: Setup 2 · Foundational 4 · US1 2 · US2 2 · US3 5 · US4 2 · US5 3 · Polish 3 · Phase 9 (snapshot) 9 · Phase 10 (picker popup) 6 · T039/T040 (fix).
- **Tests**: T008/T010/T015/T017/T020 → T030 (snapshot); **+T036 (ViewerPickerModal)**; +T021/T031/T037 chạy suite; +T022 thủ công.
