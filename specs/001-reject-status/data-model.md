# Data Model: Trạng thái Từ chối

## Schema Changes

### Hồ Sơ (HO_SO) — new column

| Column | Type | Description |
|---|---|---|
| Lý do từ chối | String | Free-text rejection reason. Set by GĐ on tuChoi action. Cleared on trinhDuyetLai. |

Add to `tabDefs` in `config.js`, bump SCHEMA_V 3→4.

### VALID_STATUSES — add entry

```js
var VALID_STATUSES = ['Chờ duyệt', 'Chờ xử lý', 'Đang xử lý', 'Hoàn thành', 'Từ chối']
```

### WORKFLOW_ACTIONS — add entries

```js
tuChoi:        { from: 'Chờ duyệt', to: 'Từ chối', roles: ['Giám đốc'] },
trinhDuyetLai: { from: 'Từ chối',   to: 'Chờ duyệt', roles: ['Văn thư'] },
```

### _DEFAULT_MAIL_TEMPLATES — add entry

```js
tuChoi: {
  subject: '[Từ chối] {tênHồSơ}',
  body: 'Xin chào {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) đã từ chối hồ sơ "{tênHồSơ}".\n\nLý do: {lyDoTuChoi}\n\nVui lòng đăng nhập hệ thống để chỉnh sửa và trình duyệt lại:\n{linkHệThống}'
}
```

## Updated Flow

```
Chờ duyệt ──(GĐ giaoViec)──→ Chờ xử lý ──(PT nhanViec)──→ Đang xử lý ──(PT hoanThanh)──→ Hoàn thành
     │                                                                          
     ├──(GĐ tuChoi)──→ Từ chối ──(VT trinhDuyetLai)──→ Chờ duyệt (loop)
     │                                                      
     └──(GĐ thuHoi from Chờ xử lý)──→ Chờ duyệt
```

## transitionDocument changes

In `tuChoi` handler:
1. Require `data['lyDoTuChoi']` (throw if empty)
2. Set `updates['Lý do từ chối'] = data['lyDoTuChoi']`
3. Find doc creator → `_getRecipientsByUsernames([doc['Người tạo']])`
4. `_markUnreadForUsers([doc['Người tạo']], id)`
5. `_sendNotificationEmails(recipients, updated, 'tuChoi', session)` with extra var `{lyDoTuChoi}`

In `trinhDuyetLai` handler:
1. Clear `updates['Lý do từ chối'] = ''`
2. Notify all GĐ (reuse trinhDuyet email + unread pattern)

## _sendNotificationEmails changes

Add `{lyDoTuChoi}` to template variables (from `doc['Lý do từ chối']`).

## SettingsPage TEMPLATE_VARS — add entry

```js
{ key: '{lyDoTuChoi}', desc: 'Lý do từ chối (chỉ dùng trong email Từ chối)' }
```

## Client changes

### DocumentModal.jsx
- Status "Chờ duyệt" + role GĐ: show "Từ chối" button (red/error style)
- Click → dialog with textarea "Lý do từ chối" (required) + Xác nhận/Hủy
- Submit → `transitionDocument(token, id, 'tuChoi', { lyDoTuChoi })`
- Status "Từ chối" + role VT (creator): show rejection reason banner + editable fields + "Trình duyệt" button
- Submit → `transitionDocument(token, id, 'trinhDuyetLai', {})`

### SettingsPage.jsx
- Add `tuChoi` to DEFAULT_TEMPLATES with default subject/body
- Add "Từ chối" tab in email settings section
