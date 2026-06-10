# Feature Specification: Đảm bảo mỗi file Drive chỉ thuộc một hồ sơ

**Feature Branch**: `007-file-ownership-index`

**Created**: 2026-06-10

**Status**: Draft

**Input**: User description: "Đảm bảo bất biến 1 file Drive chỉ thuộc 1 hồ sơ để việc move file theo danh mục luôn an toàn, qua một bảng index và quy tắc chỉ-link-file-orphaned."

## Bối cảnh vấn đề

Trong docmgr, mỗi hồ sơ có một **Danh mục**, và các file đính kèm được lưu trong thư mục Drive phản chiếu đúng cây danh mục. Khi người dùng đổi danh mục của hồ sơ, các file đính kèm được **di chuyển** sang thư mục danh mục mới.

Hiện trạng có hai lỗ hổng:

1. **Di chuyển thất bại nhưng vẫn lưu thay đổi**: nếu di chuyển file không thành công, hồ sơ vẫn đổi danh mục — dẫn đến danh mục của hồ sơ và vị trí thực của file bị lệch nhau, không có cảnh báo.
2. **Một file dùng chung nhiều hồ sơ**: cùng một file Drive có thể được liên kết (hoặc import) vào nhiều hồ sơ thuộc các danh mục khác nhau. Khi một hồ sơ đổi danh mục và kéo file đi theo, các hồ sơ còn lại trỏ tới file ở sai vị trí.

Tính năng này thiết lập bất biến **"mỗi file Drive chỉ thuộc đúng một hồ sơ"** và làm cho thao tác đổi danh mục trở nên an toàn hoặc thất bại rõ ràng.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Đổi danh mục không bao giờ để lại trạng thái lệch (Priority: P1)

Người phụ trách mở một hồ sơ đã có file đính kèm và đổi danh mục của nó. Hệ thống di chuyển file sang đúng thư mục danh mục mới. Nếu vì lý do nào đó file bắt buộc không thể di chuyển, hệ thống **không** lưu việc đổi danh mục và báo lỗi rõ ràng, thay vì âm thầm để hồ sơ và file lệch nhau.

**Why this priority**: Đây là vấn đề "vô lý" gốc mà người dùng nêu — dữ liệu lệch âm thầm là rủi ro nghiêm trọng nhất và phá vỡ niềm tin vào hệ thống.

**Independent Test**: Tạo hồ sơ có file, đổi danh mục: (a) khi di chuyển được → file nằm ở thư mục mới và hồ sơ mang danh mục mới; (b) khi di chuyển thất bại → hồ sơ vẫn giữ danh mục cũ, file vẫn ở chỗ cũ, người dùng nhận thông báo lỗi.

**Acceptance Scenarios**:

1. **Given** một hồ sơ có file đính kèm, **When** người dùng đổi sang danh mục khác và việc di chuyển file thành công, **Then** file nằm trong thư mục của danh mục mới và hồ sơ mang danh mục mới.
2. **Given** một hồ sơ có file đính kèm mà file không thể di chuyển được, **When** người dùng đổi danh mục, **Then** thao tác cập nhật thất bại với thông báo lỗi và hồ sơ giữ nguyên danh mục cũ (không lưu một phần).
3. **Given** một hồ sơ nháp đổi danh mục trước khi hoàn tất, **When** hoàn tất hồ sơ, **Then** áp dụng cùng quy tắc di chuyển an toàn / thất bại rõ ràng.

---

### User Story 2 - Không thể gắn một file vào hai hồ sơ (Priority: P1)

Khi người dùng liên kết một file Drive có sẵn vào hồ sơ, hệ thống chỉ cho phép nếu file đó **chưa thuộc** hồ sơ nào khác. Nếu file đã được hồ sơ khác sử dụng, hệ thống từ chối liên kết và giải thích lý do.

**Why this priority**: Đây là bất biến nền tảng khiến thao tác di chuyển ở Story 1 luôn an toàn. Không có nó, việc di chuyển file vẫn có thể phá vỡ hồ sơ khác.

**Independent Test**: Liên kết một file orphaned (chưa thuộc hồ sơ nào) → thành công. Thử liên kết một file đang thuộc hồ sơ khác → bị từ chối với thông báo rõ ràng.

**Acceptance Scenarios**:

1. **Given** một file Drive chưa thuộc hồ sơ nào, **When** người dùng liên kết nó vào hồ sơ, **Then** liên kết thành công.
2. **Given** một file Drive đang thuộc hồ sơ A, **When** người dùng cố liên kết nó vào hồ sơ B, **Then** hệ thống từ chối và báo "file đã thuộc hồ sơ khác".
3. **Given** một file đang thuộc chính hồ sơ nháp đang thao tác, **When** người dùng liên kết lại file đó vào cùng hồ sơ, **Then** không bị coi là xung đột.

---

### User Story 3 - Import bỏ qua file đã dùng và cảnh báo (Priority: P2)

Khi nhập hồ sơ hàng loạt từ file Excel/Google Sheet, nếu một dòng trỏ tới file đã thuộc hồ sơ khác, hệ thống **bỏ qua file đó kèm cảnh báo** (giống cách xử lý file trùng trong cùng lần nhập) thay vì làm hỏng cả lần nhập. Nếu một hồ sơ trong lần nhập không còn file hợp lệ nào, hồ sơ đó báo lỗi "không có file đính kèm".

**Why this priority**: Import là một đường tạo hồ sơ khác cũng gắn file; phải tuân cùng bất biến, nhưng mô hình lỗi của import là theo từng nhóm/cảnh báo nên xử lý mềm phù hợp hơn.

**Independent Test**: Chuẩn bị file import có một dòng trỏ tới file đã thuộc hồ sơ khác → file đó bị bỏ kèm cảnh báo; các file orphaned khác trong cùng nhóm vẫn được tạo; nhóm hết file hợp lệ → báo lỗi.

**Acceptance Scenarios**:

1. **Given** một dòng import trỏ tới file đã thuộc hồ sơ khác, **When** chạy import, **Then** file đó bị bỏ qua, có cảnh báo, và các file hợp lệ khác vẫn được nhập.
2. **Given** một nhóm import mà mọi file đều đã thuộc hồ sơ khác, **When** chạy import, **Then** nhóm đó báo lỗi "không có file đính kèm" và không tạo hồ sơ.
3. **Given** hai hồ sơ trong cùng một lần import cùng trỏ tới một file orphaned, **When** chạy import, **Then** chỉ hồ sơ đầu tiên giữ file, hồ sơ sau nhận cảnh báo bỏ file.

---

### Edge Cases

- **File đính kèm bị gỡ khỏi hồ sơ** (qua cập nhật, huỷ nháp, hoặc xoá hồ sơ): file trở lại trạng thái "chưa thuộc hồ sơ nào" và có thể được liên kết lại sau này.
- **Xoá / huỷ hồ sơ**: mọi ràng buộc sở hữu file của hồ sơ đó được giải phóng.
- **Hoàn tất hồ sơ nháp**: hồ sơ giữ nguyên định danh và danh sách file, nên quyền sở hữu file không thay đổi.
- **File upload mới** (do hệ thống tạo): luôn là file mới, đương nhiên chỉ thuộc một hồ sơ; vẫn được ghi nhận sở hữu để không thể bị liên kết sang hồ sơ khác về sau.
- **Quyền sở hữu file trên Drive**: nếu file thuộc người khác và hệ thống không có quyền di chuyển, đây là trường hợp "di chuyển thất bại" ở Story 1.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST duy trì một bản ghi xác định mỗi file đính kèm thuộc về hồ sơ nào ("file → hồ sơ"), như nguồn sự thật để kiểm tra quyền sở hữu mà không phải quét toàn bộ dữ liệu hồ sơ.
- **FR-002**: Bản ghi sở hữu MUST được cập nhật đồng bộ trên **mọi** đường thay đổi file đính kèm của hồ sơ (tạo, liên kết/upload vào nháp, cập nhật, nhập hàng loạt, xoá, huỷ nháp). Việc cập nhật này MUST được thực hiện **tự động bởi tầng ghi dữ liệu dùng chung**, không phụ thuộc vào việc từng tính năng tự nhớ cập nhật — để một tính năng mới trong tương lai gắn/gỡ file vẫn giữ bản ghi đúng mà không cần biết tới cơ chế này.
- **FR-002a**: Hệ thống MUST cung cấp một thao tác **dựng lại** toàn bộ bản ghi sở hữu từ nguồn sự thật là danh sách file đính kèm của các hồ sơ (self-heal, gọi được khi cần) để mọi sai lệch (nếu có) đều sửa được mà không mất dữ liệu vĩnh viễn; và MUST có cách **kiểm chứng** bản ghi sở hữu khớp với dữ liệu hồ sơ (dùng như một xác nhận trong kiểm thử để bắt lỗi "quên đồng bộ"). Một check chạy lúc vận hành (runtime/admin) nằm ngoài phạm vi.
- **FR-003**: Khi liên kết một file Drive có sẵn vào hồ sơ, hệ thống MUST từ chối nếu file đó đang thuộc một hồ sơ **khác**, và báo lỗi giải thích rõ.
- **FR-004**: Khi nhập hàng loạt, nếu một file trỏ tới đang thuộc hồ sơ khác, hệ thống MUST bỏ qua file đó và ghi cảnh báo; nếu hồ sơ trong lần nhập không còn file hợp lệ, hệ thống MUST báo lỗi cho hồ sơ đó.
- **FR-005**: Khi đổi danh mục của hồ sơ, hệ thống MUST di chuyển các file được giữ lại sang vị trí của danh mục mới.
- **FR-006**: Khi đổi danh mục mà hồ sơ có file được giữ lại cần di chuyển, nếu việc di chuyển **bất kỳ** file nào trong số đó thất bại, hệ thống MUST làm thao tác cập nhật (hoặc hoàn tất nháp) thất bại và KHÔNG lưu thay đổi một phần (kể cả không đổi danh mục) — không để hồ sơ và vị trí file lệch nhau.
- **FR-007**: Hệ thống MUST coi việc liên kết lại một file vào chính hồ sơ đang sở hữu nó là hợp lệ (không phải xung đột).
- **FR-008**: Sau khi một file bị gỡ khỏi hồ sơ hoặc hồ sơ bị xoá/huỷ, hệ thống MUST cho phép file đó được liên kết vào hồ sơ khác.

### Key Entities

- **Bản ghi sở hữu file (File–Document ownership)**: ánh xạ mỗi file đính kèm (định danh file Drive) tới đúng một hồ sơ đang sở hữu nó. Nhỏ gọn, tra cứu nhanh, độc lập với dữ liệu nội dung hồ sơ.
- **Hồ sơ (Document)**: đơn vị nghiệp vụ có một danh mục và danh sách file đính kèm; danh mục quyết định vị trí thư mục của các file.
- **File đính kèm**: hoặc file do hệ thống upload (mới, định danh duy nhất) hoặc file Drive có sẵn được liên kết (theo định danh). Cả hai đều chịu bất biến một-hồ-sơ.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Không có file Drive nào thuộc hai hồ sơ cùng lúc — qua mọi đường tạo/sửa/import, một file luôn ánh xạ tới tối đa một hồ sơ.
- **SC-002**: Sau khi đổi danh mục, 100% trường hợp kết thúc ở một trong hai trạng thái: file đã ở đúng thư mục danh mục mới, **hoặc** thao tác thất bại rõ ràng và hồ sơ giữ nguyên danh mục cũ — không có trạng thái lệch âm thầm.
- **SC-003**: Việc kiểm tra "file đã thuộc hồ sơ nào chưa" khi liên kết/import không phụ thuộc vào số lượng hồ sơ (không quét toàn bộ dữ liệu hồ sơ), giữ thời gian phản hồi ổn định khi dữ liệu tăng.
- **SC-004**: Mọi đường gắn/gỡ file (tạo, liên kết/upload nháp, cập nhật, import, xoá, huỷ) đều giữ bản ghi sở hữu đồng bộ — có kiểm thử tự động phủ cả 6 đường và các nhánh từ chối / bỏ-kèm-cảnh-báo / thất bại-rõ-ràng.

## Assumptions

- Việc đồng bộ bản ghi sở hữu được gắn vào **tầng ghi dữ liệu dùng chung của hồ sơ** (bọc các thao tác tạo/sửa/xoá row hồ sơ) thay vì rải ở từng hàm nghiệp vụ — chọn cách này thay vì tạo lớp repository riêng để giữ nhất quán với phong cách hiện tại của codebase (đã thống nhất với người dùng; tách repository để dành cho refactor tương lai).
- Một hồ sơ nháp dùng chung định danh với hồ sơ chính thức của nó; hoàn tất nháp cập nhật cùng bản ghi và không đổi danh sách file (đã xác minh trong mã nguồn hiện tại).
- Cấu trúc thư mục Drive phản chiếu cây danh mục dưới một thư mục gốc đã cấu hình; mô hình suy ra danh mục từ thư mục của file **không** thay đổi trong phạm vi này.
- Việc lọc/ẩn các file đã thuộc hồ sơ khác ngay trong giao diện chọn file Drive nằm **ngoài phạm vi**; chặn ở phía máy chủ khi liên kết là đủ để bảo đảm bất biến.
- Import không tự di chuyển file về thư mục danh mục tại thời điểm nhập; việc di chuyển khi cần sẽ do thao tác đổi danh mục về sau xử lý.
- Khử trùng file trong cùng một lần import ở phía giao diện vẫn được giữ nguyên như hiện tại; phần bổ sung chỉ là kiểm tra chéo với các hồ sơ đã tồn tại ở phía máy chủ.
