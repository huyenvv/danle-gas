# Feature Specification: Danh sách hồ sơ phẳng — phân trang & lọc danh mục online

**Feature Branch**: `011-flat-doc-list-pagination`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: "Doc list: Tôi muốn sửa lại phần hiển thị doc list này theo hướng ko gộp thư mục nữa mà sẽ trả ra list 100 items trải phẳng, có phân trang. Nhưng có thêm phần filter online theo Danh mục. Danh mục sẽ hiển thị collapse để chọn. Items trả ra sẽ sắp xếp theo độ ưu tiên lần lượt như sau: Chưa hoàn thành và theo ngày sửa; Hoàn thành mà có người phụ trách; Hoàn thành mà có phát hành; Hoàn thành bình thường."

## Clarifications

### Session 2026-06-22

- Q: Kiểu điều khiển phân trang cho danh sách phẳng 100 items? → A: Trước/Sau + số trang (nút ‹ Trước / Sau ›, có hiển thị số trang hiện tại).
- Q: Có hiển thị tổng số hồ sơ / tổng số trang của kết quả không? → A: Không hiển thị tổng; chỉ cần chỉ báo "còn trang sau hay không" (nút Sau bị vô hiệu ở trang cuối). Hệ quả: hiển thị số trang HIỆN TẠI nhưng KHÔNG hiển thị tổng số trang/tổng số hồ sơ.
- Q: Khi đang áp bộ lọc client và người dùng chuyển trang thì sao? → A: Vẫn chuyển trang bình thường; server trả 100 hồ sơ của trang mới (theo danh mục + ưu tiên) rồi bộ lọc client áp lại trên trang mới. Điều khiển phân trang luôn theo dữ liệu server-side.
- Q: "Công việc của tôi" lọc thế nào? → A: Áp CLIENT trên trang hiện tại; chỉ hiển thị hồ sơ CHƯA hoàn thành VÀ liên quan người đăng nhập (là Người tạo HOẶC thuộc Phụ trách HOẶC thuộc Người phối hợp); quy tắc đồng nhất cho MỌI vai trò (bỏ logic riêng GĐ=Chờ duyệt, VT=tự tạo).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Xem danh sách hồ sơ phẳng theo độ ưu tiên (Priority: P1)

Người dùng mở màn hình danh sách hồ sơ và thấy một danh sách **phẳng** (không còn gom theo cây thư mục/danh mục). Danh sách được sắp xếp sẵn theo độ ưu tiên để các hồ sơ cần chú ý nhất nằm trên cùng, và chỉ tải 100 hồ sơ mỗi lần để màn hình nhẹ và nhanh.

**Why this priority**: Đây là thay đổi cốt lõi của yêu cầu — bỏ lối hiển thị gom thư mục hiện tại, thay bằng danh sách phẳng có thứ tự ưu tiên. Không có phần này thì các phần còn lại (lọc, phân trang) không có chỗ áp dụng.

**Independent Test**: Mở danh sách với dữ liệu có đủ các loại trạng thái → xác nhận hồ sơ hiển thị thành một danh sách phẳng, đúng thứ tự ưu tiên, và chỉ 100 hồ sơ đầu được tải.

**Acceptance Scenarios**:

1. **Given** có nhiều hồ sơ thuộc nhiều danh mục khác nhau, **When** người dùng mở danh sách, **Then** hồ sơ hiển thị thành một danh sách phẳng, không nhóm theo danh mục/thư mục gốc và không còn nút "Xem thêm" theo từng thư mục.
2. **Given** tập hồ sơ có cả loại chưa hoàn thành và đã hoàn thành, **When** danh sách được hiển thị, **Then** thứ tự là: (1) Chưa hoàn thành, (2) Hoàn thành có người phụ trách, (3) Hoàn thành có phát hành, (4) Hoàn thành bình thường.
3. **Given** nhiều hồ sơ trong cùng một nhóm ưu tiên, **When** sắp xếp, **Then** trong mỗi nhóm hồ sơ được sắp theo ngày sửa giảm dần (mới nhất trước).
4. **Given** tổng số hồ sơ hợp lệ lớn hơn 100, **When** mở danh sách, **Then** chỉ 100 hồ sơ đầu (theo thứ tự ưu tiên) được tải và hiển thị, kèm thông tin/điều khiển phân trang.

---

### User Story 2 - Phân trang 100 hồ sơ mỗi trang (Priority: P1)

Khi số hồ sơ vượt 100, người dùng điều hướng qua các trang để xem toàn bộ. Mỗi lần chuyển trang, hệ thống truy vấn lại để lấy đúng 100 hồ sơ của trang đó theo thứ tự ưu tiên đã định.

**Why this priority**: Phân trang là điều kiện để danh sách phẳng hoạt động được với khối lượng hồ sơ lớn mà không tải toàn bộ về máy.

**Independent Test**: Với >200 hồ sơ, chuyển sang trang 2 → xác nhận hiển thị các hồ sơ tiếp theo (item 101–200) đúng thứ tự, không trùng và không sót so với trang 1.

**Acceptance Scenarios**:

1. **Given** có 250 hồ sơ hợp lệ, **When** người dùng ở trang 1, **Then** thấy 100 hồ sơ đầu và biết còn trang tiếp theo.
2. **Given** đang ở trang 1, **When** chuyển sang trang 2, **Then** thấy hồ sơ thứ 101–200 theo đúng thứ tự ưu tiên, liền mạch với trang 1.
3. **Given** đang ở trang cuối có ít hơn 100 hồ sơ, **When** hiển thị, **Then** chỉ hiện số hồ sơ còn lại và không có trang kế tiếp.
4. **Given** người dùng thay đổi bộ lọc Danh mục, **When** kết quả lọc thay đổi, **Then** phân trang được tính lại từ trang 1.

---

### User Story 3 - Lọc theo Danh mục bằng bộ chọn collapse (online) (Priority: P1)

Người dùng chọn một Danh mục từ một bộ chọn dạng thu gọn/mở rộng (collapse) hiển thị tối đa 2 cấp danh mục. Khi chọn, hệ thống trả về tất cả hồ sơ thuộc danh mục đó **và toàn bộ danh mục con cháu** của nó (đệ quy), đã phân trang theo thứ tự ưu tiên.

**Why this priority**: Bỏ gom thư mục khiến người dùng mất khả năng "xem theo danh mục"; bộ lọc danh mục online thay thế vai trò đó và là phần bổ sung trọng yếu của yêu cầu.

**Independent Test**: Chọn một danh mục cha có danh mục con và cháu → xác nhận danh sách trả về gồm hồ sơ của cả cây con đó, đúng phân trang và thứ tự ưu tiên; bỏ chọn → quay lại toàn bộ hồ sơ.

**Acceptance Scenarios**:

1. **Given** cây danh mục nhiều cấp, **When** mở bộ chọn danh mục, **Then** bộ chọn hiển thị dạng collapse và chỉ phơi bày tối đa 2 cấp danh mục để chọn.
2. **Given** một danh mục cha có con (cấp 2), cháu (cấp 3) và chắt (cấp 4), **When** người dùng chọn danh mục cha đó, **Then** danh sách trả về gồm hồ sơ của danh mục cha và tất cả con cháu chắt (đệ quy), không chỉ riêng cấp được chọn.
3. **Given** đã chọn một danh mục, **When** người dùng bỏ chọn (chọn "Tất cả"), **Then** danh sách trả về toàn bộ hồ sơ người dùng được phép xem, phân trang lại từ trang 1.
4. **Given** một danh mục được chọn không có hồ sơ nào hợp lệ, **When** áp dụng, **Then** hiển thị trạng thái rỗng rõ ràng ("Không có hồ sơ nào").

---

### User Story 4 - Các bộ lọc khác trên trang hiện tại (Priority: P2)

Các bộ lọc sẵn có ngoài Danh mục (từ khóa tìm kiếm, tình trạng, dự án/phòng ban, nhà cung cấp, năm) tiếp tục dùng được, áp dụng tại client trên tập 100 hồ sơ của **trang đang xem**.

**Why this priority**: Giữ tính liên tục với hành vi lọc hiện có, nhưng là thứ yếu so với cấu trúc danh sách/phân trang mới. Đây là quyết định đã chốt: chỉ Danh mục được lọc online; các bộ lọc còn lại áp tại client trên trang hiện tại.

**Independent Test**: Ở trang 1 (100 hồ sơ), gõ từ khóa khớp một số hồ sơ trong trang → danh sách thu hẹp đúng; xác nhận phạm vi lọc chỉ trong trang hiện tại.

**Acceptance Scenarios**:

1. **Given** đang ở một trang có 100 hồ sơ, **When** người dùng nhập từ khóa, **Then** danh sách hiển thị chỉ các hồ sơ trong trang hiện tại khớp từ khóa.
2. **Given** đang áp một bộ lọc client (vd: tình trạng), **When** người dùng chuyển trang, **Then** bộ lọc tiếp tục áp lên 100 hồ sơ của trang mới.
3. **Given** trang hiện tại có cả hồ sơ đã/chưa hoàn thành và có/không liên quan người đăng nhập, **When** người dùng bật "Công việc của tôi", **Then** chỉ còn các hồ sơ CHƯA hoàn thành mà người đăng nhập là Người tạo hoặc thuộc Phụ trách hoặc thuộc Người phối hợp.

---

### Edge Cases

- **Phạm vi tìm kiếm/lọc client bị giới hạn theo trang**: Vì chỉ Danh mục được lọc online, từ khóa và các bộ lọc còn lại chỉ tác động trên 100 hồ sơ của trang đang xem — một hồ sơ khớp nhưng nằm ở trang khác sẽ KHÔNG xuất hiện. Đây là thay đổi hành vi có chủ đích so với hiện tại (đang tìm trên toàn bộ). Cần thể hiện rõ cho người dùng hiểu phạm vi lọc là "trong trang này".
- **Hồ sơ Hoàn thành vừa có người phụ trách vừa có phát hành**: Xếp vào nhóm ưu tiên cao hơn theo thứ tự liệt kê (nhóm "có người phụ trách"), không tính hai lần.
- **Hồ sơ Nháp**: Chỉ người tạo thấy (giữ nguyên hành vi hiện tại); không thay đổi do tính năng này.
- **Hồ sơ không thuộc danh mục hợp lệ nào** (danh mục bị xóa/ID lạ): Vẫn xuất hiện khi không lọc danh mục; khi lọc theo một danh mục cụ thể thì không nằm trong kết quả.
- **Quyền xem danh mục**: Người dùng không thuộc vai trò miễn lọc chỉ thấy hồ sơ trong phạm vi được phép; phân trang và đếm tổng phải tính trên tập đã lọc quyền.
- **Trang vượt quá tổng số trang** (vd: đang ở trang cuối rồi bộ lọc làm giảm số hồ sơ): hệ thống đưa về trang hợp lệ gần nhất (trang 1) thay vì hiển thị rỗng do lệch trang.
- **Ngày sửa rỗng**: Hồ sơ thiếu ngày sửa được xếp sau các hồ sơ có ngày sửa trong cùng nhóm ưu tiên (xuống cuối nhóm).
- **"Công việc của tôi" + hồ sơ Hoàn thành**: hồ sơ đã Hoàn thành luôn bị ẩn khỏi "Công việc của tôi" ngay cả khi người đăng nhập là Người tạo/Phụ trách/Phối hợp. "Công việc của tôi" lọc client trên trang hiện tại nên chỉ xét trong 100 hồ sơ đang xem.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST hiển thị hồ sơ dưới dạng danh sách phẳng, KHÔNG gom theo cây danh mục/thư mục gốc và KHÔNG dùng cơ chế "Xem thêm" theo từng thư mục.
- **FR-002**: Hệ thống MUST trả về và hiển thị tối đa 100 hồ sơ mỗi trang.
- **FR-003**: Hệ thống MUST hỗ trợ phân trang bằng điều khiển Trước/Sau kèm số trang hiện tại; mỗi lần chuyển trang lấy đúng tập hồ sơ của trang đó theo thứ tự ưu tiên đã định.
- **FR-004**: Hệ thống MUST cung cấp chỉ báo "còn trang sau hay không" để vô hiệu nút Sau ở trang cuối. Hệ thống MUST hiển thị số trang HIỆN TẠI nhưng KHÔNG bắt buộc tính/hiển thị tổng số hồ sơ hay tổng số trang.
- **FR-005**: Hệ thống MUST sắp xếp hồ sơ theo các nhóm ưu tiên, theo thứ tự: (1) Chưa hoàn thành; (2) Hoàn thành và có người phụ trách; (3) Hoàn thành và có phát hành; (4) Hoàn thành bình thường (không người phụ trách, không phát hành).
- **FR-006**: Trong mỗi nhóm ưu tiên, hệ thống MUST sắp xếp theo ngày sửa giảm dần (mới nhất trước); hồ sơ thiếu ngày sửa xếp xuống cuối nhóm.
- **FR-007**: Hệ thống MUST coi một hồ sơ "Hoàn thành" có cả người phụ trách và phát hành thuộc đúng MỘT nhóm — nhóm có thứ tự ưu tiên cao hơn ("có người phụ trách").
- **FR-008**: Việc phân nhóm ưu tiên và phân trang MUST được tính trên TOÀN BỘ tập hồ sơ hợp lệ (đã lọc quyền và lọc danh mục), không phải chỉ trên dữ liệu của một trang.
- **FR-009**: Hệ thống MUST cung cấp bộ chọn Danh mục dạng collapse (thu gọn/mở rộng) hiển thị tối đa 2 cấp danh mục để người dùng chọn.
- **FR-010**: Khi người dùng chọn một danh mục, hệ thống MUST lọc (online, phía máy chủ) để trả về tất cả hồ sơ thuộc danh mục đó VÀ toàn bộ danh mục con cháu của nó (đệ quy mọi cấp).
- **FR-011**: Hệ thống MUST cho phép bỏ chọn danh mục (về "Tất cả") để trả lại toàn bộ hồ sơ người dùng được phép xem.
- **FR-012**: Khi bộ lọc Danh mục thay đổi, hệ thống MUST tính lại phân trang từ trang 1.
- **FR-013**: Hệ thống MUST tiếp tục áp các quy tắc hiển thị/quyền hiện có trước khi phân trang: ẩn Nháp với người không phải người tạo, và lọc theo quyền xem danh mục/hồ sơ với người dùng không thuộc vai trò miễn lọc.
- **FR-014**: Các bộ lọc còn lại ngoài Danh mục (từ khóa, tình trạng, dự án/phòng ban, nhà cung cấp, năm) MUST được áp tại client trên tập 100 hồ sơ của trang đang xem; hệ thống SHOULD thể hiện rõ phạm vi lọc là trong trang hiện tại.
- **FR-015**: Khi không có hồ sơ nào thỏa điều kiện, hệ thống MUST hiển thị trạng thái rỗng rõ ràng.
- **FR-016**: Khi bật bộ lọc "Công việc của tôi", hệ thống MUST chỉ hiển thị (trong phạm vi trang hiện tại) các hồ sơ thỏa ĐỒNG THỜI: (a) CHƯA hoàn thành (Tình trạng khác "Hoàn thành"); và (b) liên quan người đăng nhập — là Người tạo, HOẶC thuộc Phụ trách, HOẶC thuộc Người phối hợp. Quy tắc này áp dụng ĐỒNG NHẤT cho mọi vai trò (không còn xử lý riêng theo vai trò).

### Key Entities *(include if feature involves data)*

- **Hồ sơ**: Tài liệu trong hệ thống. Thuộc tính liên quan tính năng: Tình trạng (xác định "Hoàn thành" hay "Chưa hoàn thành"), Người phụ trách, dấu hiệu Đã phát hành (lịch sử phát hành khác rỗng), Danh mục (ID), Ngày sửa (ngày cập nhật), và các trường phục vụ hiển thị/lọc client (Tên, Số hồ sơ, Dự án, Nhà cung cấp, Ngày ban hành...).
- **Danh mục**: Mục phân loại hồ sơ, có quan hệ cha–con tạo thành cây nhiều cấp. Dùng để lọc; chọn một danh mục bao trùm toàn bộ cây con cháu của nó. Bộ chọn chỉ phơi bày 2 cấp.
- **Trang kết quả (Page)**: Một lát 100 hồ sơ liên tiếp của tập kết quả đã lọc + sắp xếp, kèm số trang hiện tại và chỉ báo còn trang sau (không kèm tổng số).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Danh sách hiển thị tối đa 100 hồ sơ mỗi trang trong mọi trường hợp, kể cả khi tổng số hồ sơ rất lớn.
- **SC-002**: Với tập dữ liệu có đủ các loại trạng thái, 100% hồ sơ trên trang tuân đúng thứ tự 4 nhóm ưu tiên và sắp theo ngày sửa trong mỗi nhóm.
- **SC-003**: Người dùng chuyển trang và xem được toàn bộ hồ sơ vượt 100 mà không có hồ sơ bị trùng hoặc bị sót giữa các trang.
- **SC-004**: Khi chọn một danh mục cha, kết quả bao gồm 100% hồ sơ thuộc mọi danh mục con cháu của nó (xác minh bằng tập dữ liệu mẫu có 3–4 cấp).
- **SC-005**: Thời gian tải một trang danh sách không tăng so với hiện trạng khi số hồ sơ tăng lớn (do chỉ tải 100 hồ sơ thay vì toàn bộ).
- **SC-006**: Người dùng hoàn thành thao tác "chọn danh mục → xem hồ sơ thuộc cây danh mục đó" trong dưới 15 giây.

## Assumptions

- "Chưa hoàn thành" = mọi trạng thái không phải "Hoàn thành" (và không phải "Nháp", vốn đã bị ẩn theo quyền). "Hoàn thành" là trạng thái đã chuẩn hóa hiện có của hệ thống.
- "Có người phụ trách" = trường Người phụ trách của hồ sơ khác rỗng. "Có phát hành" = hồ sơ có lịch sử phát hành khác rỗng.
- "Ngày sửa" = ngày cập nhật gần nhất của hồ sơ (trường hiện đang dùng để sắp xếp mới nhất trước).
- Kích thước trang cố định 100 hồ sơ (theo yêu cầu); chưa cần cho người dùng tự đổi kích thước trang.
- Quyết định đã chốt với người dùng: chỉ Danh mục được lọc online phía máy chủ; phân trang phía máy chủ; các bộ lọc còn lại áp client trên trang hiện tại.
- Quyết định đã chốt với người dùng: bộ chọn danh mục chỉ hiển thị 2 cấp; chọn 1 danh mục bao trùm toàn bộ con cháu chắt (đệ quy).
- Các quy tắc quyền xem hiện có (ẩn Nháp, lọc theo vai trò/quyền danh mục) được giữ nguyên và áp trước khi phân trang.
- Phạm vi: chỉ thay đổi cách hiển thị/lọc/phân trang danh sách hồ sơ; không thay đổi cấu trúc dữ liệu hồ sơ, luồng tạo/sửa/xóa, hay quy tắc phân quyền.
