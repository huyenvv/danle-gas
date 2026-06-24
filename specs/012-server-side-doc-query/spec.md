# Feature Specification: Truy vấn doc list phía máy chủ — mở rộng tới 10.000+ hồ sơ

**Feature Branch**: `012-server-side-doc-query`

**Created**: 2026-06-23

**Status**: Draft

**Input**: User description: "Doc list — scale lên 10k+ hồ sơ bằng truy vấn server-side (Google Sheets gviz). Đẩy LỌC + SẮP XẾP + PHÂN TRANG xuống nguồn dữ liệu để server chỉ lấy đúng 100 dòng của trang cần, thay vì đọc toàn bộ sheet rồi sort trong RAM. Giữ NGUYÊN hành vi/feature của 011 (4 nhóm ưu tiên, lọc danh mục đệ quy, 'Công việc của tôi'); tôn trọng giới hạn thời gian chạy GAS; cân nhắc gọi doc list qua lớp trừu tượng DataStore."

## Tóm tắt

Tính năng 011 đã đưa doc list thành **danh sách phẳng có phân trang phía máy chủ** (100 hồ sơ/trang, Trước/Sau + cờ `hasNext`), sắp theo 4 nhóm ưu tiên rồi ngày sửa giảm dần, kèm lọc Danh mục đệ quy và bộ lọc "Công việc của tôi". Tuy nhiên cách hiện thực hiện **đọc TOÀN BỘ sheet mỗi request**, sắp xếp + kiểm quyền trong RAM rồi mới cắt 100 dòng.

Tính năng 012 **không thay đổi hành vi người dùng** mà thay đổi *cách hệ thống lấy dữ liệu*: đẩy lọc + sắp xếp + phân trang **xuống nguồn dữ liệu** để mỗi request chỉ kéo về đúng (tối đa) 20 hồ sơ của trang cần. Mục tiêu: ở **10.000+ hồ sơ**, thời gian tải một trang gần như **không tăng** theo tổng số hồ sơ, và **không chạm giới hạn thời gian chạy** của môi trường máy chủ.

## Clarifications

### Session 2026-06-23

- Q: Chiến lược lọc quyền xem cho vai trò thường (không full quyền)? → A: **Materialize một "token ai được xem" mức TÀI LIỆU → fast-path cho MỌI vai trò.** Quyền xem hiện tại CHỈ ở mức tài liệu (không theo nhóm/vòng đời — phần đó là code chết từ feature 008, đã bỏ ở revise 2026-06-19). Mỗi hồ sơ lưu sẵn một token chứa các userId liên quan, **nội dung token phụ thuộc Tình trạng** (xem Q tiếp theo); truy vấn nguồn lọc bằng `token CONTAINS '|<userId>|'`. *(Cập nhật khi hiện thực: delimiter là `|`, không phải `_` — vì định danh thật là email chứa `_`; định danh được map về userId qua `_Người Dùng` SSO cha. Xem research D4/D5.)*
- Q: Token "ai được xem" chứa gì theo từng Tình trạng (để không rò quyền)? → A: **Nháp** → chỉ Người tạo (`|creator|`); **Chưa hoàn thành (khác Nháp)** → Người tạo + Phụ trách + Người phối hợp; **Hoàn thành** → Người tạo + Phụ trách + Người phối hợp + Người được xem. Định dạng `|id|id|` (delimiter `|`), mỗi định danh map về userId.
- Q: Vai trò full quyền (`admin, Quản trị viên, Giám đốc, Văn thư`) lọc thế nào, và hồ sơ Nháp? → A: Full quyền **bỏ điều kiện token** (thấy mọi hồ sơ) NHƯNG **vẫn KHÔNG thấy Nháp của người khác** — áp guard `Tình trạng != 'Nháp' OR Người tạo = <me>` cho mọi vai trò. Với vai trò thường, guard Nháp là dư thừa vì token Nháp đã = `_creator_`.
- Q: Tìm kiếm từ khóa và các bộ lọc phụ — giữ client trên trang hiện tại (như 011) hay đưa server-side toàn tập? → A: **Chỉ TÌM KIẾM TỪ KHÓA chuyển server-side toàn tập** (tìm đúng mọi hồ sơ khớp, có phân trang). "Công việc của tôi" và các bộ lọc phụ (tình trạng, dự án/phòng ban, nhà cung cấp, năm) GIỮ NGUYÊN 011 — áp client trên trang hiện tại.
- Q: Server-side search giữ đúng ngữ nghĩa tìm kiếm 011 (`viMatch`) thế nào? → A: **Giữ y hệt 011 — không dấu + không hoa-thường** trên 7 trường (Tên hồ sơ, Số hồ sơ, Dự án/phòng ban, Nhà cung cấp, Ghi chú, Phụ trách, Tên file). Vì truy vấn nguồn phân biệt dấu, cần materialize một **cột "blob tìm kiếm" đã chuẩn hóa** (bỏ dấu, gộp 7 trường) để truy vấn `CONTAINS` so khớp.
- Q: Khi trùng Ngày cập nhật, lấy gì làm thứ tự phụ để phân trang không trùng/sót? → A: **ID hồ sơ giảm dần** làm tie-breaker cuối, sau (hạng ưu tiên, Ngày cập nhật giảm) — bảo đảm thứ tự tổng xác định.

### Session 2026-06-23 (đợt 3 — sau khi chạy live)

- Q: Kích thước trang? → A: **20 hồ sơ/trang** (đổi từ 100 — "tải nhẹ khi vào"). Là hằng `DOC_PAGE_SIZE`, đổi 1 chỗ.
- Q: Bộ chọn Danh mục — số cấp & mặc định? → A: **Cho chọn MỌI cấp** (kể cả cháu chắt; bỏ giới hạn 2 cấp) và **mặc định co gọn hết** (chỉ hiện danh mục gốc). Chọn 1 danh mục vẫn bao trùm con cháu (server-side).
- Đổi nhãn lọc (cosmetic, không đổi nghĩa): "Tất cả dự án" → "Tất cả Nơi nhận"; "Tất cả NCC" → "Tất cả Nơi gửi".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Doc list tải nhanh & ổn định ở quy mô 10.000+ hồ sơ (Priority: P1)

Người dùng mở danh sách hồ sơ trong một kho dữ liệu đã có hàng nghìn đến hơn 10.000 hồ sơ. Trang đầu hiển thị nhanh và mượt như khi kho chỉ có vài trăm hồ sơ; chuyển trang cũng nhanh tương đương. Người dùng không cảm nhận được sự chậm đi khi tổng số hồ sơ tăng lên.

**Why this priority**: Đây là lý do tồn tại của tính năng — gỡ nút thắt hiệu năng/timeout khiến 011 không dùng được ở quy mô lớn. Không có phần này, các phần còn lại không có giá trị bổ sung.

**Independent Test**: Nạp kho dữ liệu mẫu ~10.000 hồ sơ, đo thời gian tải trang 1 và một vài trang giữa; so với kho ~1.000 hồ sơ → xác nhận thời gian gần như không tăng và không có lỗi quá hạn.

**Acceptance Scenarios**:

1. **Given** kho có ~10.000 hồ sơ hợp lệ, **When** người dùng mở danh sách, **Then** trang đầu (tối đa 20 hồ sơ) hiển thị trong thời gian tương đương kho nhỏ và không có lỗi quá hạn.
2. **Given** kho có ~10.000 hồ sơ, **When** người dùng chuyển sang một trang ở giữa (vd: trang 50), **Then** trang đó tải về đúng 20 hồ sơ trong thời gian ổn định, không tỉ lệ với tổng số hồ sơ.
3. **Given** tổng số hồ sơ tăng từ ~1.000 lên ~10.000, **When** đo thời gian tải cùng một trang, **Then** chênh lệch thời gian nằm trong ngưỡng "gần như không đổi" (xem Success Criteria), không tăng tuyến tính theo tổng số hồ sơ.

---

### User Story 2 - Kết quả lọc/sắp xếp/phân trang giữ nguyên ngữ nghĩa 011 (Priority: P1)

Người dùng sử dụng doc list y như trước: cùng thứ tự 4 nhóm ưu tiên, cùng cách sắp theo ngày sửa, cùng lọc Danh mục đệ quy, cùng "Công việc của tôi", cùng điều khiển Trước/Sau với cờ còn-trang-sau. Việc thay đổi cách lấy dữ liệu **không** làm lệch một kết quả nào so với 011.

**Why this priority**: Ràng buộc cứng của yêu cầu là "giữ NGUYÊN hành vi 011". Nếu kết quả lệch (sai thứ tự, sai tập danh mục, trùng/sót giữa các trang) thì tính năng thất bại dù nhanh hơn.

**Independent Test**: Trên cùng một tập dữ liệu, đối chiếu kết quả từng trang (thứ tự, thành phần, cờ `hasNext`) giữa hành vi 011 và 012 → phải trùng khớp 100%.

**Acceptance Scenarios**:

1. **Given** tập hồ sơ có đủ 4 loại trạng thái, **When** tải danh sách, **Then** thứ tự là: (0) Chưa hoàn thành → (1) Hoàn thành có người phụ trách → (2) Hoàn thành có phát hành → (3) Hoàn thành bình thường; trong mỗi nhóm theo ngày sửa giảm dần, hồ sơ thiếu ngày sửa xuống cuối nhóm.
2. **Given** hồ sơ "Hoàn thành" vừa có người phụ trách vừa có phát hành, **When** sắp xếp, **Then** nó nằm đúng MỘT nhóm — nhóm ưu tiên cao hơn ("có người phụ trách"), không tính hai lần.
3. **Given** chọn một danh mục cha có con/cháu/chắt, **When** áp lọc, **Then** kết quả gồm hồ sơ của cả cây con cháu (đệ quy mọi cấp), phân trang đúng thứ tự ưu tiên — trùng với 011.
4. **Given** >200 hồ sơ hợp lệ, **When** đi qua nhiều trang, **Then** không hồ sơ nào bị trùng hoặc bị sót giữa các trang; cờ "còn trang sau" và số trang hiện tại đúng (không yêu cầu tổng số trang/tổng số hồ sơ).

---

### User Story 3 - Quyền xem theo người dùng vẫn đúng ở quy mô lớn (Priority: P1)

Người dùng vai trò thường chỉ thấy những hồ sơ mình được phép xem theo quy tắc quyền **mức tài liệu** hiện có: là người tham gia (Người tạo / Phụ trách / Người phối hợp) thì thấy ở mọi trạng thái khác Nháp; hồ sơ **Hoàn thành** còn cho người trong danh sách "Người được xem"; hồ sơ **Nháp** chỉ Người tạo thấy. Phân trang và cờ còn-trang-sau được tính trên tập **đã lọc quyền**, không lộ hồ sơ ngoài phạm vi — kể cả khi việc lọc/sắp xếp/cắt trang nay chạy ở nguồn dữ liệu.

**Why this priority**: Đẩy xử lý xuống nguồn dữ liệu không được làm rò rỉ hồ sơ ngoài quyền. Đây vừa là yêu cầu bảo mật vừa là điều kiện đúng đắn của phân trang.

**Independent Test**: Đăng nhập bằng tài khoản vai trò thường có quyền hạn chế → xác nhận mọi trang chỉ chứa hồ sơ được phép, không có hồ sơ ngoài quyền lọt vào bất kỳ trang nào, và `hasNext` phản ánh đúng tập đã lọc quyền.

**Acceptance Scenarios**:

1. **Given** một hồ sơ người dùng KHÔNG được phép xem, **When** duyệt qua mọi trang (kể cả có/không lọc danh mục), **Then** hồ sơ đó không bao giờ xuất hiện.
2. **Given** người dùng vai trò thường với tập hồ sơ được phép nhỏ hơn tổng kho, **When** phân trang, **Then** số trang và cờ còn-trang-sau tính trên tập đã lọc quyền (không tính hồ sơ ngoài quyền).
3. **Given** hồ sơ Nháp của người khác, **When** người dùng (không phải người tạo) duyệt danh sách, **Then** hồ sơ Nháp đó bị ẩn — **kể cả với vai trò full quyền** (admin/Quản trị viên/Giám đốc/Văn thư), như hành vi hiện tại.
4. **Given** hồ sơ Hoàn thành mà người dùng KHÔNG tham gia nhưng CÓ trong "Người được xem", **When** duyệt danh sách, **Then** hồ sơ hiển thị; còn nếu cùng hồ sơ đó ở trạng thái CHƯA hoàn thành, **Then** hồ sơ bị ẩn (vì "Người được xem" chỉ có hiệu lực khi Hoàn thành).

---

### User Story 4 - Vị trí hồ sơ cập nhật đúng khi trạng thái thay đổi (Priority: P2)

Khi một hồ sơ đổi tình trạng (vd: từ Chưa hoàn thành → Hoàn thành), được gán/bỏ người phụ trách, được phát hành, đổi danh mục, hoặc được sửa (đổi ngày sửa), thì ở lần tải danh sách kế tiếp nó xuất hiện đúng nhóm ưu tiên và đúng vị trí mới — bất kể việc sắp xếp nay chạy ở nguồn dữ liệu.

**Why this priority**: Vì sắp xếp theo 4 nhóm ưu tiên nay diễn ra ở nguồn dữ liệu, hệ thống phải đảm bảo "hạng ưu tiên" của mỗi hồ sơ luôn phản ánh trạng thái hiện tại. Nếu không đồng bộ, danh sách sẽ sắp sai một cách âm thầm.

**Independent Test**: Đổi tình trạng/người phụ trách/phát hành của một hồ sơ → tải lại danh sách → xác nhận hồ sơ chuyển sang đúng nhóm ưu tiên và đúng vị trí theo ngày sửa.

**Acceptance Scenarios**:

1. **Given** hồ sơ đang ở nhóm "Chưa hoàn thành", **When** chuyển sang "Hoàn thành" và có người phụ trách, **Then** lần tải kế tiếp hồ sơ nằm ở nhóm (1) "Hoàn thành có người phụ trách".
2. **Given** hồ sơ vừa được tạo mới, **When** tải danh sách, **Then** hồ sơ có hạng ưu tiên đúng ngay (không cần thao tác thủ công nào khác).
3. **Given** kho dữ liệu hiện hữu (hồ sơ tạo trước khi có tính năng này), **When** tính năng được triển khai, **Then** toàn bộ hồ sơ cũ được nạp hạng ưu tiên ban đầu đúng (qua một bước chuyển đổi một lần) trước khi danh sách phục vụ kết quả đã sắp xếp.

---

### Edge Cases

- **Hồ sơ cũ chưa có cột tính sẵn**: Trước khi bước chuyển đổi một lần hoàn tất, mọi hồ sơ phải có giá trị hợp lệ cho cả ba cột tính sẵn (hạng ưu tiên, token ai được xem, blob tìm kiếm) — không để rỗng làm sai thứ tự/lọc/tìm. Phải có chiến lược nạp ban đầu (backfill) và giá trị mặc định an toàn.
- **Hồ sơ bị sửa giữa lúc người dùng đang phân trang**: Khi rank/ngày sửa thay đổi giữa hai lần tải trang, một hồ sơ có thể nhảy trang → có thể trùng hoặc sót nhẹ giữa các trang liền kề. Đây là đặc tính cố hữu của phân trang theo offset trên dữ liệu động (đã tồn tại ở 011); chấp nhận, không xem là lỗi.
- **Trang vượt quá tổng số trang** (vd: đang ở trang cuối rồi bộ lọc làm giảm số hồ sơ): hệ thống đưa về trang hợp lệ gần nhất (trang 1) thay vì hiển thị rỗng do lệch trang (giữ hành vi 011).
- **Offset sâu (trang xa)**: Tải một trang ở vị trí rất xa (vd: trang 90/100) vẫn phải ổn định, không kéo về toàn bộ hồ sơ trước đó.
- **Danh mục bị xóa/ID lạ**: Hồ sơ không thuộc danh mục hợp lệ vẫn xuất hiện khi không lọc danh mục; khi lọc theo một danh mục cụ thể thì không nằm trong kết quả (giữ hành vi 011).
- **Ngày sửa rỗng**: Hồ sơ thiếu ngày sửa xếp sau các hồ sơ có ngày sửa trong cùng nhóm ưu tiên (giữ hành vi 011).
- **Vai trò full quyền vs vai trò thường**: Cả hai dùng fast-path truy vấn nguồn. Full quyền bỏ điều kiện token (nhưng vẫn ẩn Nháp của người khác qua guard); vai trò thường giới hạn bằng "token ai được xem" đã materialize.
- **Hồ sơ chuyển trạng thái làm đổi quyền**: Vì nội dung token phụ thuộc Tình trạng (vd: Hoàn thành → có Người được xem; quay lại Chưa hoàn thành → bỏ), token phải được tính lại khi đổi Tình trạng để quyền xem theo kịp. Việc này đi kèm thao tác sửa hồ sơ nên không phát sinh cập nhật hàng loạt.
- **Tìm kiếm từ khóa toàn tập**: Tìm kiếm chạy server-side trên toàn bộ tập (đã lọc quyền + danh mục) — khác 011 (vốn chỉ tìm trong trang hiện tại). Kết quả tìm kiếm cũng phân trang theo 4 nhóm ưu tiên; từ khóa rỗng trả về danh sách bình thường.
- **Tìm kiếm (server, toàn tập) + "Công việc của tôi" (client, trong trang)**: Thứ tự áp dụng — server trả các trang kết quả tìm kiếm trước, rồi "Công việc của tôi" lọc client trên hồ sơ của trang đang xem. Hệ quả: một trang kết quả tìm kiếm có thể còn ít hồ sơ sau khi lọc "của tôi"; đây là hành vi mong đợi (search toàn tập, "của tôi" per-page như FR-015/016).
- **Nguồn dữ liệu tạm không phản hồi/lỗi truy vấn**: Hệ thống phải báo lỗi tải danh sách rõ ràng cho người dùng thay vì treo hoặc trả kết quả sai/rỗng nhầm lẫn.
- **Làm mới nền (poll 60s) khi đang lọc/tìm kiếm** *(đợt 3)*: Poll nền lấy trang-1 KHÔNG lọc. Khi người dùng đang có **keyword tìm kiếm HOẶC chọn danh mục HOẶC ở trang ≠ 1**, hệ thống MUST tải lại đúng query hiện tại (gửi kèm keyword + danhMucId) thay vì áp danh sách trang-1-không-lọc của poll lên màn hình. Chỉ khi không lọc gì (trang 1, không danh mục, không keyword) mới áp trực tiếp dữ liệu poll cho nhẹ.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Để phục vụ một trang, hệ thống MUST chỉ lấy (tối đa) **20 hồ sơ** (kích thước trang `DOC_PAGE_SIZE`, có thể chỉnh) của đúng trang được yêu cầu từ nguồn dữ liệu; KHÔNG đọc toàn bộ tập hồ sơ vào bộ nhớ để sắp xếp/cắt trang.
- **FR-002**: Lọc, sắp xếp và phân trang MUST được thực hiện ở nguồn dữ liệu (đẩy xuống), sao cho công sức xử lý mỗi request không tỉ lệ với tổng số hồ sơ trong kho.
- **FR-003**: Hệ thống MUST giữ nguyên thứ tự 4 nhóm ưu tiên của 011: (0) Chưa hoàn thành → (1) Hoàn thành có người phụ trách → (2) Hoàn thành có phát hành → (3) Hoàn thành bình thường; trong mỗi nhóm sắp theo ngày sửa giảm dần; hồ sơ thiếu ngày sửa xuống cuối nhóm.
- **FR-003a**: Khi hai hồ sơ trùng cả hạng ưu tiên và Ngày cập nhật, hệ thống MUST dùng **ID hồ sơ giảm dần** làm thứ tự phụ cuối cùng, để thứ tự tổng là xác định và phân trang không trùng/sót (truy vấn nguồn không bảo đảm thứ tự dòng ổn định như sort trong RAM của 011).
- **FR-004**: Hệ thống MUST coi một hồ sơ "Hoàn thành" có cả người phụ trách và phát hành thuộc đúng MỘT nhóm — nhóm ưu tiên cao hơn ("có người phụ trách").
- **FR-005**: Hệ thống MUST duy trì cho mỗi hồ sơ một "hạng ưu tiên" (giá trị 0..3) phản ánh trạng thái hiện tại, được cập nhật mỗi khi hồ sơ được tạo hoặc sửa, để thứ tự kết quả luôn đúng khi sắp xếp diễn ra ở nguồn dữ liệu.
- **FR-006**: Khi hồ sơ thay đổi (tình trạng, người phụ trách, phát hành, danh mục, ngày sửa), vị trí của nó trong kết quả lọc/sắp xếp MUST phản ánh trạng thái mới ở lần tải danh sách kế tiếp.
- **FR-007**: Hệ thống MUST cung cấp cơ chế nạp ban đầu (chuyển đổi một lần) cho toàn bộ hồ sơ hiện hữu cả ba giá trị tính sẵn — hạng ưu tiên, token ai được xem, blob tìm kiếm — đảm bảo mọi hồ sơ có giá trị hợp lệ trước khi danh sách phục vụ kết quả đã sắp xếp/lọc quyền/tìm kiếm bằng fast-path.
- **FR-008**: Khi người dùng chọn một danh mục, hệ thống MUST trả về tất cả hồ sơ thuộc danh mục đó VÀ toàn bộ danh mục con cháu (đệ quy mọi cấp); tập danh mục con cháu được xác định trước rồi dùng để giới hạn truy vấn ở nguồn dữ liệu.
- **FR-009**: Hệ thống MUST cho phép bỏ chọn danh mục (về "Tất cả") để trả lại toàn bộ hồ sơ người dùng được phép xem; khi bộ lọc danh mục thay đổi, phân trang tính lại từ trang 1.
- **FR-009a** *(đợt 3)*: Bộ chọn danh mục MUST cho chọn danh mục ở **MỌI cấp** (không giới hạn 2 cấp như 011), **mặc định co gọn** (chỉ hiện danh mục gốc, mở rộng theo thao tác). Trạng thái mở rộng MUST được **giữ trong phiên trang** (cache trong bộ nhớ component) — mở lại bộ chọn không co gọn lại; tự **clear khi F5 / chuyển trang**. Ô tìm trong bộ chọn MUST không bị treo kể cả khi dữ liệu cha–con có vòng lặp (chặn chu trình).
- **FR-010**: Hệ thống MUST giữ điều khiển phân trang Trước/Sau với cờ "còn trang sau hay không" và số trang hiện tại; KHÔNG bắt buộc tính/hiển thị tổng số hồ sơ hay tổng số trang (giữ hợp đồng 011).
- **FR-011**: Khi trang yêu cầu vượt quá tổng số trang hợp lệ, hệ thống MUST đưa về trang hợp lệ gần nhất (trang 1) thay vì trả kết quả rỗng do lệch trang. (Lưu ý hiện thực: truy vấn nguồn với offset quá tầm trả 0 dòng + `hasNext=false`; do đó khi `page > 1` mà kết quả rỗng, hệ thống MUST tự truy vấn lại trang 1.)
- **FR-012**: Quyền xem là **mức tài liệu** (không theo nhóm/vòng đời). Hệ thống MUST giữ đúng quy tắc quyền hiện hành (`_canViewDocument` sau revise 2026-06-19): (a) người tham gia — Người tạo HOẶC thuộc Phụ trách HOẶC thuộc Người phối hợp — thấy hồ sơ ở mọi trạng thái khác Nháp; (b) hồ sơ **Hoàn thành** còn cho người trong "Người được xem"; (c) hồ sơ **Nháp** chỉ Người tạo thấy.
- **FR-012a**: Hồ sơ **Nháp** MUST bị ẩn với mọi người trừ Người tạo, **kể cả vai trò full quyền** (`admin, Quản trị viên, Giám đốc, Văn thư`) — áp guard `Tình trạng != 'Nháp' OR Người tạo = <người đăng nhập>` cho mọi vai trò trước/khi phân trang.
- **FR-013**: Phân trang và cờ còn-trang-sau MUST được tính trên tập hồ sơ **đã lọc quyền** của người dùng; không hồ sơ ngoài quyền nào được lọt vào bất kỳ trang nào.
- **FR-014**: Để vai trò thường (không full quyền) cũng scale tới 10k+, hệ thống MUST duy trì cho mỗi hồ sơ một **"token ai được xem"** (chuỗi các userId liên quan, định dạng `|id|id|`) và lọc bằng `token CONTAINS '|<userId người đăng nhập>|'` ở truy vấn nguồn. Vai trò **full quyền** bỏ điều kiện token này (vẫn áp guard Nháp ở FR-012a).
- **FR-014a**: Nội dung "token ai được xem" MUST phụ thuộc Tình trạng để không rò quyền: **Nháp** → chỉ Người tạo; **Chưa hoàn thành (khác Nháp)** → Người tạo + Phụ trách + Người phối hợp; **Hoàn thành** → Người tạo + Phụ trách + Người phối hợp + Người được xem. Kết quả lọc bằng token MUST trùng `_canViewDocument`.
- **FR-014b**: "Token ai được xem" MUST được tính lại mỗi khi chính hồ sơ đó được tạo/sửa (đổi Tình trạng, Phụ trách, Người phối hợp, Người được xem) — cùng lúc với việc tính lại "hạng ưu tiên". Vì quyền chỉ ở mức tài liệu, thay đổi nhóm/phòng ban của một user KHÔNG đòi cập nhật token của hồ sơ nào khác (không có cập nhật hàng loạt).
- **FR-015**: Bộ lọc "Công việc của tôi" MUST giữ ngữ nghĩa 011 — chỉ hồ sơ CHƯA hoàn thành VÀ người đăng nhập là Người tạo HOẶC thuộc Phụ trách HOẶC thuộc Người phối hợp; quy tắc đồng nhất mọi vai trò. Phạm vi áp dụng GIỮ NGUYÊN 011 — áp tại client trên trang hiện tại (hồ sơ của trang đang xem).
- **FR-016**: Tìm kiếm từ khóa MUST được thực hiện server-side trên TOÀN BỘ tập hồ sơ (đã lọc quyền và lọc danh mục), trả về kết quả khớp có phân trang theo đúng thứ tự ưu tiên — không giới hạn trong trang đang xem.
- **FR-016b**: Tìm kiếm MUST giữ đúng ngữ nghĩa 011 (`viMatch`): **không phân biệt dấu và không phân biệt hoa-thường**, khớp chuỗi con trên 7 trường: Tên hồ sơ, Số hồ sơ, Dự án (Phòng ban), Nhà cung cấp (Nơi ban hành), Ghi chú, Phụ trách, Tên file. Để truy vấn nguồn (phân biệt dấu) làm được điều này, hệ thống MUST duy trì cho mỗi hồ sơ một **cột "blob tìm kiếm" đã chuẩn hóa** (bỏ dấu + thường hóa, gộp 7 trường), cập nhật khi tạo/sửa hồ sơ; truy vấn so khớp từ khóa (đã chuẩn hóa tương tự) bằng `CONTAINS` trên cột này.
- **FR-016a**: Các bộ lọc phụ ngoài tìm kiếm từ khóa (tình trạng, dự án/phòng ban, nhà cung cấp, **đã đọc/chưa đọc, hạn, "Công việc của tôi"**) MUST giữ nguyên 011 — áp tại client trên tập hồ sơ của trang đang xem; hệ thống SHOULD thể hiện rõ phạm vi các bộ lọc này là "trong trang hiện tại".
- **FR-016c** *(đợt 3)*: Trạng thái **chưa đọc** (`_Đã Đọc`) là cơ chế per-user RIÊNG, độc lập với truy vấn doc list — badge "chưa đọc" trên từng dòng MUST đúng bất kể phân trang/lọc. Bộ lọc "Chưa đọc/Đã đọc" áp client per-page (như FR-016a); KHÔNG đưa server-side (gviz không join được trạng thái per-user).
- **FR-017**: Khi không có hồ sơ nào thỏa điều kiện, hệ thống MUST hiển thị trạng thái rỗng rõ ràng ("Không có hồ sơ nào").
- **FR-018**: Khi nguồn dữ liệu lỗi/không phản hồi truy vấn, hệ thống MUST báo lỗi tải danh sách rõ ràng cho người dùng, không treo và không trả kết quả sai/rỗng gây hiểu nhầm.
- **FR-019**: Hợp đồng dữ liệu trả về cho giao diện danh sách (cấu trúc trang, cờ `hasNext`, số trang hiện tại) MUST tương thích với giao diện 011 hiện có, để không phải viết lại phía hiển thị.

### Key Entities *(include if feature involves data)*

- **Hồ sơ**: Tài liệu trong hệ thống. Thuộc tính liên quan: Tình trạng, Người phụ trách, dấu hiệu Đã phát hành, Danh mục (ID), Ngày cập nhật, Người tạo, Người phối hợp, "Người được xem", ID. Ba giá trị **tính sẵn** (cập nhật khi tạo/sửa hồ sơ): **Hạng ưu tiên** (0..3) để sắp xếp; **Token ai được xem** (chuỗi userId định dạng `|a|b|c|`, nội dung phụ thuộc Tình trạng) để lọc quyền; **Blob tìm kiếm** (chuỗi đã bỏ dấu + thường hóa, gộp 7 trường) để tìm kiếm không dấu ở nguồn.
- **Danh mục**: Mục phân loại hồ sơ, có quan hệ cha–con tạo thành cây nhiều cấp. Chọn một danh mục bao trùm toàn bộ cây con cháu (đệ quy).
- **Trang kết quả (Page)**: Một lát tối đa 20 hồ sơ liên tiếp của tập đã lọc + sắp xếp, kèm số trang hiện tại và cờ "còn trang sau" (không kèm tổng số).
- **Ngữ cảnh quyền của người dùng**: Vai trò (full quyền hay thường) và userId người đăng nhập — dùng để chọn nhánh truy vấn (full quyền: bỏ token + guard Nháp; thường: `token CONTAINS '_userId_'`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Thời gian tải một trang danh sách **ổn định theo quy mô**: chênh lệch thời gian tải cùng một trang giữa kho ~1.000 và kho ~10.000 hồ sơ không vượt quá 20% (không tăng tuyến tính theo tổng số hồ sơ).
- **SC-002**: Ở kho ~10.000+ hồ sơ, 100% yêu cầu tải trang (trang đầu, trang giữa, trang cuối) hoàn tất thành công, không có lỗi quá hạn thời gian chạy.
- **SC-003**: Trên cùng một tập dữ liệu, kết quả từng trang (thứ tự, thành phần hồ sơ, cờ còn-trang-sau) trùng khớp 100% giữa hành vi 011 và 012 — không lệch một trang nào.
- **SC-004**: Với tài khoản vai trò thường có quyền hạn chế, 0 hồ sơ ngoài quyền xuất hiện trên bất kỳ trang nào; số trang/cờ còn-trang-sau tính đúng trên tập đã lọc quyền.
- **SC-005**: Khi chọn một danh mục cha (cây 3–4 cấp), kết quả bao gồm 100% hồ sơ thuộc mọi danh mục con cháu — trùng với 011.
- **SC-006**: Sau khi đổi tình trạng/người phụ trách/phát hành của một hồ sơ, ở lần tải kế tiếp hồ sơ nằm đúng nhóm ưu tiên mới trong 100% trường hợp kiểm thử.
- **SC-007**: Tìm kiếm từ khóa trả về 100% hồ sơ khớp trong toàn bộ tập người dùng được phép xem (kể cả hồ sơ khớp nằm ngoài trang đang xem), có phân trang — không bỏ sót do giới hạn theo trang như 011.

## Assumptions

- **Giữ nguyên 011 (phần lớn)**: điều khiển Trước/Sau + cờ còn-trang-sau (không tổng số); thứ tự 4 nhóm ưu tiên + ngày sửa; lọc danh mục đệ quy; "Công việc của tôi" ngữ nghĩa đồng nhất mọi vai trò. **Đổi ở đợt 3**: kích thước trang 100→**20**; bộ chọn danh mục **mọi cấp + mặc định co gọn** (011 chỉ 2 cấp).
- **Định hướng kỹ thuật (không bắt buộc, để plan quyết định)**: nguồn dữ liệu hỗ trợ truy vấn dạng WHERE/ORDER BY/LIMIT/OFFSET (vd: Google Sheets Query qua gviz). Vì ngôn ngữ truy vấn không có biểu thức điều kiện trong ORDER BY và phân biệt dấu/hoa-thường, ba giá trị (hạng ưu tiên, token ai được xem, blob tìm kiếm) được **tính sẵn và lưu cùng hồ sơ** để truy vấn ORDER BY / `CONTAINS` trực tiếp trên cột.
- **Quyền chỉ ở mức tài liệu**: theo `_canViewDocument` hiện hành (revise 2026-06-19), quyền xem KHÔNG phụ thuộc nhóm/phòng ban hay vòng đời (phần đó là code chết từ feature 008). Nhờ vậy token chỉ phụ thuộc dữ liệu của chính hồ sơ → tính lại cục bộ khi sửa hồ sơ, không có cập nhật hàng loạt khi đổi nhóm/quyền danh mục.
- **Lớp trừu tượng DataStore (định hướng, để plan quyết định)**: doc list nên gọi qua một lớp DataStore để sau này đổi nơi lưu dữ liệu chỉ cần viết một adapter — phù hợp định hướng refactor SOLID đã thiết kế cho nhánh develop. Việc có áp dụng ngay trong tính năng này hay không thuộc phạm vi planning.
- **Backfill một lần**: hồ sơ hiện hữu cần được nạp ban đầu cả ba cột tính sẵn trước khi danh sách phục vụ kết quả bằng fast-path.
- **Vai trò full quyền**: nhóm `admin, Quản trị viên, Giám đốc, Văn thư` thấy mọi hồ sơ (bỏ điều kiện token) nhưng vẫn không thấy Nháp của người khác (guard Nháp áp cho mọi vai trò).
- **Phạm vi**: chỉ thay đổi *cách lấy/lọc/sắp/phân trang* dữ liệu doc list và dữ liệu phụ trợ (ba cột tính sẵn); thao tác tạo/sửa hồ sơ chỉ thêm việc cập nhật ba cột này, không thay đổi luồng nghiệp vụ khác, không thay đổi quy tắc phân quyền, không thay đổi giao diện hiển thị 011.
