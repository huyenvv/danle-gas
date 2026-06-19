# Feature Specification: In / Xuất danh mục hồ sơ ra Excel cho Văn thư

**Feature Branch**: `009-in-danh-muc-ho-so`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "docmgr: Bổ sung chức năng in danh mục hồ sơ cho \"Văn thư\". Admin, GĐ vẫn nhìn thấy. Ngoài ra ko ai nữa. Mục đích để xuất ra file excel các danh mục hồ sơ trong Folder được chọn, phục vụ cho lưu trữ của Văn thư, mẫu file xuất ra như sau. Chỉ có cột STT là tự động thêm mới vào thôi, còn lại là đều có trong dữ liệu hết rồi, chỉ là chọn lọc ra để xuất ra file xls thôi."

## Bối cảnh vấn đề

Văn thư cần định kỳ lập **mục lục hồ sơ** (danh sách các hồ sơ thuộc một danh mục/thư mục lưu trữ) để in ra và phục vụ công tác lưu trữ giấy tờ. Hiện docmgr đã có đầy đủ dữ liệu hồ sơ (số hồ sơ, tên hồ sơ, ngày ban hành, danh mục, nơi lưu hồ sơ cứng, ghi chú…) trong hệ thống, nhưng chưa có cách rút trích các thông tin đó ra một file Excel theo đúng biểu mẫu mục lục để lưu trữ.

Tính năng này bổ sung khả năng **chọn một thư mục/danh mục và xuất danh sách hồ sơ bên trong ra file Excel** theo biểu mẫu cố định. Mọi cột trong file xuất ra đều lấy từ dữ liệu sẵn có; chỉ có cột **STT** (số thứ tự) được hệ thống tự đánh số khi xuất.

Tính năng này chỉ dành cho **Văn thư**; **Quản trị viên (Admin)** và **Giám đốc (GĐ)** cũng nhìn thấy và dùng được; ngoài ba vai trò này không ai khác thấy chức năng.

## Clarifications

### Session 2026-06-19

- Q: Các dòng trong file mục lục được sắp theo tiêu chí nào (quyết định cách đánh STT)? → A: Theo **Số hồ sơ** tăng dần.
- Q: Định dạng cột "Ngày ban hành" trong file? → A: `yyyy-mm-dd HH:mm` (ví dụ 2026-06-19 14:30).
- Q: Nơi nhận file sau khi xuất? → A: Tải file về máy người dùng (download), không lưu bản sao vào Drive.
- Q: "Chính thức/đã phát hành" gồm trạng thái nào? → A (đã chỉnh 2026-06-19): Xuất **tất cả trạng thái trừ "Nháp"** (gồm Chờ duyệt, Chờ xử lý, Đang xử lý, Hoàn thành, Từ chối…). Chỉ loại bản nháp chưa trình.
- Q: Có cho xuất "tất cả danh mục" không? → A (2026-06-19): KHÔNG — **bắt buộc chọn đúng một danh mục** trước khi xuất.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Văn thư xuất mục lục hồ sơ của một thư mục ra Excel (Priority: P1)

Văn thư mở chức năng "In danh mục hồ sơ", chọn một thư mục/danh mục, và tải về một file Excel liệt kê tất cả hồ sơ thuộc thư mục đó (bao gồm cả các danh mục con bên trong) theo đúng biểu mẫu mục lục. File có một sheet tên **"Danh mục"**, cột STT được đánh số tự động từ 1; các cột còn lại lấy nguyên từ dữ liệu hồ sơ.

**Why this priority**: Đây là toàn bộ giá trị cốt lõi của tính năng — không có nó thì không có gì để dùng.

**Independent Test**: Đăng nhập bằng tài khoản Văn thư, chọn một thư mục có sẵn vài hồ sơ (kể cả ở danh mục con), bấm xuất → nhận được file Excel mở được, sheet tên "Danh mục", có đúng các hồ sơ thuộc thư mục đó và các danh mục con, cột STT đánh số liên tục 1..n, các cột dữ liệu khớp với dữ liệu hồ sơ.

**Acceptance Scenarios**:

1. **Given** một thư mục chứa nhiều hồ sơ (và có danh mục con cũng chứa hồ sơ), **When** Văn thư chọn thư mục đó và xuất, **Then** hệ thống tạo file Excel chứa tất cả hồ sơ thuộc thư mục được chọn và mọi danh mục con bên dưới, mỗi hồ sơ một dòng, sắp theo Số hồ sơ tăng dần, cột STT đánh số 1..n theo thứ tự đó.
2. **Given** file Excel vừa xuất, **When** mở file, **Then** sheet duy nhất tên "Danh mục", các cột theo đúng thứ tự quy định và các giá trị (ngoài STT) hiển thị đúng dữ liệu đang lưu của từng hồ sơ.
3. **Given** một thư mục không có hồ sơ nào (kể cả danh mục con), **When** Văn thư xuất, **Then** hệ thống thông báo "không có hồ sơ để xuất" và không tạo file.

---

### User Story 2 - Chỉ Văn thư, Admin, Giám đốc thấy và dùng được chức năng (Priority: P1)

Chức năng "In danh mục hồ sơ" chỉ hiển thị và cho phép thao tác với ba vai trò: Văn thư, Quản trị viên (Admin), Giám đốc. Mọi vai trò khác (Nhân viên, Trưởng phòng, Phó phòng/Người phụ trách, Phó GĐ…) không nhìn thấy chức năng và không thể gọi xuất.

**Why this priority**: Yêu cầu phân quyền là ràng buộc bắt buộc của nghiệp vụ; nếu sai thì dữ liệu lưu trữ bị lộ cho người không có thẩm quyền.

**Independent Test**: Đăng nhập lần lượt bằng từng vai trò: Văn thư/Admin/GĐ → thấy và dùng được; các vai trò còn lại → không thấy chức năng, và nếu gọi trực tiếp tới chức năng xuất thì bị từ chối.

**Acceptance Scenarios**:

1. **Given** người dùng có vai trò Văn thư, Admin, hoặc Giám đốc, **When** mở ứng dụng, **Then** chức năng "In danh mục hồ sơ" hiển thị và sử dụng được.
2. **Given** người dùng có vai trò khác ba vai trò trên, **When** mở ứng dụng, **Then** không nhìn thấy chức năng "In danh mục hồ sơ".
3. **Given** người dùng không có thẩm quyền cố gọi trực tiếp thao tác xuất (bỏ qua giao diện), **When** yêu cầu được xử lý, **Then** hệ thống từ chối với thông báo không đủ quyền.

---

### Edge Cases

- **Thư mục không có hồ sơ** (kể cả danh mục con): hệ thống báo rõ "không có hồ sơ để xuất" và không tạo file.
- **Hồ sơ "Nháp"**: KHÔNG đưa vào mục lục. Mọi trạng thái khác (Chờ duyệt, Chờ xử lý, Đang xử lý, Hoàn thành, Từ chối…) đều được xuất.
- **Danh mục con nhiều cấp**: gộp đệ quy toàn bộ hồ sơ ở mọi cấp con bên dưới thư mục được chọn.
- **Chưa chọn danh mục**: nút xuất bị vô hiệu; nếu vẫn gọi, hệ thống báo "Vui lòng chọn danh mục" và không tạo file.
- **Giá trị rỗng ở một số cột** (ví dụ hồ sơ chưa có ghi chú): ô tương ứng trong Excel để trống, không làm hỏng dòng hay lệch cột.
- **Số lượng hồ sơ lớn**: xuất được file mà không vượt giới hạn xử lý của hệ thống (cảnh báo hoặc giới hạn rõ ràng nếu vượt ngưỡng).
- **Ký tự đặc biệt / tiếng Việt có dấu** trong dữ liệu: hiển thị đúng trong file Excel, không bị lỗi mã hoá.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST cung cấp một chức năng cho phép người dùng đủ quyền chọn **đúng một** danh mục và xuất danh sách hồ sơ thuộc danh mục đó ra một file Excel.
- **FR-001a**: Việc chọn danh mục là **bắt buộc**. Không có tùy chọn "tất cả danh mục"; khi chưa chọn danh mục, hệ thống MUST không cho xuất (vô hiệu hành động và/hoặc báo lỗi rõ ràng).
- **FR-002**: Chức năng MUST chỉ hiển thị và cho phép sử dụng với ba vai trò: **Văn thư**, **Quản trị viên (Admin)**, **Giám đốc**. Mọi vai trò khác MUST không nhìn thấy và MUST bị từ chối nếu cố gọi thao tác xuất.
- **FR-003**: File Excel xuất ra MUST có đúng các cột sau theo đúng thứ tự: **STT, Số hồ sơ, Tên hồ sơ, Ngày ban hành, Ghi chú, Danh mục, Nơi lưu hồ sơ cứng**. Cột **Ngày ban hành** MUST hiển thị theo định dạng `yyyy-mm-dd HH:mm`.
- **FR-004**: Các dòng MUST được sắp xếp theo **Số hồ sơ** tăng dần. Cột **STT** MUST do hệ thống tự đánh số tăng dần từ 1 theo thứ tự đã sắp; mọi cột còn lại MUST lấy giá trị trực tiếp từ dữ liệu hồ sơ đang lưu, không tự sinh hay biến đổi; ô không có dữ liệu thì để trống.
- **FR-005**: Hệ thống MUST đưa vào file mọi hồ sơ thuộc thư mục được chọn **và tất cả danh mục con** bên dưới nó (đệ quy).
- **FR-006**: Hệ thống MUST xuất các hồ sơ ở **mọi trạng thái trừ "Nháp"**; hồ sơ có Tình trạng = "Nháp" KHÔNG được đưa vào file.
- **FR-007**: File xuất ra MUST chứa một sheet tên **"Danh mục"** và MUST mở được bằng phần mềm bảng tính phổ thông, hiển thị đúng tiếng Việt có dấu.
- **FR-008**: Khi thư mục được chọn (gồm danh mục con) không có hồ sơ hợp lệ nào, hệ thống MUST thông báo rõ ràng và không tạo file.

### Key Entities *(include if feature involves data)*

- **Hồ sơ (Document)**: đơn vị nghiệp vụ thuộc một danh mục, mang các thuộc tính sẵn có (số hồ sơ, tên hồ sơ, ngày ban hành, danh mục, nơi lưu hồ sơ cứng, ghi chú, tình trạng…). Là nguồn dữ liệu cho mọi cột trừ STT.
- **Thư mục / Danh mục (Folder/Category)**: phạm vi lọc để xuất; cây danh mục có thể nhiều cấp; xác định tập hợp hồ sơ (đệ quy theo danh mục con) đưa vào file.
- **File mục lục Excel (Export file)**: kết quả đầu ra; một sheet tên "Danh mục"; mỗi dòng là một hồ sơ; cột STT do hệ thống đánh số, các cột còn lại ánh xạ từ thuộc tính hồ sơ theo thứ tự cố định.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Văn thư có thể chọn một thư mục và nhận file Excel mục lục hoàn chỉnh trong vòng dưới 1 phút cho thư mục có tới vài trăm hồ sơ.
- **SC-002**: 100% hồ sơ không phải "Nháp" thuộc thư mục được chọn và các danh mục con xuất hiện trong file (không thiếu, không thừa hồ sơ của thư mục khác; không lẫn hồ sơ Nháp).
- **SC-003**: Cột STT luôn liên tục 1..n không trùng, không nhảy cóc; mọi cột dữ liệu khớp đúng với giá trị đang lưu của hồ sơ trong 100% dòng kiểm tra.
- **SC-004**: Chỉ ba vai trò (Văn thư, Admin, Giám đốc) thực hiện được thao tác xuất; mọi vai trò khác bị chặn ở cả giao diện lẫn khi gọi trực tiếp — kiểm chứng được bằng kiểm thử cho từng vai trò.
- **SC-005**: File xuất ra có sheet tên "Danh mục", mở được và hiển thị đúng tiếng Việt có dấu trên phần mềm bảng tính phổ thông trong 100% lần kiểm tra.

## Assumptions

- "Folder được chọn" được hiểu là một **danh mục** trong docmgr (cây danh mục phản chiếu cây thư mục Drive); người dùng chọn danh mục để xác định tập hồ sơ cần xuất, gồm cả các danh mục con (đệ quy).
- Xuất các hồ sơ ở **mọi trạng thái trừ "Nháp"**.
- File đầu ra được người dùng **tải về** (download) từ ứng dụng; không tự lưu thêm bản sao vào Drive (có thể điều chỉnh sau nếu Văn thư muốn lưu vào thư mục lưu trữ).
- Định dạng đầu ra là Excel (.xlsx) mở được bằng Microsoft Excel / Google Sheets, có một sheet tên "Danh mục".
- Cột "Danh mục" trong file ghi tên danh mục của từng hồ sơ (vì có thể gộp nhiều danh mục con), giúp phân biệt hồ sơ thuộc danh mục con nào.
- Tên ba vai trò khớp với hệ thống hiện tại: **Văn thư**, **Quản trị viên (Admin)**, **Giám đốc**. "Ngoài ra không ai nữa" hiểu theo nghĩa hẹp: **không bao gồm** Phó GĐ, Trưởng phòng, Phó phòng/Người phụ trách, Nhân viên.
- Dữ liệu mọi cột (trừ STT) đã tồn tại trong dữ liệu hồ sơ; tính năng chỉ chọn lọc và định dạng, không bổ sung trường dữ liệu mới.
