# Quickstart: Danh sách hồ sơ phẳng — phân trang & lọc danh mục online

## Chạy & test

```bash
npm install                 # nếu chưa
npm run dev:docmgr          # Vite dev server (port 5173) — UI danh sách
npm run test:docmgr         # Jest (server + client) — phải xanh trước/sau thay đổi
npx jest --config apps/docmgr/jest.config.js src/server/__tests__/documents.test.js
```

## Tiêu chí "done" (verify loop)

1. **Server — sort ưu tiên + phân trang** → verify: test `documents.test.js` cho INV-2..INV-7 và CT-1..CT-6 PASS.
2. **Server — lọc danh mục đệ quy** → verify: seed cây danh mục ≥3 cấp, chọn gốc → kết quả gồm hồ sơ hậu duệ (CT-3 PASS).
3. **Client — danh sách phẳng** → verify: không còn nhóm theo thư mục/`CatGroup`, không còn "Xem thêm" theo thư mục; hiển thị 1 bảng phẳng (Documents.test.jsx).
4. **Client — phân trang Trước/Sau** → verify: nút Sau vô hiệu khi `hasNext=false`, Trước vô hiệu ở trang 1, nhãn "Trang X" đúng; đổi trang gọi `api_getDocuments` với `page` mới.
5. **Client — bộ lọc Danh mục online** → verify: mở bộ chọn collapse 2 cấp, chọn danh mục → gọi server với `danhMucId`, danh sách về trang 1; bỏ chọn → toàn bộ.
6. **Bộ lọc client trên trang hiện tại** → verify: gõ từ khóa/đổi tình trạng chỉ lọc trong 100 hồ sơ trang đang xem; chuyển trang vẫn áp lại.

## Kiểm thử thủ công (UI)

1. Mở app docmgr (SSO) với tài khoản toàn quyền (GĐ/VT/admin) để thấy nhiều hồ sơ.
2. Xác nhận danh sách phẳng, thứ tự: hồ sơ chưa hoàn thành (mới sửa trên cùng) → hoàn thành có phụ trách → hoàn thành có phát hành → hoàn thành thường.
3. Bấm **Sau** → sang trang 2 (item 101+), không trùng trang 1; bấm **Trước** quay lại.
4. Mở bộ chọn **Danh mục** (collapse, 2 cấp) → chọn 1 danh mục cha có con cháu → danh sách chỉ còn hồ sơ thuộc cây đó, về trang 1.
5. Gõ từ khóa khớp vài hồ sơ trên trang → danh sách thu hẹp trong phạm vi trang hiện tại.
6. Trường hợp rỗng: chọn danh mục không có hồ sơ → "Không có hồ sơ nào".

## Lưu ý triển khai

- Server `documents.js`: ES5 thuần (`var`/`function`), tái dùng `_categoryDescendantSet` (export-catalog.js) và `_parseAssignees`.
- KHÔNG bump `SCHEMA_V` (read-only).
- Deploy chỉ bằng `npm run deploy:docmgr` (không `clasp push` trần).
- Hành vi đổi có chủ đích: tìm kiếm/lọc client chỉ trong trang hiện tại — thông báo phạm vi cho người dùng.
