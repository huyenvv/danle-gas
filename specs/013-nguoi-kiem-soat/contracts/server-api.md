# Contracts: Server API — Người kiểm soát

Mô tả thay đổi hợp đồng các hàm server `apps/docmgr/src/server/documents.js` (gọi từ client qua `gasClient`). Chỉ ghi phần **delta** so với hiện tại.

---

## C1. `transitionDocument(token, id, action, data, updateData)`

### giaoViec — bổ sung trường NKS (chỉ GĐ/QTV gán)
- `data['Người kiểm soát']` (tuỳ chọn): UserID (chuỗi) hoặc rỗng.
- **Chỉ ghi** khi người gọi là **GĐ hoặc admin/QTV**. Vai trò khác → **bỏ qua** trường này (FR-007). *(NKS không có quyền `giaoViec` nên không tới được nhánh này.)*
- Lưu qua `_buildAssignees([uid])`; rỗng → `''`.
- Nếu NKS chuyển sang UserID mới khác rỗng → NKS nhận **chuông** + được thêm vào **CC của email `giaoViec`** (dùng chung, không gửi mail riêng; loại trùng với PT/PH). Best-effort.
- Email `giaoViec` (TO=PT, CC=PH) dựng thêm biến `{tênNgườiKiểmSoát}`/`{vaiTròNgườiKiểmSoát}`; đoạn `[[...]]` trong body tự ẩn/hiện theo việc có NKS.

### Mở rộng tập hành động cho NKS (duyệt tới hoàn thành)
`WORKFLOW_ACTIONS` thêm token role `_kiemSoat` **chỉ** vào:
```
xacNhanHT:    roles: ['Giám đốc', '_kiemSoat']
tuChoiKetQua: roles: ['Giám đốc', '_kiemSoat']
```
- **KHÔNG** thêm `_kiemSoat` vào: `giaoViec`, `thuHoi`, `tuChoi`, `ycPhatHanh`, `luuTru`, `nhanViec`, `hoanThanh`, `trinhDuyet*`, `luuTaiLieu`.
- **Thông báo khi hồ sơ vào `Chờ xác nhận HT`**: `hoanThanh` (PT trình duyệt) và `hoanThanhLai` (PT trình duyệt lại) báo **chuông cho cả GĐ lẫn NKS** của hồ sơ (NKS có quyền xác nhận HT/từ chối kết quả nên cần biết để duyệt). Chỉ chuông, không email; loại trừ chính người thao tác; bỏ qua NKS rỗng.
- **`tuChoiKetQua`** (GĐ hoặc NKS): email `tuChoiKetQua` gửi **PT (TO)** + **CC GĐ** (`_getDirectorUserIds`, loại người thao tác) để GĐ nắm tình hình. PT vẫn nhận chuông như cũ.
- Vòng kiểm tra quyền (`transitionDocument`, ~dòng 1437) thêm nhánh:
  ```js
  } else if (rule.roles[i] === '_kiemSoat') {
    if (_isController(doc, session)) allowed = true
  }
  ```

### Action mới `ksThemPhoiHop` — NKS thêm phối hợp, KHÔNG đổi trạng thái
- `WORKFLOW_ACTIONS.ksThemPhoiHop = { from: '_keep', to: '_keep', roles: ['_kiemSoat'] }` — dùng sentinel `_keep` để **giữ nguyên trạng thái**; chỉ hợp lệ khi `doc['Tình trạng'] ∈ {'Chờ xử lý','Đang xử lý'}` (kiểm tra riêng vì `from` không cố định một giá trị).
- Trong `transitionDocument`:
  - Nếu `rule.to === '_keep'` → KHÔNG set `updates['Tình trạng']` (giữ trạng thái cũ).
  - Validate trạng thái hiện tại ∈ {Chờ xử lý, Đang xử lý}, ngược lại lỗi.
  - Ràng buộc **chỉ-thêm** PH (mượn logic `nhanViec`): tập PH cũ MUST ⊆ tập PH mới; nếu thiếu người → lỗi "Không thể xoá người phối hợp đã có". **PT bất biến** (không nhận/không ghi `Phụ trách`).
  - Bắt buộc `data['Nội dung']` khi có PH mới → lưu `updates['Nội dung phối hợp']`.
  - PH *mới* (diff) → `_markUnreadForUsers` + gửi `phoiHop` từng người (như nhánh `nhanViec`).

### Helper mới
```js
// Resolve qua _getDocUserIdMap (UserID / tên đăng nhập / email → UserID) để NHẤT QUÁN với Token xem.
function _isController(doc, session) {
  if (!doc || !session) return false
  var ids = _parseAssignees(doc['Người kiểm soát'])
  if (!ids.length) return false
  var sid = String(session.userId), map = null
  for (var i = 0; i < ids.length; i++) {
    var raw = String(ids[i])
    if (raw === sid || raw === session.username) return true
    if (!map) map = _getDocUserIdMap()
    if (String(map[raw] != null ? map[raw] : raw) === sid) return true
  }
  return false
}
```

**Lỗi/ràng buộc giữ nguyên**: admin bypass; `emailError` trả về như cũ. Với action thường, `rule.from` kiểm tra như cũ; riêng `ksThemPhoiHop` dùng kiểm tra trạng thái tập hợp ở trên.

---

## C2. `updateDocument(token, id, formData, ...)` — KHÔNG đổi (v1)

- v1 **không** thêm đường ghi `Người kiểm soát` qua `updateDocument`. Đổi/gỡ NKS thực hiện hoàn toàn qua `giaoViec` (C1): GĐ/QTV thu hồi về `Chờ duyệt` rồi giao lại với NKS khác (hoặc để trống = gỡ). Khi giao lại đổi sang NKS mới khác rỗng, NKS vào CC email `giaoViec` như C1.
- Lý do: tối giản (Constitution V); tránh thêm UI/endpoint sửa NKS trực tiếp (quyết định v1, Clarifications 2026-06-24).

---

## C3. Email — `_applyTemplate`, biến, template

### `_applyTemplate(tpl, vars)` (mở rộng, tương thích ngược)
- Sau khi thay biến, xử lý đoạn `[[ ... ]]`:
  - Giữ nội dung (bỏ cặp `[[ ]]`) nếu đoạn không còn `{biến}` chưa thay **và** không rỗng do biến NKS.
  - Xoá cả đoạn nếu biến NKS bên trong rỗng.
- Template không chứa `[[...]]` → hành vi không đổi.

### Biến mới (trong `vars` của `_sendNotificationEmails`)
```
'{tênNgườiKiểmSoát}': <name NKS hoặc ''>,
'{vaiTròNgườiKiểmSoát}': <role NKS từ _getDeptInfo hoặc ''>,
```
Lấy bằng `_getRecipientsByUsernames([controllerUid])[0]` (có `name` + `role`).

### Template `giaoViec` mặc định (cập nhật body — thêm đoạn điều kiện)
```
...đã giao việc hồ sơ "{tênHồSơ}" cho bạn[[ và trình duyệt qua {vaiTròNgườiKiểmSoát} - {tênNgườiKiểmSoát}]].\n\nNội dung: {nộiDungGiaoViec}...
```

---

## C4. Đồng bộ client (không phải API nhưng bắt buộc đi kèm)

- `lib/workflowPermissions.js`: thêm `isController(doc, session)`; trong `getAvailableActions`, nếu `isController` → **union** thêm: `ksThemPhoiHop` khi trạng thái ∈ {Chờ xử lý, Đang xử lý}, và `xacNhanHT`/`tuChoiKetQua` khi `Chờ xác nhận HT` (song song với quyền vai trò gốc). KHÔNG thêm giaoViec/thuHoi cho NKS.
- `SettingsPage.jsx`: thêm 2 biến vào `TEMPLATE_VARS`; cập nhật body `giaoViec` (đoạn `[[...]]`) trong `DEFAULT_MAIL_TEMPLATES`. Không có template/tab `kiemSoat` riêng.
- `DocumentPreview.jsx` (**ghi chú: UI workflow nằm ở đây, KHÔNG phải DocumentModal** — khác giả định ban đầu của plan/tasks):
  - Ô chọn NKS (1 người, tuỳ chọn) trong popup giao việc (`giaoViecForm.mode === 'giaoViec'`) — gửi kèm `Người kiểm soát` trong payload giaoViec. (Popup giao việc vốn chỉ GĐ/QTV mở.)
  - Popup "thêm phối hợp" cho NKS dùng mode mới `giaoViecForm.mode === 'ksThemPhoiHop'`: **dùng lại popup giao việc** với PT **ẩn/khoá** và PH cũ **không gỡ được** (chỉ thêm), ô nội dung bắt buộc, nút **Lưu** gọi `ksThemPhoiHop` (không đổi trạng thái). Bám mẫu UX "Nhận việc" (feature 010).
  - Hiển thị NKS hiện tại trong panel chi tiết; nút workflow lấy từ `getAvailableActions` (đã gồm nhánh NKS).

---

## C5. Bất biến (invariants)

- IV-1: Hồ sơ không có NKS → mọi hành vi/email **không đổi** (SC-005).
- IV-2: NKS không thể ghi trường `Người kiểm soát` (FR-007) — kiểm ở server, không chỉ ẩn UI.
- IV-3: Quyền NKS chỉ áp cho hồ sơ chứa UserID đó ở cột `Người kiểm soát` (FR-005) — kiểm ở server.
- IV-4: Email best-effort — lỗi gửi không rollback ghi hồ sơ.
- IV-5: `ksThemPhoiHop` chỉ THÊM PH (tập cũ ⊆ tập mới), PT bất biến, KHÔNG đổi trạng thái — kiểm ở server (FR-004/004a).
- IV-6: "Thấy được ⇒ thao tác được" — `_isController` resolve danh tính bằng **cùng map** với "Token xem" (`_getDocUserIdMap`). Không có ca hồ sơ hiện trong list NKS nhưng hành động bị chặn quyền (FR-015).

---

## C6. Hiển thị hồ sơ cho NKS (FR-014)

- `_docViewToken(doc)` (sinh cột **Token xem**) MUST gộp `Người kiểm soát` (qua `_getDocUserIdMap`) khi trạng thái ≠ Nháp → query danh sách (gviz) trả hồ sơ cho NKS.
- `_isParticipant(doc, session)` MUST true cho NKS → mở/xem/bình luận hồ sơ.

## C7. Hàm bảo trì (chạy THỦ CÔNG từ Apps Script editor — KHÔNG gọi trong doGet)

- `rebuildAllDerived()` → tính lại 3 cột tính sẵn (Hạng ưu tiên / Token xem / Blob tìm kiếm) cho MỌI hồ sơ. **An toàn ở 10k+**: đọc 1 lần (`getDataRange`) → tính RAM → ghi mỗi cột bằng 1 `setValues`. Trả số hồ sơ đã cập nhật.
- `backfillControllerTokens()` → bản nhẹ: chỉ ghi lại hồ sơ **có** NKS.
- ⚠️ TUYỆT ĐỐI không full-scan + ghi từng dòng trong `ensureInitialized`/`doGet` (timeout vĩnh viễn ở quy mô lớn — bài học 013).
