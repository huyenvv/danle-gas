# Research: Nghiệm thu trước hoàn thành

## R1: Change existing hoanThanh target

**Decision**: Change `hoanThanh: { from: 'Đang xử lý', to: 'Hoàn thành' }` → `to: 'Chờ xác nhận HT'`. Add new `hoanThanhLai: { from: 'Từ chối kết quả', to: 'Chờ xác nhận HT' }` for resubmit loop.
**Rationale**: Minimal change — PT button label stays "Hoàn thành", only target status changes.

## R2: New workflow actions

**Decision**: Add `xacNhanHT: { from: 'Chờ xác nhận HT', to: 'Hoàn thành', roles: ['Giám đốc'] }` and `tuChoiKetQua: { from: 'Chờ xác nhận HT', to: 'Từ chối kết quả', roles: ['Giám đốc'] }`.
**Rationale**: Same pattern as tuChoi. tuChoiKetQua requires lyDoTuChoi, reuses "Lý do từ chối" column.

## R3: xacNhanHT — no notification

**Decision**: xacNhanHT does NOT send email or mark unread. Only transitions status + locks doc.
**Rationale**: User explicitly requested no notification for approval.

## R4: PT edit on Từ chối kết quả

**Decision**: Same pattern as VT edit on Từ chối — PT (assigned) can edit + click "Hoàn thành" → transitionDocument('hoanThanhLai', {}, updateData). Single API call.
**Rationale**: Reuse existing updateData pattern from 001-reject-status.

## R5: Badge colors

**Decision**: "Chờ xác nhận HT" = `bg-teal-100 text-teal-800`. "Từ chối kết quả" = `bg-rose-100 text-rose-800` (distinct from "Từ chối" = `bg-red-100 text-red-800`).

## R6: Email template

**Decision**: Add `tuChoiKetQua` key to _DEFAULT_MAIL_TEMPLATES — separate from `tuChoi`. Subject: "[Từ chối kết quả] {tênHồSơ}". Uses {lyDoTuChoi}.
