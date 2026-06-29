# Feature Specification: Truy cập hồ sơ qua gviz thay vì đọc toàn bộ sheet

**Feature Branch**: `014-gviz-ho-so-access`

**Created**: 2026-06-25

**Status**: Draft

**Input**: User description: "Đang có quá nhiều chỗ ở docmgr đọc toàn bộ sheet Ho_so ra để đọc ghi. Tôi muốn sửa toàn bộ về filter bằng API của google sheet gviz"

## Context & Problem

Sheet `Hồ Sơ` của docmgr có thể chứa hàng chục nghìn dòng. Nhiều thao tác phía máy chủ hiện đọc **toàn bộ** sheet vào bộ nhớ rồi mới lọc/tìm/cập nhật chỉ một vài dòng. Việc này:

- Tốn thời gian và bộ nhớ tỉ lệ thuận với tổng số hồ sơ, kể cả khi chỉ cần 1 dòng.
- Đẩy app tới sát giới hạn thực thi của Google Apps Script khi dữ liệu lớn.

Phần **liệt kê danh sách hồ sơ** đã được chuyển sang truy vấn lọc phía máy chủ bằng gviz (Google Visualization API Query) ở tính năng trước. Mục tiêu của tính năng này là mở rộng cách tiếp cận đó cho các thao tác còn lại: chỉ kéo về đúng những dòng/cột cần thiết thay vì nạp cả sheet.

## Clarifications

### Session 2026-06-25

- Q: Đường ghi (update/delete) có thuộc phạm vi tối ưu không? → A: Có — tối ưu cả ghi, định vị dòng không quét toàn bộ sheet (FR-010).
- Q: Các thao tác cần TẤT CẢ các dòng (xuất danh mục, dựng lại cột phụ trợ/chỉ mục tệp) xử lý sao? → A: Loại khỏi phạm vi, giữ nguyên cách hiện tại (FR-009).
- Q: Mức nhất quán đọc-sau-ghi nào chấp nhận được? → A: Đọc-sau-ghi tức thì (FR-011/FR-012).
- Q: Khi gviz lỗi sau khi đã thử lại, hệ thống làm gì? → A: Báo lỗi rõ, KHÔNG fallback về đọc toàn bộ sheet (FR-007).
- Q: Khi cần nhiều hồ sơ cụ thể cùng lúc, truy vấn thế nào? → A: Gộp thành một truy vấn gviz duy nhất, tránh N+1 (FR-013).
- Q: Truy vấn gviz điểm/1-dòng có cache giữa các request không? → A: Không cache, luôn lấy tươi (FR-014).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tra cứu một hồ sơ theo mã không nạp cả sheet (Priority: P1)

Khi hệ thống cần thông tin của **một** hồ sơ cụ thể (theo mã ID) — ví dụ trước khi cập nhật, khi gửi thông báo, khi kiểm tra quyền — nó đọc đúng dòng đó bằng đọc-điểm trực tiếp (định vị dòng theo mã trên sheet sống) thay vì đọc toàn bộ sheet rồi duyệt tuyến tính.

**Why this priority**: Đây là đường đi nóng (hot path) phổ biến nhất và là nguồn lãng phí lớn nhất: mỗi lần cập nhật một hồ sơ hiện đều quét cả sheet. Tự nó đã mang lại phần lớn lợi ích.

**Independent Test**: Với sheet có nhiều dòng, gọi thao tác tra cứu một hồ sơ theo mã và xác nhận kết quả đúng, đồng thời lượng dữ liệu đọc về không tăng theo tổng số hồ sơ.

**Acceptance Scenarios**:

1. **Given** sheet `Hồ Sơ` có N hồ sơ (N lớn), **When** hệ thống tra cứu hồ sơ theo một mã tồn tại, **Then** trả về đúng bản ghi đó và chỉ kéo về một dòng (không phụ thuộc N).
2. **Given** một mã không tồn tại, **When** hệ thống tra cứu, **Then** trả về "không tìm thấy" rõ ràng, không lỗi.
3. **Given** giá trị ô có chứa ký tự đặc biệt/diacritics, **When** tra cứu theo mã, **Then** vẫn khớp chính xác bản ghi.

---

### User Story 2 - Cập nhật / xoá một hồ sơ không quét cả sheet (Priority: P2)

Khi người dùng cập nhật hoặc xoá một hồ sơ, hệ thống định vị đúng dòng cần ghi mà không phải đọc toàn bộ sheet để dò số dòng.

**Why this priority**: Ghi (update/delete) cũng đang quét toàn bộ sheet để tìm dòng. Tối ưu được sẽ cải thiện thao tác ghi vốn chậm hơn đọc. Tuy nhiên gviz chỉ đọc được, nên cần một cơ chế định vị dòng để ghi — phụ thuộc quyết định ở phần Clarifications.

**Independent Test**: Cập nhật một trường của một hồ sơ trên sheet lớn, xác nhận chỉ dòng đó thay đổi, các dòng khác nguyên vẹn, và không nạp cả sheet để tìm dòng.

**Acceptance Scenarios**:

1. **Given** sheet lớn, **When** cập nhật một trường của một hồ sơ, **Then** đúng dòng được ghi, dữ liệu các dòng khác không đổi.
2. **Given** sheet lớn, **When** xoá một hồ sơ, **Then** đúng dòng bị xoá, không xoá nhầm.
3. **Given** hai thao tác ghi gần như đồng thời lên hai hồ sơ khác nhau, **When** cả hai chạy, **Then** không ghi đè chéo, không hỏng dữ liệu.

---

### User Story 3 - Các tra cứu tập con khác chuyển sang lọc qua gviz (Priority: P3)

Các thao tác hiện đọc cả sheet `Hồ Sơ` chỉ để lấy một tập con theo điều kiện (ví dụ: kiểm tra ràng buộc tham chiếu trước khi xoá danh mục/dự án/nhà cung cấp; lọc hồ sơ để dựng dữ liệu phụ trợ) chuyển sang truy vấn lọc qua gviz để chỉ kéo về phần liên quan.

**Why this priority**: Mở rộng nhất quán mô hình truy vấn-phía-máy-chủ cho phần còn lại, giảm tải khi dữ liệu tăng. Ít nóng hơn US1/US2 nên ưu tiên sau.

**Independent Test**: Chạy một thao tác kiểm tra ràng buộc tham chiếu trên sheet lớn và xác nhận kết quả đúng với lượng dữ liệu đọc về tỉ lệ với số dòng khớp điều kiện, không phải tổng số dòng.

**Acceptance Scenarios**:

1. **Given** một danh mục đang được vài hồ sơ tham chiếu, **When** kiểm tra trước khi xoá danh mục đó, **Then** phát hiện đúng là đang được dùng và chặn xoá.
2. **Given** một danh mục không hồ sơ nào tham chiếu, **When** kiểm tra, **Then** cho phép xoá.

---

### Edge Cases

- **Đọc-sau-ghi (read-after-write):** gviz có thể trả dữ liệu cũ ngay sau khi ghi do tầng cache/độ trễ của Google. Yêu cầu: luồng vừa ghi phải thấy dữ liệu mới ngay (FR-011/FR-012) — không được dựa vào gviz có thể bị cũ cho phần đọc-lại-ngay-sau-ghi.
- **Suy luận kiểu cột của gviz:** gviz suy một kiểu dữ liệu cho mỗi cột; cột lẫn số và chuỗi có thể trả ô rỗng cho phần chuỗi (đã ghi nhận trong kiến thức dự án). Truy vấn theo mã/giá trị phải tránh sai sót này.
- **Ô chứa dấu nháy / ký tự đặc biệt** trong điều kiện truy vấn không được làm hỏng truy vấn.
- **Sheet rỗng hoặc chỉ có dòng tiêu đề:** mọi truy vấn vẫn trả kết quả hợp lệ (rỗng), không lỗi.
- **Thao tác cần TẤT CẢ các dòng** (xuất danh mục, dựng lại cột phụ trợ, dựng lại chỉ mục tệp): ngoài phạm vi (FR-009) — giữ nguyên cách hiện tại.
- **gviz/UrlFetch lỗi hoặc hết hạn token:** hệ thống báo lỗi rõ ràng thay vì trả dữ liệu sai/thầm lặng.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Khi cần dữ liệu của một hồ sơ theo mã, hệ thống MUST đọc đúng bản ghi đó bằng **đọc-điểm trực tiếp trên sheet sống** (định vị dòng theo mã) mà không nạp toàn bộ sheet `Hồ Sơ`. KHÔNG dùng gviz cho đường này (gviz có độ trễ → vi phạm read-after-write FR-011/FR-012; gviz dành cho truy vấn nhiều dòng/đếm ở FR-002).
- **FR-002**: Khi cần một tập con hồ sơ theo điều kiện, hệ thống MUST đẩy điều kiện lọc xuống truy vấn gviz để chỉ nhận về các dòng khớp, thay vì lọc trong bộ nhớ sau khi đã nạp cả sheet.
- **FR-003**: Truy vấn gviz MUST chỉ yêu cầu các cột cần dùng cho từng thao tác, không kéo toàn bộ cột khi không cần.
- **FR-004**: Kết quả của các truy vấn mới MUST tương đương về mặt nghiệp vụ với cách đọc-toàn-bộ-sheet hiện tại (cùng bản ghi, cùng giá trị), bao gồm xử lý đúng dấu tiếng Việt và cột lẫn kiểu.
- **FR-005**: Thao tác cập nhật và xoá một hồ sơ MUST ghi đúng dòng đích và không làm thay đổi các dòng khác.
- **FR-006**: Hệ thống MUST giữ nguyên các bảo đảm hiện có khi ghi: khoá chống tranh chấp (chống ghi đè đồng thời), đồng bộ chỉ mục tệp, tính toán lại các cột phụ trợ, và kiểm tra ràng buộc tham chiếu.
- **FR-007**: Khi truy vấn gviz thất bại (lỗi mạng, token hết hạn, phản hồi rớt), hệ thống MUST thử lại một số lần hữu hạn; nếu vẫn thất bại MUST báo lỗi rõ ràng và **không** tự động quay về đọc toàn bộ sheet (không fallback full-read). Tuyệt đối không trả kết quả sai hoặc rỗng một cách thầm lặng.
- **FR-008**: Hệ thống MUST không thay đổi hành vi và kết quả mà người dùng cuối nhìn thấy ở các luồng hiện có (cùng dữ liệu hiển thị, cùng quyền xem, cùng kết quả thao tác).
- **FR-009**: Phạm vi chuyển đổi MUST **loại trừ** các thao tác vốn cần TẤT CẢ các dòng (xuất danh mục, dựng lại cột phụ trợ, dựng lại chỉ mục tệp) — các thao tác này giữ nguyên cách đọc-toàn-bộ-sheet hiện tại vì gviz không mang lại lợi ích. Chỉ chuyển các chỗ lấy một dòng hoặc một tập con theo điều kiện.
- **FR-010**: Đường ghi (update/delete) MUST cũng được tối ưu để định vị dòng đích **không quét toàn bộ sheet**. Vì gviz chỉ đọc và không trả số dòng vật lý, hệ thống cần một cơ chế định vị dòng theo mã trước khi ghi qua cơ chế ghi của nền tảng.
- **FR-011**: Hệ thống MUST bảo đảm **nhất quán đọc-sau-ghi tức thì**: ngay sau khi một hồ sơ được ghi (thêm/sửa/xoá), mọi thao tác đọc trong cùng luồng phải thấy dữ liệu mới nhất, không trả về trạng thái cũ do độ trễ/cache của gviz.
- **FR-012**: Khi một luồng vừa ghi xong cần đọc lại để định vị dòng hoặc để hiển thị/trả về kết quả, hệ thống MUST không phụ thuộc vào kết quả gviz có thể bị cũ; phải dùng nguồn dữ liệu phản ánh thay đổi vừa ghi.
- **FR-013** *(DEFERRED — chưa có chỗ dùng trong phạm vi)*: Nếu/khi một luồng cần nhiều hồ sơ cụ thể cùng lúc (nhiều mã hoặc nhiều điều kiện), hệ thống MUST gộp thành **một** truy vấn gviz duy nhất thay vì gọi nhiều truy vấn rời (tránh N+1, tiết kiệm hạn mức UrlFetch). Hiện không call-site nào trong phạm vi cần gộp nhiều ID → KHÔNG cài helper gộp lúc này (Constitution V — không code suy đoán); chỉ triển khai khi xuất hiện luồng thực sự cần.
- **FR-014**: Kết quả của các truy vấn gviz điểm/tra-cứu-một-dòng MUST **không** được cache giữa các request; mỗi lần truy vấn phải lấy dữ liệu tươi để bảo đảm nhất quán đọc-sau-ghi (FR-011).

### Key Entities *(include if data involved)*

- **Hồ Sơ (document record)**: Một dòng trong sheet `Hồ Sơ`, định danh bởi mã ID duy nhất. Có các thuộc tính nghiệp vụ (tên, danh mục, ngày, phụ trách, tình trạng, quyền xem, v.v.) và các cột phụ trợ phục vụ truy vấn/tìm kiếm. Là đối tượng được đọc/ghi trong tính năng này.
- **Truy vấn lọc (filtered query)**: Một yêu cầu lấy đúng tập con dòng/cột theo điều kiện (theo mã, theo danh mục, theo trạng thái...) thay vì toàn bộ sheet.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Với một thao tác tra cứu/cập nhật một hồ sơ, lượng dữ liệu kéo về từ sheet **không tăng** khi tổng số hồ sơ tăng từ vài trăm lên hàng chục nghìn (độ phức tạp truy cập không còn tỉ lệ thuận với tổng số dòng).
- **SC-002**: Trên sheet cỡ 10.000+ dòng, các thao tác trong phạm vi hoàn tất trong giới hạn thực thi của nền tảng mà không gặp lỗi quá thời gian.
- **SC-003**: 100% các luồng người dùng hiện có cho cùng kết quả như trước khi chuyển đổi (không hồi quy về dữ liệu hiển thị, quyền, hay kết quả thao tác).
- **SC-004**: Không còn vị trí nào trong phạm vi đã chốt đọc toàn bộ sheet `Hồ Sơ` chỉ để lấy một dòng hoặc một tập con theo điều kiện.
- **SC-005**: Bộ kiểm thử tự động hiện có tiếp tục đạt (pass) sau khi chuyển đổi.

## Assumptions

- "Filter bằng API gviz" = mở rộng cùng cơ chế truy vấn gviz đã dùng cho danh sách hồ sơ (Google Visualization API Query) sang các thao tác đọc/ghi khác trên sheet `Hồ Sơ`.
- gviz là **chỉ-đọc**; mọi thao tác ghi vẫn dùng cơ chế ghi của nền tảng. gviz (nếu thuộc phạm vi đường ghi) chỉ phục vụ định vị dòng/đọc trạng thái hiện tại, không trực tiếp ghi.
- Trọng tâm là sheet `Hồ Sơ`. Các sheet khác (người dùng, phân bổ, chỉ mục tệp...) nằm ngoài phạm vi trừ khi được nêu rõ.
- Các bảo đảm nghiệp vụ hiện có (khoá ghi, đồng bộ chỉ mục tệp, cột phụ trợ, kiểm tra tham chiếu) phải được giữ nguyên — đây là refactor cách truy cập dữ liệu, không đổi nghiệp vụ.

> Các quyết định đã chốt qua clarify được ghi ở mục **Clarifications** phía trên.

## Out of Scope

- Thay đổi giao diện hoặc trải nghiệm người dùng cuối.
- Thay đổi mô hình quyền/đăng nhập (SSO) hoặc cấu trúc cột nghiệp vụ của sheet.
- Tối ưu các sheet khác ngoài `Hồ Sơ`.
- Di chuyển dữ liệu sang hệ lưu trữ khác (đã có hướng riêng ở nhánh develop).

## Triển khai thực tế — bổ sung & lệch so với spec gốc (cập nhật 2026-06-26)

Trong lúc triển khai phát sinh thêm các thay đổi (đều đã làm + test; docmgr 756 pass):

**Đã hoàn thành đúng spec gốc:**
- US1 đọc-điểm 1 hồ sơ (`_getDocById` qua `_findRowIndexById`/TextFinder), US2 ghi không full-scan (`_updateRowUnlocked`/`_deleteRowUnlocked`), `getDocumentStats` qua gviz group-by, `_gvizQueryWithRetry` (FR-007), no-cache (FR-014).

**Bổ sung phát sinh (ngoài spec gốc nhưng cùng nhánh 014):**
- **Hardcode map cột** `DOC_COLS_DEF` (config.js) làm nguồn duy nhất + guard `_assertDocColsOrder` (chặn lệch cột khi nâng schema) + **bump SCHEMA_V 15→16**. Thay cho đọc-header-động; sửa bug `DOC_QUERY_HEADERS` thiếu `Người kiểm soát`. **Thứ tự cột thật của sheet (sửa khớp 2026-06-29):** `X`=Người được xem, `Y`=Nội dung phối hợp, `Z`=Hạng ưu tiên, `AA`=Token xem, `AB`=Blob tìm kiếm, `AC`=Người kiểm soát (Người kiểm soát ở **CUỐI**) — ảnh hưởng letter gviz (`order by Z` cho Hạng ưu tiên).
- **Builder gviz** `_gvizQueryBuilder` + clause helpers (`_clauseDraftGuard/ViewToken/Category/Keyword`); đổi tên cho rõ (`_buildDocListQuery`, `_docColLetters`, `_pad2`, `_fetchDocPage`); tách `_gvizCellValue` (thô) khỏi `_gvizDateToStr` (`DOC_DATE_COLS`).
- **Phân trang:** bỏ "snap về trang 1" ở server → client lo UX (reset trang khi đổi filter, chặn Next theo `hasNext`).
- **Cache-buster** `_cb=UUID` trên URL gviz (giảm staleness HTTP-cache).
- **`getDocById`/`api_getDocById`** (đọc-điểm + kiểm quyền xem) → client `verify` đổi-trạng-thái/phát-hành theo ID (sửa lỗi xác minh chỉ quét trang 1 khi gặp "Lỗi không xác định").

**Phần "chưa đọc" (sheet `_Đã Đọc`) — chuẩn hoá:**
- Đổi tên tab `_Đã Đọc` → **`_Chưa Đọc`** + hằng `SHEETS.DA_DOC`→`SHEETS.CHUA_DOC` (tên cũ ngược nghĩa: có record = chưa đọc). Migration `_migrateDaDocSheetName` (rename tab) trong `ensureInitialized`/doGet.
- `_resolveUserIds` chuẩn hoá **username/EMAIL → userId** qua `_getDocUserIdMap` (SSO `_Người Dùng`) thay vì chỉ tra `_Phân Quyền` → hết lưu email vào DA_DOC.
- Migration `_migrateDaDocUserIdEmails`: convert UserID email/username cũ → userId, **RAM-light** (đọc 1 cột), idempotent + chờ sheet cha.
- **Fix bug `addComment`**: trước đây DELETE record (= đánh dấu đã-đọc, ngược ý) → đổi sang `_markUnreadForUsers` báo chưa-đọc cho PT+PH khác khi có bình luận.

**checkReferences → gviz (G1, cập nhật 2026-06-28 — trước đây defer, nay đã làm):** kiểm ràng buộc trước khi xoá Danh Mục/Dự Án/NCC nay đếm qua gviz, KHÔNG full-read (FR-002/SC-004 đủ cho cả 3 cột tham chiếu). Cài `_countDocRefs(targetColumn, matchBy, recordName, id)` ở `doc-query.js` + `matchBy` trong `REFERENCE_MAP`:
- `matchBy:'id'` (Danh Mục, cột ID số): khớp `=` chính xác (kèm biến thể chuỗi cho cột lẫn kiểu), KHÔNG dùng `matches`.
- `matchBy:'name'` (Dự Án/NCC, cột tên đơn HOẶC mảng JSON): khớp đơn `= 'v'` HOẶC khớp phần tử mảng `matches '.*"v".*'` — **neo theo dấu nháy JSON** nên không dính chuỗi con (tìm "Dự án" không khớp phần tử "Dự án A"); escape RE2 cho `matches`, escape nháy đơn cho literal.
- **fail-closed:** gviz lỗi sau retry → ném → chặn xoá (KHÔNG trả "không dùng" thầm lặng — Const. VI + FR-007).

**Ổn định ghi khi *response rớt* (cross-execution) — tinh chỉnh FR-007/FR-011/FR-012 ở tầng client (cập nhật 2026-06-29):** phân biệt 2 mức read-after-write: **trong-luồng** (server đọc lại bằng `_getDocById` đọc sống — đã đảm bảo FR-011/FR-012) khác **cross-execution** (client gọi lại sau khi response của lần ghi bị rớt — execution cũ chạy độc lập với kết nối client, đã/đang ghi; gviz hay đọc-lại đều có thể trả bản cũ). Quyết định:
- `gasClient`: **mutation KHÔNG auto-retry** khi transport lỗi — gọi lại mù → double-execute → xung đột (vd "Hồ sơ đang ở trạng thái X, không thể Y"); chuẩn hoá lỗi về `'Lỗi không xác định'`. Read-only idempotent (`api_get*`) vẫn auto-retry.
- transition + phân quyền xem: client **cập nhật lạc quan** khi gặp `'Lỗi không xác định'` (server gần như đã lưu) — KHÔNG đọc-lại để xác nhận; **xung đột-tại-đích** (lỗi báo hồ sơ đã ở trạng thái đích) coi như thành công.
- `gasRetry`: **verify TRƯỚC khi báo lỗi** (lần gọi trước có thể đã hiệu lực dù response rớt); delay ngắn lại `[500, 1500, 3000]`; "thử lại 1/3" chỉ log console, không báo UI.
- Server: **tách side-effect khỏi save** ở `transitionDocument` + `setDocumentViewers` (email/báo unread/audit bọc try/catch, chỉ log → lưu xong là trả success, không để side-effect ném làm client tưởng lỗi); **bỏ `SpreadsheetApp.flush()`** ở 2 hàm này (client không còn đọc-lại cross-execution nên không cần ép commit sớm).

**Ngoài phạm vi gviz 014 nhưng phát sinh/sửa cùng nhánh (cập nhật 2026-06-29):**
- **Phân quyền xem theo vai trò:** chỉ vai trò toàn quyền (admin/QTV/GĐ/VT) được đổi `Người được xem` (qua `setDocumentViewers` hoặc màn sửa — `_canManageViewers`); người khác tạo hồ sơ → server tự snapshot quyền theo danh mục (`_viewersForCreate`), KHÔNG tin giá trị client gửi. UI ẩn nút "Phân quyền xem" với người không đủ quyền.
- **Giới hạn người nhận phát hành:** Gmail/Apps Script chặn ~50 người nhận / 1 email; phát hành gửi 1 email (TO+CC) → `PublishDialog` chặn khi tổng người nhận duy nhất (TO∪CC) > 50, kèm chỉ báo `n/50` (đỏ khi vượt), hướng dẫn phát hành thành nhiều lần.
- **Bỏ `_FileIndex` + guard "1 file 1 hồ sơ" (huỷ feature 007):** xoá sheet `_FileIndex`, `file-index.js` (3 override CRUD + `rebuildFileIndex`/`_index*`), config tab, và 2 chỗ chặn link/import file đã thuộc hồ sơ khác (`_indexFindDoc`). Lý do: giữ index đồng bộ qua override + sheet riêng là gánh nặng; bỏ guard → 1 file có thể nằm ở nhiều hồ sơ (chấp nhận). Spec 007 → **Superseded**.
