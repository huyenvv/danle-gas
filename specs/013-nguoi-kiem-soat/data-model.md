# Data Model: Người kiểm soát hồ sơ

## 1. Schema thay đổi — sheet `Hồ Sơ` (HO_SO)

| Thuộc tính | Giá trị |
|---|---|
| Cột mới | `Người kiểm soát` |
| Kiểu | Chuỗi JSON mảng ≤1 UserID (vd `["5"]`), hoặc `""` = không có NKS |
| ⚠ Định dạng lưu | **BẮT BUỘC** chuỗi JSON `["id"]` — KHÔNG lưu số trần `5`. gviz (012) suy luận KIỂU cột theo dữ liệu; nếu cột lẫn số + chuỗi → coi cột là NUMBER → trả RỖNG cho ô chuỗi → client mất NKS. `giaoViec` luôn ghi `JSON.stringify([String(id)])`; cột production đã đặt numberFormat `@` + chuẩn hoá 1 lần. Nếu dữ liệu cũ lại lẫn số, chuẩn hoá lại bằng một lần ghi cột (kiểu `rebuildGvizQueryColumns`). |
| Bắt buộc | Không (tuỳ chọn) |
| Ghi bởi | GĐ/QTV qua `giaoViec` (đổi/gỡ = thu hồi→giao lại); admin toàn quyền |
| Đọc bởi | Server (kiểm tra quyền NKS, dựng biến email), Client (hiển thị + gating nút) |
| Parse/serialize | `_parseAssignees` / `_buildAssignees` (dùng chung PT/PH) |

**Migration**: `SCHEMA_V` `'13' → '14'` trong `config.js`:
- Thêm `'Người kiểm soát'` vào `HO_SO` headers def trong `_ensureAllTabsExist`.
- `ensureMissingColumns` tự append cột cho file cũ; hồ sơ cũ → rỗng.
- `ensureInitialized` đã gọi `_invalidateDocColsCache()` sau bump → cache cột (012) làm mới.

## 2. Thực thể

### Người kiểm soát (Controller / NKS)
- Quan hệ **1-1 (tuỳ chọn)** với Hồ Sơ (mỗi hồ sơ có 0 hoặc 1 NKS).
- Tham chiếu một người dùng (UserID) trong SSO `_Người Dùng` / `_Phân Bổ`.
- Quyền = **theo hồ sơ**, không nâng vai trò toàn hệ thống.
- Cho phép trùng với PT/PH của cùng hồ sơ.

### Thông báo NKS mới được gán
- **Không** có template email riêng. NKS mới nhận **chuông** + được đưa vào **CC của email `giaoViec`** (dùng chung). Đoạn `[[...]]` trong body `giaoViec` (chứa `{tênNgườiKiểmSoát}`/`{vaiTròNgườiKiểmSoát}`) tự hiện khi có NKS.

### Biến email mới
| Biến | Nguồn | Ghi chú |
|---|---|---|
| `{tênNgườiKiểmSoát}` | `name` của NKS (SSO `_Người Dùng`) | rỗng nếu không có NKS |
| `{vaiTròNgườiKiểmSoát}` | `role` của NKS từ SSO `_Phân Bổ` (`_getDeptInfo`) | chức danh thực |

### Cú pháp đoạn điều kiện (template body)
- `[[ ...{biến}... ]]` → giữ nội dung khi biến NKS có giá trị; xoá cả đoạn khi rỗng.
- Mặc định template `giaoViec` body chứa: `...[[ và trình duyệt qua {vaiTròNgườiKiểmSoát} - {tênNgườiKiểmSoát}]]...`

## 3. Ma trận quyền (state × actor) — sau thay đổi

`✓` = làm được; `–` = không. NKS chỉ áp cho **hồ sơ được gán**.

| Trạng thái | Action | GĐ | QTV/admin | PT | NKS |
|---|---|---|---|---|---|
| Chờ duyệt | giaoViec (gán PT·PH·NKS·nội dung) | ✓ (gồm NKS) | ✓ (gồm NKS) | – | – |
| Chờ duyệt | tuChoi / ycPhatHanh / luuTru | ✓ | ✓ | – | – |
| Chờ xử lý | thuHoi | ✓ | ✓ | – | – |
| Chờ xử lý | nhanViec (PT nhận việc, thêm PH, → Đang xử lý) | – | ✓ | ✓ | – |
| Chờ xử lý / Đang xử lý | **ksThemPhoiHop** (thêm PH, chỉ-thêm, **KHÔNG đổi trạng thái**) | – | ✓ | – | ✓ |
| Đang xử lý | hoanThanh | – | ✓ | ✓ | – |
| Chờ xác nhận HT | xacNhanHT / tuChoiKetQua | ✓ | ✓ | – | ✓ |
| Chờ duyệt (qua giao lại) | đổi/gỡ trường Người kiểm soát | ✓ | ✓ | – | – |

> GĐ và NKS có quyền **song song** (FR-012). NKS **không** dùng `giaoViec`/`thuHoi` và **không** đổi/xoá PT, **không** xoá PH cũ — chỉ thêm PH qua `ksThemPhoiHop` (ràng buộc chỉ-thêm + PT bất biến, thực thi ở server — FR-004/004a).

### Action mới: `ksThemPhoiHop`

| Thuộc tính | Giá trị |
|---|---|
| from | `Chờ xử lý` **hoặc** `Đang xử lý` |
| to | **giữ nguyên trạng thái hiện tại** (không transition) |
| roles | `_kiemSoat` (admin bypass) |
| Ghi | chỉ `Người phối hợp` (append) + `Nội dung phối hợp`; PT bất biến |
| Ràng buộc | tập PH cũ ⊆ tập PH mới (chỉ thêm, không xoá); bắt buộc nội dung khi có PH mới |
| Email | PH *mới* nhận chuông + email `phoiHop` (như nhanViec) |

## 4. Sự kiện email/chuông

| Sự kiện | Người nhận chính (TO) | Template | Đoạn điều kiện |
|---|---|---|---|
| giaoViec (có NKS) | PT (CC: PH **+ NKS mới**) | `giaoViec` | hiện đoạn NKS |
| giaoViec (không NKS) | PT (CC: PH) | `giaoViec` | ẩn đoạn NKS |
| NKS bị gỡ | (không gửi) | — | — |
| NKS thêm PH (`ksThemPhoiHop`) | từng PH *mới* | `phoiHop` | — |
| hồ sơ có NKS vào `Chờ xác nhận HT` (`hoanThanh`/`hoanThanhLai`) | (chỉ chuông) GĐ + NKS | — | — |
| `tuChoiKetQua` (GĐ **hoặc** NKS) | PT (CC: **GĐ**, loại người thao tác) | `tuChoiKetQua` | — |

Tất cả best-effort: lỗi gửi ghi log, không rollback (`emailError` trả về như hiện tại).

## 5. Hiển thị & nhận diện NKS (FR-014/FR-015)

NKS phải **thấy + mở** được hồ sơ được gán. Tích hợp vào 2 đường sẵn có:

| Điểm | Thay đổi |
|---|---|
| `_docViewToken` → cột **Token xem** (lọc danh sách server-side, 012) | Gộp thêm `Người kiểm soát` (qua `_getDocUserIdMap` → UserID) |
| `_isParticipant` (mở/xem/bình luận từng hồ sơ) | NKS được tính là người tham gia |
| `_isController` (kiểm quyền hành động) | Resolve danh tính qua **cùng `_getDocUserIdMap`** (UserID/tên đăng nhập/email) — nhất quán với Token xem; "thấy được ⇒ thao tác được" |

**Migration token cho hồ sơ cũ**: KHÔNG tính lại toàn bộ trong `doGet` (timeout ở 10k+). Dùng hàm **thủ công**:
- `rebuildGvizQueryColumns()` — tính lại 3 cột tính sẵn (gồm Token xem) cho MỌI hồ sơ; đọc 1 lần + ghi mỗi cột 1 `setValues` → an toàn ở quy mô lớn.
- `backfillControllerTokens()` — bản nhẹ, chỉ ghi hồ sơ có NKS.
