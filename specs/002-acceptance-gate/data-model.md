# Data Model: Nghiệm thu trước hoàn thành

## VALID_STATUSES

```js
var VALID_STATUSES = ['Chờ duyệt', 'Chờ xử lý', 'Đang xử lý', 'Hoàn thành', 'Từ chối', 'Chờ xác nhận HT', 'Từ chối kết quả']
```

## WORKFLOW_ACTIONS changes

```js
// CHANGE existing:
hoanThanh:      { from: 'Đang xử lý', to: 'Chờ xác nhận HT', roles: ['_phuTrach'] },
// ADD new:
hoanThanhLai:   { from: 'Từ chối kết quả', to: 'Chờ xác nhận HT', roles: ['_phuTrach'] },
xacNhanHT:      { from: 'Chờ xác nhận HT', to: 'Hoàn thành', roles: ['Giám đốc'] },
tuChoiKetQua:   { from: 'Chờ xác nhận HT', to: 'Từ chối kết quả', roles: ['Giám đốc'] },
```

## transitionDocument handlers

**hoanThanh** (modified): target → "Chờ xác nhận HT". Notify all GĐ (email + unread). Clear "Lý do từ chối".
**hoanThanhLai**: same as hoanThanh. Target → "Chờ xác nhận HT". Supports updateData. Clear "Lý do từ chối".
**xacNhanHT**: target → "Hoàn thành". NO email, NO unread. Just status + audit log.
**tuChoiKetQua**: require lyDoTuChoi. Set "Lý do từ chối". Notify PT (email + unread).

## _DEFAULT_MAIL_TEMPLATES — add

```js
tuChoiKetQua: {
  subject: '[Từ chối kết quả] {tênHồSơ}',
  body: 'Xin chào {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) đã từ chối kết quả xử lý hồ sơ "{tênHồSơ}".\n\nLý do: {lyDoTuChoi}\n\nVui lòng đăng nhập hệ thống để chỉnh sửa và hoàn thành lại:\n{linkHệThống}'
}
```

## Client workflowPermissions.js

```js
// Add to ACTIONS:
xacNhanHT:      { key: 'xacNhanHT',      label: 'Xác nhận HT',      icon: 'verified',  color: 'emerald' },
tuChoiKetQua:   { key: 'tuChoiKetQua',    label: 'Từ chối',          icon: 'cancel',    color: 'rose'    },
hoanThanhLai:   { key: 'hoanThanhLai',    label: 'Hoàn thành',       icon: 'task_alt',  color: 'emerald' },

// Add to GIAM_DOC_ACTIONS:
'Chờ xác nhận HT': ['xacNhanHT', 'tuChoiKetQua'],

// Add to ADMIN_ACTIONS:
'Chờ xác nhận HT': ['xacNhanHT', 'tuChoiKetQua'],

// Change PHUTRACH_ACTIONS:
'Đang xử lý':      ['hoanThanh'],
'Từ chối kết quả':  ['hoanThanhLai'],
```

## Badge colors (format.js)

```js
'Chờ xác nhận HT':  'bg-teal-100 text-teal-800',
'Từ chối kết quả':   'bg-rose-100 text-rose-800',
```

## DocumentPreview.jsx

- "Chờ xác nhận HT": GĐ sees xacNhanHT + tuChoiKetQua buttons. PT sees nothing (doc locked).
- "Từ chối kết quả": PT (assigned) sees edit + "Hoàn thành" in grid. Rejection banner shown. Publish hidden. Same pattern as VT on "Từ chối".
- tuChoiKetQua click → reason dialog (same as tuChoi).

## DocumentModal.jsx

- PT editing doc at "Từ chối kết quả": only "Hoàn thành" button (no Lưu tài liệu/Phát hành). Uses transitionDocument('hoanThanhLai', {}, updateData).

## SettingsPage.jsx

- Add `tuChoiKetQua` to DEFAULT_TEMPLATES + email tabs.
- TEMPLATE_VARS already has {lyDoTuChoi}.

## Updated flow

```
Chờ duyệt ──(GĐ giaoViec)──→ Chờ xử lý ──(PT nhanViec)──→ Đang xử lý
     │                                                            │
     └──(GĐ tuChoi)──→ Từ chối ──(VT trinhDuyetLai)──→ Chờ duyệt │
                                                                   ↓
Hoàn thành ←──(GĐ xacNhanHT, no notify)──← Chờ xác nhận HT ←──(PT hoanThanh, notify GĐ)
                                                  │
                                                  └──(GĐ tuChoiKetQua)──→ Từ chối kết quả ──(PT hoanThanhLai)──→ Chờ xác nhận HT (loop)
```
