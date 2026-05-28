# Sheets Schema

## SSO Portal

| Sheet | Const | Key Columns |
|---|---|---|
| `_Người Dùng` | USERS | ID, Tên đăng nhập, Mật khẩu, Email, Tên nhân viên, Trạng thái, MustChangePass, Quyền, RefreshTokens(JSON), LastLogoutAt, LogoutEpochs(JSON), AccessToken, AccessTokenExpiry |
| `_Ứng Dụng` | APPS | ID, Tên App, Webapp URL, Icon, Mô tả, Trạng thái |
| `_Phòng Ban` | PHONG_BAN | ID, Tên phòng ban, Mô tả, Trưởng, Phó, Người phụ trách |
| `_Phân Bổ` | PHAN_BO | ID, UserID, Chức vụ, PhongBanID |
| `_Hệ Thống` | SYS | Key, Value (MAIL_ENABLED, MAIL_SENDER_NAME/EMAIL, MAIL_SUBJECT/BODY_NEW_USER) |
| `_Handoffs` | HANDOFFS | ID, Token, UserID, AppID, CreatedAt, ExpiresAt, Consumed |

Dept/role: `_Phòng Ban` defines depts, `_Phân Bổ` assigns users. Company-level roles=empty PhongBanID. Multiple assignments allowed.

## Doc Manager

| Sheet | Const | Key Columns |
|---|---|---|
| `_Phân Quyền` | APP_ROLES | ID, UserID, Tên đăng nhập, AppID, Quyền, Phân quyền chi tiết(JSON), Được tạo hồ sơ, Được tạo danh mục con, Được phát hành, RefreshTokens |
| `Danh Mục` | DANH_MUC | ID, Tên danh mục, Icon, Mô tả, Danh mục cha, Người/Nhóm được xem, Nơi lưu hồ sơ cứng |
| `Nhóm` | NHOM | ID, Tên nhóm, Mô tả, Thành viên(JSON) |
| `Dự Án` | DU_AN | ID, Tên viết tắt, Tên đầy đủ, Địa chỉ |
| `Nhà Cung Cấp` | NHA_CUNG_CAP | ID, Tên viết tắt, Tên đầy đủ, Địa chỉ, MST, ĐT, Người đại diện, STK, Ngân hàng, Lĩnh vực |
| `Hồ Sơ` | HO_SO | ID, Tên hồ sơ, Danh mục, Ngày ban hành/kết thúc, File ID(JSON), Số hồ sơ, Dự án(Phòng ban), NCC(Nơi ban hành), Giá trị HĐ, Tình trạng, Phụ trách(JSON), Người phối hợp(JSON), Ghi chú, Người tạo/cập nhật |
| `_Nhật Ký` | NHAT_KY | ID, Thời gian, Người dùng, Email, Hành động, Loại, Đối tượng, Chi tiết |
| `_Đã Đọc` | DA_DOC | ID, UserID, DocID, Thời gian _(has record=unread)_ |
| `_Bình Luận` | COMMENTS | ID, DocID, UserID, Tên người dùng, Nội dung, Thời gian |

## Referential Integrity

Delete Danh Mục/Dự Án/NCC → check Hồ Sơ refs + child categories.

## Script Properties

SSO_PARENT_SHEET_ID, ROOT_FOLDER_ID, COMPANY_NAME, APP_URL, MAIL_TEMPLATES(JSON), SCHEMA_V (bump→re-init), LICENSE_ACTIVATED, LICENSE_TOKEN.
