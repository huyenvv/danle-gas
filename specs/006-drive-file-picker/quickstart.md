# Quickstart — Drive File Picker

## Thử nghiệm

1. `npm run dev:docmgr` (client) — server logic test qua Jest.
2. Đăng nhập tài khoản full-access (admin/Văn thư) → mở form tạo hồ sơ trong 1 danh mục.
3. Khu đính kèm: ngoài "Kéo file / chọn file" có thêm nút **"Chọn từ Google Drive"**.
4. Mở picker → điều hướng thư mục từ My Drive → tích chọn ≥1 file → "Chọn".
5. File được copy vào thư mục danh mục và xuất hiện trong danh sách đính kèm; bản gốc Drive còn nguyên.
6. Đăng nhập user thường **không** có cờ → chỉ thấy nút chọn file OS (không có nút Drive).
7. UserManager → tích "Được chọn từ Drive" cho user thường → user thấy nút Drive sau khi load lại.

## Test (Jest server)

```bash
npx jest --config apps/docmgr/jest.config.js drive-picker
```

Bao phủ:
- `_checkPickDrivePermission`: full-access pass; user có cờ pass; user không cờ → throw.
- `copyDriveFilesToCategory`: makeCopy gọi đúng folder; lỗi 1 file không chặn file khác; trả results đúng shape.

## Build/Deploy

```bash
npm run build:docmgr
npm run deploy:docmgr     # KHÔNG bare clasp push
```
Lần chạy đầu sau deploy: `ensureInitialized()` (SCHEMA_V→7) thêm cột `Được chọn từ Drive` vào `_Phân Quyền`.
