# Quickstart — Phân quyền xem đến từng tài liệu

## Phạm vi thay đổi (file)

> **Revise 2026-06-18** (chỉ theo người) **+ 2026-06-19** (snapshot là nguồn chân lý): tài liệu chỉ dùng `Người được xem`, là nguồn chân lý; rỗng = chỉ toàn quyền + người tham gia (bỏ fallback danh mục động); +backfill dữ liệu cũ; import CSV-quoting.

**Server** (`apps/docmgr/src/server/`):
- `config.js` — `HO_SO` +`Người được xem` (cột `Nhóm được xem` thêm nhưng không dùng); bump `SCHEMA_V` `'10'`→`'11'`; gọi `_backfillDocViewers()` sau migrate cột.
- `documents.js` — helper `_isParticipant`/`_canViewDocument` (chỉ-người, category-independent, **rỗng = false, KHÔNG fallback**)/`_categoryViewerIds(catId)`/`_backfillDocViewers()`; `getDocuments`; `publishDocument` (thêm mọi người nhận khi danh sách không rỗng); `createDocument`/`updateDocument` ghi `Người được xem` (snapshot lúc tạo); `setDocumentViewers(token,docId,nguoiDuocXem)`.
- `main.js` — `api_setDocumentViewers`.
- `import.js` — header `'phân quyền'`; `parseGroupNames` (CSV-quoting); map `groupMembersByName`; khai triển nhóm → thành viên vào `Người được xem`.
- `__tests__/helpers.js` (+cột), `__tests__/documentPerms.test.js` (MỚI).

**Client** (`apps/docmgr/src/client/`):
- `components/common/ViewerPickerModal.jsx` — MỚI (revise picker): popup chọn người theo phòng ban + "chọn tất cả" mỗi phòng + tìm kiếm + 2 chế độ "Tất cả"/"Theo danh mục" + lưu tạm. (`DeptUserMultiPicker.jsx` cũ giữ file, không dùng ở DocumentModal.)
- `components/DocumentModal.jsx` — nút "Phân quyền xem — N người" mở popup; đổi danh mục (tạo & sửa) → re-snapshot + toast cảnh báo; đưa `Người được xem` vào payload.
- `components/documents/DocumentPreview.jsx` — khối "Phân quyền xem": chip người (read-only) + nút "Sửa" (toàn quyền) mở **cùng `ViewerPickerModal`** → `api_setDocumentViewers`.
- `components/MainApp.jsx` — badge 🔒 đầu cột Ghi chú khi có `Người được xem`.
- `utils/importResolver.js` — `DOC_FIELDS` + validate tên nhóm tồn tại + mang `Phân quyền` vào `docData`.
- `gasClient.js` — mock `api_setDocumentViewers`.

## Lệnh

```bash
# Test server + client
npx jest --config apps/docmgr/jest.config.js
# hoặc
npm run test:docmgr

# Dev client
npm run dev:docmgr            # Vite port 5173

# Build + deploy (KHÔNG dùng bare clasp push)
npm run build:docmgr
npm run deploy:docmgr
```

## Kiểm chứng nhanh (manual)

1. **Migration cột + backfill**: mở app lần đầu sau deploy → `ensureInitialized` thêm 2 cột vào `Hồ Sơ`, `SCHEMA_V=11`; `_backfillDocViewers()` snapshot người-xem danh mục cha vào tài liệu cũ đang rỗng (chạy 1 lần, có cờ).
2. **Lifecycle**: tạo tài liệu, để ở `Chờ duyệt`/`Đang xử lý` → user thường (không tham gia) **không** thấy; PT/PH thấy; GĐ/VT/admin thấy.
3. **Tạo mới + popup picker**: tạo tài liệu trong danh mục có người-được-xem → nút "Phân quyền xem — N người" hiện đúng số; mở popup → chế độ "Theo danh mục" đã tích sẵn người của DM; thử "Tất cả"/"Chọn tất cả" 1 phòng/tìm kiếm; **Hủy** = không đổi, **Chọn** = ghi + đóng. Đổi danh mục (tạo & sửa) → tự đặt lại + **toast cảnh báo**; mở form sửa lần đầu **không** bị ghi đè.
4. **Snapshot bền với thay đổi folder**: sau khi tạo, **xoá** một người khỏi quyền danh mục → tài liệu cũ vẫn giữ người đó trong `Người được xem`, người đó vẫn xem được tài liệu cũ.
5. **Hoàn thành + rỗng**: tài liệu Hoàn thành có `Người được xem` rỗng (danh mục cha trống quyền) → chỉ toàn quyền + người tham gia thấy; user thường **không** thấy (không còn "mọi người xem").
6. **Restrict**: tài liệu Hoàn thành có `Người được xem` = [A] → chỉ A (+ tham gia + toàn quyền) thấy, **bất kể** danh mục.
7. **Publish auto-add**: VT phát hành cho X → X được thêm vào `Người được xem`, X thấy — **kể cả khi danh sách trước đó rỗng** (revise 2026-06-19). Người chỉ có cờ "Được phát hành" → chỉ gửi mail.
8. **Import CSV-quoting**: cột `Phân quyền` = `BGĐ, "Trưởng, Phó phòng", "GĐ, PGĐ NM", Email NMTĐ` → 4 nhóm; tên thật → tạo + `Người được xem` = hợp thành viên; tên sai/nháy lệch → không tạo + cảnh báo; trống → tạo + `Người được xem` = snapshot quyền danh mục (danh mục trống → rỗng).
9. **Kế thừa danh mục cha**: danh mục cha có người-xem [A], danh mục con (cha = nó) có [B]. Tạo/sửa hồ sơ trong **danh mục con** → "Theo danh mục"/auto-tích = **{A, B}** (gộp cha). Tương tự import vào danh mục con (cột trống) → snapshot {A, B}.

## Tiêu chí hoàn thành

Map tới SC-001…SC-006 trong [spec.md](spec.md). Mọi test trong `documentPerms.test.js` xanh + bộ test docmgr hiện có không vỡ.
