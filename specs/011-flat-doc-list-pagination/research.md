# Phase 0 Research: Danh sách hồ sơ phẳng — phân trang & lọc danh mục online

Mọi điểm "NEEDS CLARIFICATION" đã được giải quyết tại `/speckit-clarify` (xem mục Clarifications trong spec). Tài liệu này ghi các quyết định kỹ thuật và tradeoff để chốt thiết kế.

## D1. Phân trang ở đâu — server hay client?

- **Decision**: Phân trang **server-side**. `getDocuments` nhận `page` (1-based), trả đúng 100 hồ sơ của trang đó.
- **Rationale**: Đúng yêu cầu người dùng ("trả ra list 100 items"); giảm payload gửi về client; render nhẹ. Việc đọc sheet vẫn đọc toàn bộ dòng (giới hạn GAS) nhưng sort + cắt lát ở bộ nhớ rồi chỉ trả 1 lát.
- **Alternatives**:
  - Trả full rồi client cắt trang: bị chính yêu cầu loại trừ (vẫn tải toàn bộ).
  - Phân trang ở tầng đọc sheet (`getRange` theo dòng): không khả thi vì phải sort theo ưu tiên trên toàn tập trước khi cắt.

## D2. Định nghĩa 4 nhóm ưu tiên & thứ tự

- **Decision**: Hạng (rank) thấp = ưu tiên cao, sắp tăng dần theo rank rồi giảm dần theo ngày sửa:
  - rank 0 — **Chưa hoàn thành**: `Tình trạng !== 'Hoàn thành'` (Nháp đã bị ẩn theo quyền trước đó).
  - rank 1 — **Hoàn thành + có người phụ trách**: `Hoàn thành` và trường `Phụ trách` khác rỗng.
  - rank 2 — **Hoàn thành + có phát hành**: `Hoàn thành`, KHÔNG phụ trách, và `Lịch sử phát hành` khác rỗng.
  - rank 3 — **Hoàn thành bình thường**: `Hoàn thành`, không phụ trách, không phát hành.
- **Rationale**: Khớp đúng thứ tự người dùng liệt kê. Hồ sơ Hoàn thành vừa có phụ trách vừa có phát hành rơi vào rank 1 (ưu tiên cao hơn) — chỉ tính một nhóm (FR-007).
- **Phụ trách rỗng?**: dùng `_parseAssignees(doc['Phụ trách']).length > 0` (đã có helper, xử lý cả JSON array string lẫn giá trị legacy).
- **Phát hành?**: `doc['Lịch sử phát hành']` parse được mảng và `length > 0`. Bao rỗng/parse lỗi → coi như chưa phát hành.

## D3. Sắp xếp thứ cấp trong mỗi nhóm

- **Decision**: Trong cùng rank, sắp theo **ngày sửa giảm dần** (`Ngày cập nhật`, mới nhất trước). Hồ sơ thiếu ngày sửa (timestamp 0) xuống cuối nhóm.
- **Rationale**: Người dùng chỉ nêu rõ "theo ngày sửa" cho nhóm Chưa hoàn thành; áp đồng nhất cho mọi nhóm là nhất quán và khớp hành vi sort hiện tại (`Ngày cập nhật` desc).

## D4. Lọc Danh mục đệ quy (con cháu chắt)

- **Decision**: Khi có `filters.danhMucId`, dựng tập ID = danh mục chọn ∪ mọi hậu duệ đệ quy, rồi giữ hồ sơ có `Danh mục` ∈ tập đó. **Tái dùng `_categoryDescendantSet(selectedId)`** đã có trong `export-catalog.js`.
- **Rationale**: Hàm sẵn có làm đúng BFS theo `Danh mục cha`, đã được test gián tiếp qua export. Concat gộp toàn cục → `getDocuments` gọi được. Tránh trùng lặp (Constitution V).
- **Lưu ý**: Logic hiện tại của `getDocuments` (dòng ~405) đang so khớp `danhMucId` **chính xác** một cấp → thay bằng so khớp theo tập đệ quy.

## D5. Bộ chọn Danh mục collapse — giới hạn 2 cấp

- **Decision**: Tái dùng `CategoryPickerDropdown` (đã là cây collapse, single-select, có ô tìm). Thêm prop `maxDepth=2` để CHỈ render tối đa 2 cấp (gốc + con); cấp 3+ không hiện trong picker. Chọn 1 danh mục → server vẫn gộp toàn bộ hậu duệ (D4), nên hồ sơ ở cấp sâu hơn vẫn ra kết quả.
- **Rationale**: Khớp quyết định clarify ("hiển thị 2 cấp; chọn 1 danh mục tìm con cháu chắt"). Tái dùng component giữ đồng bộ design system (Constitution VIII).
- **Alternatives**: Viết picker mới — bị loại vì trùng lặp.

## D6. Điều khiển phân trang & chỉ báo trang

- **Decision**: Nút **‹ Trước / Sau ›** + nhãn **"Trang X"** (số trang hiện tại). KHÔNG hiển thị tổng số trang / tổng hồ sơ. Nút **Sau** vô hiệu khi `hasNext === false`; nút **Trước** vô hiệu ở trang 1.
- **Rationale**: Khớp 2 câu trả lời clarify ("Trước/Sau + số trang" và "chỉ báo còn trang sau"). Tránh chi phí đếm tổng mỗi truy vấn.
- **Cách tính `hasNext`**: server sort + lọc toàn tập, lấy lát `[ (page-1)*100, page*100 )`; `hasNext = tổngSauLọc > page*100`. (Đếm độ dài mảng đã lọc trong bộ nhớ là rẻ; ta KHÔNG trả con số này ra client.)

## D7. Tương tác bộ lọc client với chuyển trang

- **Decision**: Bộ lọc client (từ khóa, tình trạng, dự án, NCC, phụ trách, đọc/chưa đọc, hạn, "công việc của tôi") áp trên 100 hồ sơ của **trang hiện tại**. Chuyển trang → server trả trang mới (theo danh mục + ưu tiên), bộ lọc client áp lại lên trang mới. Điều khiển Trước/Sau luôn theo dữ liệu server-side, KHÔNG theo số dòng còn lại sau lọc client.
- **Rationale**: Khớp clarify Q3. Đơn giản, không cần đồng bộ tổng server với bộ lọc client.
- **Tradeoff (đã được người dùng chấp nhận)**: Tìm kiếm/lọc client chỉ thấy hồ sơ trong trang đang xem → có thể "bỏ sót" hồ sơ khớp ở trang khác. Đây là thay đổi hành vi so với hiện tại (từ khóa hiện đang tìm server-side trên toàn tập). UI cần gợi ý phạm vi "trong trang này". Nếu sau này muốn tìm-toàn-tập, có thể giữ riêng đường tìm kiếm server-side cũ — nằm ngoài phạm vi bản này.

## D8. Hòa hợp với kiến trúc "load-all + poll" hiện tại

- **Bối cảnh**: Hiện `api_getInitialData`/`api_pollUpdates` trả TOÀN BỘ hồ sơ; `dataCache` đẩy `docs` (toàn bộ) mỗi 60s; `MainApp` lọc client.
- **Decision**:
  - `getDocuments` mặc định `page = 1` khi không truyền (giữ `api_getInitialData` render được trang đầu).
  - `MainApp` giữ state `page` + `hasNext` + `danhMucId` (server filter). Mỗi lần đổi trang hoặc đổi danh mục → gọi `api_getDocuments(token, { page, danhMucId, keyword? })` và thay danh sách trang.
  - **Poll**: thay vì để subscription `docs` đẩy "toàn bộ" vào danh sách (sẽ phá phân trang), poll tick sẽ **nạp lại trang hiện tại** (silent) với cùng `{ page, danhMucId }`. Cập nhật lạc quan (`upsertDocInCache`/`removeDocFromCache`) vẫn thao tác trên mảng trang hiện tại.
- **Rationale**: Đây là điểm phức tạp nhất; cô lập thay đổi ở `MainApp` + chữ ký trả về của `getDocuments`. Không cần đổi gas-core hay cơ chế token.
- **Alternatives**: Giữ poll đẩy toàn bộ rồi client tự phân trang — mâu thuẫn yêu cầu "trả 100 items".

## D9. Phạm vi giữ nguyên (không làm)

- Không đổi schema/`SCHEMA_V`; không đụng luồng tạo/sửa/xóa/giao việc/phát hành.
- Quy tắc quyền xem (ẩn Nháp với người không tạo; lọc theo vai trò/quyền danh mục với người không miễn lọc) giữ nguyên và áp **trước** khi sort + phân trang.
- Kích thước trang cố định 100 (chưa cho người dùng đổi).
