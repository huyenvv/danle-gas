# Feature Specification: Workflow giao việc cho người phối hợp

**Feature Branch**: `010-giao-viec-phoi-hop`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "Workflow giao việc cho người phối hợp (tách từ 008). Khi GĐ/vai trò toàn quyền thêm người phối hợp vào tài liệu để giao việc: (1) người phụ trách CHỈ được THÊM người phối hợp, KHÔNG xoá được ai (kể cả người mình tự thêm); chỉ admin/QTV/GĐ/VT mới xoá/sửa; (2) khi có ≥1 người phối hợp, ô 'Nội dung giao việc' bắt buộc; (3) mỗi người phối hợp được thêm nhận email theo template riêng kèm nội dung giao việc, gửi ngay khi được thêm."

## User Scenarios & Testing *(mandatory)*

Tính năng này mô tả **luồng giao việc** (workflow) trên một tài liệu, trực giao với phân quyền *xem* tài liệu (đã làm ở feature 008). Khi người có quyền giao việc thêm một hoặc nhiều **người phối hợp** vào tài liệu, hệ thống ràng buộc cách danh sách người phối hợp được chỉnh sửa, bắt buộc kèm nội dung giao việc, và thông báo cho từng người được giao.

Các vai trò liên quan tới người phối hợp trong tính năng này:

- **Người được giao việc (được THÊM người phối hợp)**: Giám đốc (GĐ), admin/Quản trị viên (QTV), và **người phụ trách** của tài liệu.
- **Vai trò toàn quyền (được XOÁ/SỬA người phối hợp)**: admin/QTV và GĐ — chỉnh sửa danh sách người phối hợp tự do.
- **Người phụ trách** (người chịu trách nhiệm chính của tài liệu, không thuộc nhóm toàn quyền) — chỉ được **thêm** người phối hợp, không được xoá/sửa bất kỳ ai.
- **Văn thư (VT)** **không có vai trò** trong tính năng này (không thêm, không xoá/sửa người phối hợp), vì VT không tham gia duyệt hồ sơ.

**Luồng trạng thái giao việc** (giao việc gắn với trạng thái tài liệu): `Chờ duyệt` → `Chờ xử lý` → `Đang xử lý`.

- **`Chờ duyệt`**: GĐ hoặc admin/QTV thiết lập giao việc — chọn **người phụ trách**, thêm **người phối hợp**, điền **nội dung giao việc** (bắt buộc nếu có ≥1 người phối hợp). Người phụ trách chưa thao tác ở bước này. Chưa gửi email.
- **Duyệt → `Chờ xử lý`**: khi tài liệu được duyệt, hệ thống gửi email giao việc cho **người phối hợp hiện có** (những người được thêm ở `Chờ duyệt`).
- **`Chờ xử lý`**: người phụ trách thấy nút **"Nhận việc"**; mở ra cho phép **thêm** người phối hợp (chỉ thêm, không xoá/sửa).
- **Nhận việc → `Đang xử lý`**: sau khi người phụ trách nhận việc, hệ thống gửi email giao việc **ngay** cho những **người phối hợp mới** vừa thêm (không gửi lại cho người đã có).

## Clarifications

### Session 2026-06-20

- Q: Ai được phép THÊM người phối hợp (giao việc)? → A: GĐ, admin/QTV, và người phụ trách của tài liệu (không ai khác).
- Q: VT (Văn thư) có quyền gì với người phối hợp? → A: Không có quyền nào trong tính năng này (không thêm, không xoá/sửa); VT không duyệt hồ sơ. Nhóm xoá/sửa = admin/QTV, GĐ.
- Q: Giao việc có phụ thuộc trạng thái tài liệu không? → A: Có. GĐ/admin(QTV) giao việc ở trạng thái `Chờ duyệt` (chọn người phụ trách + người phối hợp + nội dung giao việc); sang `Chờ xử lý`, người phụ trách dùng nút "Nhận việc" để thêm người phối hợp.
- Q: Email giao việc gửi vào lúc nào so với mốc duyệt? → A: Khi tài liệu được duyệt (→ `Chờ xử lý`) gửi cho người phối hợp hiện có; người phụ trách thêm ở "Nhận việc" thì sau khi nhận việc (→ `Đang xử lý`) gửi ngay cho người phối hợp mới. Không gửi khi còn `Chờ duyệt`.
- Q: Email cho PH thêm lúc "Nhận việc" dùng template nào, ai là người nhận chính, popup ra sao? → A (chốt với khách 2026-06-21): Giữ nguyên như cũ, chỉ thay đổi tối thiểu. (1) `giaoViec`: người chủ trì là TO, PH do GĐ tag chỉ CC. (2) `nhanViec`: PH mới do người chủ trì thêm là **người nhận chính (TO)**, gửi qua **1 template email cấu hình mới**. (3) Popup nhập nội dung **dùng lại popup giao việc** (không làm popup riêng), chỉ hiện khi có bổ sung PH mới.
- Q: Nội dung popup nhận việc lưu ở đâu, hiển thị thế nào? → A (chốt khách 2026-06-21): Lưu vào **cột mới riêng** ("Nội dung phối hợp") để **không mất** nội dung giao việc cũ của GĐ → cần thêm cột + bump SCHEMA_V. Preview detail hiển thị **cả hai tách biệt, tiêu đề khác nhau**: "Nội dung giao việc" (GĐ) và "Nội dung phối hợp" (chủ trì).
- Q: Template email "Phối hợp" mới có cần đưa vào màn cấu hình email không? → A (khách 2026-06-21, "thêm 1 cấu hình email"): Có — thêm tab "Phối hợp" vào Settings → Email thông báo (sửa được tiêu đề/nội dung) kèm biến `{nộiDungPhoiHop}`.

### User Story 1 - Khoá xoá người phối hợp với người phụ trách (Priority: P1)

Khi tài liệu ở trạng thái `Chờ xử lý`, người phụ trách dùng nút "Nhận việc" để mở danh sách người phối hợp. Họ có thể bổ sung người phối hợp mới nhưng không thể gỡ bỏ bất kỳ người phối hợp nào đã có trong danh sách — kể cả người do chính họ vừa thêm trước đó. Mục tiêu là giữ lại dấu vết giao việc: một khi đã giao cho ai, người phụ trách không thể tự ý rút lại; chỉ vai trò toàn quyền (admin/QTV, GĐ) mới điều chỉnh được.

**Why this priority**: Đây là ràng buộc cốt lõi của workflow, đảm bảo tính minh bạch và không thể chối bỏ của việc giao việc. Không có ràng buộc này thì hai yêu cầu còn lại mất ý nghĩa.

**Independent Test**: Đăng nhập bằng tài khoản người phụ trách (không toàn quyền), mở một tài liệu đã có sẵn người phối hợp, xác nhận chỉ có thao tác thêm khả dụng và mọi nỗ lực xoá đều bị từ chối — ở cả giao diện và phía máy chủ.

**Acceptance Scenarios**:

1. **Given** một tài liệu ở trạng thái `Chờ xử lý` đã có ≥1 người phối hợp, **When** người phụ trách (không toàn quyền) mở qua nút "Nhận việc", **Then** chỉ thao tác thêm người phối hợp mới khả dụng, không có cách nào xoá người phối hợp hiện có.
2. **Given** người phụ trách vừa thêm một người phối hợp trong cùng phiên chỉnh sửa, **When** họ cố gỡ chính người vừa thêm đó, **Then** hệ thống không cho phép (người vừa thêm cũng nằm trong tập không-xoá-được).
3. **Given** một yêu cầu lưu tài liệu từ người phụ trách trong đó tập người phối hợp mới thiếu một người so với tập cũ, **When** máy chủ xử lý, **Then** yêu cầu bị từ chối với thông báo rõ ràng (tập cũ phải là tập con của tập mới).
4. **Given** vai trò toàn quyền (admin/QTV hoặc GĐ), **When** mở cùng tài liệu, **Then** có thể xoá hoặc sửa người phối hợp tự do.

---

### User Story 2 - Bắt buộc nội dung giao việc khi có người phối hợp (Priority: P2)

Khi tài liệu có ít nhất một người phối hợp, người chỉnh sửa phải nhập "Nội dung giao việc" trước khi lưu — vì giao việc cho ai đó mà không nói rõ việc gì là vô nghĩa. Ngược lại, nếu tài liệu không có người phối hợp nào, ô nội dung giao việc được phép để trống.

**Why this priority**: Đảm bảo mỗi lần giao việc đều kèm mô tả công việc, làm cho email thông báo (US3) có nội dung hữu ích. Phụ thuộc logic vào việc có người phối hợp hay không.

**Independent Test**: Tạo/sửa một tài liệu, thử lưu với ≥1 người phối hợp nhưng để trống nội dung giao việc (phải bị chặn), rồi lưu cùng tài liệu không có người phối hợp và để trống nội dung (phải thành công).

**Acceptance Scenarios**:

1. **Given** tài liệu có ≥1 người phối hợp và ô "Nội dung giao việc" để trống, **When** người dùng lưu, **Then** hệ thống chặn lưu và yêu cầu nhập nội dung giao việc.
2. **Given** tài liệu không có người phối hợp nào và ô "Nội dung giao việc" để trống, **When** người dùng lưu, **Then** lưu thành công.
3. **Given** tài liệu có ≥1 người phối hợp và nội dung giao việc đã nhập, **When** người dùng lưu, **Then** lưu thành công.
4. **Given** một yêu cầu lưu lách qua giao diện (gọi trực tiếp máy chủ) với ≥1 người phối hợp và nội dung giao việc trống, **When** máy chủ xử lý, **Then** yêu cầu bị từ chối (ràng buộc được thực thi ở phía máy chủ, không chỉ ở giao diện).

---

### User Story 3 - Email template riêng cho người phối hợp được giao việc (Priority: P3)

Người phối hợp nhận **chuông + email** thông báo giao việc, dùng **template riêng** (khác template phát hành của Văn thư). Email gửi theo mốc trạng thái và **nguồn nội dung khác nhau**:

- **PH do GĐ/QTV thêm ở `Chờ duyệt`**: nhận email khi tài liệu **được duyệt** (→ `Chờ xử lý`), dùng template `giaoViec`. Ở lần này **người chủ trì là người nhận chính (TO)**, PH do GĐ tag **chỉ nhận CC**. *(Giữ nguyên hành vi hiện có.)*
- **PH do người chủ trì (người phụ trách) thêm khi "Nhận việc"**: nhận email ngay sau khi **nhận việc** (→ `Đang xử lý`), dùng **template email riêng (cấu hình mới)**, và **PH mới là người nhận chính (TO)**. Nội dung email lấy từ **popup giao việc** (dùng lại popup hiện có) mà người chủ trì nhập lúc nhận việc.

Chỉ người *mới* được thêm nhận email.

**Why this priority**: Hoàn thiện vòng giao việc bằng việc thông báo cho người được giao. Phụ thuộc vào US1 (xác định ai vừa được thêm) và US2 (đảm bảo có nội dung giao việc để đưa vào email).

**Independent Test**: Ở bước nhận việc, người chủ trì bổ sung một người phối hợp mới và nhập nội dung ở popup (dùng lại popup giao việc); xác nhận đúng người đó là **người nhận chính (TO)** của chuông + email dùng **template cấu hình mới** mang nội dung vừa nhập.

**Acceptance Scenarios**:

1. **Given** GĐ/QTV đã thêm ≥1 người phối hợp ở `Chờ duyệt` (có nội dung giao việc), **When** tài liệu được duyệt (→ `Chờ xử lý`), **Then** mỗi người phối hợp hiện có nhận một email theo template giao việc, kèm nội dung giao việc.
2. **Given** tài liệu ở `Chờ xử lý`, **When** người chủ trì "Nhận việc" và **bổ sung** người phối hợp mới, **Then** hiện **popup giao việc** (dùng lại) để nhập nội dung; sau khi nhận việc (→ `Đang xử lý`) mỗi người phối hợp *mới* là **người nhận chính (TO)** của **chuông + email** (template cấu hình mới, mang nội dung vừa nhập); người phối hợp đã có từ trước không nhận lại.
2b. **Given** tài liệu ở `Chờ xử lý`, **When** người chủ trì "Nhận việc" mà **không** bổ sung người phối hợp nào, **Then** không hiện popup và không gửi email phối hợp.
3. **Given** một thao tác trên tài liệu không thêm người phối hợp mới nào, **When** lưu/chuyển trạng thái, **Then** không gửi email giao việc nào.
4. **Given** email giao việc được gửi, **When** so sánh với email phát hành của Văn thư, **Then** đây là template riêng biệt (nội dung/định dạng dành cho giao việc), không phải template phát hành.

---

### Edge Cases

- **Thêm người đã là người phối hợp**: Nếu một người đã có trong danh sách phối hợp, thêm lại không tạo bản ghi trùng và không gửi lại email (chỉ người *mới* được thêm mới nhận email).
- **Lưu thất bại sau khi đã định gửi email**: Nếu việc lưu tài liệu thất bại, không được gửi email giao việc (chỉ gửi cho người phối hợp đã lưu thành công).
- **Email không gửi được**: Việc lưu tài liệu vẫn được coi là thành công ngay cả khi gửi email thất bại; lỗi gửi email được ghi nhận nhưng không làm rollback việc thêm người phối hợp. (Xem Assumptions.)
- **Toàn quyền xoá người phối hợp**: Khi vai trò toàn quyền xoá một người phối hợp, không có email "huỷ giao việc" nào được gửi (ngoài phạm vi feature này).
- **Người phụ trách đồng thời là toàn quyền**: Nếu một người vừa là người phụ trách vừa thuộc nhóm toàn quyền, áp dụng quyền toàn quyền (được xoá/sửa).
- **Nội dung giao việc trống khi giao việc có người phối hợp**: Ở bước `giaoViec`, giữ ≥1 người phối hợp nhưng để trống nội dung giao việc → bị chặn (Scenario US2.1). Ngoài bước giao việc, ràng buộc này không áp.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST chỉ cho phép **GĐ, admin/QTV, và người phụ trách** của tài liệu **thêm** người phối hợp khi giao việc; các vai trò khác (kể cả VT) MUST không thêm được.
- **FR-002**: Hệ thống MUST ngăn người phụ trách (không toàn quyền) **xoá** hoặc thay thế bất kỳ người phối hợp nào đã có — bao gồm cả người do chính họ vừa thêm. Cụ thể, với thao tác lưu của người phụ trách, tập người phối hợp trước khi lưu MUST là tập con của tập sau khi lưu.
- **FR-003**: admin/QTV MUST được thêm/sửa/xoá người phối hợp không hạn chế ở mọi trạng thái. GĐ MUST thiết lập/sửa người phối hợp qua `giaoViec` (ở `Chờ duyệt`) hoặc thu hồi (`thuHoi`) về `Chờ duyệt` rồi giao lại — KHÔNG có đường sửa trực tiếp khi hồ sơ đã `Đang xử lý` (theo quyết định giữ nguyên workflow hiện có). VT MUST không có quyền thêm/sửa/xoá người phối hợp trong tính năng này.
- **FR-004**: Hệ thống MUST thực thi ràng buộc "chỉ thêm" của người phụ trách ở phía máy chủ, không chỉ ẩn nút ở giao diện, để không thể lách qua bằng cách gọi trực tiếp.
- **FR-005**: Khi **giao việc** (action `giaoViec`, ở `Chờ duyệt`) có ≥1 người phối hợp, hệ thống MUST yêu cầu trường "Nội dung giao việc" không được để trống trước khi lưu. (Ràng buộc này áp ở bước giao việc; không áp ở các đường lưu/sửa hồ sơ thông thường khác.)
- **FR-006**: Khi tài liệu không có người phối hợp nào, hệ thống MUST cho phép lưu với "Nội dung giao việc" để trống.
- **FR-007**: Hệ thống MUST thực thi ràng buộc bắt buộc "Nội dung giao việc" ở phía máy chủ, không chỉ ở giao diện.
- **FR-008**: Người phối hợp được GĐ/admin(QTV) thêm ở trạng thái `Chờ duyệt` MUST nhận email giao việc khi tài liệu được **duyệt** (chuyển sang `Chờ xử lý`) — KHÔNG gửi tại thời điểm thêm khi còn `Chờ duyệt`.
- **FR-009**: Email thông báo MUST tách biệt với template phát hành của Văn thư. Luồng `giaoViec` (GĐ) dùng template `giaoViec`, **người chủ trì là TO**, **PH chỉ CC**. Luồng `nhanViec` (người chủ trì thêm PH) MUST dùng **một template email riêng (cấu hình mới)**, với **PH mới là người nhận chính (TO)**.
- **FR-010**: Người phối hợp do người chủ trì thêm ở bước "Nhận việc" MUST nhận **chuông + email** (là người nhận chính/TO) ngay sau khi nhận việc (→ `Đang xử lý`). Mỗi lần gửi MUST chỉ tới người *mới* được thêm; không gửi lại cho người phối hợp đã có.
- **FR-014**: Khi người chủ trì "Nhận việc" và **bổ sung ≥1 người phối hợp mới**, hệ thống MUST hiển thị **popup giao việc** (dùng lại popup hiện có) để nhập nội dung; nếu **không** bổ sung người nào thì MUST không hiển thị popup. Nội dung nhập MUST được đưa vào email phối hợp (FR-009/FR-010).
- **FR-015**: Nội dung popup nhận việc MUST được lưu vào **trường riêng** (tách khỏi "Nội dung giao việc" của GĐ), KHÔNG ghi đè nội dung GĐ.
- **FR-016**: Màn hình chi tiết (preview) MUST hiển thị **cả hai** nội dung tách biệt với tiêu đề khác nhau: "Nội dung giao việc" (do GĐ nhập) và "Nội dung phối hợp" (do người chủ trì nhập). Trường rỗng có thể ẩn.
- **FR-017**: Template email "Phối hợp" MUST xuất hiện trong màn cấu hình email (Settings → Email thông báo) như một mục riêng để quản trị sửa tiêu đề/nội dung, và biến `{nộiDungPhoiHop}` MUST có trong danh sách biến khả dụng.
- **FR-011**: Hệ thống MUST không gửi email giao việc nếu thao tác lưu tài liệu không thành công.
- **FR-012**: Ở trạng thái `Chờ duyệt`, hệ thống MUST chỉ cho GĐ và admin/QTV thiết lập giao việc (chọn người phụ trách, thêm người phối hợp, điền nội dung giao việc); người phụ trách MUST chưa thao tác giao việc ở bước này. Nếu ở bước này có ≥1 người phối hợp, nội dung giao việc MUST bắt buộc (theo FR-005).
- **FR-013**: Hệ thống MUST chỉ cho người phụ trách thêm người phối hợp khi tài liệu ở trạng thái `Chờ xử lý` (qua thao tác "Nhận việc"), và thao tác này MUST tuân ràng buộc "chỉ thêm" (FR-002).

### Key Entities *(include if feature involves data)*

- **Tài liệu (Document)**: Đối tượng được giao việc. Thuộc tính liên quan: người phụ trách, danh sách người phối hợp, nội dung giao việc.
- **Người phối hợp (Coordinator)**: Người được giao phối hợp xử lý tài liệu. Quan hệ nhiều-một với tài liệu. Việc thêm một người phối hợp mới là sự kiện kích hoạt email.
- **Nội dung giao việc (Task description)**: Mô tả công việc kèm theo tài liệu; bắt buộc khi có ≥1 người phối hợp.
- **Vai trò người dùng (Role)**: Phân biệt nhóm được thêm người phối hợp (GĐ, admin/QTV, người phụ trách), nhóm toàn quyền xoá/sửa (admin/QTV, GĐ), và các vai trò không liên quan (VT) — quyết định được thêm/xoá/sửa người phối hợp hay không.
- **Email giao việc (Assignment email)**: Thông báo (kèm chuông) mang nội dung. Hai template: `giaoViec` (luồng GĐ — TO=chủ trì, CC=PH) và **template cấu hình mới** (luồng nhận việc — TO=PH mới). Mốc gửi gắn chuyển trạng thái (duyệt → `Chờ xử lý`; nhận việc → `Đang xử lý`).
- **Nội dung phối hợp (Coordinator message)**: Nội dung người chủ trì nhập ở **popup giao việc dùng lại** khi "Nhận việc". Lưu vào **trường/cột riêng** (tách khỏi "Nội dung giao việc" của GĐ), dùng cho email phối hợp và hiển thị trên preview.
- **Trạng thái giao việc (Workflow state)**: `Chờ duyệt` → `Chờ xử lý` → `Đang xử lý`. Quyết định ai được thao tác (GĐ/QTV ở `Chờ duyệt`; người phụ trách ở `Chờ xử lý`) và mốc gửi email.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% nỗ lực xoá người phối hợp bởi người phụ trách (không toàn quyền) bị từ chối — kể cả khi lách qua giao diện gọi trực tiếp máy chủ.
- **SC-002**: 100% thao tác lưu tài liệu có ≥1 người phối hợp nhưng thiếu nội dung giao việc bị chặn; 100% thao tác lưu không có người phối hợp và để trống nội dung giao việc thành công.
- **SC-003**: 100% người phối hợp mới được thêm nhận đúng một email dùng template riêng (luồng GĐ: template `giaoViec` mang "Nội dung giao việc"; luồng nhận việc: template phối hợp mang "Nội dung phối hợp"); 0% người phối hợp đã có từ trước nhận lại email khi không có thay đổi liên quan đến họ.
- **SC-004**: 0 trường hợp email giao việc được gửi khi thao tác lưu tài liệu thất bại.
- **SC-005**: Vai trò toàn quyền hoàn tất thêm/sửa/xoá người phối hợp mà không gặp ràng buộc "chỉ thêm" trong 100% trường hợp.

## Assumptions

- "Người phụ trách" là người chịu trách nhiệm chính của tài liệu, không thuộc nhóm toàn quyền; được thêm người phối hợp nhưng chịu ràng buộc "chỉ thêm" (không xoá/sửa).
- Nhóm được THÊM người phối hợp = {GĐ, admin/QTV, người phụ trách}. Nhóm toàn quyền XOÁ/SỬA = {admin/QTV, GĐ}. VT không có vai trò trong tính năng này (khác với feature 008, nơi VT thuộc nhóm toàn quyền cho phân quyền xem) vì VT không duyệt hồ sơ.
- "Người phối hợp mới" được xác định bằng so sánh tập người phối hợp trước và sau khi lưu; chỉ phần chênh lệch (mới thêm) kích hoạt email.
- Việc gửi email là best-effort: nếu gửi email thất bại, việc thêm người phối hợp đã lưu vẫn giữ nguyên (không rollback); lỗi gửi được ghi nhận để theo dõi. Đây là hành vi mặc định hợp lý cho ứng dụng GAS gửi mail; điều chỉnh nếu nghiệp vụ yêu cầu đảm bảo gửi.
- Chỉnh sửa nội dung giao việc trên một tài liệu đã có người phối hợp (không thêm người mới) không gửi lại email cho người cũ.
- Feature này độc lập (trực giao) với phân quyền *xem* tài liệu của feature 008; không thay đổi cách quyết định ai được xem tài liệu.
- Tận dụng cơ chế gửi email và mô hình tài liệu/người dùng sẵn có của ứng dụng docmgr.
- "Người chủ trì" = người phụ trách (PT) của tài liệu; là người thực hiện "Nhận việc".
- Popup nhập nội dung lúc nhận việc **dùng lại popup giao việc** hiện có (không tạo popup mới); nội dung **bắt buộc** khi có bổ sung PH (giống popup giao việc), và **lưu vào cột riêng** "Nội dung phối hợp" (tách khỏi "Nội dung giao việc" của GĐ) — cần **thêm cột + bump SCHEMA_V**.
- Email luồng nhận việc gửi PH mới làm **TO** (người nhận chính). Triển khai gửi đích danh từng PH mới (mỗi người 1 email) để vừa là người nhận chính vừa cá nhân hoá tên.
