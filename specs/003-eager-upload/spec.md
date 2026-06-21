# Feature Specification: Eager Upload với Draft Status

**Feature Branch**: `003-eager-upload`
**Created**: 2026-05-31
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Upload file ngay khi chọn (Priority: P1)

User chọn file trong form tạo/sửa hồ sơ → file upload ngay lên Google Drive → hiện progress per-file (uploading → done). Không phải chờ đến khi bấm Lưu.

**Why this priority**: Core UX improvement — thay đổi toàn bộ upload flow.

**Independent Test**: Chọn file → thấy spinner → thấy checkmark → file đã trên Drive.

**Acceptance Scenarios**:

1. **Given** form tạo mới với Danh mục đã chọn, **When** user chọn 3 files, **Then** mỗi file upload tuần tự lên đúng folder danh mục + hiện progress "Đang tải lên... (1/3)" → "✓ (2/3)" → "✓ (3/3)".
2. **Given** form sửa hồ sơ đang có file, **When** user thêm file mới, **Then** file mới upload ngay lên Drive, file cũ giữ nguyên.
3. **Given** form tạo mới CHƯA chọn Danh mục, **When** user chọn file, **Then** hiện lỗi "Vui lòng chọn Danh mục trước".

---

### User Story 2 - Draft status cho hồ sơ chưa hoàn tất (Priority: P1)

Khi user upload file đầu tiên trong form tạo mới, server tạo 1 row Nháp trên sheet. Nháp hiện trong danh sách với badge riêng. User tự xoá nháp nếu không cần.

**Why this priority**: Ngăn orphan files — mỗi file upload đều link đến 1 row visible.

**Independent Test**: Upload file → thấy row Nháp trong danh sách → bấm xoá → row + files bị xoá.

**Acceptance Scenarios**:

1. **Given** user upload file đầu tiên trong form tạo mới, **When** upload xong, **Then** 1 row Nháp xuất hiện trong sheet HO_SO với Người tạo = user + Danh mục + File ID.
2. **Given** row Nháp tồn tại, **When** user bấm Lưu, **Then** row cập nhật đầy đủ form data + status chuyển từ Nháp → Chờ duyệt.
3. **Given** row Nháp tồn tại, **When** user bấm Huỷ, **Then** files bị xoá khỏi Drive + row bị xoá khỏi sheet.
4. **Given** danh sách hồ sơ, **When** có hồ sơ Nháp, **Then** hiện badge "Nháp" (gray, dashed border).

---

### User Story 3 - Huỷ upload + cleanup (Priority: P1)

Khi user bấm Huỷ hoặc đóng modal, files đã upload phải được dọn dẹp: create mode xoá draft + files, edit mode chỉ xoá files mới.

**Why this priority**: Hoàn thành cancel flow — không để rác trên Drive.

**Independent Test**: Upload files → Huỷ → verify files trashed + draft deleted.

**Acceptance Scenarios**:

1. **Given** form tạo mới đã upload 2 files (draft tồn tại), **When** user bấm Huỷ, **Then** api_cancelDraft xoá cả 2 files + row Nháp.
2. **Given** form sửa hồ sơ đã upload 1 file mới, **When** user bấm Huỷ, **Then** api_deleteFiles xoá file mới, files cũ và row không đổi.
3. **Given** user xoá 1 file đã upload xong (status=done) từ UI, **When** click nút close trên chip, **Then** hiện xác nhận; sau khi đồng ý, file được gỡ khỏi danh sách và **trash khỏi Drive khi lưu** (finalizeDraft `keepFileIds`), gỡ-file tính là thay đổi nên đóng X có hỏi lưu nháp.
4. **Given** user đã gõ field (Tên/Danh mục) nhưng CHƯA upload tệp, **When** bấm X, **Then** hiện cảnh báo "Lưu thông tin vừa thay đổi…" → Có → `api_createDraft` lưu Nháp (FR-014).
5. **Given** user CHỈ upload/xoá tệp, không sửa field nào, **When** bấm X, **Then** KHÔNG cảnh báo (tệp đã tự lưu) → đóng & surface draft.

---

### User Story 4 - Disable buttons khi đang upload (Priority: P2)

Các nút Lưu/Trình duyệt/Phát hành bị disable khi còn file đang upload, ngăn submit form thiếu file.

**Why this priority**: UX guard — ngăn user submit thiếu file.

**Independent Test**: Upload file → nút Lưu disabled → upload xong → nút enabled.

**Acceptance Scenarios**:

1. **Given** form đang có file status='uploading', **When** user nhìn footer, **Then** tất cả submit buttons disabled.
2. **Given** tất cả files đã done/error, **When** user nhìn footer, **Then** buttons enabled.
3. **Given** form tạo mới đủ Tên hồ sơ + Danh mục nhưng CHƯA có tệp đính kèm, **When** user bấm Lưu tài liệu / Trình duyệt / Phát hành, **Then** hiện lỗi "Cần đính kèm ít nhất một tệp…" và KHÔNG gọi API lưu (chỉ được lưu nháp) (FR-013).

---

### Edge Cases

- User đóng tab giữa chừng upload: draft row tồn tại với partial files, user thấy trong danh sách và tự xoá.
- Upload fail 1 file: hiện error icon + cho xoá, các file khác giữ nguyên.
- User đổi Danh mục sau khi upload: files giữ nguyên folder cũ, di chuyển khi finalize/save.
- Chọn file trùng tên: skip (dedup client-side).
- trinhDuyetLai / hoanThanhLai: vẫn dùng eager upload qua normal file picker.

## Requirements

### Functional Requirements

- **FR-001**: Khi chọn file, MUST upload ngay lên Google Drive vào folder đúng danh mục (qua `api_uploadFileEager`).
- **FR-002**: Upload MUST tuần tự (1 file tại 1 thời điểm) — GAS concurrency limit.
- **FR-003**: File đầu tiên upload trong create mode MUST tạo row Nháp trên sheet.
- **FR-004**: File tiếp theo MUST append vào row Nháp đã tạo.
- **FR-005**: Edit mode MUST upload file mà KHÔNG tạo/sửa row (chỉ upload lên Drive).
- **FR-006**: Bấm Lưu trên draft MUST gọi `api_finalizeDraft` — cập nhật form data + đổi status.
- **FR-007**: Bấm Huỷ trên draft MUST gọi `api_cancelDraft` — xoá files + row.
- **FR-008**: Bấm Huỷ khi edit MUST gọi `api_deleteFiles` — xoá chỉ files mới upload.
- **FR-009**: Status 'Nháp' MUST hiện trong danh sách với badge riêng (gray, dashed).
- **FR-010**: Status 'Nháp' MUST NOT xuất hiện trong dropdown Tình trạng.
- **FR-011**: Submit buttons MUST disabled khi còn file đang upload.
- **FR-012**: `updateDocument` MUST nhận `eagerFileInfos` (7th param) — pre-uploaded files không cần base64.
- **FR-013**: Khi tạo mới (hoặc sửa hồ sơ Nháp), để rời trạng thái Nháp (bấm Lưu tài liệu / Trình duyệt / Phát hành) MUST đủ cả ba: **Tên hồ sơ**, **Danh mục**, và **ít nhất một tệp đính kèm**. Thiếu bất kỳ điều kiện nào → các nút finalize MUST bị chặn (báo lỗi rõ ràng, không gọi API lưu). Vì tệp đính kèm tạo row Nháp (FR-003), hồ sơ mới có tệp luôn hoàn tất qua `api_finalizeDraft`.
- **FR-014**: Chế độ tạo mới / sửa Nháp MUST có nút **"Lưu nháp"** hiển thị rõ (đặt cạnh nút Hủy), lưu hồ sơ hiện tại ở trạng thái Nháp. Lưu nháp **KHÔNG bắt buộc tệp**: đã có draft (đã upload) → `api_finalizeDraft`; chưa có draft → `api_createDraft` tạo hàng Nháp từ form. Để tránh hàng rỗng, "Lưu nháp" MUST cần **ít nhất Tên hồ sơ hoặc Danh mục** (thiếu cả hai → nút tắt, tooltip giải thích). Nút **Hủy** = xoá nháp (FR-007); nút **X** hỏi lưu nháp khi **bất kỳ field nào thay đổi** (so với snapshot lúc mở modal — gồm Tên, Danh mục, ngày, Giá trị HĐ, Khẩn, Ghi chú, phụ trách, người phối hợp, người được xem…). **Thêm** file (upload) đã tự lưu nên KHÔNG tính (luồng chỉ-upload-tệp không cảnh báo); nhưng **gỡ file** (cả vừa upload lẫn sẵn có) đều xác nhận + hoãn trash + CÓ tính là thay đổi. Cảnh báo hoạt động cả khi **chưa có draft** (gõ field rồi tắt X → hỏi lưu → `api_createDraft`). Chỉ áp cho tạo mới / sửa nháp; non-draft edit (lưu qua "Cập nhật") thì X chỉ đóng.
- **FR-015**: `createDraft(token, formData)` MUST tạo hàng status `Nháp` từ form (không tệp), yêu cầu ít nhất `Tên hồ sơ` hoặc `Danh mục`, gác quyền `_checkCreatePermission`. (Tách biệt với đường tạo-nháp-qua-upload ở FR-003 — yêu cầu finalize-phải-có-tệp tại FR-013 không đổi.)
- **FR-016**: `finalizeDraft` MUST nhận `keepFileIds` (tham số 5): file của nháp KHÔNG nằm trong danh sách giữ MUST bị trash khỏi Drive (`_shouldTrashFile`, nháp → được trash) và cột `Tệp đính kèm`/`Tên file` cập nhật về phần giữ lại. Client (`handleSaveDraft` & nhánh draft của `handleSubmit`) truyền `existingFiles + eager done`. Không gửi → giữ nguyên (tương thích cũ). Sửa lỗi: gỡ file sẵn có của nháp rồi lưu mà file không bị xoá thật.
- **FR-017**: Upload gặp `'Lỗi không xác định'` (response `google.script.run` bị mất dù server có thể đã upload xong) MUST **xác minh & phục hồi** thay vì báo lỗi: đọc lại nháp (`api_getDocuments`), tìm file theo tên trong nháp của mình (hoặc draft đang mở) — nếu thấy thì đánh dấu upload thành công (set `draftId`/`fileId`), KHÔNG upload lại (tránh trùng file trên Drive). 2 lần thử cách nhau ~1.5s; không thấy → mới báo lỗi. (Sửa: "Lỗi tải … Lỗi không xác định" trong khi file đã lên Drive.)

### Key Entities

- **Hồ Sơ**: Thêm status "Nháp" vào data model. Row Nháp tạo qua upload có: Người tạo, Danh mục, File ID, Tình trạng='Nháp'; tạo qua `createDraft` (FR-015) có thể **không có File ID** (chỉ Tên hồ sơ và/hoặc Danh mục).
- **File Info**: `{ fileId, fileName, mimeType, size }` — format không đổi, chỉ thêm path mới (eager upload vs base64).

## Success Criteria

- **SC-001**: Chọn file → thấy progress ngay, không phải chờ đến lúc Lưu.
- **SC-002**: Bấm Huỷ hoặc đóng tab → không để rác file trên Drive (trừ trường hợp đóng tab đột ngột thì có draft visible).
- **SC-003**: Flow Lưu/Trình duyệt/Phát hành hoạt động đúng với files đã upload sẵn.
- **SC-004**: Tất cả test cases hiện có PASS (backward compatible).

## Assumptions

- Files tổng cộng ≤ 50MB — trong giới hạn GAS `google.script.run`.
- `google.script.run` không hỗ trợ progress callback byte-level — chỉ biết per-file (đang upload / xong).
- User chịu trách nhiệm dọn dẹp hồ sơ Nháp (không auto-cleanup).
- Parallel upload không áp dụng (GAS concurrency limit).
- trinhDuyetLai/hoanThanhLai flows vẫn dùng eager upload qua cùng file picker.
