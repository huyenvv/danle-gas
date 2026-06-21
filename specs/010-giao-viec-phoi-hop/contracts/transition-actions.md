# Contract: `transitionDocument` — actions `giaoViec` & `nhanViec` (sau thay đổi)

API server-side gọi qua `google.script.run` (client) hoặc trực tiếp trong test. Chữ ký giữ nguyên; chỉ bổ sung ràng buộc/hành vi.

```
transitionDocument(token, id, action, data, updateData) → { data, emailError }
```

Chỉ mô tả 2 action thuộc phạm vi feature. Các action khác không đổi.

---

## Action `giaoViec` (Chờ duyệt → Chờ xử lý)

**Quyền**: `Giám đốc`, hoặc admin/`Quản trị viên` (bypass). Khác → lỗi `'Bạn không có quyền thực hiện hành động này'`.

**Tiền điều kiện**: `Tình trạng == 'Chờ duyệt'`.

**`data`**:
| field | bắt buộc | ý nghĩa |
|---|---|---|
| `Phụ trách` | có | id/username người phụ trách (1 người). Thiếu → lỗi `'Phải chọn người phụ trách'`. |
| `Người phối hợp` | tuỳ chọn | mảng/chuỗi id người phối hợp. |
| `Nội dung` | **bắt buộc nếu có ≥1 người phối hợp** | nội dung giao việc. |

**Ràng buộc mới (R1 / D1)**:
- Nếu danh sách `Người phối hợp` kết quả có ≥1 người và `trim(Nội dung) == ''` → **lỗi** `'Phải nhập nội dung giao việc khi có người phối hợp'`. Không ghi sheet.
- Nếu 0 người phối hợp → `Nội dung` được phép rỗng.

**Hiệu lực khi thành công**: cập nhật `Phụ trách`, `Người phối hợp`, `Nội dung giao việc` (đã trim), `Tình trạng='Chờ xử lý'`. Gửi email template `giaoViec`: TO=Phụ trách, CC=Người phối hợp (hành vi **đã có, không đổi**). `emailError` = null hoặc thông điệp lỗi (best-effort).

---

## Action `nhanViec` (Chờ xử lý → Đang xử lý)

**Quyền**: `_phuTrach` (người trong cột `Phụ trách`), hoặc admin (bypass). Khác → lỗi quyền.

**Tiền điều kiện**: `Tình trạng == 'Chờ xử lý'`.

**`data`**:
| field | bắt buộc | ý nghĩa |
|---|---|---|
| `Người phối hợp` | tuỳ chọn | danh sách người phối hợp **sau khi thêm**. |
| `Nội dung` | **bắt buộc nếu bổ sung ≥1 PH mới** | nội dung từ **popup giao việc dùng lại**; **lưu vào cột `Nội dung phối hợp`** + đưa vào email phối hợp. |

**Ràng buộc mới (R2 / D2)** — chỉ áp khi không phải admin:
- Đặt `oldPH = _parseAssignees(doc['Người phối hợp'])`, `newPH = _parseAssignees(payload)`.
- Nếu tồn tại phần tử `oldPH` không nằm trong `newPH` → **lỗi** `'Không thể xoá người phối hợp đã có'`. Không ghi sheet.
- Cho phép `newPH ⊇ oldPH` (chỉ thêm).

**Ràng buộc nội dung (D3b)**:
- `addedPH = newPH \ oldPH` (trừ người thao tác). Nếu `addedPH.length >= 1` mà `trim(data['Nội dung']) == ''` → **lỗi** `'Phải nhập nội dung gửi tới người phối hợp'`. Không ghi sheet.

**Hành vi chuông + email mới (R3 / D3)**:
- Với mỗi người trong `addedPH`: đánh dấu unread (**đã có**) **và** gửi 1 email template **`phoiHop`** với người đó là **người nhận chính (TO = 1 người)** — **mới**. (Khác `giaoViec`: ở đó PH chỉ CC.)
- Template `phoiHop` (mới, cấu hình được): *"Xin chào {tênNgườiNhận}, bạn được {tênNgườiGửi} giao phối hợp xử lý công việc với nội dung: {nộiDungPhoiHop}…"*. `{tênNgườiGửi}` = người chủ trì (session). `{nộiDungPhoiHop}` (biến mới) = `doc['Nội dung phối hợp']` vừa lưu.
- Người phối hợp cũ KHÔNG nhận lại email. Email best-effort: lỗi gửi gom `emailError`, không rollback (FR-011). Không thêm ai → không gửi.

**Hiệu lực khi thành công**: cập nhật `Người phối hợp`, **`Nội dung phối hợp`** (= trim nội dung popup), `Tình trạng='Đang xử lý'`. KHÔNG đụng `Nội dung giao việc` của GĐ.

---

## Bảng lỗi (server) liên quan feature

| Tình huống | Thông điệp |
|---|---|
| `giaoViec` thiếu Phụ trách | `Phải chọn người phụ trách` |
| `giaoViec` có PH nhưng nội dung trống | `Phải nhập nội dung giao việc khi có người phối hợp` |
| `nhanViec` (PT) bỏ bớt PH cũ | `Không thể xoá người phối hợp đã có` |
| `nhanViec` bổ sung PH nhưng nội dung popup trống | `Phải nhập nội dung gửi tới người phối hợp` |
| Sai quyền | `Bạn không có quyền thực hiện hành động này` |
| Sai trạng thái | `Hồ sơ đang ở trạng thái "…", không thể <action>` |
