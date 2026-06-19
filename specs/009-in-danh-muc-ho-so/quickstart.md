# Quickstart — In / Xuất danh mục hồ sơ

## Chạy & test trong worktree

```bash
# Đang ở: .claude/worktrees/009-in-danh-muc-ho-so
npm install                         # nếu worktree chưa có node_modules
npm run test:docmgr                 # chạy Jest (server+client) — gồm test mới exportCatalog
npm run dev:docmgr                  # Vite dev (port 5173) để thử UI client
npm run build:docmgr                # build + bundle server (kiểm export-catalog.js được gom)
```

## Kiểm thử thủ công (sau khi build/deploy)

1. Đăng nhập bằng tài khoản **Văn thư** (hoặc Admin/Giám đốc).
2. Mở mục **"In danh mục hồ sơ"** ở sidebar (chỉ 3 vai trò này thấy).
3. Chọn **một** danh mục có hồ sơ (kể cả ở danh mục con) → bấm **Tải Excel**. (Chưa chọn danh mục thì nút **Tải Excel** bị mờ/không bấm được — danh mục là bắt buộc.)
4. Kỳ vọng: tải về `danh-muc-ho-so-<...>.xlsx`, mở được, **sheet tên "Danh mục"**, 7 cột đúng thứ tự:
   `STT | Số hồ sơ | Tên hồ sơ | Ngày ban hành | Ghi chú | Danh mục | Nơi lưu hồ sơ cứng`.
5. Kiểm: STT 1..n liên tục; sắp theo Số hồ sơ tăng dần; gồm mọi trạng thái trừ "Nháp"; gồm cả hồ sơ ở danh mục con; ngày dạng `yyyy-mm-dd HH:mm`; tiếng Việt đúng dấu.
6. Chọn danh mục rỗng (hoặc chỉ có hồ sơ Nháp) → thông báo "Không có hồ sơ để xuất", không tải file.
7. Đăng nhập bằng **Nhân viên/Trưởng phòng** → KHÔNG thấy mục "In danh mục hồ sơ".

## Kịch bản test tự động (exportCatalog.test.js)

- Lọc đúng `_normalizeStatus(Tình trạng) !== 'Nháp'` (loại Nháp; giữ Chờ duyệt/Đang xử lý/Hoàn thành/Từ chối…).
- Gộp đệ quy hồ sơ ở danh mục con nhiều cấp.
- STT 1..n theo thứ tự Số hồ sơ tăng dần; Số hồ sơ rỗng xuống cuối.
- Ánh xạ đúng 7 cột; cột "Danh mục" = tên danh mục theo ID; ngày format `yyyy-mm-dd HH:mm`.
- Thiếu danh mục (bắt buộc) → ném `Vui lòng chọn danh mục để xuất`.
- Danh mục không có hồ sơ hợp lệ → ném `Không có hồ sơ để xuất`.
- Gác quyền: Văn thư/Admin/Giám đốc qua được; Nhân viên/Trưởng phòng bị chặn `Không có quyền...`.
- Sheet tạm được xoá (trashed) sau khi xuất (kể cả khi lỗi giữa chừng — kiểm `finally`).

## Lưu ý

- Cần OAuth scope Drive/Sheets (đã có sẵn cho upload/import). Export dùng `ScriptApp.getOAuthToken()`.
- Không bump `SCHEMA_V` (không đổi schema).
- Sau khi xong: `/speckit-tasks` để sinh tasks, rồi `/speckit-implement`.
