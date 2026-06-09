# Feature Specification: Chọn file đính kèm từ Google Drive của tài khoản deploy

**Feature Branch**: `006-drive-file-picker`

**Created**: 2026-06-09

**Status**: Draft

**Input**: User description: "Phần upload file sẽ có thêm option chọn từ chính google drive của người deploy app. Chọn được toàn bộ file trên toàn bộ G drive, ko giới hạn bởi cài đặt của app. Khi được chọn upload thì sẽ copy nó qua đúng danh mục của document hiện tại. Admin và Văn thư sẽ mặc định chọn được 2 option này. Có thêm phân quyền cho việc này. Ai được tích quyền sẽ có thêm option này. Nếu ai ko có quyền thì mặc định vẫn như cũ, chọn cái open luôn dialog của OS chọn file."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Đính kèm file từ Drive của tài khoản deploy (Priority: P1)

Một người dùng có quyền (ví dụ Văn thư) đang tạo hoặc chỉnh sửa một hồ sơ tài liệu. Khi cần đính kèm file, ngoài nút "Chọn từ máy" (mở hộp thoại file của hệ điều hành) đã có, họ thấy thêm tùy chọn "Chọn từ Google Drive". Họ mở trình duyệt Drive, chọn một (hoặc nhiều) file bất kỳ trong toàn bộ Google Drive của tài khoản dùng để deploy app, không bị giới hạn bởi cấu hình thư mục của app. Sau khi chọn, hệ thống sao chép các file đó vào đúng thư mục danh mục của hồ sơ hiện tại và đính kèm chúng như file upload thông thường.

**Why this priority**: Đây là giá trị cốt lõi của tính năng — cho phép tái sử dụng tài liệu đã có sẵn trên Drive tổ chức mà không phải tải xuống máy rồi upload lại. Nếu chỉ làm story này thì đã có một MVP dùng được.

**Independent Test**: Đăng nhập bằng một tài khoản có quyền, mở form tạo hồ sơ trong một danh mục bất kỳ, chọn "Chọn từ Google Drive", chọn một file nằm ngoài các thư mục của app, xác nhận. Kiểm tra file được sao chép vào thư mục danh mục của hồ sơ và xuất hiện trong danh sách đính kèm. Bản gốc trên Drive vẫn còn nguyên.

**Acceptance Scenarios**:

1. **Given** người dùng có quyền đang ở form tạo/sửa hồ sơ thuộc danh mục X, **When** họ chọn "Chọn từ Google Drive" và chọn một file bất kỳ trong Drive của tài khoản deploy, **Then** file được sao chép vào thư mục của danh mục X và hiển thị trong danh sách file đính kèm của hồ sơ.
2. **Given** file được chọn nằm ngoài mọi thư mục mà app quản lý, **When** người dùng xác nhận chọn, **Then** hệ thống vẫn cho phép chọn và sao chép file đó (không bị giới hạn bởi cấu hình thư mục của app).
3. **Given** một file đã được chọn từ Drive và sao chép thành công, **When** kiểm tra Drive gốc, **Then** file gốc vẫn tồn tại nguyên vẹn (đây là thao tác sao chép, không phải di chuyển).
4. **Given** người dùng chọn nhiều file cùng lúc từ Drive, **When** xác nhận, **Then** tất cả file được sao chép vào thư mục danh mục và đính kèm vào hồ sơ.

---

### User Story 2 - Phân quyền sử dụng tùy chọn chọn từ Drive (Priority: P1)

Người quản trị cấu hình quyền cho từng người dùng. Có một mục phân quyền mới (tương tự các quyền "Được tạo hồ sơ", "Được phát hành") để bật/tắt khả năng "Chọn từ Google Drive". Admin và Văn thư luôn có quyền này theo mặc định (không cần tích, không thể bỏ tích). Người dùng khác chỉ có tùy chọn này khi được tích quyền.

**Why this priority**: Tính năng cho phép truy cập toàn bộ Drive của tài khoản deploy — một phạm vi rộng và nhạy cảm — nên phải đi kèm cơ chế kiểm soát quyền. Quyền và tính năng phải ra cùng nhau, vì vậy cũng là P1.

**Independent Test**: Với một tài khoản không phải Admin/Văn thư và chưa được tích quyền, mở form hồ sơ và xác nhận KHÔNG thấy tùy chọn "Chọn từ Google Drive". Tích quyền cho tài khoản đó trong phần quản lý người dùng, đăng nhập lại, xác nhận tùy chọn xuất hiện.

**Acceptance Scenarios**:

1. **Given** một người dùng là Admin hoặc Văn thư, **When** họ mở form đính kèm file, **Then** tùy chọn "Chọn từ Google Drive" luôn hiển thị mà không cần cấu hình thêm.
2. **Given** một người dùng không thuộc nhóm mặc định và chưa được tích quyền, **When** họ mở form đính kèm file, **Then** họ chỉ thấy tùy chọn "Chọn từ máy" (hộp thoại file của hệ điều hành) như cũ.
3. **Given** quản trị viên cấu hình quyền cho người dùng, **When** màn hình hiển thị các quyền của một Admin/Văn thư, **Then** ô tích quyền "Chọn từ Google Drive" hiển thị là đã bật và không cho chỉnh sửa.
4. **Given** một người dùng thường vừa được tích quyền "Chọn từ Google Drive", **When** họ mở lại form đính kèm file, **Then** tùy chọn "Chọn từ Google Drive" xuất hiện bên cạnh tùy chọn chọn từ máy.
5. **Given** quyền của người dùng bị thu hồi (bỏ tích), **When** người dùng thực hiện thao tác chọn từ Drive sau đó, **Then** hệ thống từ chối thao tác (kiểm tra quyền lại ở phía máy chủ, không chỉ ẩn nút).

---

### User Story 3 - Giữ nguyên hành vi cũ cho người không có quyền (Priority: P2)

Người dùng không có quyền tiếp tục đính kèm file đúng như hiện tại: bấm chọn file sẽ mở thẳng hộp thoại file của hệ điều hành, không có bước chọn loại nguồn. Trải nghiệm hiện hữu không thay đổi với họ.

**Why this priority**: Đảm bảo không gây xáo trộn cho đa số người dùng hiện tại; là ràng buộc về tính tương thích ngược hơn là tính năng mới, nên P2.

**Independent Test**: Với tài khoản không có quyền, bấm nút đính kèm file và xác nhận hộp thoại file của hệ điều hành mở ra ngay, không có menu chọn nguồn trung gian.

**Acceptance Scenarios**:

1. **Given** người dùng không có quyền "Chọn từ Google Drive", **When** họ bấm nút đính kèm file, **Then** hộp thoại chọn file của hệ điều hành mở ra trực tiếp như hành vi hiện tại.
2. **Given** người dùng không có quyền, **When** họ tương tác với khu vực đính kèm file, **Then** không có bất kỳ thành phần giao diện nào liên quan đến Google Drive xuất hiện.

---

### Edge Cases

- File được chọn trên Drive bị xóa, mất quyền truy cập, hoặc nằm trong thùng rác giữa lúc chọn và lúc sao chép → hệ thống báo lỗi rõ ràng cho file đó và không làm hỏng các file khác trong cùng lượt chọn.
- Người dùng chọn một thư mục (folder) thay vì file trên Drive → hệ thống chỉ xử lý file; cần xác định cách hành xử với thư mục (xem Assumptions).
- File trên Drive là Google-native (Docs/Sheets/Slides) thay vì file nhị phân → cần xác định cách sao chép (xem Assumptions).
- File rất lớn vượt giới hạn dung lượng đính kèm hiện hành của app → áp dụng cùng giới hạn như upload thường, báo lỗi nếu vượt.
- Hồ sơ chưa được lưu (chưa có danh mục/thư mục đích) tại thời điểm chọn từ Drive → áp dụng cùng cơ chế tạo nháp/đích như luồng upload eager hiện có.
- Quyền bị thu hồi ngay trước khi xác nhận → máy chủ kiểm tra lại quyền và từ chối nếu không còn quyền.
- Trùng tên file với file đã đính kèm trong hồ sơ → áp dụng cùng quy tắc khử trùng tên như upload thường.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Khu vực đính kèm file của form tạo/sửa hồ sơ MUST cung cấp thêm tùy chọn "Chọn từ Google Drive" cho người dùng có quyền, song song với tùy chọn chọn file từ máy đã có.
- **FR-002**: Tùy chọn "Chọn từ Google Drive" MUST cho phép duyệt và chọn file trên toàn bộ Google Drive của tài khoản dùng để deploy app, KHÔNG bị giới hạn bởi cấu hình thư mục nội bộ của app.
- **FR-003**: Người dùng MUST chọn được một hoặc nhiều file trong một lượt chọn.
- **FR-004**: Khi người dùng xác nhận chọn, hệ thống MUST sao chép (copy) mỗi file đã chọn vào đúng thư mục tương ứng với danh mục của hồ sơ hiện tại.
- **FR-005**: Thao tác sao chép MUST giữ nguyên file gốc trên Drive (không di chuyển, không xóa bản gốc).
- **FR-006**: File được sao chép MUST được đính kèm vào hồ sơ và hiển thị trong danh sách file đính kèm giống như file upload từ máy.
- **FR-007**: Hệ thống MUST có một mục phân quyền mới (ví dụ "Được chọn từ Drive") lưu cùng nơi với các quyền hiện có của người dùng, độc lập với ma trận quyền CRUD.
- **FR-008**: Các vai trò Admin và Văn thư MUST mặc định có quyền sử dụng tùy chọn "Chọn từ Google Drive"; ô tích quyền của họ hiển thị đã bật và không cho chỉnh sửa.
- **FR-009**: Người dùng được tích quyền MUST thấy tùy chọn "Chọn từ Google Drive"; người dùng không có quyền MUST KHÔNG thấy tùy chọn này.
- **FR-010**: Với người dùng không có quyền, thao tác đính kèm file MUST giữ nguyên hành vi hiện tại — mở thẳng hộp thoại chọn file của hệ điều hành, không có bước chọn nguồn.
- **FR-011**: Hệ thống MUST kiểm tra lại quyền "Chọn từ Drive" ở phía máy chủ tại thời điểm thực hiện thao tác sao chép, không chỉ dựa vào việc ẩn/hiện nút ở giao diện.
- **FR-012**: Quản trị viên MUST cấu hình được (bật/tắt) quyền "Chọn từ Drive" cho từng người dùng trong màn hình quản lý người dùng.
- **FR-013**: Khi một file trong lượt chọn không sao chép được (bị xóa, mất quyền, lỗi), hệ thống MUST báo lỗi cụ thể cho file đó mà không làm hỏng việc đính kèm các file còn lại.
- **FR-014**: File sao chép từ Drive MUST tuân theo cùng các ràng buộc đang áp dụng cho file upload thường (giới hạn dung lượng, quy tắc khử trùng tên, gắn vào hồ sơ nháp nếu hồ sơ chưa lưu).

### Key Entities *(include if feature involves data)*

- **Quyền "Chọn từ Drive"**: Một cờ phân quyền theo từng người dùng, bật/tắt khả năng dùng tùy chọn chọn file từ Google Drive. Mặc định bật cho Admin và Văn thư. Lưu cùng tập quyền của người dùng, độc lập với ma trận CRUD.
- **File nguồn trên Drive**: Một file thuộc Google Drive của tài khoản deploy, được người dùng chọn làm nguồn. Có định danh, tên, loại, dung lượng. Không bị giới hạn bởi cấu trúc thư mục của app.
- **File đính kèm hồ sơ**: Bản sao của file nguồn, nằm trong thư mục của danh mục hồ sơ và gắn với hồ sơ — giống về bản chất với file được upload từ máy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Người dùng có quyền có thể đính kèm một file từ Drive của tài khoản deploy vào hồ sơ trong vòng dưới 30 giây kể từ khi mở trình duyệt Drive (không tính thời gian tải file lớn).
- **SC-002**: 100% file được đính kèm qua tùy chọn này nằm đúng trong thư mục của danh mục hồ sơ hiện tại.
- **SC-003**: 100% file gốc trên Drive vẫn nguyên vẹn sau thao tác (không có trường hợp file gốc bị di chuyển hoặc mất).
- **SC-004**: Người dùng không có quyền không nhìn thấy bất kỳ thành phần giao diện Drive nào và trải nghiệm đính kèm file của họ không thay đổi so với trước (mở thẳng hộp thoại OS).
- **SC-005**: Admin và Văn thư thấy tùy chọn Drive ngay mà không cần bất kỳ cấu hình bổ sung nào.
- **SC-006**: Thao tác chọn từ Drive bị máy chủ từ chối trong 100% trường hợp người thực hiện không có quyền (kể cả khi cố gắng vượt qua giao diện).

## Assumptions

- **Phạm vi Drive**: "Google Drive của người deploy app" được hiểu là Drive của tài khoản mà app chạy dưới danh nghĩa (chủ sở hữu/deployer), không phải Drive cá nhân của người dùng cuối đang đăng nhập. App truy cập toàn bộ Drive này qua phía máy chủ (chạy as owner), tái dùng pattern `api_browseDriveFolders`/`FolderPicker` đã có.
- **Sao chép, không di chuyển**: Hành vi mặc định là tạo bản sao trong thư mục danh mục; file gốc giữ nguyên vị trí và quyền.
- **File Google-native** *(đã chốt)*: File Docs/Sheets/Slides được sao chép giữ nguyên dạng Google-native (makeCopy ra bản sao native), không export sang PDF.
- **Vai trò mặc định bật quyền** *(đã chốt)*: Cả nhóm full-access — admin, Quản trị viên, Giám đốc, Văn thư — mặc định bật quyền "Chọn từ Drive" (nhất quán với `isAdminOrVanThu`/canPublish hiện có), không cần tích và không sửa được. Yêu cầu gốc nêu "Admin và Văn thư" được mở rộng cho đồng nhất với các quyền hiện hữu.
- **UX picker** *(đã chốt)*: Duyệt thư mục theo từng cấp từ My Drive (mở rộng `FolderPicker`), liệt kê file trong thư mục hiện tại, cho chọn nhiều file một lượt. Không có tìm kiếm toàn Drive trong v1.
- **Chọn thư mục**: Người dùng chọn file, không chọn cả thư mục để sao chép đệ quy (out of scope v1).
- **Tái dùng luồng đính kèm hiện có**: File từ Drive đi qua cùng cơ chế đính kèm/hồ sơ nháp (`_attachFileToDraft`) như upload thường (xử lý hồ sơ chưa lưu, khử trùng tên).
- **Vị trí lưu quyền**: Cờ quyền mới lưu trong sheet `_Phân Quyền` (APP_ROLES) cùng nơi với "Được tạo hồ sơ"/"Được phát hành", máy chủ đọc lại mỗi lần thao tác (không cache theo phiên).
- **Nhãn quyền**: Cột "Được chọn từ Drive" trong APP_ROLES; field session `canPickDrive`.
- **Một danh mục đích duy nhất**: Mỗi hồ sơ thuộc đúng một danh mục tại thời điểm đính kèm, nên đích sao chép là xác định.
