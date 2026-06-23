---

description: "Task list for Danh sách hồ sơ phẳng — phân trang & lọc danh mục online"
---

# Tasks: Danh sách hồ sơ phẳng — phân trang & lọc danh mục online

**Input**: Design documents from `/specs/011-flat-doc-list-pagination/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api_getDocuments.md](contracts/api_getDocuments.md)

**Tests**: INCLUDED — bắt buộc theo Constitution VII (test qua `vm.runInContext`) và mục Testing trong plan.

**Organization**: Theo user story (US1→US4). ⚠️ **Lưu ý quan trọng**: US1–US3 cùng sửa 2 file chia sẻ (`documents.js` server và `MainApp.jsx` client) nên **chủ yếu chạy tuần tự**, không song song giữa các story. Cờ `[P]` chỉ áp cho các task khác file thật sự (vd test server vs test client).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1/US2/US3/US4

## Path Conventions

App đơn `apps/docmgr/` (client React + GAS server đồng cư). Đường dẫn tuyệt đối tính từ repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Xác lập nền tảng đã có, đảm bảo điểm xuất phát xanh.

- [X] T001 Xác nhận baseline xanh: chạy `npm run test:docmgr` và xác nhận đang ở nhánh `011-flat-doc-list-pagination` (không thay đổi file).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Hạ tầng test dùng chung cho US1–US3.

**⚠️ CRITICAL**: Phải xong trước khi viết test các story.

- [X] T002 Thêm fixtures test dùng chung trong `apps/docmgr/src/server/__tests__/documents.test.js` (hoặc `__tests__/helpers.js`): seed >100 hồ sơ phủ đủ trạng thái (Chưa hoàn thành; Hoàn thành có/không phụ trách; Hoàn thành có/không `Lịch sử phát hành`) và cây danh mục ≥3 cấp (cha→con→cháu→chắt). Dùng cho test US1/US2/US3.

**Checkpoint**: Có dữ liệu mẫu → bắt đầu story được.

---

## Phase 3: User Story 1 — Danh sách phẳng theo độ ưu tiên (Priority: P1) 🎯 MVP

**Goal**: Bỏ gom thư mục; trả + hiển thị danh sách phẳng sắp theo 4 nhóm ưu tiên rồi ngày sửa.

**Independent Test**: Mở danh sách với dữ liệu đủ trạng thái → 1 bảng phẳng (không `CatGroup`, không "Xem thêm" theo thư mục), thứ tự rank 0→1→2→3, trong nhóm theo ngày sửa giảm dần.

### Tests for User Story 1 ⚠️ (viết trước, phải FAIL)

- [X] T003 [P] [US1] Test server thứ tự ưu tiên (INV-2, INV-3, INV-5) trong `apps/docmgr/src/server/__tests__/documents.test.js`: rank 0 (chưa HT) trước 1 (HT+phụ trách) trước 2 (HT+phát hành) trước 3 (HT thường); trong nhóm theo `Ngày cập nhật` giảm dần; hồ sơ HT có cả phụ trách+phát hành → rank 1.
- [X] T004 [P] [US1] Test client render phẳng trong `apps/docmgr/src/client/__tests__/Documents.test.jsx`: danh sách hiển thị 1 bảng phẳng, KHÔNG còn nhóm theo danh mục/`CatGroup` và KHÔNG còn nút "Xem thêm" theo thư mục; **khi không có hồ sơ → hiển thị trạng thái rỗng "Không có hồ sơ nào" (FR-015)**.

### Implementation for User Story 1

- [X] T005 [US1] Thêm `_docPriorityRank(doc)` (ES5 `var`/`function`) trong `apps/docmgr/src/server/documents.js`: trả 0..3 theo D2/data-model (dùng `_parseAssignees(doc['Phụ trách'])` và parse `doc['Lịch sử phát hành']`).
- [X] T006 [US1] Thêm `_compareByPriority(a, b)` (ES5) trong `apps/docmgr/src/server/documents.js`: so rank tăng dần, rồi `Ngày cập nhật` giảm dần (thiếu ngày = 0, xuống cuối). (depends T005)
- [X] T007 [US1] Trong `getDocuments` (`apps/docmgr/src/server/documents.js`) thay `docs.sort(...Ngày cập nhật...)` bằng `docs.sort(_compareByPriority)`. (depends T006)
- [X] T008 [US1] Thay `DocumentTable`/`CatGroup` (cây) bằng bảng phẳng trong `apps/docmgr/src/client/components/MainApp.jsx`: render tuần tự `docs` thành 1 bảng; **giữ trạng thái rỗng "Không có hồ sơ nào" khi danh sách trống (FR-015)**; gỡ wiring per-root load-more (`rootDisplayCounts`, `ROOT_FOLDER_BATCH_SIZE`, `onLoadMoreRoot`) khỏi luồng render danh sách.
- [X] T009 [US1] Cập nhật `docs` useMemo trong `apps/docmgr/src/client/components/MainApp.jsx` để giữ danh sách phẳng (không nhóm thư mục), bảo toàn thứ tự server trả về. (depends T008)

**Checkpoint**: US1 hoạt động độc lập — danh sách phẳng + đúng thứ tự ưu tiên (MVP demo được, dù chưa phân trang/lọc danh mục).

---

## Phase 4: User Story 2 — Phân trang 100 hồ sơ/trang (Priority: P1)

**Goal**: Server trả lát 100 hồ sơ + `hasNext`; client điều hướng Trước/Sau với nhãn "Trang X".

**Independent Test**: Với >200 hồ sơ, trang 1 hiện ≤100; bấm Sau → item 101+ không trùng/sót; nút Sau vô hiệu ở trang cuối, Trước vô hiệu ở trang 1.

### Tests for User Story 2 ⚠️ (viết trước, phải FAIL)

- [X] T010 [P] [US2] Test server phân trang trong `apps/docmgr/src/server/__tests__/documents.test.js`: `{}`→`page=1`, `data.length≤100`, `hasNext` đúng (CT-1); trang 1+2 không trùng ID và nối đúng thứ tự (CT-2, INV-6); `page` vượt tổng → `data=[]`,`hasNext=false` (CT-5); `hasNext` đúng ở trang cuối (INV-7); **assertion quyền: người dùng KHÔNG miễn lọc chỉ thấy hồ sơ được phép trong kết quả phân trang — quyền áp TRƯỚC sort+slice (FR-013, CT-6)**.
- [X] T011 [P] [US2] Test client phân trang trong `apps/docmgr/src/client/__tests__/Documents.test.jsx`: nhãn "Trang X" đúng; Trước vô hiệu ở trang 1, Sau vô hiệu khi `hasNext=false`; bấm Sau/Trước gọi `api_getDocuments` với `page` tương ứng.

### Implementation for User Story 2

- [X] T012 [US2] Mở rộng `getDocuments` (`apps/docmgr/src/server/documents.js`): nhận `filters.page` (1-based, `<1`/thiếu→1), cắt lát `[(page-1)*100, page*100)`, tính `hasNext = tổngĐãLọc > page*100`, trả `{ data, page, hasNext }`. (depends T007)
- [X] T013 [US2] Đảm bảo `getDocuments(token, {})` mặc định `page=1` để không vỡ `api_getInitialData`/`api_pollUpdates`/`loadDocs()` trong `apps/docmgr/src/server/documents.js`. (depends T012)
- [X] T014 [US2] Thêm state `page`/`hasNext` + nút Trước/Sau + nhãn "Trang X" trong `apps/docmgr/src/client/components/MainApp.jsx`; đổi trang → gọi `api_getDocuments(token,{page,...})` thay danh sách. (depends T008)
- [X] T015 [US2] Chỉnh polling trong `apps/docmgr/src/client/components/MainApp.jsx`: poll tick nạp lại ĐÚNG trang hiện tại (silent) thay vì đẩy toàn bộ `docs`; giữ `upsertDocInCache`/`removeDocFromCache` thao tác trên mảng trang hiện tại. (depends T014)
- [X] T016 [US2] (Nếu cần) Truyền `page:1` tường minh trong `api_getInitialData`/`api_pollUpdates` tại `apps/docmgr/src/server/main.js`. (depends T012)

**Checkpoint**: US1 + US2 hoạt động — danh sách phẳng có phân trang Trước/Sau.

---

## Phase 5: User Story 3 — Lọc Danh mục online (collapse 2 cấp) (Priority: P1)

**Goal**: Chọn 1 danh mục (picker collapse 2 cấp) → server lọc đệ quy toàn bộ con cháu, về trang 1.

**Independent Test**: Chọn danh mục cha có con/cháu/chắt → kết quả gồm hồ sơ của cả cây con; bỏ chọn → toàn bộ; picker chỉ phơi 2 cấp.

### Tests for User Story 3 ⚠️ (viết trước, phải FAIL)

- [X] T017 [P] [US3] Test server lọc danh mục đệ quy trong `apps/docmgr/src/server/__tests__/documents.test.js`: `danhMucId` của danh mục cha 3 cấp → kết quả gồm hồ sơ ở mọi hậu duệ (CT-3, INV-4); danh mục không có hồ sơ → `data=[]`.
- [X] T018 [P] [US3] Test client lọc danh mục trong `apps/docmgr/src/client/__tests__/Documents.test.jsx`: chọn danh mục → gọi `api_getDocuments` kèm `danhMucId` và reset về `page=1`; bỏ chọn → gọi không kèm `danhMucId`.

### Implementation for User Story 3

- [X] T019 [US3] Đổi xử lý `filters.danhMucId` trong `getDocuments` (`apps/docmgr/src/server/documents.js`) từ so khớp 1 cấp sang lọc theo `_categoryDescendantSet(filters.danhMucId)` (tái dùng từ `export-catalog.js`). (depends T012)
- [X] T020 [US3] Thêm prop `maxDepth=2` cho `apps/docmgr/src/client/components/common/CategoryPickerDropdown.jsx`: chỉ render tối đa 2 cấp (gốc + con), không hiện cấp 3+.
- [X] T021 [US3] Gắn `CategoryPickerDropdown` (maxDepth=2) vào toolbar trong `apps/docmgr/src/client/components/MainApp.jsx` (thay select danh mục ẩn): onChange → set `danhMucId` (server filter) + reset `page=1` + reload. (depends T014, T020)

**Checkpoint**: US1 + US2 + US3 — danh sách phẳng, phân trang, lọc danh mục online.

---

## Phase 6: User Story 4 — Bộ lọc client trên trang hiện tại (Priority: P2)

**Goal**: Các bộ lọc còn lại (từ khóa, tình trạng, dự án, NCC, phụ trách, đọc/chưa đọc, hạn, "công việc của tôi") áp client trên 100 hồ sơ của trang đang xem; nêu rõ phạm vi.

**Independent Test**: Ở 1 trang, gõ từ khóa/đổi tình trạng → chỉ lọc trong trang hiện tại; chuyển trang → bộ lọc áp lại lên trang mới.

### Tests for User Story 4 ⚠️ (viết trước, phải FAIL)

- [X] T022 [P] [US4] Test client trong `apps/docmgr/src/client/__tests__/Documents.test.jsx`: với 1 trang dữ liệu, áp từ khóa/tình trạng chỉ thu hẹp trong trang hiện tại (không gọi lại server cho các bộ lọc này).

### Implementation for User Story 4

- [X] T023 [US4] Trong `apps/docmgr/src/client/components/MainApp.jsx`: chuyển ô tìm kiếm từ gọi server (`loadDocs({keyword})`) sang lọc client trên trang hiện tại; đảm bảo các bộ lọc client còn lại (`tinhTrang`, `duAn`, `nhaCungCap`, `phuTrach`, `readStatus`, `deadlineStatus`, `myWork`) áp trên `docs` của trang hiện tại. (depends T014)
- [X] T024 [US4] Thêm gợi ý phạm vi "lọc trong trang này" cạnh ô tìm kiếm/bộ lọc trong `apps/docmgr/src/client/components/MainApp.jsx`. (depends T023)
- [X] T029 [P] [US4] Test client "Công việc của tôi" trong `apps/docmgr/src/client/__tests__/Documents.test.jsx`: bật → chỉ còn hồ sơ CHƯA hoàn thành VÀ liên quan người đăng nhập (Người tạo/Phụ trách/Phối hợp); ẩn hồ sơ Hoàn thành dù liên quan; đồng nhất mọi vai trò (FR-016).
- [X] T030 [US4] Sửa nhánh `filters.myWork` trong `apps/docmgr/src/client/components/MainApp.jsx`: thay logic riêng theo vai trò bằng quy tắc đồng nhất — giữ hồ sơ khi `Tình trạng !== 'Hoàn thành'` VÀ (Người tạo == me HOẶC Phụ trách chứa me HOẶC Người phối hợp chứa me). (depends T023)

**Checkpoint**: Toàn bộ 4 story hoạt động.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T025 [P] Chạy `npm run test:docmgr` — toàn bộ test server + client XANH (gồm test 008 quyền không vỡ).
- [ ] T026 [P] Kiểm thử thủ công theo [quickstart.md](quickstart.md) (6 bước) trên `npm run dev:docmgr`.
- [X] T027 Build kiểm tra: `npm run build:docmgr` chạy được (server bundle ES5 hợp lệ, obfuscation không vỡ); KHÔNG `clasp push` trần.
- [X] T028 Dọn code orphaned do US1 (đúng phạm vi yêu cầu bỏ gom thư mục) trong `apps/docmgr/src/client/components/MainApp.jsx`: gỡ `CatGroup`, `gatherSubtreeDocs`, `rootDisplayCounts`, `ROOT_FOLDER_BATCH_SIZE`, state collapse dành cho cây — chỉ gỡ phần do thay đổi này làm dư.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → **Foundational (P2)** → **US1 (P3)** → **US2 (P4)** → **US3 (P5)** → **US4 (P6)** → **Polish (P7)**.
- Vì US1–US3 cùng sửa `documents.js` + `MainApp.jsx`, thứ tự là **tuần tự theo độ ưu tiên**, không song song giữa các story.

### Story-level

- **US1 (MVP)**: sau Foundational. Độc lập.
- **US2**: phụ thuộc US1 (client T014←T008; server T012←T007).
- **US3**: phụ thuộc US2 (server T019←T012; client T021←T014).
- **US4**: phụ thuộc US2 (T023←T014).

### Within a story

- Test ([P]) viết trước và FAIL → rồi implementation.
- Server: ranker (T005) → comparator (T006) → wire vào sort (T007) → phân trang (T012) → lọc đệ quy (T019).
- Client: bảng phẳng (T008) → state/phân trang (T014) → picker wiring (T021)/poll (T015).

### Parallel Opportunities

- Trong mỗi story: test **server** và test **client** ([P]) chạy song song (khác file): T003∥T004, T010∥T011, T017∥T018.
- Hầu hết task implementation **không** song song vì dồn vào 2 file chia sẻ.

---

## Parallel Example: User Story 1

```bash
# Viết 2 test song song (khác file) trước khi code:
Task: "T003 Test server thứ tự ưu tiên trong documents.test.js"
Task: "T004 Test client render phẳng trong Documents.test.jsx"
# Sau đó implementation tuần tự trên documents.js rồi MainApp.jsx (T005→T009).
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & VALIDATE** (danh sách phẳng + ưu tiên) → demo được.

### Incremental Delivery

1. Foundation → 2. US1 (phẳng+ưu tiên, MVP) → 3. US2 (phân trang) → 4. US3 (lọc danh mục online) → 5. US4 (lọc client trên trang) → 6. Polish.

### Notes

- [P] = khác file, không phụ thuộc.
- Server ES5 thuần; read-only (không bump `SCHEMA_V`).
- Verify test FAIL trước khi implement; commit sau mỗi nhóm hợp lý.
- Hành vi đổi có chủ đích (D7): tìm kiếm/lọc client chỉ trong trang hiện tại.
