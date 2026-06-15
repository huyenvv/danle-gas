# Phase 1 — Quickstart / Verify

## Chạy test

```bash
npm run test:docmgr
# hoặc nhắm file:
npx jest --config apps/docmgr/jest.config.js file-index documents import
```

## Test phải phủ (theo Success Criteria & FR)

**Đồng bộ tự động qua override (SC-004, FR-002):**
- `addRow(HO_SO, {Tệp đính kèm: [f1,f2]})` → `_FileIndex` có f1,f2 → docId.
- `updateRow(HO_SO, id, {Tệp đính kèm: [f1]})` → f2 bị gỡ khỏi index, f1 còn.
- `updateRow(HO_SO, id, {Tình trạng:'...'})` (không có Tệp đính kèm) → index không đổi.
- `deleteRow(HO_SO, id)` → mọi row docId biến mất.
- Sau mỗi case: `_assertIndexMatchesDocs()` không throw.

**End-to-end qua hàm nghiệp vụ:**
- `createDocument` / `_attachFileToDraft` / `bulkImportDocuments` → index đúng (không gọi index thủ công).
- `deleteDocument` / `cancelDraft` → giải phóng (INV-3).

**Policy orphaned (FR-003, FR-004, FR-007):**
- `linkDriveFiles` file orphaned → ok; file thuộc doc khác → throw; re-link file của chính doc đang sửa → ok.
- `bulkImportDocuments`: file thuộc doc khác → bỏ + warning; group hết file → lỗi; 2 group cùng batch cùng fileId → group sau bị drop+warning.

**Move fail-loud (FR-005, FR-006, SC-002):**
- Đổi `Danh mục`, `moveFile` ok → file ở folder mới + doc mang danh mục mới.
- `moveFile` ném (mock lỗi) → `updateDocument`/`finalizeDraft` throw, doc giữ danh mục cũ (không commit một phần).

**Self-heal (FR-002a):**
- Làm `_FileIndex` lệch thủ công → `rebuildFileIndex()` → `_assertIndexMatchesDocs()` pass.

## Verify thủ công (sau deploy)

1. Mở app, tạo hồ sơ nháp, link 1 file Drive orphaned → ok.
2. Thử link cùng file đó vào hồ sơ khác → bị từ chối với thông báo rõ.
3. Đổi danh mục hồ sơ → file di chuyển sang folder danh mục mới.
4. Import file Excel/Sheet có dòng trỏ tới file đã dùng → file đó bị bỏ kèm cảnh báo, hồ sơ vẫn tạo với các file còn lại.

## Lưu ý vận hành

- Sheet `_FileIndex` tạo tự động khi `SCHEMA_V` lên 9 (lần `doGet`/`ensureInitialized` đầu sau deploy). Cũng được getOrCreate phòng thủ ở `_indexGetSheet` nếu chưa có.
- Với spreadsheet đã có dữ liệu: chạy `rebuildFileIndex()` một lần để nạp index từ hồ sơ hiện hữu (backfill) — đồng bộ và self-heal mọi lệch.
- `linkDriveFiles`/`api_linkDriveFiles` nay có tham số thứ 5 `docId` (id hồ sơ đang sửa, dùng cho re-link không xung đột). `DocumentModal` truyền `doc.ID` khi sửa hồ sơ không-nháp; luồng tạo/nháp truyền null. Dev mock `gasClient.js` bỏ qua tham số này — không cần sửa.
- Đồng bộ index hoàn toàn TỰ ĐỘNG qua override `addRow`/`updateRow`/`deleteRow` (file-index.js). Tính năng mới ghi file qua CRUD chuẩn không cần biết tới `_FileIndex`.
