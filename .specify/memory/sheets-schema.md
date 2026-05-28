# Sheets Schema Reference

## SSO Portal Spreadsheet

| Sheet | Constant | Key Columns |
|---|---|---|
| `_Người Dùng` | SHEETS.USERS | ID, Tên đăng nhập, Mật khẩu, Email, Tên nhân viên, Trạng thái, MustChangePass, Phòng ban, Chức vụ, Quyền, RefreshTokens, LastLogoutAt, LogoutEpochs, AccessToken, AccessTokenExpiry |
| `_Ứng Dụng` | SHEETS.APPS | ID, Tên App, Webapp URL, Icon, Mô tả, Trạng thái |
| `_Phòng Ban` | SHEETS.PHONG_BAN | ID, Tên phòng ban, Mô tả, Trưởng, Phó, Người phụ trách, Đơn vị thuộc sự quản lý |
| `_Phân Bổ` | SHEETS.PHAN_BO | ID, UserID, Chức vụ, PhongBanID |
| `_Hệ Thống` | SHEETS.SYS | Key, Value |
| `_Handoffs` | SHEETS.HANDOFFS | ID, Token, UserID, AppID, CreatedAt, ExpiresAt, Consumed |

Auth columns in `_Người Dùng`:
- `RefreshTokens` — JSON array, one entry per device-label
- `LastLogoutAt` — global epoch
- `LogoutEpochs` — JSON `{desktop, mobile}` per-device epoch
- `AccessToken` + `AccessTokenExpiry` — for cross-script validation

Department/role: `_Phòng Ban` defines depts, `_Phân Bổ` assigns users.
Company-level roles have empty PhongBanID. A user can have multiple assignments.

## Doc Manager Spreadsheet

| Sheet | Constant | Key Columns |
|---|---|---|
| `_Phân Quyền` | SHEETS.APP_ROLES | ID, UserID, Tên đăng nhập, AppID, Quyền, Phân quyền chi tiết (JSON), Được tạo hồ sơ, Được tạo danh mục con, Được phát hành, RefreshTokens |
| `Danh Mục` | SHEETS.DANH_MUC | ID, Tên danh mục, Icon, Mô tả, Danh mục cha, Người được xem, Nhóm được xem, Nơi lưu hồ sơ cứng |
| `Nhóm` | SHEETS.NHOM | ID, Tên nhóm, Mô tả, Thành viên (JSON) |
| `Dự Án` | SHEETS.DU_AN | ID, Tên dự án viết tắt, Tên dự án đầy đủ, Địa chỉ |
| `Nhà Cung Cấp` | SHEETS.NHA_CUNG_CAP | ID, Tên NCC viết tắt, Tên NCC đầy đủ, Địa chỉ, MST, ĐT, Người đại diện, STK, Ngân hàng, Lĩnh vực |
| `Hồ Sơ` | SHEETS.HO_SO | ID, Tên hồ sơ, Danh mục, Ngày ban hành, Ngày kết thúc, File ID (JSON), Tên file, Loại file, Kích thước, Mô tả, Số hồ sơ, Dự án (Phòng ban), Nhà cung cấp (Nơi ban hành), Giá trị HĐ, Tình trạng, Phụ trách (JSON), Người phối hợp (JSON), Ghi chú, Nơi lưu, Ngày cập nhật, Người tạo, Người cập nhật |
| `_Nhật Ký` | SHEETS.NHAT_KY | ID, Thời gian, Người dùng, Email, Hành động, Loại, Đối tượng, Chi tiết |
| `_Đã Đọc` | SHEETS.DA_DOC | ID, UserID, DocID, Thời gian |
| `_Bình Luận` | SHEETS.COMMENTS | ID, DocID, UserID, Tên người dùng, Nội dung, Thời gian |

## Referential Integrity

Before deleting from lookup tables, check `Hồ Sơ` for references:
- Danh Mục → column Danh mục (+ check child categories)
- Dự Án → column Dự án (Phòng ban)
- Nhà Cung Cấp → column Nhà cung cấp (Nơi ban hành)

## Script Properties

| Key | Purpose |
|---|---|
| `SSO_PARENT_SHEET_ID` | Parent SSO sheet for child apps (write-once) |
| `ROOT_FOLDER_ID` | Drive folder for file uploads |
| `COMPANY_NAME` | Shown in header bar |
| `APP_URL` | SSO Portal link for email templates |
| `MAIL_TEMPLATES` | JSON with email templates |
| `SCHEMA_V` | Schema version flag — bump to force re-init |
| `LICENSE_ACTIVATED` / `LICENSE_TOKEN` | License verification |
