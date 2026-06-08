# Feature Specification: Bulk Import Data

**Feature Branch**: `004-bulk-import-data`

**Created**: 2026-06-06

**Status**: Draft

**Input**: User description: "Import dữ liệu hàng loạt vào docmgr từ file Excel đã được tạo bởi app ngoài. File Excel chứa thông tin các file đã upload sẵn lên Drive (STT, tên file, file ID). Nhiều file có thể thuộc chung 1 document, nhóm theo cột tên document."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import hàng loạt documents từ file Excel (Priority: P1)

Người dùng (Văn thư) đã upload sẵn nhiều file lên Google Drive bằng app ngoài và có một file Excel chứa danh sách các file. Họ muốn import file Excel này vào docmgr để hệ thống tự động tạo các document tương ứng và liên kết đến các file đã có trên Drive, thay vì phải tạo từng document và upload từng file một cách thủ công.

**Why this priority**: Đây là tính năng cốt lõi — không có nó thì người dùng phải tạo hàng trăm document bằng tay, rất tốn thời gian.

**Independent Test**: Có thể test bằng cách chuẩn bị file Excel mẫu với 5-10 file thuộc 3-4 document, import và kiểm tra các document được tạo đúng với file liên kết chính xác.

**Acceptance Scenarios**:

1. **Given** người dùng có file Excel hợp lệ chứa 10 dòng thuộc 4 document, **When** họ upload file Excel và nhấn Import, **Then** hệ thống tạo 4 document mới, mỗi document chứa đúng các file được nhóm theo cột tên document.
2. **Given** file Excel có 2 dòng cùng tên document "Hợp đồng ABC", **When** import xong, **Then** hệ thống tạo 1 document "Hợp đồng ABC" chứa 2 file.
3. **Given** file Excel chứa file ID không tồn tại trên Drive, **When** import, **Then** hệ thống báo lỗi cụ thể cho dòng đó và tiếp tục xử lý các dòng hợp lệ còn lại.

---

### User Story 2 - Xem trước và xác nhận trước khi import (Priority: P2)

Trước khi thực sự tạo documents, người dùng muốn xem preview danh sách documents sẽ được tạo (gồm tên document, số file, danh mục) để kiểm tra và xác nhận.

**Why this priority**: Giảm rủi ro import sai dữ liệu. Người dùng cần cơ hội review trước khi commit vào hệ thống.

**Independent Test**: Upload file Excel → xem bảng preview hiển thị đúng số document, số file mỗi document, danh mục → có thể hủy hoặc xác nhận.

**Acceptance Scenarios**:

1. **Given** người dùng upload file Excel hợp lệ, **When** hệ thống phân tích xong, **Then** hiển thị bảng preview gồm: tên document, số file, danh mục, và các lỗi (nếu có).
2. **Given** preview hiển thị có 2 dòng lỗi (file ID không hợp lệ), **When** người dùng nhấn "Import", **Then** hệ thống chỉ import các dòng hợp lệ và bỏ qua dòng lỗi.
3. **Given** người dùng thấy preview không đúng, **When** nhấn "Hủy", **Then** không có document nào được tạo.

---

### User Story 3 - Xem kết quả import (Priority: P3)

Sau khi import xong, người dùng muốn biết kết quả: bao nhiêu document tạo thành công, bao nhiêu lỗi, chi tiết lỗi ở dòng nào.

**Why this priority**: Cần để người dùng biết chắc dữ liệu đã vào hệ thống đúng và xử lý các trường hợp lỗi.

**Independent Test**: Import file Excel có mix dòng hợp lệ và không hợp lệ → xem báo cáo kết quả hiển thị đầy đủ thông tin.

**Acceptance Scenarios**:

1. **Given** import 10 dòng trong đó 8 hợp lệ và 2 lỗi, **When** import hoàn tất, **Then** hiển thị: "Đã tạo 3 hồ sơ (8 file). 2 dòng lỗi." kèm chi tiết lỗi từng dòng.

---

### Edge Cases

- File Excel rỗng (không có dòng dữ liệu) → thông báo lỗi rõ ràng
- File Excel có dòng thiếu cột bắt buộc (tên document, file ID) → báo lỗi dòng đó, tiếp tục xử lý dòng khác
- File ID trùng lặp trong Excel (cùng file ID xuất hiện nhiều lần) → cảnh báo và bỏ qua bản trùng
- Tên document trùng với document đã tồn tại trong hệ thống → tạo document mới (không merge vào document cũ)
- File Excel quá lớn (hàng nghìn dòng) → xử lý giới hạn hợp lý, thông báo nếu vượt quá
- Cột danh mục không khớp với danh mục có sẵn trong hệ thống → báo lỗi dòng đó

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI cho phép người dùng upload file Excel (.xlsx) chứa danh sách file đã upload sẵn trên Drive
- **FR-002**: Hệ thống PHẢI đọc và parse file Excel với các cột: Tên hồ sơ (tên document), Tên file, File ID, Danh mục [NEEDS CLARIFICATION: Ngoài các cột trên, bạn cần thêm cột nào khác trong Excel? Ví dụ: Số hồ sơ, Ngày ban hành, Ngày kết thúc, Dự án, Nhà cung cấp, Ghi chú?]
- **FR-003**: Hệ thống PHẢI nhóm các dòng có cùng "Tên hồ sơ" thành một document, gom các file vào mảng File ID của document đó
- **FR-004**: Hệ thống PHẢI validate từng dòng: kiểm tra file ID tồn tại trên Drive, kiểm tra danh mục hợp lệ, kiểm tra các cột bắt buộc có giá trị
- **FR-005**: Hệ thống PHẢI hiển thị preview kết quả phân tích trước khi import, cho phép người dùng xác nhận hoặc hủy
- **FR-006**: Hệ thống PHẢI tạo document với trạng thái ban đầu phù hợp cho dữ liệu lịch sử [NEEDS CLARIFICATION: Documents import vào nên ở trạng thái nào? "Hoàn thành" (vì là dữ liệu cũ đã xử lý xong) hay "Nháp" (để review lại trước)?]
- **FR-007**: Hệ thống PHẢI xử lý từng phần — nếu một số dòng lỗi, các dòng hợp lệ vẫn được import
- **FR-008**: Hệ thống PHẢI hiển thị báo cáo kết quả sau import: số document tạo, số file liên kết, danh sách lỗi chi tiết
- **FR-009**: Hệ thống PHẢI ghi nhận người thực hiện import (Người tạo, Ngày cập nhật) cho mỗi document được tạo
- **FR-010**: Chỉ người dùng có quyền phù hợp (Văn thư, Quản trị) mới được sử dụng tính năng import [NEEDS CLARIFICATION: Những role nào được phép import? Chỉ Văn thư và Quản trị, hay tất cả role đều được?]

### Key Entities

- **Import Batch**: Một lần import từ một file Excel — chứa danh sách documents cần tạo và trạng thái import (pending, completed, partial)
- **Import Row**: Một dòng trong file Excel — ánh xạ đến một file trên Drive, thuộc một document (nhóm theo Tên hồ sơ)
- **Document (Hồ sơ)**: Bản ghi trong sheet HO_SO — được tạo mới từ import, chứa mảng file IDs
- **File Reference**: Thông tin file trên Drive (fileId, fileName, mimeType, size) — lấy metadata từ Drive dựa trên file ID trong Excel

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Người dùng có thể import 100 file (thuộc 30 documents) trong dưới 5 phút, thay vì phải tạo thủ công từng cái
- **SC-002**: 100% documents được tạo có liên kết file chính xác — mỗi file mở được đúng từ document
- **SC-003**: Người dùng nhận diện được lỗi trước khi import thông qua preview — không có trường hợp import xong mới phát hiện sai
- **SC-004**: Giảm thời gian nhập liệu dữ liệu cũ từ hàng giờ xuống vài phút cho mỗi đợt import

## Assumptions

- File đã được upload sẵn lên Google Drive đúng cấu trúc thư mục trước khi import (bằng app ngoài)
- File Excel được tạo bởi app ngoài của người dùng, có format cố định và nhất quán
- Import không di chuyển file trên Drive — chỉ tạo document record và liên kết đến file ID có sẵn
- Một file chỉ thuộc một document (không chia sẻ file giữa nhiều documents)
- Kích thước file Excel hợp lý (dưới 1000 dòng mỗi lần import)
- Hệ thống SSO và phân quyền hiện tại được tái sử dụng — không cần auth mới
