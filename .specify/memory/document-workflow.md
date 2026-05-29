# Document Workflow

> Abbreviations: see constitution.md

## Flow

```
Chờ duyệt ──(GĐ giaoViec)──→ Chờ xử lý ──(PT nhanViec)──→ Đang xử lý ──(PT hoanThanh)──→ Hoàn thành
     │
     └──(GĐ tuChoi)──→ Từ chối ──(VT trinhDuyetLai)──→ Chờ duyệt (loop)
```

## Actions

**VT:** Create (file required). "Chờ duyệt"→emails GĐ | "Hoàn thành"→confirm→emails GĐ+audit. No edit/delete after submit. No PT/PH fields.
**VT on Từ chối (creator only):** Can edit + "Trình duyệt lại" only. No "Lưu tài liệu" / "Phát hành". Single API: `transitionDocument('trinhDuyetLai', {}, updateData)` saves edits + transitions.
**GĐ:** "Giao việc" on Chờ duyệt. Assigns PT(1,required)+PH(multi,optional). →Chờ xử lý, notify PT+PH. Can edit/recall while PT hasn't accepted. "Từ chối" on Chờ duyệt — requires lyDoTuChoi (text), →Từ chối, emails+unread to doc creator.
**PT:** "Nhận việc"→Đang xử lý (notify GĐ). "Hoàn thành"→locked (notify GĐ). Can add PH.
**PH:** View + comment only.
**Admin:** Full access all statuses. Only role that deletes.

## WORKFLOW_ACTIONS

```js
trinhDuyet:     { from: null,        to: 'Chờ duyệt',  roles: ['Văn thư'] }
luuTaiLieu:     { from: null,        to: 'Hoàn thành',  roles: ['Văn thư'] }
giaoViec:       { from: 'Chờ duyệt', to: 'Chờ xử lý',  roles: ['Giám đốc'] }
thuHoi:         { from: 'Chờ xử lý', to: 'Chờ duyệt',  roles: ['Giám đốc'] }
nhanViec:       { from: 'Chờ xử lý', to: 'Đang xử lý', roles: ['_phuTrach'] }
hoanThanh:      { from: 'Đang xử lý',to: 'Hoàn thành', roles: ['_phuTrach'] }
tuChoi:         { from: 'Chờ duyệt', to: 'Từ chối',    roles: ['Giám đốc'] }
trinhDuyetLai:  { from: 'Từ chối',   to: 'Chờ duyệt',  roles: ['Văn thư'] }
```

## Notifications

`_Đã Đọc`: has record=unread, delete=read.
trinhDuyet→unread+email all GĐ. giaoViec→PT+PH. nhanViec(new PH)→new PH only. tuChoi→unread+email doc creator (with {lyDoTuChoi}). trinhDuyetLai→unread+email all GĐ.

## Filters

"Công việc của tôi": GĐ→Chờ duyệt. VT→own docs. NV/TP→PT or PH docs. Hidden for admin.
Search: server-side Enter, NFD diacritics-insensitive (Tên hồ sơ, Số hồ sơ, Dự án, NCC, Ghi chú, PT). Other filters client-side. Poll `api_pollUpdates` 60s, paused during search.
