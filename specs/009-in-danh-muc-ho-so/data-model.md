# Phase 1 — Data Model: In / Xuất danh mục hồ sơ

Tính năng **chỉ đọc**, không tạo/đổi schema. Dưới đây là các thực thể liên quan và ánh xạ cột xuất.

## Thực thể nguồn (đã tồn tại)

### Hồ Sơ (`SHEETS.HO_SO`)
Cột dùng tới: `ID`, `Tên hồ sơ`, `Danh mục` (ID danh mục), `Ngày ban hành`, `Số hồ sơ`, `Ghi chú`, `Nơi lưu hồ sơ cứng`, `Tình trạng`.

### Danh Mục (`SHEETS.DANH_MUC`)
Cột dùng tới: `ID`, `Tên danh mục`, `Danh mục cha` (ID cha; rỗng = gốc).
- Quan hệ cha–con qua `Danh mục cha`. Dùng để tính tập hậu duệ (đệ quy).

## Quy tắc lọc (từ FR-005, FR-006)

Một hồ sơ được đưa vào file khi **cả hai** đúng:
1. `_normalizeStatus(Hồ Sơ['Tình trạng']) !== 'Nháp'` (loại bản nháp; mọi trạng thái khác đều xuất).
2. `String(Hồ Sơ['Danh mục'])` ∈ `selectedCategorySet`, trong đó
   `selectedCategorySet = { selectedId } ∪ { mọi hậu duệ của selectedId }`.
   - `selectedId` (categoryId) là **bắt buộc**. Thiếu → `exportCatalog` ném `Vui lòng chọn danh mục để xuất` (không có trường hợp "tất cả danh mục").

## Sắp xếp & STT (FR-004, R4)

- Sắp tăng dần theo `Số hồ sơ` (so sánh chuỗi, không phân biệt hoa/thường; rỗng xuống cuối, ổn định).
- `STT` = chỉ số dòng sau khi sắp, bắt đầu từ 1.

## Ánh xạ cột file xuất (FR-003) — đúng thứ tự

| # | Cột file | Nguồn | Biến đổi |
|---|----------|-------|----------|
| 1 | STT | (hệ thống) | Đánh số 1..n theo thứ tự đã sắp |
| 2 | Số hồ sơ | `Hồ Sơ['Số hồ sơ']` | Nguyên trạng (rỗng → ô trống) |
| 3 | Tên hồ sơ | `Hồ Sơ['Tên hồ sơ']` | Nguyên trạng |
| 4 | Ngày ban hành | `Hồ Sơ['Ngày ban hành']` | Format `yyyy-mm-dd HH:mm` (ghi dạng text) |
| 5 | Ghi chú | `Hồ Sơ['Ghi chú']` | Nguyên trạng |
| 6 | Danh mục | Đường dẫn từ danh mục được chọn xuống danh mục của `Hồ Sơ['Danh mục']` | Lần ngược `Danh mục cha` tới danh mục được chọn, nối `' / '` |
| 7 | Nơi lưu hồ sơ cứng | `Hồ Sơ['Nơi lưu hồ sơ cứng']` | Nguyên trạng |

- Ô không có dữ liệu → để trống (FR-004).
- Cột "Danh mục" ghi **đường dẫn danh mục** dạng `Cha / Con / Hiện tại`, lần ngược theo `Danh mục cha` nhưng **dừng ở danh mục được chọn** làm gốc (không lên trên nó). Vì gộp đệ quy nhiều danh mục con nên mỗi hồ sơ có đường dẫn riêng.

## Thực thể đầu ra (tạm thời)

### File mục lục Excel (kết quả trả về)
- Một workbook `.xlsx`, **một sheet tên "Danh mục"**.
- Hàng 1 = tiêu đề 7 cột; hàng 2..n+1 = dữ liệu.
- Trả về client dạng `{ base64, fileName, mimeType }` (xem contract).

### Google Sheet tạm (vòng đời trong 1 request)
- Tạo để sinh xlsx, **xoá ngay** (trashed) trong `finally`. Không phải dữ liệu nghiệp vụ.

## Trường hợp rỗng (FR-008)

- Nếu sau lọc không còn hồ sơ nào → KHÔNG tạo file, ném lỗi/thông báo “không có hồ sơ để xuất” để client hiển thị.
