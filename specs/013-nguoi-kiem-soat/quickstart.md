# Quickstart: Kiểm thử Người kiểm soát

Map kịch bản thủ công ↔ acceptance scenarios trong [spec.md](spec.md). Chạy trên docmgr (SSO child).

## Chuẩn bị
- Tài khoản: 1 GĐ, 1 admin/QTV, 1 NV làm PT, 1 NV làm NKS (X), 1 NV khác (Y).
- Deploy bản build có schema mới (lần `doGet` đầu sẽ bump `SCHEMA_V` 13→14 + thêm cột `Người kiểm soát`).

## US1 — Chọn NKS khi giao việc
1. Đăng nhập **GĐ**, mở hồ sơ ở `Chờ duyệt` → "Giao việc". → **Có ô chọn người kiểm soát (tuỳ chọn)** cạnh PT/PH. *(AS1)*
2. Chọn PT + NKS=X, nhập nội dung, lưu. → Hồ sơ lưu có NKS=X. *(AS2)*
3. Lặp lại, để trống NKS → lưu OK, workflow như cũ. *(AS3)*
4. Đăng nhập **PT** (không GĐ/QTV), bấm "Nhận việc" → **không có ô chọn NKS**. *(AS4)*
5. Sau bước 2: **X** có **chuông** về hồ sơ và **nằm trong CC của email `[Giao việc]`** (không có email riêng `[Kiểm soát]`); thân email có đoạn "…và trình duyệt qua {vaiTrò} - {tên}…". *(AS5, FR-013)*

## US2 — NKS thêm phối hợp & duyệt tới hoàn thành (trên hồ sơ được gán)
1. Hồ sơ A (NKS=X) ở `Chờ xử lý` (rồi lặp ở `Đang xử lý`). Đăng nhập **X** → mở popup thêm phối hợp: **PT khoá**, PH cũ **không gỡ được**; thêm PH mới + nhập nội dung → **Lưu** → PH mới được thêm, **trạng thái không đổi**, PH mới nhận email phối hợp. *(AS1, FR-004a/004b)*
2. X cố gỡ PH cũ hoặc đổi PT → **bị chặn**. *(AS2, FR-004a)*
3. Hồ sơ A ở `Chờ xác nhận HT`. Đăng nhập **X** → **Xác nhận HT / Từ chối kết quả** được; X **không** có giaoViec/thuHoi/tuChoi/ycPhatHanh/luuTru. *(AS3)*
4. Hồ sơ B (NKS≠X). Đăng nhập X → **không có** quyền NKS trên B. *(AS4)*
5. GĐ mở hồ sơ A → vẫn làm đầy đủ hành động của mình (song song). *(AS5, FR-012)*
6. Gọi trực tiếp `transitionDocument('ksThemPhoiHop')` bằng tài khoản Y (không NKS) trên A, hoặc gọi gỡ PH cũ → **bị từ chối** ở server. *(AS6, FR-006)*

## US3 — Email đoạn NKS theo điều kiện
1. Giao việc hồ sơ **có** NKS → email `[Giao việc]` gửi PT chứa "…và trình duyệt qua **Giám đốc - X**…", nội dung đầy đủ. *(AS1)*
2. Giao việc hồ sơ **không** NKS → email **không** có đoạn đó, không còn `{...}` thừa, câu trôi chảy. *(AS2)*
3. Admin → Settings → Email: mở mẫu **Giao việc** thấy đoạn `[[...]]` sửa được; danh sách biến có `{tênNgườiKiểmSoát}`, `{vaiTròNgườiKiểmSoát}`. *(AS3)*

## Tự động (Jest)
```bash
npx jest --config apps/docmgr/jest.config.js
```
Bổ sung test:
- **Server**: `_isController`; `ksThemPhoiHop` thêm PH chỉ-thêm + không đổi trạng thái + chặn gỡ PH/đổi PT; gating `xacNhanHT/tuChoiKetQua` cho NKS; NKS không có giaoViec/thuHoi; PH mới nhận `phoiHop`; `_applyTemplate` giữ/ẩn `[[...]]`; biến NKS dựng đúng; NKS mới vào CC email `giaoViec` (không mail riêng); NKS được báo chuông khi hồ sơ vào `Chờ xác nhận HT` (FR-016); hồ sơ không NKS → không đổi (SC-005).
- **Client**: `workflowPermissions` trả đúng action cho NKS theo trạng thái; `DocumentModal` chỉ hiện ô NKS cho GĐ/QTV; `SettingsPage` liệt kê biến mới.

## Kỳ vọng (Success Criteria)
SC-001..006 trong spec — đặc biệt SC-005: hồ sơ cũ/không NKS hành xử **y hệt** trước.
