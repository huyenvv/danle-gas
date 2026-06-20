# Phase 1 — Data Model: Phân quyền xem đến từng tài liệu

> **Cập nhật mô hình "chỉ theo người"** (revise 2026-06-18) **+ "snapshot là nguồn chân lý"** (revise 2026-06-19): tài liệu chỉ lưu `Người được xem`. Cột `Nhóm được xem` ở `Hồ Sơ` **không còn dùng**. `Người được xem` là **nguồn chân lý** — rỗng = chỉ toàn quyền + người tham gia (KHÔNG fallback danh mục động); danh mục chỉ là nguồn **snapshot lúc tạo** + **backfill** dữ liệu cũ.

## Sheet `Hồ Sơ` — cột phân quyền

Thêm vào cuối headers (config.js), bump `SCHEMA_V` 10→11:

| Cột | Kiểu | Ý nghĩa | Default |
|-----|------|---------|---------|
| `Người được xem` | JSON array of userId (string) hoặc rỗng | Cá nhân được xem tài liệu (khi Hoàn thành) | `''` (rỗng = chỉ toàn quyền + người tham gia) |
| `Nhóm được xem` | (deprecated ở cấp tài liệu) | Không dùng nữa | `''` |

- **Bất biến**: `Người được xem` không rỗng ⇒ khi Hoàn thành, visibility **category-independent** (chỉ cần nằm trong danh sách).
- **Rỗng** ⇒ khi Hoàn thành chỉ vai trò toàn quyền + người tham gia thấy — **KHÔNG** fallback danh mục động.
- Định dạng giống `Danh Mục.Người được xem` → tái dùng `_parseAssignees`.
- Tài liệu cũ (rỗng) ⇒ **cần backfill 1 lần** (FR-013) snapshot người-xem danh mục cha, nếu không sẽ bị ẩn khỏi người-xem-danh-mục.

### Các cột liên quan (đã có, không đổi)

| Cột | Vai trò |
|-----|---------|
| `Tình trạng` | `'Hoàn thành'` ⇒ `Người được xem` có hiệu lực; khác ⇒ chỉ người tham gia |
| `Người tạo` / `Phụ trách` / `Người phối hợp` | Người tham gia |
| `Danh mục` | Nguồn **snapshot lúc tạo** + nguồn **backfill** dữ liệu cũ (KHÔNG còn fallback động) |

## Entity: Quyền xem tài liệu (suy diễn)

```
canView(user U, document D) =
  Nếu D.TìnhTrạng == 'Nháp'                  → (U == D.NgườiTạo)              [ưu tiên cao nhất]
  Nếu U.role ∈ {admin, Quản trị viên, Giám đốc, Văn thư}  → true (trừ nháp người khác)
  Nếu isParticipant(U, D)                    → true
  Nếu D.TìnhTrạng != 'Hoàn thành'            → false                          [lifecycle gating]
  Nếu D.NgườiĐượcXem không rỗng              → (U.id ∈ D.NgườiĐượcXem ∨ U.username ∈ …)  [category-independent]
  Ngược lại (rỗng)                           → false                          [KHÔNG fallback danh mục — chỉ toàn quyền + participant đã trả true ở trên]

isParticipant(U, D) = U==D.NgườiTạo ∨ U.id∈D.PhụTrách ∨ U.id∈D.NgườiPhốiHợp
```

> **Bỏ fallback danh mục động**: nhánh cuối trả `false` thay vì `matchPerm(Cat…)`. Quyền danh mục chỉ còn ảnh hưởng tài liệu qua **snapshot lúc tạo** và **backfill** (ghi sẵn vào `Người được xem`), không tra cứu động lúc xem. `_matchPerm` (nếu còn) chỉ phục vụ phân quyền **danh mục** ở nơi khác, không dùng trong `canView` tài liệu.

## Entity: Nhóm (Group)

`Nhóm`: `ID, Tên nhóm, Mô tả, Thành viên(JSON array userId)`. Dùng để: (a) tích sẵn `Người được xem` lúc tạo (khai triển thành viên của nhóm-được-xem của danh mục); (b) import cột "Phân quyền" → khai triển thành viên. **Không** gắn trực tiếp vào tài liệu.

## Tạo tài liệu → tích sẵn `Người được xem`

```
# Đi ngược chuỗi 'Danh mục cha' (chống lặp): gộp danh mục con + mọi tổ tiên.
defaultViewers(catId) = unique(
  ⋃ qua C ∈ [catId, cha(catId), ông(catId), …]:
       C.NgườiĐượcXem ∪ flatMap(C.NhómĐượcXem, gid → Nhóm[gid].Thành viên)
) ∩ eligible           # eligible = SSO active trừ vai trò admin/QTV/GĐ/VT
```
Tính ở client (DocumentModal/DocumentPreview) khi chọn/đổi danh mục; người dùng chỉnh được trước khi lưu. Server `_categoryViewerIds` mirror logic (import-trống + backfill).

## Quy tắc phát hành (ghi dữ liệu)

```
publish(D, recipients, publisher):  # recipients = toUserIds ∪ ccUserIds
  ghi Lịch sử phát hành + gửi email (như cũ)
  nếu publisher.role ∈ {Văn thư, Giám đốc, admin, Quản trị viên}:   # revise 2026-06-19: LUÔN cộng
     với r ∈ recipients: nếu r ∉ D.NgườiĐượcXem → thêm r        # kể cả khi rỗng; không trùng
  ngược lại (chỉ cờ "Được phát hành"): không đổi danh sách, chỉ gửi email
```

## Import → ghi dữ liệu

Client (`importResolver.js`) mang thô `docData['Phân quyền']` + cờ đỏ nếu tên nhóm sai; server (`bulkImportDocuments`) khai triển qua map `groupMembersByName`:

```
cột "Phân quyền" (chuỗi, tách kiểu CSV — xem parseGroupNames):
  rỗng           → Người được xem = snapshot _categoryViewerIds(cat)  (danh mục trống → '')
  mỗi tên nhóm   → tra groupMembersByName; thiếu bất kỳ → throw → tài liệu KHÔNG tạo (errors)
  đủ             → Người được xem = JSON.stringify(hợp các thành viên)

parseGroupNames(s):                # tách CSV-style, giữ phẩy trong tên có nháy kép
  duyệt ký tự; gặp '"' → bật/tắt cờ inQuote; gặp ',' ngoài quote → cắt token; trim mỗi token; bỏ token rỗng
  vd  BGĐ, "Trưởng, Phó phòng", "GĐ, PGĐ NM", Email NMTĐ
   → ["BGĐ", "Trưởng, Phó phòng", "GĐ, PGĐ NM", "Email NMTĐ"]
  nháy kép lệch cặp → tên không khớp groupMembersByName → cảnh báo + bỏ qua tài liệu
```

## Migration backfill (FR-013) — chạy 1 lần

```
backfillDocViewers():              # idempotent, gắn cờ DONE trong ScriptProperties
  với mỗi D trong Hồ Sơ mà D.NgườiĐượcXem rỗng:
     ids = defaultViewers(D.Danh mục)      # người trực tiếp + khai triển nhóm danh mục (KHÔNG lọc eligible)
     nếu ids không rỗng → ghi D.NgườiĐượcXem = JSON.stringify(ids)
     nếu ids rỗng (danh mục cha trống quyền) → giữ rỗng (chỉ toàn quyền + participant thấy)
```
Mục đích: dữ liệu cũ (`Người được xem` rỗng) không bị ẩn khi bỏ fallback động. Chạy sau khi `ensureMissingColumns` thêm cột, kiểm cờ để không lặp.
