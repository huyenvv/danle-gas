# Data Model: YC Phát hành

**Date**: 2026-05-31 | **Feature**: 003-yc-phat-hanh

## Entity Changes

### Hồ Sơ (Document)

**Field: Tình trạng (Status)**
- Add new value: `"YC Phát hành"` to VALID_STATUSES array
- Position: after `"Từ chối"` in the array

**Field: Lý do từ chối (Rejection/Request Reason)**
- No schema change — reused for YC Phát hành reason
- Field stores only the latest reason (overwritten on status transition)
- Cleared when document is published or transitions away

### State Transitions

```
New action:
  ycPhatHanh: Chờ duyệt → YC Phát hành (by GĐ)

Exit from YC Phát hành:
  publishDocument: YC Phát hành → [published] (by creator)
```

**Updated state machine:**

```
                    ┌──(tuChoi)──→ Từ chối ──(trinhDuyetLai)──┐
                    │                                          │
Chờ duyệt ←────────┤                                          └──→ Chờ duyệt
    │               │
    │               └──(ycPhatHanh)──→ YC Phát hành ──(publish)──→ [published]
    │
    ├──(giaoViec)──→ Chờ xử lý ──(nhanViec)──→ Đang xử lý ──(hoanThanh)──→ Chờ xác nhận HT
    │                                                                             │
    └──(luuTru)──→ Hoàn thành ←──(xacNhanHT)─────────────────────────────────────┘
                                     │
                                     └──(tuChoiKetQua)──→ Từ chối kết quả ──(hoanThanhLai)──→ Chờ xác nhận HT
```

### WORKFLOW_ACTIONS

New entry:

```
ycPhatHanh: { from: 'Chờ duyệt', to: 'YC Phát hành', roles: ['Giám đốc'] }
```

### MAIL_TEMPLATES

New key:

```
ycPhatHanh: {
  subject: '{hoảTốc}[YC Phát hành] {tênHồSơ}',
  body: '...(includes {lyDoTuChoi} variable for reason)...'
}
```

### Permission Matrix

| Status       | Admin              | GĐ              | Publisher* (creator) | Publisher* (non-creator) |
| ------------ | ------------------ | ---------------- | -------------------- | ------------------------ |
| Chờ duyệt    | Edit               | Giao việc / Từ chối / Lưu trữ / **YC Phát hành** | (no actions) | (no actions) |
| Hoàn thành   | Edit + Phát hành   | (no actions)     | Phát hành            | Phát hành                |
| YC Phát hành | Edit + Phát hành   | (no actions)     | Phát hành (no edit)  | (no actions, no edit)    |

*Publisher = VT hoặc user có quyền tạo doc (canCreate) + quyền phát hành (canPublish / "Được phát hành"), trừ admin.

**Key rule**: Ở trạng thái "YC Phát hành", tất cả publisher (trừ admin) đều KHÔNG được edit. Chỉ creator mới thấy nút Phát hành.
