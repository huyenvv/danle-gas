# Quickstart — 012 server-side doc query

**Date**: 2026-06-23

## 0. Spike auth gviz (BẮT BUỘC trước khi code phần còn lại)

> ✅ **Đã xác minh live 2026-06-23**: `code=200`, `status:"ok"` — gviz auth OK, không cần Fallback. Snippet dưới giữ làm tham khảo.

Trong Apps Script editor của docmgr (hoặc test tạm), chạy:
```js
function _spikeGviz() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var gid = ss.getSheetByName('Hồ Sơ').getSheetId()
  var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId()
          + '/gviz/tq?gid=' + gid + '&headers=1&tq=' + encodeURIComponent('select A limit 1')
  var r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true })
  Logger.log(r.getResponseCode())
  Logger.log(r.getContentText().slice(0, 200))
}
```
- ✅ 200 + body bắt đầu `...google.visualization.Query.setResponse(` → đi tiếp.
- ❌ 401 / body HTML đăng nhập → thêm scope `https://www.googleapis.com/auth/spreadsheets` vào `appsscript.json`, re-authorize; nếu vẫn hỏng → dùng Fallback B (sheet `=QUERY`) trong research.md R1.

## 1. Build & test (local)

```bash
npm run test:docmgr            # Jest — phải xanh (gồm test gviz mới + getDocuments)
npm run build:docmgr           # bundle server (kiểm doc-query.js vào concat) + client
```

## 2. Kiểm thử ngữ nghĩa (so 011)

Trên một bản sheet có dữ liệu đa dạng (đủ 4 nhóm ưu tiên, nhiều danh mục, hồ sơ Nháp/Hoàn thành, có/không Người được xem):

1. **Thứ tự ưu tiên**: trang 1 đúng (0) Chưa hoàn thành → (1) PT → (2) phát hành → (3) thường; trong nhóm theo Ngày cập nhật desc; trùng ngày → ID desc.
2. **Phân trang**: >200 hồ sơ → trang 1/2/… liền mạch, không trùng/sót; nút Sau tắt ở trang cuối; đổi danh mục/keyword → về trang 1.
3. **Danh mục đệ quy**: chọn cha 3–4 cấp → gồm mọi con cháu.
4. **Tìm kiếm toàn tập**: gõ "ke hoach" (không dấu) → khớp "Kế hoạch" ở MỌI trang (không chỉ trang đang xem); 7 trường.
5. **Quyền**:
   - Tài khoản thường: chỉ thấy hồ sơ mình tham gia / được xem (Hoàn thành); KHÔNG thấy hồ sơ ngoài quyền ở bất kỳ trang nào.
   - Hồ sơ Nháp của người khác: ẩn cả với admin/Giám đốc/Văn thư.
   - Hồ sơ Hoàn thành + mình trong "Người được xem" → thấy; cùng hồ sơ chuyển về Chưa hoàn thành → ẩn.
6. **Lọc phụ**: tình trạng/dự án/NCC/năm vẫn lọc trên trang hiện tại (per-page), có chú thích phạm vi.

## 3. Hiệu năng (SC-001/002)

- Nạp ~1.000 và ~10.000 hồ sơ (script seed). Đo thời gian `getDocuments` trang 1, trang giữa, trang cuối.
- Kỳ vọng: chênh ≤20% giữa 1k và 10k; không lỗi quá hạn ở 10k.

## 4. Backfill (một lần)

- Nâng `SCHEMA_V` → mở app để `ensureInitialized` thêm 3 cột; chạy `backfillDocDerived()` (qua editor hoặc tự gọi trong ensureInitialized). Kiểm vài hồ sơ: 3 cột có giá trị đúng (rank/token theo Tình trạng/blob không dấu).
- Chạy lại backfill → idempotent (giá trị không đổi).

## 5. Rollback an toàn

- 3 cột là phụ; nếu cần tắt nhanh: trả `getDocuments` về nhánh đọc-toàn-bộ cũ (giữ hàm cũ `_getDocumentsInRam` trong 1 commit để đối chiếu, gỡ sau khi ổn định). Không xoá cột (chỉ ngừng dùng).
