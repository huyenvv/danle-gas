# Phase 0 Research: Workflow giao việc cho người phối hợp

Mục tiêu: đối chiếu spec với code hiện hữu, chốt các quyết định trước khi thiết kế. Mọi tham chiếu dòng theo `apps/docmgr/src/server/documents.js` tại worktree `010`.

## Phát hiện nền tảng (đã tồn tại)

- **Workflow** `transitionDocument()` (dòng 1222) với `WORKFLOW_ACTIONS` (1206–1220):
  - `giaoViec`: `Chờ duyệt → Chờ xử lý`, roles `['Giám đốc']` (+ admin/QTV bypass dòng 1238). Đặt `Phụ trách` (bắt buộc), `Người phối hợp` (tuỳ chọn), `Nội dung giao việc` (1267–1274). Gửi email TO=PT, CC=PH bằng template `giaoViec` (1297–1310).
  - `nhanViec`: `Chờ xử lý → Đang xử lý`, roles `['_phuTrach']`. Cho PT cập nhật `Người phối hợp` (1278–1280). Chỉ đánh dấu unread cho PH mới, **không gửi email** (1355–1362).
- **Cột `Nội dung giao việc`** đã có trong `HO_SO` (config.js, SCHEMA_V `'11'`). Không cần bump schema.
- **Template email `giaoViec`** (dòng 43–45) tách biệt với `phatHanh` (47–49), có biến `{nộiDungGiaoViec}` (227).
- **Vai trò**: `isAdmin = role==='admin' || 'Quản trị viên'` bypass mọi gate (1238). `_phuTrach` resolve từ cột `Phụ trách` của tài liệu (1243–1247).
- **Email best-effort**: mỗi nhánh bọc `try/catch`, gom `emailError`, không rollback (vd 1306–1310). `_sendNotificationEmails` gửi 1 email tới danh sách TO (join ',') + CC; cá nhân hoá `{tênNgườiNhận}` **chỉ khi TO có đúng 1 người** (194–196, 235).

## Đối chiếu Functional Requirements ↔ code

| FR | Trạng thái | Hành động |
|---|---|---|
| FR-001 (adder = GĐ, admin/QTV, PT) | **Đã thoả** | `giaoViec` roles GĐ + admin/QTV bypass; PT thêm ở `nhanViec`. Không sửa. |
| FR-002 (PT chỉ thêm, không xoá) | **GAP** → D2 | `nhanViec` đang thay thế danh sách; thêm ràng buộc tập cũ ⊆ tập mới. |
| FR-003 (admin/QTV, GĐ toàn quyền) | **Đã thoả phần lớn** | admin bypass hoàn toàn; GĐ sửa PH qua `giaoViec`/`thuHoi`. (Xem "Giới hạn đã biết".) |
| FR-004 (enforce server-side) | D2 thực thi ở server | Ràng buộc nằm trong `transitionDocument`, không phụ thuộc UI. |
| FR-005/FR-006/FR-012 (bắt buộc nội dung khi ≥1 PH) | **GAP** → D1 | Validate ở nhánh `giaoViec`. |
| FR-007 (enforce server-side) | D1 ở server | Validate trong `transitionDocument`. |
| FR-008 (PH ở `Chờ duyệt` nhận email khi →`Chờ xử lý`) | **Đã thoả** | `giaoViec` CC cho PH bằng template `giaoViec`. Không sửa. |
| FR-009 (template riêng, tách `phatHanh`) | **Một phần** → D3 | `giaoViec` cho luồng GĐ đã có; cần **thêm template `phoiHop`** cho luồng nhận việc. |
| FR-010 (PH thêm ở `nhanViec` nhận chuông+email khi →`Đang xử lý`) | **GAP** → D3 | Gửi email template `phoiHop` (nội dung popup) cho PH *mới*. |
| FR-011 (không gửi nếu lưu thất bại) | **Đã thoả** | `updateRow` chạy trước (1294); email sau, best-effort. |
| FR-014 (popup nhập nội dung khi bổ sung PH ở nhận việc) | **GAP** → D3/D3b + C2 | **Dùng lại popup giao việc**; bắt buộc; chỉ hiện khi có PH mới. |

## Quyết định

### D1 — Validate bắt buộc nội dung giao việc (nhánh `giaoViec`)
- **Decision**: Trong nhánh `giaoViec`, tính số người phối hợp kết quả; nếu ≥1 mà `trim(Nội dung)` rỗng → `throw`. Lưu nội dung đã `trim`.
- **Rationale**: Khớp FR-005/FR-012 và phát biểu của người dùng ("ở `Chờ duyệt` nếu có người phối hợp thì nội dung bắt buộc"). Thực thi server (FR-007).
- **Phạm vi**: Chỉ ép ở `giaoViec` (nơi PH + nội dung cùng nhập). **Không** ép lại ở `nhanViec` — PT chỉ thêm người, form không có ô nội dung; nội dung đã do GĐ nhập từ `giaoViec`. (Khớp lời người dùng.)
- **Alternatives**: Ép ở mọi đường lưu (kể cả `updateDocument`) — loại, vì ngoài luồng giao việc và gây phiền cho thao tác không liên quan.

### D2 — Ràng buộc "chỉ thêm" cho người phụ trách (nhánh `nhanViec`)
- **Decision**: Trong `nhanViec`, nếu `data['Người phối hợp']` được gửi: parse tập cũ (`doc['Người phối hợp']`) và tập mới; nếu có phần tử cũ **không** nằm trong tập mới → `throw 'Không thể xoá người phối hợp đã có'`. Bỏ qua kiểm tra khi `isAdmin`.
- **Rationale**: FR-002 (tập cũ ⊆ tập mới), enforce server (FR-004). admin toàn quyền (FR-003) nên miễn ràng buộc.
- **Lưu ý vai trò**: `nhanViec` chỉ mở cho `_phuTrach` (và admin bypass). GĐ không đi qua `nhanViec` → ràng buộc thực tế chỉ áp PT. So khớp theo username/userId như `_excludeSelf`/`_parseAssignees` đang dùng.
- **Alternatives**: Khoá hoàn toàn cột PH cho PT — loại, vì spec yêu cầu PT *được thêm*.

### D3 — Email + popup cho người phối hợp mới khi `nhanViec` (template phối hợp RIÊNG)
> Cập nhật theo phản hồi khách 2026-06-20: KHÔNG tái dùng template `giaoViec`; dùng template phối hợp riêng + nội dung từ popup nhận việc.
- **Decision**:
  1. **Thêm template mới** `phoiHop` vào `_DEFAULT_MAIL_TEMPLATES` (cấu hình được qua `MAIL_TEMPLATES`), body: *"Xin chào {tênNgườiNhận}, bạn được {tênNgườiGửi} giao phối hợp xử lý công việc với nội dung: {nộiDungGiaoViec}…"* (subject `[Phối hợp] {tênHồSơ}`).
  2. Ở `nhanViec`, nhận thêm field `data['Nội dung']` = nội dung popup. **Lưu vào cột mới `Nội dung phối hợp`** (xem D5), KHÔNG đè `Nội dung giao việc` của GĐ. Với mỗi PH **mới** (`newPH \ oldPH`, trừ người thao tác): đánh dấu unread (đã có) **và** gửi 1 email template `phoiHop` với người đó là **TO** (người nhận chính).
  3. Template `phoiHop` dùng biến **mới** `{nộiDungPhoiHop}` (thêm vào `vars` của `_sendNotificationEmails`, map `doc['Nội dung phối hợp']`). Email đọc nội dung từ cột vừa lưu (`updated['Nội dung phối hợp']`).
  4. Best-effort: bọc `try/catch`, gom `emailError` (FR-011). Không thêm PH → không gửi.
- **Rationale**: FR-009/FR-010/FR-014/FR-015 + mô tả khách: email phối hợp có nội dung riêng do người chủ trì nhập, lưu tách khỏi nội dung GĐ, tách khỏi template phát hành. `{tênNgườiGửi}` = session (người chủ trì) → khớp "[tên người chủ trì]". PH mới = TO (khác `giaoViec` PH=CC).
- **Người nhận chính (TO)**: khác luồng `giaoViec` (chủ trì=TO, PH=CC), luồng `nhanViec` đặt **PH mới = TO** (người nhận chính, theo chốt khách 2026-06-21). Loop từng PH mới (TO=1) vừa khiến mỗi người là người nhận chính vừa cá nhân hoá `{tênNgườiNhận}` (`_sendNotificationEmails` chỉ cá nhân hoá tên khi TO có 1 người — dòng 194).
- **Popup**: dùng lại **popup giao việc** hiện có (không tạo popup riêng) — chốt khách. Nội dung truyền qua `data['Nội dung']`.
- **Alternatives**: tái dùng `giaoViec` template — loại (người nhận chính & ngữ cảnh khác); 1 email TO=tất cả PH — loại (mất cá nhân hoá tên).

### D3b — Bắt buộc nội dung popup khi có bổ sung PH (`nhanViec`)
- **Decision**: Nếu `addedPH.length >= 1` mà `trim(data['Nội dung']) == ''` → `throw 'Phải nhập nội dung gửi tới người phối hợp'`. Không bổ sung → không yêu cầu, không popup (client).
- **Rationale**: FR-014; popup "giống popup giao việc/từ chối" — đều bắt buộc nhập. Enforce server (không chỉ UI).

### D4 — Email ở `giaoViec` giữ nguyên (CC cho PH)
- **Decision**: KHÔNG đổi cơ chế email `giaoViec` hiện tại (PT ở TO, PH ở CC, template `giaoViec`, nội dung GĐ).
- **Rationale**: FR-008/US3.1 chỉ yêu cầu PH *nhận* email assignment khi →`Chờ xử lý`; CC đã giao đến từng PH với nội dung. Khách chỉ yêu cầu đổi luồng **nhận việc** (mục D3), không đụng luồng giao việc của GĐ. Đổi `giaoViec` là rủi ro hồi quy, vi phạm Surgical/Simplicity.

### D5 — Cột mới `Nội dung phối hợp` + bump SCHEMA_V + hiển thị preview
> Cập nhật theo chốt khách 2026-06-21: lưu nội dung popup vào chỗ mới, hiển thị tách biệt.
- **Decision**:
  - **Schema (S1)**: thêm cột `Nội dung phối hợp` vào header `HO_SO` trong `config.js`; bump `SCHEMA_V` `'11'`→`'12'`. `ensureMissingColumns` tự thêm cột cho file hiện hữu (giá trị rỗng cho tài liệu cũ).
  - **Lưu (D3)**: `nhanViec` ghi `updates['Nội dung phối hợp'] = trim(data['Nội dung'])`. KHÔNG đụng `Nội dung giao việc`.
  - **Hiển thị (C3)**: `DocumentPreview.jsx` hiển thị 2 mục tách biệt, tiêu đề khác nhau: "Nội dung giao việc" (= `Nội dung giao việc`, GĐ) và "Nội dung phối hợp" (= `Nội dung phối hợp`, chủ trì). Trường rỗng có thể ẩn.
- **Rationale**: FR-015/FR-016 + khách: không mất nội dung GĐ; người xem phân biệt được 2 nguồn nội dung.
- **An toàn bump schema**: `prevSchema='11'`≠null → `ensureInitialized` KHÔNG chạy `rebuildFileIndex` (nặng), chỉ thêm cột + backfill nhẹ (xem config.js). 
- **Tên cột/tiêu đề**: đề xuất `Nội dung phối hợp`; có thể đổi nhãn nếu khách muốn rõ hơn (vd "Nội dung gửi người phối hợp").

### D6 — Lộ template `phoiHop` ra màn cấu hình email (Settings)
> Phát sinh khi triển khai (khách: "thêm 1 cấu hình email nữa"). Template chỉ ở `_DEFAULT_MAIL_TEMPLATES` (server) thì admin không thấy/sửa được.
- **Decision**: Bổ sung `phoiHop` vào `SettingsPage.jsx`: `MAIL_TABS` (tab "Phối hợp"), `DEFAULT_TEMPLATES` (pre-fill subject/body khớp server), `TEMPLATE_VARS` (thêm `{nộiDungPhoiHop}`).
- **Rationale**: FR-017 — admin sửa được template; biến hiển thị trong danh sách. Lưu khi save → `MAIL_TEMPLATES` config (SSO `_Hệ Thống`), runtime override mặc định.
- **Lưu ý**: `_DEFAULT_MAIL_TEMPLATES` (server) và `DEFAULT_TEMPLATES` (client) là 2 nguồn pre-fill song song sẵn có của dự án — giữ đồng bộ body cho `phoiHop`.

## Giới hạn đã biết (ngoài phạm vi, ghi nhận để minh bạch)

- **GĐ xoá/sửa PH khi `Đang xử lý`**: **Quyết định khách 2026-06-21 — GIỮ NGUYÊN**. GĐ chỉ sửa PH qua `giaoViec` (Chờ duyệt) hoặc `thuHoi` (thu hồi về Chờ duyệt rồi giao lại); KHÔNG thêm đường sửa trực tiếp ở `Đang xử lý`. admin vẫn toàn quyền mọi trạng thái. FR-003 đã được thu hẹp lại cho khớp (không còn là "gap").
- **PGĐ (rank 5)**: Không nằm trong tập adder/toàn quyền theo clarify (chỉ GĐ/admin-QTV/PT). `giaoViec` roles `['Giám đốc']` nên PGĐ không giao việc — khớp spec. Nếu nghiệp vụ muốn PGĐ ngang GĐ, xác nhận sau.
- **Bắt buộc nội dung ở `nhanViec`**: Nếu GĐ giao việc với 0 PH + nội dung trống, rồi PT thêm PH ở `nhanViec` (nội dung vẫn trống) → hiện **không** chặn (D1 chỉ ở `giaoViec`). Theo phát biểu người dùng (ép ở `Chờ duyệt`). Ghi nhận như giả định; đổi nếu cần.
