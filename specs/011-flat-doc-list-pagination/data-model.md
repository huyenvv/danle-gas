# Phase 1 Data Model: Danh sách hồ sơ phẳng — phân trang & lọc danh mục online

Tính năng **read-only**: không thêm/đổi cột sheet, không bump `SCHEMA_V`. Mô hình dưới đây mô tả các thực thể/khái niệm liên quan tới hiển thị, xếp hạng và phân trang.

## Thực thể

### Hồ sơ (sheet `Hồ Sơ`) — các trường dùng cho tính năng

| Trường | Vai trò trong tính năng |
|---|---|
| `ID` | Khóa định danh, dùng cho key render, chọn, cập nhật lạc quan. |
| `Tình trạng` | Phân loại Chưa hoàn thành vs Hoàn thành (sau `_normalizeStatus`). `Nháp` bị ẩn theo quyền. |
| `Phụ trách` | Có người phụ trách hay không (qua `_parseAssignees(...).length > 0`). |
| `Lịch sử phát hành` | Có phát hành hay không (parse JSON mảng, `length > 0`). |
| `Danh mục` | ID danh mục của hồ sơ → so với tập danh mục đệ quy khi lọc. |
| `Ngày cập nhật` | "Ngày sửa" — khóa sắp xếp thứ cấp (giảm dần) trong mỗi nhóm. |
| `Tên hồ sơ`, `Số hồ sơ`, `Dự án (Phòng ban)`, `Nhà cung cấp (Nơi ban hành)`, `Người tạo`, `Ngày kết thúc`, … | Hiển thị + bộ lọc client trên trang hiện tại. |

### Danh mục (sheet `Danh Mục`)

| Trường | Vai trò |
|---|---|
| `ID` | Định danh danh mục. |
| `Danh mục cha` | Quan hệ cây; rỗng = gốc. Dùng để dựng tập hậu duệ đệ quy và để picker giới hạn 2 cấp. |
| `Tên danh mục`, `Icon` | Hiển thị trong bộ chọn collapse. |

### Trang kết quả (Page) — khái niệm, không phải sheet

| Thuộc tính | Ý nghĩa |
|---|---|
| `data` | Mảng ≤100 hồ sơ của trang, đã lọc quyền + lọc danh mục + sort ưu tiên. |
| `page` | Số trang hiện tại (1-based). |
| `hasNext` | Còn trang sau hay không (boolean). KHÔNG kèm tổng số. |

## Quy tắc xếp hạng ưu tiên (rank)

Hàm thuần `_docPriorityRank(doc)` → số 0..3 (nhỏ = ưu tiên cao):

```
isDone   = (doc['Tình trạng'] === 'Hoàn thành')
hasPT    = _parseAssignees(doc['Phụ trách']).length > 0
hasPH     = (parse 'Lịch sử phát hành' thành mảng).length > 0

rank = 0  nếu !isDone                      // Chưa hoàn thành
rank = 1  nếu isDone && hasPT              // Hoàn thành + có người phụ trách
rank = 2  nếu isDone && !hasPT && hasPH    // Hoàn thành + có phát hành
rank = 3  nếu isDone && !hasPT && !hasPH   // Hoàn thành bình thường
```

## Quy tắc so sánh (sort toàn tập trước khi cắt trang)

`_compareByPriority(a, b)`:
1. So `rank(a)` vs `rank(b)` tăng dần.
2. Nếu cùng rank → so `Ngày cập nhật` giảm dần (mới nhất trước); thiếu ngày = thời điểm 0 (xuống cuối).

## Trình tự xử lý trong `getDocuments(token, filters)`

```
1. requireAuth(token)                                  (giữ nguyên)
2. Đọc + chuẩn hóa trạng thái Hồ Sơ                     (giữ nguyên)
3. Ẩn Nháp với người không phải Người tạo               (giữ nguyên)
4. Lọc quyền xem danh mục/hồ sơ (vai trò không miễn lọc) (giữ nguyên)
5. NẾU filters.danhMucId:
     catSet = _categoryDescendantSet(filters.danhMucId)
     giữ doc có String(doc['Danh mục']) ∈ catSet         (THAY logic so khớp 1 cấp cũ)
6. NẾU filters.keyword: lọc theo từ khóa (tùy chọn — xem D7)
7. docs.sort(_compareByPriority)                        (THAY sort 'Ngày cập nhật' đơn thuần)
8. page = max(1, filters.page || 1)
   start = (page-1)*100; slice = docs.slice(start, start+100)
   hasNext = docs.length > page*100
9. return { data: slice, page: page, hasNext: hasNext }
```

> Lưu ý tương thích: các khóa filter cũ (`tinhTrang`, `duAn`, `nhaCungCap`, `phuTrach`, `nam`) — theo quyết định D7, các bộ lọc này CHUYỂN sang áp client trên trang hiện tại. Việc còn giữ hay bỏ nhánh lọc tương ứng ở server sẽ được chốt ở `/speckit-tasks`/triển khai sao cho không phá test hiện có (ưu tiên: client áp cho list; server chỉ chịu trách nhiệm `danhMucId` + sort + phân trang). Trường `data` vẫn là khóa trả về (giữ tương thích `res.data`).

## Bất biến (invariants) cần test

- INV-1: Mỗi trang ≤ 100 hồ sơ.
- INV-2: Toàn bộ hồ sơ rank 0 đứng trước mọi rank 1; rank 1 trước rank 2; rank 2 trước rank 3 (xét trên toàn tập, kiểm qua nối các trang).
- INV-3: Trong cùng rank, ngày sửa không tăng dần theo vị trí.
- INV-4: Lọc một danh mục cha trả về hồ sơ của mọi hậu duệ (≥3 cấp).
- INV-5: Hồ sơ Hoàn thành có cả phụ trách lẫn phát hành → rank 1 (không tính trùng).
- INV-6: Ghép tuần tự các trang không trùng, không sót so với toàn tập đã lọc + sort.
- INV-7: `hasNext` đúng: true khi còn hồ sơ sau lát hiện tại, false ở trang cuối.
