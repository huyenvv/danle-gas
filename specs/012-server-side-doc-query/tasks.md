---
description: "Task list — 012 server-side doc query (gviz)"
---

# Tasks: Truy vấn doc list phía máy chủ — 10.000+ hồ sơ

**Input**: Design documents from `specs/012-server-side-doc-query/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-getDocuments.md, quickstart.md

**Tests**: CÓ — dự án có bộ test mạnh (vm.runInContext) và hiến pháp VII yêu cầu. Test viết trước phần hiện thực tương ứng và phải FAIL trước.

**Organization**: Theo user story của spec (US1 P1 hiệu năng · US2 P1 ngữ nghĩa · US3 P1 quyền · US4 P2 cập nhật vị trí). Lưu ý: cơ chế lõi (gviz + 3 cột tính sẵn) là nền chung; US2/US3/US4 là lớp đúng-đắn chồng trên cùng module.

## Path Conventions

Server: `apps/docmgr/src/server/` · Client: `apps/docmgr/src/client/` · Test: `apps/docmgr/src/server/__tests__/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Khử rủi ro hạ tầng & dựng khung trước khi code logic.

- [x] T001 Spike xác thực gviz/tq: thêm hàm tạm `_spikeGviz()` (theo quickstart §0) trong `apps/docmgr/src/server/documents.js`, deploy thử, kiểm `getResponseCode()===200` và body chứa `google.visualization.Query.setResponse(`. Ghi kết quả vào `specs/012-server-side-doc-query/research.md` (R1). Nếu FAIL → thực thi Fallback A (scope) hoặc B (sheet QUERY) trước khi tiếp tục. **CHẶN mọi task sau.**
- [x] T002 Thêm mock `UrlFetchApp.fetch` trả response gviz mẫu (status ok + N rows; và case lỗi 401/`status:"error"`) trong `apps/docmgr/src/server/__tests__/mocks/gas.js`.
- [x] T003 [P] Tạo file rỗng `apps/docmgr/src/server/doc-query.js` và thêm vào thứ tự concat app (SAU `documents.js`, TRƯỚC `main.js`) trong `scripts/bundle-server.js`; cập nhật `GAS_CORE_FILES`/app file list trong `apps/docmgr/src/server/__tests__/setup.js` để test nạp được.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 3 cột tính sẵn + đồng bộ tại mọi điểm ghi + plumbing gviz. **Không story nào chạy được trước khi xong phase này** (query dựa vào cột & parse).

**⚠️ CRITICAL**

- [x] T004 Thêm 3 header `Hạng ưu tiên`, `Token xem`, `Blob tìm kiếm` vào cuối định nghĩa cột `HO_SO` và bump `SCHEMA_V '12'→'13'` trong `apps/docmgr/src/server/config.js` (để `ensureMissingColumns` tự thêm cột).
- [x] T005 [P] Viết test cho derived helpers (FAIL trước) trong `apps/docmgr/src/server/__tests__/docDerived.test.js`: `_docViewToken` theo từng Tình trạng (Nháp→creator; Chưa hoàn thành→+PT/PH; Hoàn thành→+Người được xem; canonical userId; format `_a_b_`), `_docSearchBlob` (7 trường, không dấu), `_docPriorityRank` (đã có — chỉ khẳng định).
- [x] T006 Hiện thực `_docViewToken(doc)`, `_docSearchBlob(doc)`, `_docDerivedColumns(doc)` trong `apps/docmgr/src/server/documents.js` (tái dùng `_viNormalize`, `_parseAssignees`, `_docPriorityRank`; resolve username→userId qua bảng người dùng/APP_ROLES). → T005 xanh.
- [x] T007 Hiện thực wrapper `_addDocRow(record)` và `_updateDocRow(id, updates, existingDoc)` (gán `_docDerivedColumns` của doc đã-merge rồi gọi `addRow`/`updateRow`) trong `apps/docmgr/src/server/documents.js`.
- [x] T008 Thay 11 điểm ghi HO_SO bằng wrapper: `apps/docmgr/src/server/documents.js` dòng ~545, 689, 894, 1061, 1076, 1181, 1240, 1395, 1544, 1568 và `apps/docmgr/src/server/import.js` ~256 (mỗi nơi truyền `existingDoc` cho update). Giữ hành vi cũ, chỉ thêm derived.
- [x] T009 [P] Hiện thực backfill `backfillDocDerived()` (idempotent, duyệt mọi hồ sơ, `_updateDocRow`, log định danh không resolve được) trong `apps/docmgr/src/server/documents.js`; gọi một lần trong `ensureInitialized()` khi nâng SCHEMA_V (`apps/docmgr/src/server/config.js`).
- [x] T010 [P] Test backfill idempotent + đúng giá trị 3 cột trong `apps/docmgr/src/server/__tests__/docDerived.test.js`.
- [x] T011 [P] Hiện thực plumbing gviz trong `apps/docmgr/src/server/doc-query.js`: `_colLetter(i)` (0→A,26→AA,27→AB), `_parseGvizResponse(body)` (cắt `setResponse(...)`, JSON.parse, lỗi→throw), `_gvizRowsToDocs(rows, headers)` (map theo thứ tự headers HO_SO).
- [x] T012 [P] Test plumbing trong `apps/docmgr/src/server/__tests__/docQuery.test.js`: `_colLetter` biên; `_parseGvizResponse` (ok/lỗi); `_gvizRowsToDocs` map đúng cột.

**Checkpoint**: 3 cột có giá trị đúng tại mọi ghi + backfill; parse gviz hoạt động.

---

## Phase 3: User Story 1 — Tải nhanh & ổn định ở 10.000+ (Priority: P1) 🎯 MVP

**Goal**: `getDocuments` chỉ kéo 100 dòng/trang qua gviz thay vì đọc cả sheet.

**Independent Test**: Ở kho ~10k, trang 1/giữa/cuối tải nhanh tương đương kho 1k, không lỗi quá hạn.

- [x] T013 [US1] Hiện thực `_buildDocTq(ctx, opts, descendantIds)` (khung tối thiểu: draftGuard + ORDER BY `rank asc, ngàyCN desc, id desc` + `limit 101 offset`) trong `apps/docmgr/src/server/doc-query.js`.
- [x] T014 [US1] Hiện thực `_queryDocPage(ctx, opts)` (build tq → `UrlFetchApp.fetch` OAuth Bearer → `_parseGvizResponse` → `_gvizRowsToDocs` → cắt 100, suy `hasNext`) trong `apps/docmgr/src/server/doc-query.js`. **FR-011**: nếu `page > 1` mà kết quả rỗng → tự truy vấn lại trang 1 (snap-to-page-1), trả `page:1`.
- [x] T015 [US1] Thay thân `getDocuments(token, filters)` để gọi `_queryDocPage` (giữ `requireAuth`, hợp đồng `{data,page,hasNext}` FR-019); giữ hàm cũ đổi tên `_getDocumentsInRam` (chưa xoá — rollback) trong `apps/docmgr/src/server/documents.js`.
- [x] T016 [P] [US1] Test `getDocuments` qua mock gviz trong `apps/docmgr/src/server/__tests__/documents.test.js`: 101 rows→hasNext true & trả 100; <100→hasNext false; 0→rỗng; lỗi truy vấn→ném Error (FR-018).
- [ ] T017 [US1] Chạy kiểm hiệu năng quickstart §3 (seed 1k & 10k) — xác nhận SC-001 (≤20%) và SC-002 (không timeout); ghi số đo vào `specs/012-server-side-doc-query/quickstart.md`.

**Checkpoint**: Danh sách phẳng tải nhanh ở quy mô lớn (MVP).

---

## Phase 4: User Story 2 — Giữ nguyên ngữ nghĩa 011 (Priority: P1)

**Goal**: Thứ tự 4 nhóm + ngày sửa + tie-breaker + danh mục đệ quy khớp 011, phân trang không trùng/sót.

**Independent Test**: Đối chiếu từng trang giữa `_getDocumentsInRam` và `getDocuments` trên cùng dữ liệu → trùng 100%.

- [x] T018 [US2] Bổ sung mệnh đề danh mục vào `_buildDocTq`: dùng `_categoryDescendantSet(danhMucId)` → `where danhMucCol in (...)`; guard log khi set > 300 (R5) trong `apps/docmgr/src/server/doc-query.js`.
- [x] T019 [US2] Khẳng định ORDER BY xử lý đúng ngày rỗng (xuống cuối nhóm) và tie-breaker ID desc trong `_buildDocTq` tại `apps/docmgr/src/server/doc-query.js` (FR-003a/FR-006).
- [x] T020 [P] [US2] Test ngữ nghĩa trong `apps/docmgr/src/server/__tests__/documents.test.js`: thứ tự 4 nhóm; **hồ sơ Hoàn thành vừa có Phụ trách vừa có phát hành → nhóm 1 (FR-004)**; cùng ngày→ID desc; ngày rỗng cuối nhóm; danh mục cha gồm con cháu; không trùng/sót qua nhiều trang (SC-003/004/005).
- [x] T021 [US2] Test đối chiếu parity: cùng tập mock, kết quả `_getDocumentsInRam` vs `getDocuments` khớp từng trang trong `apps/docmgr/src/server/__tests__/documents.test.js`.

**Checkpoint**: Kết quả khớp 011.

---

## Phase 5: User Story 3 — Quyền xem đúng ở quy mô lớn (Priority: P1)

**Goal**: Lọc quyền mức tài liệu bằng token; Nháp ẩn với mọi vai trò; full quyền bỏ token.

**Independent Test**: Tài khoản thường chỉ thấy hồ sơ được phép ở mọi trang; Nháp người khác ẩn cả với admin.

- [x] T022 [US3] Bổ sung `visibilityClause` vào `_buildDocTq`: full quyền (`admin, Quản trị viên, Giám đốc, Văn thư`)→bỏ token; thường→`tokenCol contains '_<userId>_'`; draftGuard `(L != 'Nháp' or creator = me)` cho MỌI vai trò (FR-012a/014) trong `apps/docmgr/src/server/doc-query.js`.
- [x] T023 [P] [US3] Test quyền trong `apps/docmgr/src/server/__tests__/documents.test.js`: thường không thấy hồ sơ ngoài token (mọi trang); Nháp người khác ẩn kể cả full quyền; Hoàn thành+Người được xem thấy, cùng hồ sơ Chưa hoàn thành thì ẩn (SC-004); `hasNext` tính trên tập đã lọc quyền.

**Checkpoint**: Không rò hồ sơ ngoài quyền.

---

## Phase 6: User Story 4 — Vị trí cập nhật khi đổi trạng thái (Priority: P2)

**Goal**: Đổi Tình trạng/PT/phát hành → 3 cột (rank/token/blob) cập nhật đúng ở lần tải kế.

**Independent Test**: Đổi trạng thái một hồ sơ → tải lại → hồ sơ ở đúng nhóm/đúng khả kiến.

- [x] T024 [P] [US4] Test recompute qua các path đổi trạng thái trong `apps/docmgr/src/server/__tests__/docDerived.test.js`: publish (rank 0/1→2, token +viewers khi Hoàn thành), workflow chuyển Tình trạng (rank & token đổi), finalize nháp (Nháp→khác). Khẳng định mọi write site dùng wrapper (T008).
- [x] T025 [US4] Sửa lỗi nếu T024 lộ path nào chưa qua wrapper (rà lại 11 điểm ghi) trong `apps/docmgr/src/server/documents.js` / `import.js`.

**Checkpoint**: Sắp xếp/quyền theo kịp thay đổi trạng thái.

---

## Phase 7: Tìm kiếm toàn tập (server-side) + Client

**Purpose**: FR-016/016a/016b — tìm kiếm toàn tập; client gửi keyword, lọc phụ giữ per-page.

- [x] T026 Bổ sung `searchClause` vào `_buildDocTq`: `where blobCol contains '<_viNormalize(keyword)>'`, escape `'`→`''`; rỗng→bỏ mệnh đề (`apps/docmgr/src/server/doc-query.js`).
- [x] T027 [P] Test tìm kiếm toàn tập trong `apps/docmgr/src/server/__tests__/documents.test.js`: "ke hoach"↔"Kế hoạch" (không dấu) khớp ở ngoài trang đang xem; 7 trường; escape nháy đơn an toàn (SC-007).
- [x] T028 `MainApp.jsx`: gửi `searchKeyword` (trim) xuống `api_getDocuments` như `filters.keyword`; **bỏ lọc keyword client toàn-cục**; reset trang 1 khi đổi keyword; giữ lọc phụ client per-page (`apps/docmgr/src/client/components/MainApp.jsx`). **Giữ nguyên (regression-check)**: "Công việc của tôi" (FR-015), trạng thái rỗng (FR-017), reset trang 1 khi đổi danh mục (FR-009).
- [x] T029 [P] `MainApp.jsx`: thêm chú thích/nhãn cho biết các lọc phụ áp "trong trang hiện tại" (FR-016a) (`apps/docmgr/src/client/components/MainApp.jsx`).

---

## Phase 8: Polish & Cross-Cutting

- [x] T030 [P] Báo lỗi tải danh sách rõ ràng khi gviz lỗi/không phản hồi ở client (`apps/docmgr/src/client/components/MainApp.jsx`) — FR-018.
- [ ] T031 Chạy toàn bộ quickstart.md (§2 ngữ nghĩa, §4 backfill, §5 rollback) trên bản sheet thật; tick các kịch bản.
- [x] T032 `npm run test:docmgr` toàn bộ xanh; `npm run build:docmgr` chạy được (kiểm `doc-query.js` vào bundle).
- [x] T033 Gỡ hàm spike `_spikeGviz` (T001) khỏi `apps/docmgr/src/server/documents.js`; quyết định giữ/gỡ `_getDocumentsInRam` trong cùng file sau khi ổn định (mặc định GIỮ 1 phiên bản để rollback, ghi chú TODO xoá sau).

---

## Dependencies & Execution Order

- **Phase 1 (Setup)**: T001 CHẶN tất cả (spike auth). T002, T003 song song sau T001.
- **Phase 2 (Foundational)**: sau Setup; CHẶN mọi user story. T005→T006; T006→T007→T008; T009 sau T007; T011/T012 độc lập (song song T004-T010).
- **US1 (Phase 3)**: sau Foundational. T013→T014→T015→T016; T017 sau T015.
- **US2 (Phase 4)**: sau US1 (cùng `_buildDocTq`/`getDocuments`). T018,T019→T020,T021.
- **US3 (Phase 5)**: sau US1; song song được với US2 (khác mệnh đề trong cùng hàm → phối hợp tránh xung đột file). T022→T023.
- **US4 (Phase 6)**: sau Foundational (chủ yếu xác minh wrappers). T024→T025.
- **Phase 7 (Search+Client)**: server T026/T027 sau US1; client T028/T029 sau T015 (hợp đồng ổn định).
- **Phase 8 (Polish)**: sau các phase trên.

### Within story
- Test viết trước & FAIL trước (T005,T012,T016,T020,T023,T024,T027).
- `_buildDocTq` xây tăng dần: US1 (khung+order+limit) → US2 (category) → US3 (visibility) → Search (blob). Cùng 1 file `doc-query.js` ⇒ các bước này TUẦN TỰ, không [P] với nhau.

### Parallel Opportunities
- T002 ∥ T003 (sau T001).
- T011/T012 (plumbing) ∥ T004–T010 (derived/schema) — khác file.
- Các task test có [P] chạy song song khi file khác nhau.
- T028 ∥ T029 ∥ T030 chỉnh các phần khác nhau của MainApp.jsx? → KHÔNG, cùng file → tuần tự. (Bỏ [P] khi cùng file.)

---

## Implementation Strategy

### MVP (US1)
Setup → Foundational → US1 (T013–T017). Dừng & xác nhận SC-001/002 ⇒ đã có giá trị scaling. Lúc này quyền/ngữ nghĩa dùng khung tối thiểu (draftGuard); chưa đầy đủ → CHƯA deploy production cho vai trò thường.

### Incremental
US1 (scaling) → US2 (parity) → US3 (quyền — bắt buộc trước khi mở cho vai trò thường) → US4 (đồng bộ) → Search+Client → Polish. Mỗi bước test độc lập.

### Lưu ý rủi ro
- T001 (auth gviz) là điểm make-or-break — không qua thì đổi sang Fallback B trước khi làm tiếp.
- US3 phải xong trước khi cho vai trò thường dùng bản mới (nếu không sẽ lộ hồ sơ).

---

## Notes
- [P] = khác file, không phụ thuộc. Nhiều task sửa CÙNG `doc-query.js`/`MainApp.jsx` ⇒ KHÔNG [P] với nhau.
- Mỗi task xong → commit nhỏ (≤ vài file, tiếng Việt, nêu cái gì + vì sao).
- ES5 `var/function` ở server (hiến pháp I); thêm cột ⇒ đã bump SCHEMA_V (VI).
