# Research: YC Phát hành

**Date**: 2026-05-31 | **Feature**: 003-yc-phat-hanh

## R1: How to add a new workflow action

**Decision**: Follow the exact pattern of `tuChoi` — add entry to `WORKFLOW_ACTIONS` (server), `ACTIONS` (client), role-action matrices, and status validation.

**Rationale**: The codebase has a well-established pattern for workflow actions across 4 files: `documents.js` (server), `DocumentPreview.jsx` (client UI), `workflowPermissions.js` (client logic), and `SettingsPage.jsx` (email config). All existing actions follow the same structure.

**Alternatives considered**: None — the pattern is rigid due to GAS concatenation discipline.

## R2: Where to store the "YC Phát hành" reason

**Decision**: Reuse the existing "Lý do từ chối" column in the Hồ Sơ sheet.

**Rationale**: User explicitly requested "Lý do sẽ lưu chung với chỗ lý do của Từ chối". The field stores only the latest reason (overwritten on each transition). Since "YC Phát hành" and "Từ chối" are mutually exclusive states from different status origins, there's no data conflict.

**Alternatives considered**: Separate column "Lý do YC Phát hành" — rejected per user requirement to share the field.

## R3: Publish button visibility rules (revised)

**Decision**: Modify `showPublishBtn` logic to include "YC Phát hành" status with creator-only constraint. Applies to all "publishers" (VT + users with canCreate + canPublish), not just VT role.

**Rationale**: User specified nút Phát hành visible when: (a) tạo mới, (b) Hoàn thành, (c) YC Phát hành but only for own docs. This applies to anyone with publish permission, not just VT. Admin is excluded from these restrictions (admin follows its own logic). The new `showPublishBtn` logic adds: `isYCPhatHanh && isCreator` as a condition for non-admin publishers.

**Alternatives considered**: Separate button for "YC Phát hành" publish — unnecessary complexity since the publish action is identical.

## R4: Edit button behavior on "YC Phát hành"

**Decision**: "YC Phát hành" status blocks edit for ALL publishers (VT + users with canCreate + canPublish), not just VT. Only admin retains edit capability.

**Rationale**: User clarified: "ko chỉ VT mà ai đó có quyền tạo doc + quyền phát hành (Trừ admin) thì khi GĐ gửi YC phát hành thì cũng sẽ ko edit được". GĐ wants the doc published as-is — editing by any publisher would defeat the purpose.

**Alternatives considered**: Allow only VT to be restricted — rejected per user clarification that all publishers (trừ admin) are restricted.

## R5: Email template for YC Phát hành

**Decision**: Add `ycPhatHanh` key to `_DEFAULT_MAIL_TEMPLATES` and a new tab in `MAIL_TABS` in SettingsPage.

**Rationale**: User explicitly requested "Có thêm tab cài đặt template email riêng cho phần này". Follows the same pattern as `tuChoi` template with `{lyDoTuChoi}` variable for the reason.

**Alternatives considered**: None — direct user requirement.

## R6: GĐ button source status

**Decision**: GĐ sees "YC Phát hành" button only on documents in "Chờ duyệt" status.

**Rationale**: "YC Phát hành" is another GĐ action alongside Giao việc, Từ chối, and Lưu trữ — all from "Chờ duyệt". GĐ reviews the doc and decides it should be published directly (skip the assignment workflow). This parallels how tuChoi works from the same status.

**Alternatives considered**: Show from "Hoàn thành" — rejected per user clarification that GĐ only sees this at "Chờ duyệt".

## R7: What happens when VT publishes from "YC Phát hành"

**Decision**: Identical to normal publish from "Hoàn thành". The `publishDocument` function doesn't check source status beyond permission — it just publishes.

**Rationale**: User stated "VT nhấn Phát hành như bình thường". No special post-publish behavior needed.

**Alternatives considered**: Clear "Lý do từ chối" field after publish — will implement since publish replaces the status anyway, and the reason becomes historical.
