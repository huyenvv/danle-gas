# Sheets Schema

> Abbreviations: see constitution.md

## SSO Portal

**`_Người Dùng`** (USERS): ID, Tên đăng nhập, Mật khẩu, Email, Tên nhân viên, Trạng thái, MustChangePass, Quyền, RefreshTokens(JSON per device), LastLogoutAt, LogoutEpochs(JSON `{desktop,mobile}`), AccessToken, AccessTokenExpiry
**`_Ứng Dụng`** (APPS): ID, Tên App, Webapp URL, Icon, Mô tả, Trạng thái
**`_Phòng Ban`** (PHONG_BAN): ID, Tên phòng ban, Mô tả, Trưởng, Phó, Người phụ trách
**`_Phân Bổ`** (PHAN_BO): ID, UserID, Chức vụ, PhongBanID — assigns users to depts. Empty PhongBanID=company-level. Multiple assignments allowed.
**`_Hệ Thống`** (SYS): Key-Value (MAIL_ENABLED, MAIL_SENDER_NAME/EMAIL, MAIL_SUBJECT/BODY_NEW_USER)
**`_Handoffs`** (HANDOFFS): ID, Token, UserID, AppID, CreatedAt, ExpiresAt, Consumed

## Doc Manager

**`_Phân Quyền`** (APP_ROLES): ID, UserID, Tên đăng nhập, AppID, Quyền, Phân quyền chi tiết(JSON), Được tạo hồ sơ, Được tạo danh mục con, Được phát hành, RefreshTokens
**`Danh Mục`** (DANH_MUC): ID, Tên, Icon, Mô tả, Danh mục cha, Người/Nhóm được xem, Nơi lưu hồ sơ cứng
**`Nhóm`** (NHOM): ID, Tên, Mô tả, Thành viên(JSON)
**`Dự Án`** (DU_AN): ID, Tên viết tắt, Tên đầy đủ, Địa chỉ
**`Nhà Cung Cấp`** (NHA_CUNG_CAP): ID, Tên viết tắt/đầy đủ, Địa chỉ, MST, ĐT, Người đại diện, STK, Ngân hàng, Lĩnh vực
**`Hồ Sơ`** (HO_SO): ID, Tên, Danh mục, Ngày ban hành/kết thúc, File ID(JSON), Số hồ sơ, Dự án(Phòng ban), NCC(Nơi ban hành), Giá trị HĐ, Tình trạng, PT(JSON), PH(JSON), Ghi chú, Người tạo/cập nhật
**`_Nhật Ký`** (NHAT_KY): ID, Thời gian, Người dùng, Email, Hành động, Loại, Đối tượng, Chi tiết
**`_Đã Đọc`** (DA_DOC): ID, UserID, DocID, Thời gian — has record=unread
**`_Bình Luận`** (COMMENTS): ID, DocID, UserID, Tên người dùng, Nội dung, Thời gian

## Integrity

Delete Danh Mục/Dự Án/NCC → check Hồ Sơ refs + child categories.

## Script Properties

SSO_PARENT_SHEET_ID, ROOT_FOLDER_ID, COMPANY_NAME, APP_URL, MAIL_TEMPLATES(JSON), SCHEMA_V(bump→re-init), LICENSE_ACTIVATED, LICENSE_TOKEN.
