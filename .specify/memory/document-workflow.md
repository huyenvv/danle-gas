# Document Workflow

> Abbreviations: see constitution.md

## Flow

Chờ duyệt →(GĐ giao việc)→ Chờ xử lý →(PT nhận việc)→ Đang xử lý →(PT hoàn thành)→ Hoàn thành

## Actions

**VT:** Create (file required). "Chờ duyệt"→emails GĐ | "Hoàn thành"→confirm→emails GĐ+audit. No edit/delete after submit. No PT/PH fields.
**GĐ:** "Giao việc" on Chờ duyệt. Assigns PT(1,required)+PH(multi,optional). →Chờ xử lý, notify PT+PH. Can edit/recall while PT hasn't accepted.
**PT:** "Nhận việc"→Đang xử lý (notify GĐ). "Hoàn thành"→locked (notify GĐ). Can add PH.
**PH:** View + comment only.
**Admin:** Full access all statuses. Only role that deletes.

## Notifications

`_Đã Đọc`: has record=unread, delete=read.
trinhDuyet→unread+email all GĐ. giaoViec→PT+PH. nhanViec(new PH)→new PH only.

## Filters

"Công việc của tôi": GĐ→Chờ duyệt. VT→own docs. NV/TP→PT or PH docs. Hidden for admin.
Search: server-side Enter, NFD diacritics-insensitive (Tên hồ sơ, Số hồ sơ, Dự án, NCC, Ghi chú, PT). Other filters client-side. Poll `api_pollUpdates` 60s, paused during search.
