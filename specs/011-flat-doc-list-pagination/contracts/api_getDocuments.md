# Contract: `api_getDocuments` / `getDocuments` (đã phân trang)

Hợp đồng giao tiếp client ↔ GAS server cho danh sách hồ sơ phẳng có phân trang. Mở rộng hàm hiện có; giữ tương thích khóa trả về `data`.

## Lời gọi

- Client: `gasCall('api_getDocuments', token, filters)` → `api_getDocuments(token, filters)` → `getDocuments(token, filters)`.
- Quyền: `requireAuth(token)` (giữ nguyên). Lỗi token → ném như cũ.

## Request — `filters` (object, tất cả tùy chọn)

| Khóa | Kiểu | Ý nghĩa | Mặc định |
|---|---|---|---|
| `page` | number (1-based) | Trang cần lấy. `< 1` hoặc thiếu → 1. | `1` |
| `danhMucId` | string \| number | Lọc online: hồ sơ thuộc danh mục này **và toàn bộ hậu duệ đệ quy**. Rỗng/thiếu → không lọc danh mục. | (none) |

> **Từ khóa (`keyword`) KHÔNG còn là tham số của danh sách phân trang.** Theo quyết định D7, tìm kiếm từ khóa và các bộ lọc cũ khác (`tinhTrang`, `duAn`, `nhaCungCap`, `phuTrach`, `nam`) được áp ở **client trên trang hiện tại**. Server chỉ chịu trách nhiệm `danhMucId` (lọc đệ quy) + sort ưu tiên + phân trang. Nhánh xử lý `keyword` cũ ở server (nếu còn) không thuộc luồng danh sách này.

## Response

```json
{
  "data": [ { /* ...bản ghi Hồ Sơ... */ } ],
  "page": 1,
  "hasNext": true
}
```

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `data` | array | Độ dài ≤ 100. Đã lọc quyền + danh mục, sort theo rank rồi ngày sửa giảm dần. |
| `page` | number | Trang đã trả (1-based, đã chuẩn hóa). |
| `hasNext` | boolean | `true` nếu còn hồ sơ sau lát hiện tại. |

> KHÔNG trả tổng số hồ sơ / tổng số trang (quyết định clarify).

## Quy tắc thứ tự (server đảm bảo trước khi cắt trang)

1. Nhóm ưu tiên tăng dần: (0) Chưa hoàn thành → (1) Hoàn thành + phụ trách → (2) Hoàn thành + phát hành → (3) Hoàn thành thường.
2. Trong nhóm: `Ngày cập nhật` giảm dần; thiếu ngày xuống cuối.

## Ràng buộc tương thích

- Giữ khóa `data` để các nơi đang đọc `res.data` không vỡ.
- `getDocuments(token, {})` (không `page`) phải trả trang 1 — dùng bởi `api_getInitialData`, `api_pollUpdates`, fallback `loadDocs()`.

## Ví dụ

**Trang 1, lọc danh mục cha có con cháu:**
```
api_getDocuments(token, { page: 1, danhMucId: 'CAT_ROOT' })
→ { data: [<=100 docs trong CAT_ROOT + mọi hậu duệ, đã sort ưu tiên>], page: 1, hasNext: true }
```

**Trang cuối:**
```
api_getDocuments(token, { page: 3, danhMucId: 'CAT_ROOT' })
→ { data: [<phần còn lại>], page: 3, hasNext: false }
```

## Test hợp đồng (server, vm.runInContext)

- CT-1: `{}` → `page=1`, `data.length ≤ 100`, `hasNext` đúng theo số hồ sơ seed.
- CT-2: seed >100 hồ sơ → trang 1 và trang 2 không trùng ID, nối lại đúng thứ tự ưu tiên.
- CT-3: `danhMucId` của danh mục cha 3 cấp → kết quả gồm hồ sơ của hậu duệ.
- CT-4: thứ tự rank 0→1→2→3 và ngày sửa giảm trong nhóm (INV-2, INV-3, INV-5).
- CT-5: `page` vượt tổng → `data=[]`, `hasNext=false`.
- CT-6: quyền — người không miễn lọc chỉ thấy hồ sơ được phép (giữ test 008 hiện có không vỡ).
