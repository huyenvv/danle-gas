# Feature Specification: Phân quyền xem đến từng tài liệu

**Feature Branch**: `008-document-permissions`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Bổ sung phân quyền đến từng tài liệu. Cách phân quyền giống với phân quyền cho danh mục cha: mặc định những người được xem thư mục (danh mục) sẽ được xem tài liệu trong thư mục đó. Nhưng nếu có phân quyền riêng cho 1 người hoặc nhóm người ở cấp tài liệu thì chỉ người/nhóm đó xem được tài liệu đó. Ngoài ra khi phát hành, những người trong danh sách phát hành cũng xem được tài liệu đó. Tính năng import excel cũng cần hỗ trợ việc này: Import excel bổ sung thêm 1 cột 'phân quyền' nó sẽ phải map với tên 'nhóm' đã được tạo sẵn trên ứng dụng. Nếu không tồn tại tên nhóm trên phần mềm thì không tạo tài liệu."

## Bối cảnh vấn đề

Hiện tại docmgr chỉ phân quyền xem ở **cấp danh mục**: mỗi danh mục có hai trường `Người được xem` và `Nhóm được xem`. Một người không phải quản trị chỉ thấy được các tài liệu nằm trong danh mục mà họ (hoặc nhóm của họ) được xem; nếu cả hai trường trống thì mọi người đều xem được danh mục đó. Cấp danh mục là quá thô: trong cùng một danh mục mà nhiều người được xem, vẫn có những tài liệu chỉ nên giới hạn cho một người hoặc một nhóm.

Tính năng này thiết lập một **mô hình hiển thị theo vòng đời tài liệu**, kết hợp phân quyền xem ở cấp tài liệu:

1. **Khi tài liệu chưa hoàn thành** (đang trong quy trình xử lý): chỉ những người **tham gia** vào tài liệu mới thấy nó — phân quyền xem chưa có hiệu lực ở giai đoạn này.
2. **Khi tài liệu đã hoàn thành**: phân quyền xem có hiệu lực — nếu tài liệu có **phân quyền riêng** thì chỉ người/nhóm đó xem được; nếu không, kế thừa quyền xem của **danh mục cha**.
3. **Khi phát hành**: nếu tài liệu **đã có phân quyền riêng**, người được Văn thư chọn nhận mà vốn có quyền xem danh mục cha nhưng đang bị phân quyền riêng loại trừ sẽ được **tự động thêm vào danh sách được xem**; nếu tài liệu **không** có phân quyền riêng thì phát hành không đổi gì (giữ kế thừa danh mục).

Các vai trò toàn quyền (admin, Quản trị viên, Giám đốc, Văn thư) luôn xem được mọi tài liệu (trừ nháp của người khác). Đường tạo tài liệu hàng loạt qua **import Excel** cũng phải đặt được phân quyền này ngay khi nhập, qua một cột map theo tên nhóm.

## Clarifications

### Session 2026-06-18

- Q: Ai được đặt/sửa phân quyền riêng của tài liệu? → A: Bất kỳ ai **có quyền chỉnh sửa tài liệu** đều đặt/sửa được — không cần cờ quyền riêng (an toàn vì vai trò toàn quyền luôn xem được).
- Q: Quy tắc "tài liệu chưa hoàn thành chỉ người tham gia xem" áp dụng cho phạm vi nào? → A: **Tất cả tài liệu** (không chỉ tài liệu có phân quyền riêng). Phân quyền xem (riêng hoặc kế thừa danh mục) **chỉ có hiệu lực khi tài liệu đã Hoàn thành**; trước đó chỉ người tham gia và vai trò toàn quyền xem được. Quy tắc này thay thế ràng buộc hẹp "Chờ duyệt/Từ chối" trước đó bằng một mô hình vòng đời chung.
- Bổ sung (người dùng cung cấp): (1) Khi **Hoàn thành**, tài liệu có phân quyền riêng thì người/nhóm đó xem; không có thì người có quyền xem danh mục cha xem. (2) Khi **Văn thư phát hành** chọn người chưa nằm trong danh sách được xem của tài liệu thì hệ thống **tự động thêm** họ vào danh sách được xem.
- Q: Quy tắc phát hành tự-động-thêm vào `Người được xem` nên thu hẹp thế nào để không kích hoạt override ngoài ý muốn? → A: Chỉ thêm khi tài liệu **đã có** phân quyền riêng (không có thì không làm gì thêm); và chỉ thêm người nhận **không** nằm trong phân quyền riêng **nhưng có** quyền xem danh mục cha chứa tài liệu. Người nhận không có quyền xem danh mục cha thì **không** được tự động thêm.
- Q: Ai (người phát hành nào) được phép bổ sung người xem khi phát hành? → A: **Chỉ Văn thư, Giám đốc, admin/Quản trị viên**. Người chỉ có cờ "Được phát hành" (không thuộc các vai trò trên) khi phát hành chỉ **gửi email**, không thay đổi danh sách người xem.
- Q: Đặt phân quyền xem cho tài liệu ở đâu, ai đặt? → A: Ở **màn chi tiết tài liệu** (không phải màn sửa) vì quyền chỉ hiệu lực khi Hoàn thành — lúc đó hồ sơ đã khóa sửa; thao tác **tách khỏi luồng sửa** (`setDocumentViewers`) nên đặt được trên cả tài liệu đã Hoàn thành. **Chỉ vai trò toàn quyền** (admin/QTV/GĐ/VT) được đặt; bỏ picker khỏi màn tạo/sửa hồ sơ.

### Session 2026-06-18 (revise — mô hình "chỉ theo người")

Người dùng chỉnh lại requirement sau khi test (các quyết định này **GHI ĐÈ** phần liên quan ở trên):

- **Bỏ nhóm ở cấp tài liệu** → phân quyền tài liệu **chỉ theo người** (`Người được xem`). Nhóm chỉ còn dùng để tích sẵn lúc tạo + khai triển khi import. (FR-001, FR-004, FR-010)
- **Tạo mới tự tích người-xem-của-danh-mục** (khai triển nhóm danh mục → người); đổi danh mục thì tích lại. (FR-008a)
- **Tạo/Sửa có giao diện tích quyền** (đưa picker trở lại modal) — **ghi đè** quyết định "chỉ ở màn chi tiết" trước đó. Màn chi tiết vẫn giữ ô sửa cho tài liệu đã Hoàn thành/khóa sửa (chỉ toàn quyền). (FR-008)
- **Phát hành (VT/GĐ/admin)** → thêm **mọi** người nhận chưa có vào `Người được xem` (**vô điều kiện**, bỏ điều kiện "có quyền danh mục" / "đã có override" trước đó). (FR-005)
- **Doc list** hiển thị mọi tài liệu mà người dùng nằm trong `Người được xem`, **bất kể** quyền danh mục cha → visibility khi Hoàn thành là **category-independent**; danh sách rỗng mới fallback kế thừa danh mục. (FR-009, FR-004, FR-003)
- **Giữ lifecycle**: chưa Hoàn thành → chỉ người tham gia. **Import**: tên nhóm → khai triển thành viên vào `Người được xem`.

### Session 2026-06-19 (revise — snapshot là nguồn chân lý)

Người dùng chỉnh lại để xoá quyền trong folder **không** làm mất quyền xem tài liệu cũ (các quyết định này **GHI ĐÈ** phần liên quan ở trên):

- Q: Tài liệu Hoàn thành có `Người được xem` **rỗng** nên hiển thị cho ai; cơ chế nào đảm bảo người bị xoá khỏi folder vẫn xem được tài liệu cũ? → A: **Option A — snapshot là nguồn chân lý.** `Người được xem` của tài liệu là nguồn chân lý duy nhất (snapshot lúc tạo). Rỗng → **chỉ** vai trò toàn quyền (admin/QTV/GĐ/VT) + người tham gia (người tạo/phụ trách/phối hợp) xem; **bỏ hẳn fallback kế thừa danh mục động** (FR-003). Lúc tạo, hệ thống copy người-được-xem của danh mục vào danh sách riêng của tài liệu → xoá người khỏi folder về sau **không** ảnh hưởng tài liệu cũ. Danh mục **trống quyền** → tài liệu mới có danh sách rỗng → chỉ toàn quyền + người tham gia thấy (không còn "mọi người xem"). Cần **migration backfill** snapshot cho tài liệu cũ đang rỗng (FR-013).
- Q: Cột "Phân quyền" khi import cần tách nhiều nhóm mà tên nhóm có thể chứa dấu phẩy — định dạng nào? → A: **Quy tắc kiểu CSV.** Tách theo dấu phẩy ở cấp ngoài; tên nhóm chứa dấu phẩy phải bọc trong **dấu nháy kép** `"..."`; trim khoảng trắng đầu/cuối mỗi tên. Ví dụ `BGĐ, "Trưởng, Phó phòng", "GĐ, PGĐ NM", Email NMTĐ` → 4 nhóm: `BGĐ` / `Trưởng, Phó phòng` / `GĐ, PGĐ NM` / `Email NMTĐ`. (FR-010)

> **Ghi chú (2026-06-19)**: phần "workflow giao việc cho người phối hợp" (trước đây gắn tạm vào 008) đã **TÁCH RA** thành feature riêng — xem `specs/_deferred-us6-giao-viec-phoi-hop.md`. 008 chỉ còn phạm vi **phân quyền xem**.

### Session 2026-06-19 (revise — picker dạng popup)

Sau khi test app deploy, người dùng phản hồi dropdown inline chọn người **quá nhỏ + nhảy giật**, khó thao tác. Chỉnh UI (GHI ĐÈ FR-008/FR-008a phần giao diện):

- Q: Đặt `Người được xem` ở màn tạo/sửa bằng giao diện nào? → A: **Popup (modal) chọn người.** Màn tạo/sửa chỉ còn nút "Phân quyền xem — N người" mở popup. Popup: gom **theo phòng ban** (mỗi phòng có "Chọn tất cả"), có ô tìm kiếm, và **2 chế độ nhanh loại trừ** ở đầu — "Tất cả" (mọi người chọn được) / "Theo danh mục" (chỉ người danh mục đã phân quyền). **Lưu tạm**: bấm "Chọn" mới ghi + đóng; "Hủy"/đóng = bỏ. Đóng xong hiện tổng số người đã chọn. (FR-008)
- Q: Đổi danh mục thì danh sách người xem xử lý sao? → A: **Cả tạo mới lẫn sửa**: đổi danh mục → tự đặt lại theo người-xem của danh mục mới + **cảnh báo**; không ghi đè ở lần mở form (chỉ khi đổi thật). (FR-008a)
- Q: Chọn danh mục **con** thì người-xem tính thế nào? → A: **Kế thừa ngược lên danh mục CHA.** Snapshot/"Theo danh mục" gộp người-được-xem (trực tiếp + khai triển nhóm) của danh mục con **và mọi danh mục tổ tiên** theo chuỗi `Danh mục cha` (chống lặp). Áp dụng đồng nhất ở 3 nơi: client tạo/sửa, client chi tiết, server import/backfill. (FR-008a/FR-010/FR-013)
- Q: User không được phân quyền danh mục nhưng có tài liệu được phân quyền riêng trong đó → list hiện "(Chưa phân danh mục)". Xử lý? → A: **BỎ lọc quyền danh mục theo user** (`getAllData` trả về **tất cả** danh mục). Quyền danh mục giờ **chỉ** là template snapshot, không còn lọc duyệt. Hiển thị tài liệu hoàn toàn theo quyền cấp **tài liệu**; client **ẩn danh mục không có tài liệu** nào user xem được (CatGroup `total===0` → null). → tài liệu được phân quyền riêng hiện đúng tên danh mục (đệ quy cả cha). (FR-009)

## User Scenarios & Testing *(mandatory)*

> **Lưu ý đồng bộ**: US1 vẫn đúng. US2/US3/US4/US5 bên dưới mô tả theo bản đầu (có nhóm/override/điều kiện danh mục/**kế thừa danh mục động**); phần mâu thuẫn đã được **GHI ĐÈ** bởi Clarifications "Session 2026-06-18 (revise — chỉ theo người)" và "Session 2026-06-19 (revise — snapshot là nguồn chân lý)" cùng các FR-001/003/004/005/008/008a/010/013. Tóm tắt bản mới nhất: tài liệu chỉ lưu `Người được xem` (theo người), là **snapshot nguồn chân lý** lúc tạo; Hoàn thành + danh sách không rỗng → category-independent; Hoàn thành + **rỗng → chỉ toàn quyền + người tham gia** (KHÔNG kế thừa danh mục động — US2 đã lỗi thời ở điểm này); danh mục trống quyền → tài liệu mới rỗng → chỉ toàn quyền + người tham gia; publish (VT/GĐ/admin) thêm mọi người nhận; import khai triển nhóm → người; migration backfill tài liệu cũ rỗng (FR-013).

### User Story 1 - Tài liệu chưa hoàn thành chỉ người tham gia mới thấy (Priority: P1)

Khi một tài liệu còn **đang trong quy trình** (chưa ở trạng thái "Hoàn thành"), chỉ những người **tham gia** vào tài liệu — người tạo, người phụ trách, người phối hợp **đã được gắn** vào tài liệu — mới xem được nó. Người chưa được gắn (kể cả người được xem danh mục hay người có phân quyền riêng) chưa thấy tài liệu cho đến khi nó hoàn thành. Vai trò toàn quyền (admin, Quản trị viên, Giám đốc, Văn thư) vẫn xem được.

**Why this priority**: Đây là khung hiển thị nền tảng theo vòng đời — quyết định ai thấy tài liệu ở mỗi giai đoạn. Mọi quy tắc phân quyền khác chỉ áp dụng *sau* khi tài liệu hoàn thành, nên khung này phải đúng trước.

**Independent Test**: Tạo một tài liệu, đưa qua các trạng thái trước "Hoàn thành". Người tham gia (đã gắn phụ trách/phối hợp) → thấy; người ngoài (dù được xem danh mục) → không thấy; admin/GĐ/VT → thấy.

**Acceptance Scenarios**:

1. **Given** một tài liệu chưa hoàn thành mà người dùng **không** được gắn tham gia, **When** người dùng (không phải vai trò toàn quyền) xem danh sách, **Then** tài liệu **không** hiển thị — kể cả khi người đó được xem danh mục chứa tài liệu.
2. **Given** một tài liệu chưa hoàn thành, **When** người phụ trách hoặc người phối hợp đã được gắn xem danh sách, **Then** tài liệu hiển thị và mở được.
3. **Given** một tài liệu chưa hoàn thành có phân quyền riêng cho nhóm X, **When** một thành viên nhóm X (chưa được gắn tham gia, không phải vai trò toàn quyền) xem danh sách, **Then** tài liệu **không** hiển thị (phân quyền riêng chưa có hiệu lực khi chưa hoàn thành).
4. **Given** một tài liệu ở bất kỳ trạng thái nào, **When** một vai trò toàn quyền (admin/QTV/GĐ/VT) xem, **Then** tài liệu hiển thị (trừ nháp của người khác).

---

### User Story 2 - Tài liệu hoàn thành không có phân quyền riêng kế thừa danh mục (Priority: P1)

Khi một tài liệu đã **Hoàn thành** và **không** đặt phân quyền riêng, quyền xem của nó được quyết định theo quyền của **danh mục cha** chứa nó — đúng như mô hình quen thuộc ở cấp danh mục. Người được xem danh mục (trực tiếp hoặc qua nhóm) xem được; nếu danh mục để trống quyền thì mọi người đều xem được.

**Why this priority**: Đây là hành vi mặc định cho phần lớn tài liệu đã hoàn thành — giữ trải nghiệm phân quyền theo danh mục mà người dùng đã quen.

**Independent Test**: Lấy một tài liệu Hoàn thành không đặt quyền riêng trong một danh mục có `Người được xem`/`Nhóm được xem`. Người trong danh sách danh mục → xem được; người ngoài → không. Danh mục để trống quyền → mọi người xem được.

**Acceptance Scenarios**:

1. **Given** một tài liệu Hoàn thành không đặt quyền riêng trong danh mục mà người dùng được xem, **When** người dùng xem danh sách/mở tài liệu, **Then** tài liệu hiển thị và mở được.
2. **Given** một tài liệu Hoàn thành không đặt quyền riêng trong danh mục mà người dùng **không** được xem, **When** người dùng xem danh sách, **Then** tài liệu không hiển thị.
3. **Given** một danh mục để trống cả hai trường quyền, **When** người dùng thường xem danh sách, **Then** các tài liệu Hoàn thành không đặt quyền riêng trong danh mục đó đều hiển thị.

---

### User Story 3 - Tài liệu hoàn thành có phân quyền riêng thì chỉ người/nhóm đó xem được (Priority: P1)

Người phụ trách đặt phân quyền riêng cho một tài liệu, chọn một hoặc nhiều người và/hoặc một hoặc nhiều nhóm. Khi tài liệu đã **Hoàn thành**, **chỉ** những người được chọn (trực tiếp hoặc thuộc nhóm được chọn), cùng người tham gia và vai trò toàn quyền, mới xem được tài liệu — quyền kế thừa từ danh mục **không còn áp dụng** cho tài liệu này (phân quyền riêng thay thế quyền danh mục).

**Why this priority**: Đây chính là giá trị cốt lõi người dùng yêu cầu — siết quyền xem xuống từng tài liệu. Không có nó, tính năng vô nghĩa.

**Independent Test**: Đặt quyền riêng cho một tài liệu Hoàn thành là "nhóm A". Thành viên nhóm A → xem được. Một người được xem danh mục nhưng không thuộc nhóm A → không xem được tài liệu đó nhưng vẫn xem được các tài liệu Hoàn thành khác (không đặt quyền) trong cùng danh mục.

**Acceptance Scenarios**:

1. **Given** một tài liệu Hoàn thành đặt quyền riêng cho một nhóm, **When** một thành viên của nhóm đó xem danh sách, **Then** tài liệu hiển thị và mở được.
2. **Given** một tài liệu Hoàn thành đặt quyền riêng cho nhóm A, **When** một người được xem danh mục nhưng không thuộc nhóm A xem danh sách, **Then** tài liệu **không** hiển thị (quyền danh mục bị quyền riêng thay thế).
3. **Given** một tài liệu Hoàn thành đặt quyền riêng cho một cá nhân, **When** chính cá nhân đó xem, **Then** xem được; **When** người khác (không trong quyền riêng) xem, **Then** không xem được.
4. **Given** một tài liệu đang có quyền riêng, **When** người phụ trách xoá hết quyền riêng, **Then** tài liệu quay lại kế thừa quyền của danh mục (khi Hoàn thành).

---

### User Story 4 - Phát hành thêm lại người bị phân quyền riêng loại trừ (Priority: P2)

Khi **Văn thư, Giám đốc, hoặc admin** phát hành một tài liệu **đã có phân quyền riêng**, có những người vốn có quyền xem danh mục cha nhưng đang bị phân quyền riêng (override) loại trừ. Nếu một người nhận thuộc nhóm này (có quyền xem danh mục cha, chưa nằm trong phân quyền riêng), hệ thống **tự động thêm** họ vào danh sách `Người được xem` của tài liệu để họ xem được. Nếu tài liệu **không** có phân quyền riêng, phát hành **không** thay đổi danh sách — tài liệu vẫn ở chế độ kế thừa danh mục và người xem danh mục vẫn thấy như thường. Người nhận **không** có quyền xem danh mục cha sẽ không được tự động thêm. Người phát hành **chỉ có cờ "Được phát hành"** (không phải VT/GĐ/admin) chỉ gửi email — **không** bổ sung người xem.

**Why this priority**: Phát hành cần đảm bảo người nhận đáng lẽ thấy được (theo danh mục) không bị override chặn; nhưng phải tránh vô tình biến tài liệu kế-thừa-danh-mục thành override. Là nhánh bổ sung nên ưu tiên sau.

**Independent Test**: Phát hành một tài liệu **có** phân quyền riêng tới người X (X có quyền xem danh mục cha, chưa trong phân quyền riêng) → X được thêm vào `Người được xem`. Phát hành một tài liệu **không** có phân quyền riêng → danh sách không đổi. Phát hành tới người Y không có quyền xem danh mục cha → Y không được thêm.

**Acceptance Scenarios**:

1. **Given** một tài liệu **có** phân quyền riêng, người X có quyền xem danh mục cha nhưng chưa nằm trong phân quyền riêng, **When** Văn thư phát hành và chọn X, **Then** X được thêm vào `Người được xem` của tài liệu.
2. **Given** một tài liệu **không** có phân quyền riêng, **When** Văn thư phát hành và chọn người nhận, **Then** danh sách `Người được xem` **không** thay đổi (không kích hoạt override; người xem danh mục vẫn thấy).
3. **Given** một người nhận đã có sẵn trong phân quyền riêng, **When** phát hành chọn lại người đó, **Then** không tạo bản trùng trong danh sách.
4. **Given** một tài liệu **có** phân quyền riêng, người Y **không** có quyền xem danh mục cha và không trong phân quyền riêng, **When** Văn thư phát hành và chọn Y, **Then** Y **không** được tự động thêm (phát hành không mở rộng quyền ra ngoài tập người xem danh mục).
5. **Given** một tài liệu **có** phân quyền riêng, **When** một người **chỉ có cờ "Được phát hành"** (không phải VT/GĐ/admin) phát hành và chọn người nhận đủ điều kiện, **Then** hệ thống chỉ gửi email, danh sách `Người được xem` **không** thay đổi.

---

### User Story 5 - Import Excel đặt phân quyền theo tên nhóm (Priority: P2)

Khi nhập tài liệu hàng loạt từ Excel, người dùng có thể thêm một cột **"Phân quyền"** chứa tên nhóm đã tạo sẵn trong ứng dụng. Hệ thống ánh xạ tên nhóm trong cột này sang nhóm tương ứng và đặt làm phân quyền riêng (nhóm được xem) cho tài liệu được tạo. Nếu một tên nhóm trong cột **không tồn tại** trong ứng dụng, hệ thống **không tạo** tài liệu đó và báo lỗi rõ ràng.

**Why this priority**: Import là đường tạo tài liệu hàng loạt; phải đặt được quyền ngay lúc nhập để không phải sửa thủ công sau đó. Là nhánh độc lập, thực hiện sau khi mô hình quyền đã rõ.

**Independent Test**: Chuẩn bị file import có cột "Phân quyền": (a) tên một nhóm có thật → tạo thành công với quyền riêng đúng nhóm; (b) tên nhóm không tồn tại → không được tạo, có thông báo lỗi; (c) để trống cột → tạo bình thường, không đặt quyền riêng (kế thừa danh mục).

**Acceptance Scenarios**:

1. **Given** một dòng import có cột "Phân quyền" ghi tên một nhóm tồn tại, **When** chạy import, **Then** tài liệu được tạo với phân quyền riêng là nhóm đó.
2. **Given** một dòng import có cột "Phân quyền" ghi tên nhóm **không** tồn tại, **When** chạy import, **Then** tài liệu đó **không** được tạo và có cảnh báo/lỗi nêu rõ tên nhóm không hợp lệ.
3. **Given** một dòng import để **trống** cột "Phân quyền", **When** chạy import, **Then** tài liệu được tạo bình thường và kế thừa quyền của danh mục (không đặt quyền riêng).
4. **Given** cột "Phân quyền" liệt kê nhiều tên nhóm (phân tách bằng dấu phẩy), **When** chạy import, **Then** tài liệu được đặt quyền riêng cho tất cả các nhóm đó; nếu **bất kỳ** tên nào không tồn tại thì tài liệu không được tạo.

---

### Edge Cases

- **Tài liệu nháp**: quy tắc hiện tại "nháp chỉ người tạo thấy" được giữ nguyên và có ưu tiên cao nhất — không vai trò nào khác (kể cả phân quyền riêng) thấy nháp của người khác.
- **Người được phân quyền nhưng tài liệu chưa hoàn thành**: chưa thấy tài liệu cho đến khi nó Hoàn thành (US1). Phân quyền riêng chỉ "kích hoạt" ở trạng thái Hoàn thành.
- **Người phụ trách / phối hợp được gắn giữa chừng**: ngay khi được gắn vào tài liệu chưa hoàn thành, họ thấy tài liệu; trước khi được gắn thì không.
- **Vai trò toàn quyền** (admin, Quản trị viên, Giám đốc, Văn thư): xem được mọi tài liệu ở mọi trạng thái (trừ nháp của người khác), không bị phân quyền riêng/khung vòng đời chặn.
- **Phát hành** *(revise 2026-06-19)*: VT/GĐ/admin phát hành → thêm **mọi** người nhận chưa có vào `Người được xem`, **kể cả khi danh sách rỗng** (rỗng = chưa nhân viên nào thấy nên không khóa nhầm ai). Không còn khái niệm "kế thừa danh mục" để bảo toàn.
- **Quyền riêng trỏ tới người/nhóm đã bị xoá**: quyền chỉ đơn giản không khớp ai; tài liệu vẫn tồn tại nhưng bị giới hạn (chỉ người tham gia + vai trò toàn quyền thấy) — không gây lỗi hệ thống.
- **Đổi danh mục của một tài liệu đã tạo**: `Người được xem` (snapshot) giữ nguyên — không re-snapshot theo danh mục mới (snapshot chỉ chạy lúc tạo). Không còn fallback danh mục động nên đổi danh mục không đổi quyền xem tài liệu đã tạo.
- **Tài liệu import**: được tạo ở trạng thái Hoàn thành nên `Người được xem` (snapshot lúc import) có hiệu lực ngay.
- **Cột "Phân quyền" trong import có khoảng trắng thừa / khác hoa-thường**: việc khớp tên nhóm cần bỏ qua khoảng trắng đầu/cuối; mức độ phân biệt hoa-thường theo cách khớp tên nhóm hiện hành của ứng dụng.
- **Tên nhóm chứa dấu phẩy trong cột "Phân quyền"**: phải bọc trong dấu nháy kép `"..."` để không bị tách nhầm (vd `"Trưởng, Phó phòng"` là MỘT nhóm). Tên không bọc nháy kép được tách tại mỗi dấu phẩy. Nháy kép lệch/thiếu cặp → coi như tên nhóm không khớp → cảnh báo + bỏ qua tài liệu (FR-011).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mỗi tài liệu MUST có khả năng lưu phân quyền xem riêng **chỉ theo NGƯỜI** — một danh sách `Người được xem` (userId). **Không** lưu nhóm ở cấp tài liệu.
- **FR-002**: Khi một tài liệu **chưa** ở trạng thái "Hoàn thành" (và không phải nháp), hệ thống MUST chỉ cho **người tham gia** (người tạo, người phụ trách, người phối hợp đã được gắn vào tài liệu) và các vai trò toàn quyền xem tài liệu; phân quyền `Người được xem` **chưa** có hiệu lực ở giai đoạn này (giữ khung vòng đời).
- **FR-003**: Khi một tài liệu đã **Hoàn thành** và `Người được xem` **rỗng**, hệ thống MUST chỉ cho **vai trò toàn quyền** (admin/QTV/GĐ/VT) và **người tham gia** (người tạo/phụ trách/phối hợp) xem — **không** kế thừa quyền danh mục động. (Danh mục là nguồn **snapshot lúc tạo**, không phải fallback động — FR-008a/FR-013.)
- **FR-004**: Khi một tài liệu đã **Hoàn thành** và `Người được xem` **không rỗng**, hệ thống MUST cho người nằm trong danh sách (cùng người tham gia và vai trò toàn quyền) xem tài liệu, **bất kể** quyền danh mục cha (category-independent). Người ngoài danh sách không xem được dù có quyền danh mục.
- **FR-005** *(revise 2026-06-19 — GHI ĐÈ)*: Khi **người phát hành** là VT/GĐ/admin/Quản trị viên, hệ thống MUST thêm **mọi** người nhận (TO+CC) **chưa** có vào `Người được xem` (không trùng), **kể cả khi danh sách đang rỗng** — vì theo mô hình snapshot, rỗng = chưa nhân viên nào thấy (chỉ toàn quyền + người tham gia) nên cộng người nhận không khóa nhầm ai. Người chỉ có cờ "Được phát hành" MUST chỉ gửi email.
- **FR-006**: Hệ thống MUST cho các vai trò toàn quyền (admin, Quản trị viên, Giám đốc, Văn thư) xem mọi tài liệu ở mọi trạng thái, **trừ** nháp của người khác — không bị khung vòng đời (FR-002) hay phân quyền riêng (FR-004) chặn.
- **FR-007**: Hệ thống MUST giữ nguyên quy tắc tài liệu **nháp** chỉ người tạo thấy, với ưu tiên cao nhất.
- **FR-008** *(revise 2026-06-19 — picker popup)*: Hệ thống MUST đặt `Người được xem` qua một **popup (modal) chọn người**, mở từ: (a) màn **tạo/sửa** tài liệu (nút "Phân quyền xem — N người") — người có quyền sửa tài liệu; (b) màn **chi tiết** — chỉ **vai trò toàn quyền**, mở **cùng popup** (nút "Sửa"), lưu qua `setDocumentViewers`, đặt được kể cả khi tài liệu đã Hoàn thành (khóa sửa). Popup MUST: (1) gom người **theo phòng ban**, mỗi phòng có nút **"Chọn tất cả / Bỏ chọn"**; (2) có **ô tìm kiếm**; (3) ở đầu có **2 chế độ chọn nhanh loại trừ** — **"Tất cả"** (toàn bộ người chọn được) và **"Theo danh mục"** (chỉ người danh mục đang chọn đã phân quyền); sửa tay → về "tùy chỉnh" (bỏ tích cả hai); (4) **lưu tạm** — chỉ ghi vào hồ sơ khi bấm **"Chọn"**; **"Hủy"**/đóng thì bỏ thay đổi; (5) sau khi đóng, màn tạo/sửa hiển thị **tổng số người đã chọn**. *(Thay giao diện dropdown inline trước đó để tránh khó thao tác.)* Khi lưu, hệ thống MUST **báo (unread/chuông) cho những người MỚI** được thêm vào `Người được xem` (không re-báo người đã có).
- **FR-008a** *(revise 2026-06-19)*: Khi người dùng **chọn danh mục lúc tạo mới** hoặc **đổi danh mục ở màn sửa**, hệ thống MUST tự đặt `Người được xem` = snapshot người-xem của danh mục đang chọn (người trực tiếp + **khai triển thành viên** nhóm-được-xem) **+ kế thừa ngược lên các danh mục CHA** (đi theo chuỗi `Danh mục cha`) và **hiển thị cảnh báo** đã đặt lại danh sách theo danh mục mới. KHÔNG tự ghi đè ở lần **mở form** (chỉ khi người dùng **thực sự đổi** danh mục). Cảnh báo chỉ hiện khi **ghi đè một lựa chọn trước** (đổi từ danh mục đã có sang danh mục khác); lần **đầu chọn** danh mục lúc tạo mới thì auto-tích **lặng lẽ** (không cảnh báo). Người dùng vẫn chỉnh trước khi lưu. Snapshot **lưu cùng tài liệu**, là nguồn chân lý — danh mục đổi/xoá quyền về sau **không** ảnh hưởng tài liệu đã tạo. Danh mục **trống quyền** → snapshot rỗng (FR-003).
- **FR-009** *(revise)*: Việc lọc danh sách tài liệu theo quyền MUST cho ra cùng kết quả với việc kiểm tra quyền khi mở từng tài liệu (danh sách và truy cập trực tiếp nhất quán). Hiển thị tài liệu MUST **hoàn toàn theo quyền cấp tài liệu** (`Người được xem`) — quyền cấp **danh mục KHÔNG còn gate việc duyệt/hiển thị** (`getAllData` trả về tất cả danh mục). Danh sách MUST hiển thị **mọi** tài liệu người dùng nằm trong `Người được xem`, **kể cả** trong danh mục họ không được phân quyền; UI hiển thị đúng **tên danh mục (đệ quy cả cha)** và **ẩn danh mục không có tài liệu** nào người dùng xem được.
- **FR-010**: Import Excel MUST nhận một cột tuỳ chọn **"Phân quyền"** chứa một hoặc nhiều **tên nhóm** đã tồn tại, phân tách kiểu **CSV**: dấu phẩy là dấu tách ở cấp ngoài; tên nhóm chứa dấu phẩy MUST được bọc trong **dấu nháy kép** `"..."`; trim khoảng trắng đầu/cuối mỗi tên (vd `BGĐ, "Trưởng, Phó phòng", "GĐ, PGĐ NM", Email NMTĐ` → 4 nhóm). Hệ thống MUST **khai triển mỗi nhóm thành các thành viên (userId)** và đặt hợp các thành viên làm `Người được xem` của tài liệu được tạo (snapshot lúc import).
- **FR-011**: Khi cột "Phân quyền" của một tài liệu import chứa **bất kỳ** tên nhóm nào không tồn tại, hệ thống MUST **không tạo** tài liệu đó và MUST ghi cảnh báo/lỗi nêu rõ tên nhóm không hợp lệ (cờ đỏ ngay ở màn preview + chặn ở server).
- **FR-012** *(revise 2026-06-19)*: Khi cột "Phân quyền" của một tài liệu import để **trống**, hệ thống MUST tạo tài liệu và đặt `Người được xem` = **snapshot quyền danh mục cha** (`_categoryViewerIds` — người trực tiếp + khai triển nhóm), giống đường tạo thủ công (FR-008a). Danh mục cha trống quyền → `Người được xem` rỗng (siết theo FR-003).
- **FR-013**: Hệ thống MUST có **migration backfill** một lần: với mỗi tài liệu hiện hữu đang có `Người được xem` rỗng, snapshot người-được-xem của danh mục cha (người trực tiếp + khai triển nhóm) vào `Người được xem` của tài liệu — để dữ liệu cũ không bị ẩn khi bỏ fallback động (FR-003). Tài liệu có danh mục cha trống quyền giữ danh sách rỗng (chỉ toàn quyền + người tham gia thấy).

### Key Entities

- **Phân quyền tài liệu (Document viewing permission)**: một danh sách `Người được xem` (userId) gắn với tài liệu — **chỉ theo người**, không có nhóm; là **nguồn chân lý** (snapshot lúc tạo). Rỗng = chỉ vai trò toàn quyền + người tham gia xem (KHÔNG fallback danh mục động). Chỉ có hiệu lực khi tài liệu đã Hoàn thành.
- **Tài liệu (Hồ sơ)**: đơn vị nghiệp vụ thuộc một danh mục, có **trạng thái** vòng đời và danh sách người tham gia (người tạo, người phụ trách, người phối hợp); mang thêm `Người được xem`.
- **Người tham gia**: người tạo, người phụ trách, người phối hợp đã được gắn — nhóm duy nhất (ngoài vai trò toàn quyền) thấy tài liệu khi chưa hoàn thành.
- **Danh mục (Category)**: thư mục tổ chức tài liệu (có cây cha-con qua `Danh mục cha`), vẫn có `Người được xem` + `Nhóm được xem`; là **nguồn snapshot lúc tạo** `Người được xem` của tài liệu (khai triển nhóm danh mục → người, **kế thừa ngược lên các danh mục cha**). **Không còn là fallback động** cũng **không còn lọc duyệt** — quyền danh mục **chỉ** là template snapshot. `getAllData` trả về **tất cả** danh mục; client ẩn danh mục không có tài liệu user xem được. Đổi/xoá quyền danh mục không ảnh hưởng tài liệu đã tạo. Danh mục trống quyền → tài liệu mới snapshot rỗng.
- **Nhóm (Group)**: tập người dùng có tên + thành viên; **không** gắn trực tiếp vào tài liệu nữa — chỉ dùng để (a) tích sẵn lúc tạo và (b) khai triển → người khi import cột "Phân quyền".
- **Phát hành**: hành động VT/GĐ/admin gửi tài liệu tới người nhận; mọi người nhận chưa có trong `Người được xem` được tự động thêm vào danh sách.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tài liệu **chưa hoàn thành** chỉ hiển thị cho người tham gia và vai trò toàn quyền — người ngoài (kể cả người được xem danh mục hay người được phân quyền riêng) không thấy — đúng 100% trường hợp kiểm thử.
- **SC-002**: Tài liệu **Hoàn thành** + `Người được xem` rỗng → chỉ vai trò toàn quyền + người tham gia xem (không kế thừa danh mục động); danh mục trống quyền → tài liệu mới rỗng nên chỉ toàn quyền + người tham gia thấy — đúng 100% trường hợp.
- **SC-003**: Tài liệu **Hoàn thành** + `Người được xem` không rỗng: chỉ người trong danh sách (cộng người tham gia, vai trò toàn quyền) xem được, **bất kể** quyền danh mục; người ngoài danh sách không xem được dù có quyền danh mục — đúng 100% trường hợp.
- **SC-004** *(revise 2026-06-19)*: VT/GĐ/admin phát hành → mọi người nhận (TO+CC) chưa có được thêm vào `Người được xem` (không trùng), **kể cả khi danh sách đang rỗng**. Người chỉ có cờ "Được phát hành" → chỉ gửi email — đúng 100% trường hợp.
- **SC-005**: Kết quả lọc danh sách và kiểm tra quyền khi mở trực tiếp khớp nhau ở mọi tổ hợp (chưa hoàn thành / hoàn thành / có-danh-sách / rỗng-siết / nháp / toàn quyền); doc list hiện đủ tài liệu user nằm trong `Người được xem` kể cả ngoài quyền danh mục — không lệch.
- **SC-006** *(revise 2026-06-19)*: Import cột "Phân quyền": tên nhóm hợp lệ → tạo + `Người được xem` = hợp thành viên các nhóm; tên nhóm không tồn tại (hoặc nháy kép lệch) → không tạo + cảnh báo (preview + server); để trống → tạo + `Người được xem` = snapshot quyền danh mục (danh mục trống → rỗng) — đúng 100% trường hợp kiểm thử.

## Assumptions

- **Mô hình vòng đời áp dụng cho mọi tài liệu**: ràng buộc "chưa hoàn thành → chỉ người tham gia xem" áp dụng cho **tất cả** tài liệu, không chỉ tài liệu có phân quyền riêng (đã xác nhận với người dùng). Phân quyền xem (`Người được xem` snapshot) chỉ kích hoạt khi trạng thái là "Hoàn thành".
- **"Hoàn thành" = trạng thái `Hoàn thành`**: mọi trạng thái không phải `Hoàn thành` (và không phải `Nháp`) được coi là "chưa hoàn thành" cho mục đích hiển thị. Ranh giới chính xác này có thể tinh chỉnh ở bước plan nếu có trạng thái hậu-hoàn-thành cần xem như đã hoàn thành.
- **Phân quyền tài liệu CHỈ theo người** (`Người được xem`), là **snapshot nguồn chân lý** lúc tạo; bỏ nhóm ở cấp tài liệu. Khi Hoàn thành + danh sách không rỗng → visibility **category-independent**; rỗng → chỉ vai trò toàn quyền + người tham gia (KHÔNG fallback danh mục động). Dữ liệu cũ rỗng được **backfill** snapshot từ danh mục một lần (FR-013).
- **Phân quyền tài liệu là quyền XEM**: phạm vi tính năng là kiểm soát ai **xem** được tài liệu. Quyền sửa/duyệt/phát hành vẫn theo cơ chế vai trò và workflow hiện hành, không thay đổi.
- **Tích sẵn lúc tạo**: khi tạo tài liệu, `Người được xem` mặc định = người xem được của danh mục đang chọn (người trực tiếp + khai triển thành viên nhóm-danh-mục) **+ kế thừa ngược lên các danh mục cha**, giới hạn trong tập người **không** phải vai trò mặc định-đã-xem (admin/QTV/GĐ/VT). Đây là **snapshot** lúc tạo — danh mục đổi quyền về sau không tự cập nhật tài liệu cũ.
- **Phát hành cộng người — luôn cộng** *(revise 2026-06-19)*: VT/GĐ/admin phát hành → thêm mọi người nhận chưa có vào `Người được xem`, **kể cả khi danh sách đang rỗng** (rỗng = chưa nhân viên nào thấy nên không khóa nhầm ai). Người chỉ có cờ "Được phát hành" chỉ gửi email.
- **Người tham gia luôn xem được**: người tạo, người phụ trách, người phối hợp đã gắn vào tài liệu luôn xem được ở mọi trạng thái.
- **Import khai triển nhóm → người**: cột "Phân quyền" nhận **tên nhóm**; hệ thống lấy thành viên các nhóm đó bỏ vào `Người được xem` (snapshot). Tên nhóm sai → bỏ qua tài liệu (cảnh báo ở preview + chặn server). Khớp tên nhóm bỏ khoảng trắng đầu/cuối.
- **Giao diện đặt phân quyền — popup** *(revise 2026-06-19)*: màn **tạo/sửa** (người sửa được tài liệu, nút mở popup hiển thị số người) và màn **chi tiết** (chỉ toàn quyền, qua `setDocumentViewers`). Popup chọn người **theo phòng ban + nút chọn tất cả mỗi phòng**, có ô tìm kiếm, 2 chế độ nhanh "Tất cả"/"Theo danh mục", lưu tạm tới khi bấm "Chọn".
- **Nguồn người cho mọi picker chọn người** *(cross-cutting, phát hiện khi test)*: dùng **toàn bộ nhân viên SSO `Active`** (`lookups.ssoUsers`), **không** phải chỉ người đã có bản ghi quyền docmgr (`lookups.users` = `_Phân Quyền` lọc `AppID`). Áp dụng cho viewer picker (008) **và** picker giao việc (Phụ trách/Người phối hợp) + phát hành (PublishDialog) + hiển thị tên. Lý do: docmgr tự gán role khi lần đầu đăng nhập → người chưa vào docmgr vẫn cần chọn được. `lookups.users` chỉ giữ cho chỗ cần **dữ liệu role docmgr** (Được phát hành/Quyền, Người tạo/cập nhật).
