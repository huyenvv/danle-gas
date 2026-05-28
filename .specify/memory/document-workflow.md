# Document Workflow

## Status Flow

Chờ duyệt →(GĐ giao việc)→ Chờ xử lý →(PT nhận việc)→ Đang xử lý →(PT hoàn thành)→ Hoàn thành

## Role Actions

**Văn thư:** Create doc (file required). Status on create: "Chờ duyệt" (→emails GĐ) or "Hoàn thành" (→confirm→emails GĐ+audit). Cannot edit/delete after submit. No Phụ trách/Phối hợp fields.

**Giám Đốc:** "Giao việc" on Chờ duyệt docs. Assigns Phụ trách (1, required) + Phối hợp (multi, optional). →"Chờ xử lý", notify PT+PH. Can edit/recall while PT hasn't accepted.

**Phụ trách:** "Nhận việc"→"Đang xử lý" (notify GĐ). "Hoàn thành"→locked (notify GĐ). Can add Phối hợp.

**Phối hợp:** View + comment only.

**Admin:** Full access all statuses. Only role that deletes docs.

## Notifications

`_Đã Đọc`: has record=unread, delete=read.

| Trigger | Unread for | Email to |
|---|---|---|
| trinhDuyet | All GĐ | All GĐ |
| giaoViec | PT+PH | PT+PH |
| nhanViec (new PH) | New PH only | New PH only |

## "Công việc của tôi"

GĐ→Chờ duyệt docs. VT→own docs. NV/TP→Phụ trách or Phối hợp docs. Hidden for admin.

## Search

Server-side on Enter, NFD diacritics-insensitive. Fields: Tên hồ sơ, Số hồ sơ, Dự án, NCC, Ghi chú, Phụ trách. Other filters client-side. `api_pollUpdates` every 60s, paused during search.
