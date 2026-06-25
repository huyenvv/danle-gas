# Feature Specification: Người kiểm soát hồ sơ

**Feature Branch**: `013-nguoi-kiem-soat`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: "Thêm tính năng người kiểm soát. Chỉ GĐ và admin (QTV) có thể thêm khi giao việc, có thêm chỗ chọn người kiểm soát (optional). Người kiểm soát được gán cho doc nào thì có quyền tương tự như GĐ ở doc đó: có thể thay đổi người phối hợp/người phụ trách, có thể approve đến bước hoàn thành thay cho GĐ. Email giao việc bổ sung biến người kiểm soát, có đoạn nội dung chỉ hiển thị khi hồ sơ có người kiểm soát."

## User Scenarios & Testing *(mandatory)*

Tính năng này bổ sung một vai trò **uỷ quyền theo từng hồ sơ**: **Người kiểm soát**. Đây là phần mở rộng trực tiếp của workflow giao việc (feature 010): khi Giám đốc (GĐ) hoặc admin/Quản trị viên (QTV) **giao việc** một hồ sơ, họ có thể (tuỳ chọn) chọn thêm một **người kiểm soát** cho hồ sơ đó. Người kiểm soát được gán cho hồ sơ nào thì có quyền hành động **như GĐ trên đúng hồ sơ đó** (và chỉ hồ sơ đó), giúp GĐ uỷ quyền việc duyệt/điều phối mà không phải tự tay xử lý từng hồ sơ.

Vai trò liên quan:

- **GĐ và admin/QTV**: nhóm duy nhất được **chọn/gán người kiểm soát**, và chỉ ở **thời điểm giao việc**.
- **Người kiểm soát (mới)**: một người dùng được gán vào một hồ sơ cụ thể; trên hồ sơ đó được thực hiện các hành động duyệt/điều phối tương đương GĐ (đổi người phụ trách, đổi người phối hợp, duyệt tới bước hoàn thành). Quyền này **chỉ giới hạn trong hồ sơ được gán**, không phải quyền toàn hệ thống.
- **Người phụ trách / người phối hợp / Văn thư**: không thay đổi so với hiện tại.

Luồng trạng thái giao việc nền tảng (từ feature 010): `Chờ duyệt` → `Chờ xử lý` → `Đang xử lý` → `Chờ xác nhận HT` → `Hoàn thành`. Người kiểm soát tham gia ở khâu duyệt/điều phối trên hồ sơ được gán.

## Clarifications

### Session 2026-06-24

- Q: Cơ chế đoạn "người kiểm soát" hiển thị theo điều kiện trong email giao việc làm thế nào? → A: **Đánh dấu đoạn điều kiện ngay trong thân email** (ví dụ cú pháp `[[...]]`); đoạn trong dấu tự động bị lược bỏ khi hồ sơ không có người kiểm soát. Admin sửa trực tiếp trong thân mẫu email, không cần ô cấu hình riêng.
- Q: Khi được gán làm người kiểm soát, chính người đó có nhận thông báo không? → A: **Có** — người kiểm soát nhận **chuông** và được đưa vào **CC của email giao việc chung** (không có email template riêng); đoạn `[[...]]` trong email giao việc đã nêu vai trò kiểm soát.
- Q: `{vaiTròNgườiKiểmSoát}` trong email trả ra giá trị gì? → A: **Chức danh/vai trò thực** của người kiểm soát trong hệ thống (ví dụ "Giám đốc - Nguyễn Văn A"), không phải nhãn cố định.
- Q: Giao diện đổi/gỡ NKS sau khi đã giao việc? → A (chốt v1): **Chỉ qua popup Giao việc** (ở `Chờ duyệt`). Muốn đổi NKS sau đó, GĐ/QTV **thu hồi** về `Chờ duyệt` rồi **giao lại** — KHÔNG thêm đường sửa NKS trực tiếp ở các trạng thái khác (điều chỉnh phạm vi so với "sửa bất kỳ lúc nào").
- Q: NKS "điều phối" PT/PH kiểu gì? → A (chốt v1): NKS **chỉ THÊM người phối hợp** (không xoá PH cũ do GĐ/PT thêm, **không** đổi/xoá người phụ trách), dùng lại popup giao việc (PT khoá, PH chỉ-thêm) + nút **Lưu**, chạy ở `Chờ xử lý` và `Đang xử lý`, **KHÔNG đổi trạng thái**. NKS KHÔNG dùng giao việc/thu hồi để đổi PT/PH. Kế thừa feature 010: PH mới nhận chuông + email phối hợp; bắt buộc nhập nội dung (lưu "Nội dung phối hợp").

### User Story 1 - Chọn người kiểm soát khi giao việc (Priority: P1)

Khi GĐ hoặc admin/QTV giao việc một hồ sơ (action giao việc, ở trạng thái `Chờ duyệt`), màn giao việc có thêm một ô **chọn người kiểm soát (tuỳ chọn)**, bên cạnh ô chọn người phụ trách và người phối hợp. Nếu để trống, hồ sơ không có người kiểm soát và mọi hành vi giữ nguyên như hiện nay. Nếu chọn một người, người đó trở thành người kiểm soát của hồ sơ.

**Why this priority**: Đây là điểm vào của toàn bộ tính năng — không gán được người kiểm soát thì các quyền và email phụ thuộc đều không có ý nghĩa.

**Independent Test**: Đăng nhập GĐ/QTV, giao việc một hồ sơ và chọn một người kiểm soát; xác nhận hồ sơ lưu lại đúng người kiểm soát đã chọn. Lặp lại nhưng để trống ô người kiểm soát; xác nhận hồ sơ không có người kiểm soát và workflow chạy y như trước.

**Acceptance Scenarios**:

1. **Given** một hồ sơ ở `Chờ duyệt` và người dùng là GĐ hoặc admin/QTV, **When** mở màn giao việc, **Then** có ô chọn người kiểm soát (tuỳ chọn) ngoài ô người phụ trách và người phối hợp.
2. **Given** GĐ/QTV giao việc và chọn một người kiểm soát, **When** lưu, **Then** hồ sơ được lưu với người kiểm soát đó.
3. **Given** GĐ/QTV giao việc và để trống ô người kiểm soát, **When** lưu, **Then** hồ sơ lưu thành công không có người kiểm soát và toàn bộ workflow giữ nguyên hành vi hiện tại.
4. **Given** một người dùng KHÔNG phải GĐ/admin/QTV (ví dụ người phụ trách dùng "Nhận việc"), **When** thao tác trên hồ sơ, **Then** không có ô chọn người kiểm soát và không thể gán người kiểm soát.
5. **Given** GĐ/QTV gán một người kiểm soát cho hồ sơ, **When** lưu thành công, **Then** chính người kiểm soát đó nhận **chuông** và nằm trong **CC của email giao việc chung** (không có email riêng); đoạn `[[...]]` trong email nêu vai trò + tên người kiểm soát.

---

### User Story 2 - Người kiểm soát thêm phối hợp & duyệt tới hoàn thành (Priority: P1)

Người kiểm soát của một hồ sơ, **trên đúng hồ sơ đó**, có hai khả năng:

1. **Thêm người phối hợp** (chỉ thêm, không xoá): dùng lại popup giao việc với **người phụ trách bị khoá** và **người phối hợp cũ không gỡ được** (kể cả PH do GĐ hoặc PT đã thêm). NKS chỉ bổ sung PH mới rồi bấm **Lưu**. Thao tác này chạy ở trạng thái **`Chờ xử lý`** và **`Đang xử lý`**, và **KHÔNG đổi trạng thái** hồ sơ.
2. **Duyệt tới Hoàn thành thay GĐ**: ở `Chờ xác nhận HT` thực hiện **xác nhận hoàn thành** hoặc **từ chối kết quả** như GĐ.

NKS **không** đổi/xoá người phụ trách, **không** xoá người phối hợp, **không** dùng giao việc/thu hồi để chuyển trạng thái, và **không** làm các hành động khác của GĐ (từ chối ở Chờ duyệt, YC phát hành, lưu trữ). Trên hồ sơ **không** được gán, NKS không có thêm quyền gì.

**Why this priority**: Đây là giá trị cốt lõi — uỷ quyền điều phối (bổ sung phối hợp) và duyệt hoàn thành theo từng hồ sơ để giảm tải cho GĐ.

**Independent Test**: Gán X làm NKS hồ sơ A (không phải B). Đăng nhập X: trên A ở `Chờ xử lý`/`Đang xử lý` thêm được PH mới (không gỡ được PT/PH cũ, không đổi trạng thái), và ở `Chờ xác nhận HT` xác nhận/từ chối kết quả được; trên B không có thêm quyền nào.

**Acceptance Scenarios**:

1. **Given** X là NKS của hồ sơ A ở `Chờ xử lý` hoặc `Đang xử lý`, **When** X mở popup (PT khoá, PH cũ không gỡ được), bổ sung PH mới và bấm Lưu, **Then** PH mới được thêm, trạng thái hồ sơ **không đổi**, PH mới nhận chuông + email phối hợp.
2. **Given** X là NKS của hồ sơ A, **When** X cố **gỡ** một PH cũ hoặc **đổi/xoá** người phụ trách, **Then** hệ thống từ chối (chỉ thêm, không xoá; PT bất biến) — thực thi ở máy chủ.
3. **Given** X là NKS của hồ sơ A ở `Chờ xác nhận HT`, **When** X xác nhận hoàn thành (hoặc từ chối kết quả), **Then** thực hiện được như GĐ; nhưng X **không** làm được từ chối ở Chờ duyệt, YC phát hành, lưu trữ.
3a. **Given** hồ sơ A có NKS X, **When** người phụ trách **trình duyệt** (hoàn thành) hoặc **trình duyệt lại** đẩy hồ sơ sang `Chờ xác nhận HT`, **Then** **cả GĐ lẫn NKS X** nhận chuông (để biết mà duyệt) — giống cách GĐ được báo.
4. **Given** X là NKS của hồ sơ A nhưng KHÔNG phải của hồ sơ B, **When** X mở hồ sơ B, **Then** X chỉ có quyền theo vai trò gốc, không có quyền NKS trên B.
5. **Given** hồ sơ A có NKS X, **When** GĐ mở hồ sơ A, **Then** GĐ vẫn thực hiện đầy đủ hành động của mình (quyền **song song**, NKS không tước quyền GĐ).
6. **Given** một yêu cầu gọi trực tiếp máy chủ mạo danh quyền NKS trên hồ sơ không được gán (hoặc cố gỡ PT/PH), **When** máy chủ xử lý, **Then** bị từ chối (kiểm tra ở máy chủ, không chỉ ẩn nút).

---

### User Story 3 - Email giao việc có đoạn người kiểm soát theo điều kiện (Priority: P2)

Email giao việc bổ sung thông tin về người kiểm soát. Nội dung email có một **đoạn về người kiểm soát chỉ hiển thị khi hồ sơ có người kiểm soát**; nếu hồ sơ không có người kiểm soát thì đoạn này biến mất hoàn toàn (không để lại biến trống hay câu cụt). Quản trị viên cấu hình được đoạn nội dung này trong màn cấu hình email, sử dụng các biến tên/vai trò người kiểm soát.

Ví dụ khách hàng mong muốn — mẫu hiện tại:

> {tênNgườiGửi} giao cho bạn xử lý hồ sơ "{tênHồSơ}" **và trình duyệt qua {vaiTròNgườiKiểmSoát} - {tênNgườiKiểmSoát}**. Với nội dung: {nộiDungGiaoViec}. Hạn xử lý hồ sơ {ngàyKếtThúc}, link tài liệu {linkTàiLiệu} …

Đoạn in đậm "và trình duyệt qua {vaiTròNgườiKiểmSoát} - {tênNgườiKiểmSoát}" chỉ xuất hiện khi hồ sơ có người kiểm soát; ngược lại bị lược bỏ.

**Why this priority**: Hoàn thiện thông báo cho người nhận việc biết hồ sơ sẽ được duyệt qua ai. Phụ thuộc US1 (phải có dữ liệu người kiểm soát).

**Independent Test**: Giao việc một hồ sơ CÓ người kiểm soát; xác nhận email chứa đoạn người kiểm soát với đúng tên/vai trò. Giao việc một hồ sơ KHÔNG có người kiểm soát; xác nhận email không còn đoạn đó và đọc trôi chảy, không có biến trống.

**Acceptance Scenarios**:

1. **Given** một hồ sơ được giao việc có người kiểm soát, **When** email giao việc gửi đi, **Then** email chứa đoạn người kiểm soát với tên và vai trò người kiểm soát được điền đúng.
2. **Given** một hồ sơ được giao việc không có người kiểm soát, **When** email giao việc gửi đi, **Then** email không chứa đoạn người kiểm soát và không để lại biến chưa thay thế hay câu cụt.
3. **Given** quản trị viên ở màn cấu hình email, **When** mở mẫu email giao việc, **Then** có thể chỉnh sửa đoạn nội dung người kiểm soát và thấy các biến `{vaiTròNgườiKiểmSoát}`, `{tênNgườiKiểmSoát}` trong danh sách biến khả dụng.

---

### Edge Cases

- **Người kiểm soát trùng với người phụ trách hoặc người phối hợp của cùng hồ sơ**: hệ thống chấp nhận; người đó có cả quyền của vai trò gốc lẫn quyền người kiểm soát trên hồ sơ.
- **Người kiểm soát đồng thời là GĐ/admin**: áp quyền cao nhất; không phát sinh xung đột.
- **Đổi/gỡ người kiểm soát**: GĐ/QTV **thu hồi** hồ sơ về `Chờ duyệt` rồi **giao lại** để chọn NKS khác (hoặc để trống = gỡ). Khi **đổi sang người kiểm soát mới**, người mới nhận chuông + nằm trong CC email giao việc; người bị gỡ **không** nhận email "huỷ kiểm soát" (ngoài phạm vi feature này, nhất quán với hành vi feature 010).
- **Gửi email thất bại**: việc giao việc vẫn được coi là thành công; lỗi gửi email được ghi nhận, không rollback (giữ nguyên hành vi best-effort của feature 010).
- **Hồ sơ cũ trước khi có tính năng**: không có người kiểm soát; mọi hành vi như trước; email không hiển thị đoạn người kiểm soát.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST cho phép **chỉ GĐ và admin/QTV** gán **người kiểm soát** cho một hồ sơ, tại thao tác **giao việc** (trạng thái `Chờ duyệt`). Việc **đổi/gỡ** người kiểm soát thực hiện qua **thu hồi về `Chờ duyệt` rồi giao lại** (dùng lại chính đường giao việc) — không có đường sửa NKS trực tiếp ở trạng thái khác. Các vai trò khác MUST không gán/đổi/gỡ được người kiểm soát.
- **FR-002**: Ô chọn người kiểm soát MUST là **tuỳ chọn**; để trống thì hồ sơ không có người kiểm soát và toàn bộ workflow giữ nguyên hành vi hiện tại.
- **FR-003**: Khi một hồ sơ có người kiểm soát, hệ thống MUST cho người kiểm soát đó, **trên đúng hồ sơ đó**: (a) **thêm người phối hợp** (chỉ thêm, không xoá) ở trạng thái `Chờ xử lý` và `Đang xử lý` **không làm đổi trạng thái** hồ sơ; và (b) **duyệt tới Hoàn thành thay GĐ** (xác nhận hoàn thành / từ chối kết quả ở `Chờ xác nhận HT`).
- **FR-004**: Tập quyền của người kiểm soát MUST giới hạn đúng nhóm ở FR-003. Người kiểm soát MUST KHÔNG: đổi/xoá người phụ trách; xoá người phối hợp đã có (kể cả do GĐ/PT thêm); dùng giao việc/thu hồi để chuyển trạng thái; và MUST KHÔNG làm các hành động GĐ khác (từ chối ở `Chờ duyệt`, YC phát hành, lưu trữ, giao việc, thu hồi).
- **FR-004a**: Thao tác "thêm người phối hợp" của người kiểm soát MUST dùng lại popup giao việc với **người phụ trách bị khoá** và **danh sách người phối hợp cũ không gỡ được**; tập PH trước khi lưu MUST là tập con của tập sau khi lưu (chỉ thêm). Ràng buộc này MUST thực thi ở phía máy chủ.
- **FR-004b**: Khi người kiểm soát thêm ≥1 người phối hợp mới, hệ thống MUST yêu cầu nhập **nội dung** (lưu vào "Nội dung phối hợp") và mỗi người phối hợp *mới* MUST nhận chuông + email phối hợp; người phối hợp đã có MUST không nhận lại (kế thừa hành vi feature 010).
- **FR-005**: Quyền của người kiểm soát MUST **chỉ giới hạn trong hồ sơ được gán**; trên hồ sơ khác, người kiểm soát chỉ có quyền theo vai trò gốc.
- **FR-006**: Hệ thống MUST thực thi kiểm tra quyền người kiểm soát ở **phía máy chủ** (không chỉ ẩn nút giao diện), để không thể lách bằng cách gọi trực tiếp máy chủ.
- **FR-007**: Người kiểm soát (nếu không phải GĐ/admin) MUST không được gán/đổi/gỡ người kiểm soát — kể cả cho hồ sơ mình đang kiểm soát.
- **FR-008**: Khi giao việc một hồ sơ **có** người kiểm soát, email giao việc MUST chứa đoạn nội dung người kiểm soát với **tên** và **vai trò** người kiểm soát được điền đúng (vai trò = chức danh thực của người kiểm soát trong hệ thống, ví dụ "Giám đốc").
- **FR-009**: Khi giao việc một hồ sơ **không có** người kiểm soát, email giao việc MUST **không** chứa đoạn người kiểm soát và MUST không để lại biến chưa thay thế (`{...}`) hay câu cụt.
- **FR-010**: Mẫu email giao việc MUST cung cấp các biến `{vaiTròNgườiKiểmSoát}` và `{tênNgườiKiểmSoát}`, và một cơ chế **đoạn điều kiện đánh dấu ngay trong thân email** (ví dụ cú pháp `[[...]]`): đoạn được đánh dấu MUST tự động bị lược bỏ khi hồ sơ không có người kiểm soát, và được giữ lại (đã thay biến) khi có. Quản trị viên MUST chỉnh sửa được đoạn này trực tiếp trong thân mẫu email giao việc (Settings → Email).
- **FR-011**: Việc gán người kiểm soát MUST được lưu bền vững cùng hồ sơ để các lần xử lý/duyệt sau đó áp dụng đúng quyền.
- **FR-012**: GĐ và admin/QTV MUST tiếp tục thực hiện được đầy đủ các hành động của mình trên hồ sơ kể cả khi hồ sơ đã có người kiểm soát. Người kiểm soát là quyền **song song** (làm thay/đỡ tải), KHÔNG tước quyền của GĐ.
- **FR-013**: Khi GĐ/QTV gán (hoặc đổi sang) một người kiểm soát cho hồ sơ, người kiểm soát đó MUST nhận **chuông** + được đưa vào **CC của email giao việc chung** (KHÔNG dùng template email riêng). Đoạn `[[...]]` trong email giao việc đã chứa thông tin người kiểm soát. Thông báo MUST chỉ áp cho người kiểm soát *mới* được gán; người bị gỡ MUST không nhận email "huỷ kiểm soát".
- **FR-014**: Người kiểm soát của một hồ sơ MUST **thấy hồ sơ đó trong danh sách** và **mở/xem/bình luận** được, kể cả khi không phải người tạo/phụ trách/phối hợp. (NKS được tính là "người tham gia" hồ sơ.)
- **FR-015**: Việc nhận diện người kiểm soát (cho cả hiển thị danh sách lẫn kiểm quyền hành động) MUST nhất quán: nếu hồ sơ hiện trong danh sách của NKS thì NKS cũng MUST thao tác được (không có trạng thái "thấy nhưng bị chặn quyền"). Hệ thống MUST khớp danh tính NKS qua mọi định danh tương đương (UserID / tên đăng nhập / email).
- **FR-016**: Khi một hồ sơ **có** người kiểm soát chuyển sang `Chờ xác nhận HT` (người phụ trách **trình duyệt** = `hoanThanh`, hoặc **trình duyệt lại** = `hoanThanhLai`), hệ thống MUST báo **chuông cho người kiểm soát** của hồ sơ đó **song song với GĐ** — vì NKS có quyền xác nhận HT/từ chối kết quả nên cần biết để duyệt. Mức thông báo MUST đồng nhất với GĐ ở bước này (hiện tại: chỉ chuông, không email); MUST loại trừ chính người thao tác và bỏ qua khi không có NKS.
- **FR-017**: Khi **từ chối kết quả** (`tuChoiKetQua`) — dù do GĐ hay người kiểm soát thực hiện — email thông báo (gửi PT, kèm lý do) MUST **CC cho GĐ** để GĐ nắm tình hình. CC MUST loại trừ chính người thao tác (GĐ tự từ chối thì không tự gửi cho mình).

### Key Entities *(include if feature involves data)*

- **Hồ sơ (Document)**: bổ sung thuộc tính **người kiểm soát** (tuỳ chọn, tối đa 1 người).
- **Người kiểm soát (Controller)**: người dùng được uỷ quyền trên một hồ sơ cụ thể: **thêm người phối hợp** (chỉ thêm, không đổi/xoá PT·PH; không đổi trạng thái) ở `Chờ xử lý`/`Đang xử lý`, và **duyệt tới Hoàn thành** thay GĐ. Quan hệ: gắn với từng hồ sơ; quyền chỉ áp trong phạm vi hồ sơ đó.
- **Vai trò người dùng (Role)**: bổ sung khái niệm quyền theo-hồ-sơ của người kiểm soát, song song với vai trò toàn hệ thống (GĐ, QTV, Văn thư, người phụ trách, người phối hợp).
- **Email giao việc (Assignment email)**: bổ sung biến `{vaiTròNgườiKiểmSoát}`, `{tênNgườiKiểmSoát}` và một đoạn điều kiện (đánh dấu trong thân email) hiển thị theo việc hồ sơ có/không có người kiểm soát.
- **Thông báo người kiểm soát**: NKS mới được gán nhận **chuông** + nằm trong **CC của email giao việc chung** (không có template email riêng); đoạn `[[...]]` của email giao việc nêu vai trò + tên NKS.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% thao tác giao việc bởi GĐ/QTV cho phép chọn người kiểm soát (tuỳ chọn); 100% thao tác bởi vai trò khác không có khả năng gán người kiểm soát.
- **SC-002**: 100% thao tác hợp lệ của người kiểm soát trên hồ sơ được gán thành công (thêm PH không đổi trạng thái ở `Chờ xử lý`/`Đang xử lý`; xác nhận/từ chối kết quả ở `Chờ xác nhận HT`); 100% nỗ lực xoá PH cũ/đổi PT, hoặc dùng quyền NKS trên hồ sơ KHÔNG được gán, bị từ chối (kể cả gọi trực tiếp máy chủ).
- **SC-003**: 100% email giao việc của hồ sơ có người kiểm soát chứa đúng đoạn người kiểm soát; 100% email của hồ sơ không có người kiểm soát không còn đoạn đó và không chứa biến chưa thay thế.
- **SC-004**: 100% nỗ lực gán/đổi/gỡ người kiểm soát bởi người không phải GĐ/QTV bị từ chối.
- **SC-005**: 0 thay đổi hành vi đối với các hồ sơ không có người kiểm soát (workflow và email giữ nguyên).
- **SC-006**: 100% người kiểm soát mới được gán nhận chuông + nằm trong CC email giao việc chung; 0% trường hợp gửi email template riêng cho NKS; 0% người bị gỡ nhận email "huỷ kiểm soát".
- **SC-007**: 100% hồ sơ được gán NKS hiển thị trong danh sách của NKS và mở/thao tác được — không có ca "thấy nhưng bị chặn quyền" (FR-014/FR-015).
- **SC-008**: 100% lần hồ sơ có NKS chuyển sang `Chờ xác nhận HT` (trình duyệt / trình duyệt lại) → NKS nhận chuông song song với GĐ (FR-016).

## Assumptions

- Tính năng mở rộng trực tiếp workflow giao việc của feature 010; tận dụng cơ chế giao việc, mô hình hồ sơ/người dùng, và hệ thống gửi email sẵn có của docmgr.
- "admin/QTV" = vai trò Quản trị viên/admin hiện có; "GĐ" = Giám đốc. Đây là hai nhóm duy nhất gán được người kiểm soát.
- Người kiểm soát được gán **tại bước giao việc** (giống cách chọn người phụ trách/người phối hợp), tuỳ chọn 0 hoặc 1 người. Đổi/gỡ NKS thực hiện qua **thu hồi → giao lại** (v1 không có UI sửa NKS trực tiếp ngoài popup giao việc).
- Tối đa 1 người kiểm soát mỗi hồ sơ. Cho phép người kiểm soát trùng với người phụ trách/người phối hợp của cùng hồ sơ.
- Cơ chế "đoạn người kiểm soát hiển thị theo điều kiện" trong email (chốt 2026-06-24): **đánh dấu đoạn điều kiện ngay trong thân mẫu email** (ví dụ cú pháp `[[...]]`). Hệ thống giữ lại đoạn (đã thay `{vaiTròNgườiKiểmSoát}`, `{tênNgườiKiểmSoát}`) khi hồ sơ có người kiểm soát, và lược bỏ hoàn toàn khi không có. Admin sửa trực tiếp trong thân email, không có ô cấu hình riêng.
- `{vaiTròNgườiKiểmSoát}` lấy từ chức danh/vai trò thực của người kiểm soát trong hệ thống.
- Người kiểm soát mới được gán nhận chuông + nằm trong CC email giao việc chung (không có template riêng), best-effort như feature 010.
- Gửi email là best-effort (kế thừa feature 010): lỗi gửi không rollback việc giao việc.
- Quyền người kiểm soát là quyền **theo hồ sơ**, không nâng vai trò toàn hệ thống của người đó.
- Hiển thị danh sách (012) lọc phía server qua cột tính sẵn "Token xem"; NKS được thêm vào token này để thấy hồ sơ. Hồ sơ gán NKS **trước bản vá** cần chạy **một lần** hàm bảo trì thủ công `rebuildAllDerived()` (tính lại token theo lô, an toàn ở 10k+) hoặc thu hồi→giao lại. Tuyệt đối KHÔNG tính lại toàn bộ trong `doGet` (sẽ timeout ở quy mô lớn).

## Dependencies

- Feature 010 (workflow giao việc cho người phối hợp) — nền tảng action giao việc, các trường người phụ trách/người phối hợp/nội dung giao việc, và mẫu email giao việc.
- Màn cấu hình email (Settings → Email thông báo) — nơi quản trị viên chỉnh sửa mẫu và biến.
