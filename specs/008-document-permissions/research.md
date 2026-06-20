# Phase 0 — Research & Decisions: Phân quyền xem đến từng tài liệu

> **Revise 2026-06-18 (mô hình "chỉ theo người")** — GHI ĐÈ các quyết định liên quan bên dưới:
> tài liệu chỉ lưu `Người được xem` (bỏ nhóm); Hoàn thành + danh sách không rỗng → **category-independent** (R3 nhánh override đổi thành chỉ-người, không group); rỗng → fallback danh mục. Tạo mới tích sẵn người-xem-danh-mục (khai triển nhóm→người). Publish (VT/GĐ/admin) thêm **mọi** người nhận (bỏ điều kiện danh mục/override ở R6). Import (R7/R8) khai triển nhóm → **thành viên** vào `Người được xem` (map `groupMembersByName`). Picker đặt quyền ở **cả** màn tạo/sửa lẫn chi tiết (R9). `setDocumentViewers` chỉ còn tham số `nguoiDuocXem`. `_recipientCanViewCategory` đã bỏ.
>
> **Revise 2026-06-19 (snapshot là nguồn chân lý)** — GHI ĐÈ tiếp:
> `Người được xem` là **nguồn chân lý** — Hoàn thành + **rỗng → false** (chỉ toàn quyền + người tham gia thấy), **BỎ fallback danh mục động** ở R3 bước 4. Danh mục chỉ là nguồn **snapshot lúc tạo** (R10/createDocument ghi snapshot bắt buộc) + **backfill** dữ liệu cũ — **đảo lại R2** ("không cần backfill" → **cần** backfill 1 lần, FR-013). Thêm helper `_categoryViewerIds(catId)` dùng chung snapshot + backfill, và `_backfillDocViewers()`. Import (R8): cột "Phân quyền" tách **CSV-style** qua `parseGroupNames` (tên có dấu phẩy bọc `"..."`), ghi `Người được xem` (không ghi `Nhóm được xem`).

Grounded trong mã nguồn hiện tại của `apps/docmgr`. Mỗi mục: Decision / Rationale / Alternatives.

## R1. Lưu phân quyền tài liệu ở đâu

**Decision**: Thêm 2 cột vào sheet `Hồ Sơ`: `Người được xem` và `Nhóm được xem` — **cùng tên, cùng định dạng** (JSON array of IDs, hoặc rỗng) với sheet `Danh Mục` (config.js:44).

**Rationale**: Tái dùng nguyên `_parseAssignees()` (documents.js:789) và toàn bộ pattern UI/permission của danh mục → ít code, nhất quán. Rỗng = không có phân quyền riêng (kế thừa danh mục).

**Alternatives**: (a) Sheet phụ `_Phân Quyền Hồ Sơ` (1-n) — thừa cho nhu cầu hiện tại, thêm join. (b) Một cột JSON gộp — khó mirror logic danh mục. Bỏ.

## R2. Migration schema

**Decision**: Thêm 2 cột vào `HO_SO` headers def trong `_ensureAllTabsExist` (config.js:48) và bump `SCHEMA_V` `'10'`→`'11'` (config.js:25,32).

**Rationale**: `ensureMissingColumns(ss, tabDefs)` (config.js:64) đã tự thêm cột thiếu vào sheet hiện có khi nâng schema. Bump version để buộc `ensureInitialized` chạy lại bước nhẹ. Tài liệu cũ sẽ có 2 cột trống → mặc định kế thừa danh mục (đúng hành vi mong muốn, không cần backfill).

**Alternatives**: Backfill giá trị — không cần (rỗng = đúng default). Bỏ.

## R3. Mô hình quyết định "ai được xem" — tập trung vào 1 helper

**Decision**: Trích logic thành các helper thuần trong `documents.js`:
- `_matchPerm(allowedUserIds, allowedGroupIds, userIdStr, username, userGroupIds)` → boolean (rỗng cả hai = true).
- `_isParticipant(doc, session)` → true nếu `session.username === doc['Người tạo']`, hoặc `session.userId`/username nằm trong `_parseAssignees(doc['Phụ trách'])` hoặc `_parseAssignees(doc['Người phối hợp'])`.
- `_canViewDocument(doc, session, ctx)` áp dụng thứ tự:
  1. `_isParticipant` → true.
  2. `doc['Tình trạng'] !== 'Hoàn thành'` → false (chưa hoàn thành: chỉ người tham gia).
  3. Hoàn thành + có phân quyền riêng (`Người được xem`/`Nhóm được xem` ở Hồ Sơ không rỗng) → `_matchPerm(docUsers, docGroups, …)`.
  4. Hoàn thành + không phân quyền riêng → `_matchPerm(catUsers, catGroups, …)` của danh mục (rỗng danh mục = true).

`getDocuments` (documents.js:355) giữ filter Nháp (creator-only) và bypass cho vai trò toàn quyền (`['admin','Quản trị viên','Giám đốc','Văn thư']`) như cũ; thay **block lọc theo danh mục** (dòng ~388–403) bằng một vòng `docs.filter(d => _canViewDocument(d, session, ctx))`, với `ctx = { categories, userGroupIds, userIdStr, username }` tính 1 lần/request.

**Rationale**: Một nguồn sự thật cho hiển thị → tránh lệch giữa danh sách và (tương lai) truy cập đơn lẻ (FR-009). Giữ chi phí O(docs) như hiện tại.

**Alternatives**: Nhúng inline trong filter — lặp logic 2–3 lần (list, publish-check, future single-read), dễ lệch. Bỏ.

## R4. Không có cổng truy cập tài liệu đơn lẻ

**Decision**: Hiện không có `getDocument(id)` riêng — `getDocuments` (list) là cổng duy nhất; `DocumentPreview` chỉ render dữ liệu đã nhận. Không thêm endpoint mới trong phạm vi này (Surgical). Helper `_canViewDocument` được viết tái dùng để mọi đường đọc tài liệu **tương lai** gọi chung.

**Rationale**: Đúng phạm vi spec + nguyên tắc V. FR-009 (list ≡ direct) thoả vì client chỉ thấy tài liệu lọt qua list filter.

**Alternatives**: Thêm gate đơn lẻ ngay — vượt phạm vi, không có endpoint tiêu thụ. Ghi nhận như rủi ro nếu sau này có deep-link.

## R5. "Hoàn thành" = trạng thái nào

**Decision**: `_isCompleted(doc) = doc['Tình trạng'] === 'Hoàn thành'`. Mọi trạng thái khác (Chờ duyệt, Chờ xử lý, Đang xử lý, Từ chối, YC Phát hành, Chờ xác nhận HT, Từ chối kết quả) coi là **chưa hoàn thành** → chỉ người tham gia + toàn quyền xem.

**Rationale**: Khớp Assumptions trong spec; đơn giản, một so sánh chuỗi. Workflow thực tế (memory `document-workflow.md`): chỉ `Hoàn thành` là trạng thái kết.

**Alternatives**: Gộp `Chờ xác nhận HT`/`YC Phát hành` vào "đã hoàn thành" — chưa có yêu cầu; có thể tinh chỉnh sau. Bỏ.

## R6. Phát hành tự-động-thêm có điều kiện

**Decision**: Trong `publishDocument` (documents.js:1307), sau khi dựng `publishUpdates`:
- Đọc `docUsers = _parseAssignees(doc['Người được xem'])`, `docGroups = _parseAssignees(doc['Nhóm được xem'])`.
- **Chỉ** khi `docUsers.length || docGroups.length` (đã có phân quyền riêng): với mỗi `rid` trong `toUserIds.concat(ccUserIds||[])`, nếu `rid` chưa nằm trong `docUsers` **và** `_recipientCanViewCategory(cat, rid)` → push vào bản sao `docUsers`. Nếu có thêm → `publishUpdates['Người được xem'] = JSON.stringify(newUsers)`.
- Nếu tài liệu **không** có phân quyền riêng → không đụng danh sách (không kích hoạt override).

`_recipientCanViewCategory(cat, rid)`: rỗng quyền danh mục = true; `rid` trong `cat['Người được xem']` = true; hoặc `rid` thuộc một nhóm nằm trong `cat['Nhóm được xem']` (quét `Nhóm`).

**Rationale**: Đúng FR-005 đã làm rõ — tránh biến tài liệu kế-thừa-danh-mục thành override; không mở quyền ra ngoài tập người xem danh mục.

**Hạn chế đã biết**: khớp người nhận theo **userId** (picker lưu ID). Nếu `cat['Người được xem']` lưu username thuần (legacy) thì người nhận có thể không khớp — chấp nhận, đồng bộ với cách danh mục hiện so khớp (ưu tiên ID).

**Alternatives**: Luôn thêm recipients (bản trước) — kích hoạt override ngoài ý muốn (đã bị người dùng bác). Bỏ.

## R7. Group lookup theo tên (cho import) — map nội bộ, server-authoritative

**Decision**: Không thêm `_findGroupByName`. Trong `bulkImportDocuments` (import.js:149) dựng **một** map `groupIdByName` trước vòng lặp — **mirror đúng pattern `catIds`** (import.js:156–158): `getSheetData(SHEETS.NHOM).forEach(g => groupIdByName[String(g['Tên nhóm']).trim()] = String(g.ID))`.

**Rationale**: Việc kiểm tra tồn tại danh mục đã làm server-side (`!catIds[...]` → throw, import.js:173); kiểm tra nhóm theo đúng pattern đó → an toàn, một nguồn xác thực, không lặp đọc sheet mỗi tên. Tránh helper dùng-một-chỗ (constitution V). Trim tha khoảng trắng; hoa-thường theo so khớp chuỗi mặc định.

**Alternatives**: `_findGroupByName` gọi mỗi tên — đọc sheet lặp; resolve ở client — không authoritative (FR-011 yêu cầu chặn cứng). Bỏ.

## R8. Import cột "Phân quyền" — client mang thô, server xác thực

**Kiến trúc (đã xác minh)**: `bulkImportDocuments` nhận `payload.groups[].docData` đã **keyed tiếng Việt**; map internal-key→tiếng-Việt + resolve nằm ở **client** `importResolver.js` (`DOC_FIELDS` dòng 7, dựng `docData` ~147–158). `_IMPORT_HEADER_MAP` (import.js:28) chỉ phục vụ `parseImportFile` (trả row keyed internal).

**Decision**:
- **Client** (`importResolver.js`): `+ { key: 'phanQuyen', label: 'Phân quyền' }` vào `DOC_FIELDS`; mang thô `docData['Phân quyền'] = first.phanQuyen || ''` (KHÔNG resolve tên→ID ở client).
- **Server** (`import.js`): `+ 'phân quyền': 'phanQuyen'` vào `_IMPORT_HEADER_MAP`; trong `bulkImportDocuments` dùng `groupIdByName` (R7):
  - Tách `doc['Phân quyền']` theo dấu phẩy → tên nhóm (trim, bỏ rỗng).
  - Mỗi tên tra `groupIdByName`; **thiếu bất kỳ** → `throw new Error('Nhóm "X" không tồn tại')` (rơi vào `try/catch` theo nhóm ở import.js:225 → `errors`, **không** tạo).
  - Đủ → `record['Nhóm được xem'] = JSON.stringify(ids)`, `record['Người được xem'] = ''`.
  - Trống → cả hai `''` (kế thừa danh mục).

**Rationale**: Tái dùng mô hình lỗi-theo-nhóm + xác thực server-authoritative (FR-010/011/012). Import chỉ đặt theo **nhóm**.

**Alternatives**: Cho phép email cá nhân — ngoài phạm vi. Bỏ.

## R9. UI đặt/sửa quyền ở MÀN CHI TIẾT (đã sửa sau khi triển khai)

**Decision (cập nhật)**: Đặt phân quyền ở **`DocumentPreview.jsx` (màn chi tiết)**, KHÔNG ở `DocumentModal` (màn tạo/sửa). Khối "Phân quyền xem": vai trò toàn quyền thấy nút **Sửa** → 2 `OptionPickerDropdown` (người + nhóm) + **Lưu** gọi `api_setDocumentViewers`; vai trò khác chỉ xem read-only. Lưu qua `setDocumentViewers` (server), **không** qua `updateDocument`.

**Rationale**: Quyền chỉ hiệu lực khi **Hoàn thành** — lúc đó hồ sơ đã **khóa sửa**, nên picker ở màn sửa sẽ không với tới được đúng lúc cần. Tách thao tác khỏi luồng sửa để đặt được trên tài liệu đã Hoàn thành. Gate **chỉ toàn quyền** (admin/QTV/GĐ/VT) → tránh người sửa-hồ-sơ-thường đặt quyền qua đường vòng.

**Lý do đổi so với bản đầu**: bản đầu đặt picker trong `DocumentModal` + ghi qua `updateDocument`; nhưng (1) màn sửa khóa với tài liệu Hoàn thành, (2) `updateDocument` cho mọi editor ghi field → lách gate. Đã gỡ picker khỏi modal và bỏ 2 field khỏi `textFields` của `updateDocument`.

**Alternatives**: Giữ ở modal — bị 2 vấn đề trên. Bỏ.

## R9b. setDocumentViewers (server, mới)

**Decision**: `setDocumentViewers(token, docId, nguoiDuocXem, nhomDuocXem)` + `api_setDocumentViewers`. Chặn vai trò không toàn quyền; chỉ ghi 2 cột + Người/Ngày cập nhật; **không** xử lý file → an toàn chạy trên tài liệu đã Hoàn thành. `_wrap` như các api khác.

**Rationale**: Tách bạch khỏi `updateDocument` (vốn xử lý file, có guard trạng thái). Một nguồn ghi quyền duy nhất, dễ gate.

## R10. Server write-path cho 2 field quyền

**Decision**:
- `createDocument` (documents.js:~498): thêm vào `record`: `'Người được xem': data['Người được xem'] || ''`, `'Nhóm được xem': data['Nhóm được xem'] || ''`.
- `updateDocument`: **KHÔNG** ghi 2 field quyền (đã gỡ khỏi `textFields`) — quyền chỉ đặt qua `setDocumentViewers` (R9/R9b).
- `import.js`: set `Nhóm được xem` theo cột "Phân quyền" (R8).

**Rationale**: Đồng nhất với cách các field khác được ghi; surgical.

**Alternatives**: Tạo mapper chung — refactor ngoài phạm vi. Bỏ.

## R11. Tests

**Decision**: `__tests__/documentPerms.test.js` (mirror `categoryPerms.test.js`): seed `Hồ Sơ`/`Danh Mục`/`Nhóm` + session qua `helpers.js`. Cập nhật `DOC_HEADERS` trong `helpers.js` thêm `'Người được xem'`,`'Nhóm được xem'`. Phủ:
- Lifecycle: tài liệu chưa hoàn thành → participant thấy, người ngoài (kể cả được phân quyền) không thấy; toàn quyền thấy.
- Hoàn thành + không quyền riêng → người xem danh mục thấy; ngoài → không.
- Hoàn thành + quyền riêng → chỉ người/nhóm đó; người xem danh mục ngoài danh sách không thấy.
- Publish auto-add: có quyền riêng + recipient có quyền danh mục & bị loại trừ → được thêm; không quyền riêng → không đổi; recipient không quyền danh mục → không thêm; không trùng.
- Import: tên nhóm hợp lệ → tạo + `Nhóm được xem` đúng; tên không tồn tại → không tạo + error; trống → tạo, kế thừa.
- Nhất quán list filter (FR-009 ở mức list).

**Rationale**: Khớp SC-001…SC-006; nguyên tắc VII.

**Alternatives**: Chỉ E2E — chậm, khó phủ tổ hợp. Bỏ.

## Tổng hợp NEEDS CLARIFICATION

Không còn — mọi điểm mơ hồ đã chốt trong spec (Clarifications/Assumptions) và các quyết định R1–R11 ở trên.
