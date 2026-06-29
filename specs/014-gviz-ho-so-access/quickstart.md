# Quickstart: Truy cập hồ sơ qua gviz

## Phạm vi thay đổi
Chỉ server. Files: `packages/gas-core/sheets-crud.js`, `apps/docmgr/src/server/{doc-query.js, documents.js, sheets.js}`, mock `apps/docmgr/src/server/__tests__/mocks/gas.js`.

## Build & Test
```bash
npm install
# Test docmgr (bắt buộc — SC-005)
npx jest --config apps/docmgr/jest.config.js
# Vì sửa gas-core, chạy test các app khác dùng chung core (Constitution VII):
npx jest --config apps/sso-portal/jest.config.js      # nếu có
npx jest --config apps/license-server/jest.config.js  # nếu có
# Build + deploy (chỉ khi user yêu cầu)
npm run build:docmgr
npm run deploy:docmgr   # KHÔNG bao giờ bare clasp push
```

## Thứ tự triển khai gợi ý (mỗi bước test xanh trước khi sang bước sau — TDD)
1. **Mock**: thêm `createTextFinder` (Sheet + Range) vào `mocks/gas.js`; nếu cần, nâng `UrlFetchApp` thành hàng đợi phản hồi. → verify: mock unit nhỏ.
2. **gas-core**: `_findRowIndexById` + chuyển `_updateRowUnlocked`/`_deleteRowUnlocked`. → verify: `documents.test.js` (update/delete) + test 3 app pass.
3. **seam đọc-điểm**: `_getDocById` (live). → verify: test read-after-write + ID không tồn tại.
4. **SINGLE-ID call-sites** trong `documents.js` (11 điểm, gộp `addComment`). → verify: documents/controller/perms/file-deletion tests pass.
5. **gviz subset/aggregate**: `_countDocsWhere` + truy vấn group-by tại chỗ; đổi `getDocumentStats` + `checkReferences`. → verify: test thống kê + ràng buộc tham chiếu tương đương ngữ nghĩa cũ. (`_queryDocsWhere`/`_getDocsByIds` DEFERRED — không cài.)

## Kiểm thử thủ công ở quy mô lớn (sau deploy)
- Sheet `Hồ Sơ` ~10k dòng: mở 1 hồ sơ, sửa 1 trường → lưu → kết quả phản ánh ngay (read-after-write).
- Xoá 1 hồ sơ giữa sheet → đúng dòng bị xoá.
- Xoá 1 Danh Mục đang được hồ sơ dùng → bị chặn; danh mục trống → cho xoá.
- Tắt mạng/giả lỗi gviz → thống kê báo lỗi rõ, KHÔNG treo/không trả rỗng âm thầm.

## Tiêu chí hoàn thành (map Success Criteria)
- SC-001/004: không còn `getSheetData(SHEETS.HO_SO)` ở các điểm SINGLE-ID/SUBSET trong phạm vi (grep kiểm tra).
- SC-002: thao tác trên sheet lớn không timeout.
- SC-003/FR-008: hành vi người dùng cuối không đổi.
- SC-005: toàn bộ test hiện có pass.
