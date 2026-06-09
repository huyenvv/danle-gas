# Research: Chọn file từ Google Drive của tài khoản deploy

## R1 — Duyệt Drive của owner (không phải end-user)

- **Decision**: Duyệt/copy hoàn toàn ở phía server (GAS deploy "Execute as: owner" → `DriveApp` chạy as owner). Mở rộng `api_browseDriveFolders` để trả thêm danh sách **file** trong thư mục hiện tại; client điều hướng thư mục như `FolderPicker`.
- **Rationale**: Google Picker (client-side) dùng OAuth của **người dùng đăng nhập** → duyệt nhầm Drive của end-user, không phải owner. Pattern server-side đã tồn tại (`api_browseDriveFolders` + `FolderPicker.jsx`) và đúng yêu cầu "toàn bộ Drive của người deploy".
- **Alternatives**: Google Picker API (sai tài khoản, cần API key + scope picker, phức tạp); Drive search query (thêm scope, để v2).

## R2 — Sao chép file (gồm Google-native)

- **Decision**: `DriveApp.getFileById(fileId).makeCopy(name, targetFolder)` → giữ nguyên dạng (native vẫn native), rồi `setSharing(ANYONE_WITH_LINK, VIEW)` như upload thường. Đích = `resolveFolderId(_resolveCategoryPath(categoryId))`.
- **Rationale**: `makeCopy` xử lý mọi loại file đồng nhất, kể cả Docs/Sheets/Slides (đã chốt giữ native). Tái dùng `_attachFileToDraft` để gắn vào hồ sơ nháp giống upload.
- **Alternatives**: Export PDF (đã loại); copy qua Drive API v3 (thừa, makeCopy đủ).

## R3 — Cờ phân quyền mới

- **Decision**: Thêm cột `Được chọn từ Drive` vào APP_ROLES (`config.js` headers + bump `SCHEMA_V` 6→7; `ensureMissingColumns` tự thêm cột cho sheet hiện có). Session field `canPickDrive`. Server gate `_checkPickDrivePermission(session)` mirror `_checkCreatePermission`.
- **Rationale**: Nhất quán hoàn toàn với `Được phát hành`/`Được tạo hồ sơ`: lưu cùng sheet, đọc lại mỗi thao tác (không cache), default-on cho full-access ở cả client gate lẫn server check.
- **Alternatives**: Lưu trong custom-permission JSON (`Phân quyền chi tiết`) — lệch pattern flag hiện có, bỏ.

## R4 — Default-on cho full-access

- **Decision**: Full-access = `admin / Quản trị viên / Giám đốc / Văn thư` (đúng `isAdminOrVanThu` ở `sheets.js`). Client: `canPickDrive = isAdminRole || isVanThu || session?.canPickDrive`. Server: nếu role ∈ full-access → cho phép; ngược lại đọc cờ. `api_getUsers` trả `'Được chọn từ Drive': isFullAccess || flag`, checkbox bị disable khi full-access (như UI hiện tại ẩn checkbox cho admin).
- **Rationale**: Khớp quyết định người dùng + đồng nhất các cờ hiện hữu.

## R5 — Multi-select & xử lý lỗi từng file

- **Decision**: Picker cho chọn nhiều file (checkbox/list). `api_copyDriveFiles(token, fileIds[], categoryId, draftId)` copy tuần tự, trả mảng kết quả `{fileId, ok, fileInfo?|error?}`; file lỗi không chặn file khác (FR-013). Mỗi file thành công gắn vào nháp qua `_attachFileToDraft` (tái dùng cơ chế tạo nháp khi hồ sơ chưa lưu).
- **Rationale**: Khớp luồng eager-upload hiện tại (mỗi file 1 entry, lỗi thì drop riêng).
