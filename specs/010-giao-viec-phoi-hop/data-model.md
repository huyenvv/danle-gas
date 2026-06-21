# Phase 1 Data Model: Workflow giao việc cho người phối hợp

**Có 1 thay đổi schema**: thêm cột `Nội dung phối hợp` vào `HO_SO`, bump `SCHEMA_V` `'11'`→`'12'`. Các cột còn lại đã có sẵn.

## Sheet `HO_SO` — các cột liên quan (đã tồn tại)

| Cột (header) | Kiểu lưu | Vai trò trong feature |
|---|---|---|
| `ID` | số | Khoá tài liệu. |
| `Tình trạng` | chuỗi | Trạng thái workflow (xem máy trạng thái). |
| `Phụ trách` | JSON array 1 phần tử `["uid"]` | Người phụ trách (PT). Gán bởi GĐ ở `giaoViec`. Resolve `_phuTrach`. |
| `Người phối hợp` | JSON array nhiều phần tử `["uid", ...]` | Danh sách người phối hợp (PH). Đối tượng của ràng buộc "chỉ thêm" (D2) và email (D3). |
| `Nội dung giao việc` | chuỗi | Mô tả công việc do **GĐ** nhập ở `giaoViec`. Bắt buộc khi ≥1 PH (D1). |
| `Nội dung phối hợp` | chuỗi | **(CỘT MỚI, SCHEMA_V 12)** Nội dung do **người chủ trì** nhập ở popup khi `nhanViec`. Dùng cho email `phoiHop` + hiển thị preview. Không đè cột trên. |
| `Người tạo` / `Người cập nhật` / `Ngày cập nhật` | chuỗi | Audit, do hệ thống đặt. |

Helper sẵn có: `_parseAssignees(value)` → mảng id/username; `_buildAssignees(input, …)` → chuỗi JSON. PH so khớp theo userId **hoặc** username (như `_excludeSelf`, `_parseAssignees`).

## Quy tắc dữ liệu (validation) áp dụng

- **R1 (D1)**: Ở `giaoViec`, nếu `_parseAssignees(Người phối hợp kết quả).length >= 1` thì `trim(Nội dung giao việc)` MUST ≠ rỗng. Vi phạm → chặn lưu.
- **R2 (D2)**: Ở `nhanViec` bởi PT (không admin), với `oldPH = _parseAssignees(doc['Người phối hợp'])` và `newPH = _parseAssignees(payload)`: mọi phần tử của `oldPH` MUST ∈ `newPH` (tập cũ ⊆ tập mới). Vi phạm → chặn.
- **R3 (D3)**: `addedPH = newPH \ oldPH` (trừ người thao tác). Mỗi phần tử `addedPH` MUST được đánh dấu unread (chuông) **và** gửi 1 email template **`phoiHop`** (đích danh) mang nội dung popup.
- **R4 (D3b)**: Ở `nhanViec`, nếu `addedPH.length >= 1` thì `trim(data['Nội dung']) (popup)` MUST ≠ rỗng. Vi phạm → chặn.

### Template email & nội dung (không phải cột sheet)

- **Template `giaoViec`** (đã có): luồng GĐ giao việc; nội dung = cột `Nội dung giao việc`.
- **Template `phoiHop`** (MỚI, thêm vào `_DEFAULT_MAIL_TEMPLATES`, cấu hình qua `MAIL_TEMPLATES`): luồng người chủ trì thêm PH ở nhận việc. Body: *"Xin chào {tênNgườiNhận}, bạn được {tênNgườiGửi} giao phối hợp xử lý công việc với nội dung: {nộiDungPhoiHop}…"*. Biến **mới** `{nộiDungPhoiHop}` map `doc['Nội dung phối hợp']` (thêm vào `vars` trong `_sendNotificationEmails`).
- **Nội dung popup nhận việc**: **lưu vào cột `Nội dung phối hợp`** (D5), email đọc từ cột này. Recipient: PH mới = **TO** (khác `giaoViec` PH=CC).

## Máy trạng thái (phần liên quan giao việc)

```
Chờ duyệt ──(giaoViec: GĐ/admin)──▶ Chờ xử lý ──(nhanViec: PT)──▶ Đang xử lý
   │  set PT + PH + Nội dung (R1)        │  thêm PH (R2, chỉ thêm)
   │  email PT(TO)+PH(CC) [đã có]        │  email PH mới (R3) [thêm mới]
   └──(thuHoi: GĐ)── Chờ xử lý ──▶ Chờ duyệt   (đường GĐ chỉnh sửa PH trước khi PT nhận)
```

- **`giaoViec`** (`Chờ duyệt → Chờ xử lý`): actor GĐ (hoặc admin/QTV). Đặt PT (bắt buộc), PH (tuỳ chọn), Nội dung (R1). Email cho PT+PH (đã có, không đổi).
- **`nhanViec`** (`Chờ xử lý → Đang xử lý`): actor PT (`_phuTrach`). Thêm PH (R2). Email cho PH mới (R3 — delta).
- Các action khác (`thuHoi`, `tuChoi`, `hoanThanh`, …) không thuộc phạm vi feature; không đổi.

## Phân quyền tóm tắt

| Vai trò | `giaoViec` (thêm/sửa PT+PH) | `nhanViec` (thêm PH) | Xoá PH |
|---|---|---|---|
| admin / QTV | ✔ (bypass) | ✔ (bypass R2) | ✔ |
| Giám đốc (GĐ) | ✔ | ✖ (không phải `_phuTrach`) | qua `thuHoi`+`giaoViec` |
| Người phụ trách (PT) | ✖ | ✔ (chỉ thêm, R2) | ✖ |
| VT / PGĐ / khác | ✖ | ✖ | ✖ |
