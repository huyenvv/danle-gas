# Document Workflow Reference

## Status Flow

```
Chờ duyệt → (GĐ giao việc) → Chờ xử lý → (Phụ trách nhận việc) → Đang xử lý → (Phụ trách hoàn thành) → Hoàn thành
```

## Role-Based Transitions

### Văn thư (Secretary)
- Creates docs (file required). Two status options on create:
  - "Chờ duyệt" → button "Trình duyệt" → emails Giám Đốc
  - "Hoàn thành" → button "Lưu tài liệu" → confirmation → emails GĐ + audit log
- Cannot edit or delete after submitting
- Fields: Nhà cung cấp, Dự án (Phòng ban), Ghi chú — no Phụ trách/Phối hợp

### Giám Đốc (Director)
- Opens "Chờ duyệt" docs via "Giao việc" button
- Assigns Người phụ trách (1, required) + Người phối hợp (multi, optional)
- After Duyệt: status → "Chờ xử lý"; notify Phụ trách + Phối hợp
- While Phụ trách has not accepted: can edit or recall (→ "Chờ duyệt")

### Người phụ trách (Assignee)
- "Nhận việc" → "Đang xử lý"; notify Giám Đốc
- "Hoàn thành" → "Hoàn thành"; notify Giám Đốc; doc locked
- Can add Phối hợp members (system notifies new members)

### Người phối hợp (Collaborator)
- View doc and comment. Cannot: nhận việc, sửa, hoàn thành.

### Admin
- Full access across all statuses. Only role that can delete documents.

## Notification System

`_Đã Đọc` stores UNREAD records (inverted: has record = unread, delete = mark read).

| Trigger | Unread for | Email to |
|---|---|---|
| trinhDuyet | All Giám đốc | All Giám đốc |
| giaoViec | Phụ trách + Phối hợp | Phụ trách + Phối hợp |
| nhanViec (new Phối hợp) | Newly added only | Newly added only |

## "Công việc của tôi" Filter

| Role | Shows |
|---|---|
| Giám đốc | Docs with status "Chờ duyệt" |
| Văn thư | Docs created by self |
| Nhân viên / Trưởng phòng | Docs where user is Phụ trách or Phối hợp |

Hidden for admin/Quản trị viên.

## Search

Server-side keyword search on Enter. Vietnamese diacritics-insensitive
(NFD + strip combining marks + đ→d). Searches: Tên hồ sơ, Số hồ sơ,
Dự án, Nhà cung cấp, Ghi chú, Phụ trách. Other filters client-side.

## Background Polling

Single `api_pollUpdates` call every 60s. Paused during server-search.
