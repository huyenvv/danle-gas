# Research: Trạng thái Từ chối

## R1: How to add new status to workflow

**Decision**: Add `tuChoi` entry to `WORKFLOW_ACTIONS` map + add "Từ chối" to `VALID_STATUSES`.

**Rationale**: Existing pattern. `giaoViec`, `thuHoi`, `nhanViec`, `hoanThanh` all follow same structure: `{ from, to, roles }`. `transitionDocument()` already validates role + status + dispatches email.

**Alternatives**: Separate API function (rejected — breaks consistent pattern).

## R2: Where to store rejection reason

**Decision**: New column "Lý do từ chối" in `Hồ Sơ` sheet. Passed via `data` param in `transitionDocument`.

**Rationale**: Same pattern as `giaoViec` which reads `data['Phụ trách']`. Column added via `ensureInitialized` + SCHEMA_V bump (3→4).

**Alternatives**: Store in `_Bình Luận` as comment (rejected — rejection reason is metadata, not a conversation).

## R3: VT resubmit flow (Từ chối → Chờ duyệt)

**Decision**: Add `trinhDuyetLai` action to WORKFLOW_ACTIONS: `{ from: 'Từ chối', to: 'Chờ duyệt', roles: ['Văn thư'] }`. Reuse existing `trinhDuyet` email template.

**Rationale**: Separate action name to distinguish in audit log. Same email as original trinhDuyet.

**Alternatives**: Reuse `trinhDuyet` action with from=null (rejected — from=null means "any status" which is too broad, and audit log loses distinction).

## R4: Email template for rejection

**Decision**: Add `tuChoi` key to `_DEFAULT_MAIL_TEMPLATES` with `{lyDoTuChoi}` variable. Settings UI adds tab for rejection email.

**Rationale**: Follows existing pattern (trinhDuyet, giaoViec, phatHanh). Template variables: `{tênHồSơ}`, `{ngườiGửi}`, `{emailNgườiGửi}`, `{lyDoTuChoi}`, `{linkHệThống}`.

## R5: VT can edit doc at "Từ chối" status

**Decision**: Client treats "Từ chối" same as pre-submit state for VT — editable fields, file changes allowed. Show rejection reason prominently.

**Rationale**: VT needs to fix issues before resubmitting. After resubmit, doc returns to "Chờ duyệt" (read-only for VT again).

## R6: Notification recipients for rejection

**Decision**: TO = doc creator (Người tạo). Unread for same user.

**Rationale**: VT who created the doc needs to know. Consistent with existing pattern where trinhDuyet notifies all GĐ.
