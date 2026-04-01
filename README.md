# Webapp Quản Lý Tài Liệu, Văn Bản

Ứng dụng quản lý hồ sơ / tài liệu trên nền tảng Google Apps Script + React.

## Kiến trúc

| Layer | Công nghệ |
|---|---|
| Frontend | React 18, Tailwind CSS 3, Lucide-react, Vite (single file) |
| Backend | Google Apps Script (container-bound), Google Sheets DB |
| File storage | Google Drive |
| License | GAS License Server riêng (email whitelist + SHA256 token) |
| CI/CD | GitHub Actions → Jest → Vite build → javascript-obfuscator → clasp push |

## Cấu trúc

```
src/
├── client/               # React frontend
│   ├── components/       # UI components
│   ├── context/          # AuthContext (login/logout/session)
│   ├── utils/            # gasClient, writeBuffer, dataCache, format
│   ├── App.jsx           # Root component (HashRouter)
│   ├── main.jsx          # Entry point
│   ├── index.html        # HTML template
│   └── index.css         # Tailwind directives
└── server/               # GAS backend
    ├── config.js          # SHEETS constants, getSheet(), ensureInitialized()
    ├── cache.js           # CacheService wrapper + version counters
    ├── utils.js           # UUID, ID generator, rowsToObjects, formatDate
    ├── sheets.js          # CRUD + referential integrity + batchWrite
    ├── auth.js            # Login, session, password, lock/unlock
    ├── drive.js           # Google Drive upload/delete/folder
    ├── documents.js       # Document CRUD + stats + permission filter
    ├── license.js         # License check/activate + SHA256
    ├── main.js            # doGet() + tất cả api_* wrapper
    └── __tests__/         # Jest tests (35 tests)

license-server/           # GAS Web App riêng — kích hoạt license
scripts/obfuscate.js      # javascript-obfuscator wrapper
.github/workflows/        # CI/CD pipeline
```

## Chạy Local (Dev Mode)

### 1. Cài dependencies

```bash
npm install
```

### 2. Chạy dev server

```bash
npm run dev
```

Mở trình duyệt tại `http://localhost:5173` (Vite dev server).

**Trong dev mode:**
- `gasClient.js` tự động dùng **mock** thay vì `google.script.run`
- Login mặc định: `admin` / `admin123`
- Dữ liệu mock trả về dữ liệu mẫu cứng (không cần Google Sheet)

### 3. Chạy tests backend

```bash
npm test
```

Chạy 35 Jest tests cho toàn bộ backend (config, sheets, auth, documents, license).

### 4. Build

```bash
# Build tất cả (client + server + obfuscate)
npm run build

# Hoặc build riêng từng phần
npm run build:client    # Vite → dist/gas/index.html (single file)
npm run build:server    # Vite IIFE → dist/gas/main.js
npm run build:obfuscate # javascript-obfuscator → dist/gas/main.js
```

## Deploy lên Google Apps Script

### Lần đầu

1. **Tạo Google Spreadsheet mới**
2. Mở Extensions → Apps Script → lấy **Script ID**
3. Cập nhật `.clasp.json`:
   ```json
   { "scriptId": "YOUR_SCRIPT_ID", "rootDir": "./dist/gas" }
   ```
4. Login clasp:
   ```bash
   npx clasp login
   ```
5. Thiết lập Script Properties (trong GAS editor → Settings → Script Properties):
   - `SECRET_SALT` — chuỗi bí mật dài, random
   - `LICENSE_SERVER_URL` — URL của License Server web app
   - `ROOT_FOLDER_ID` — ID thư mục Google Drive gốc (hoặc để trống, thiết lập trong Cài đặt)

### Deploy

```bash
npm run deploy
# Hoặc riêng: npx clasp push --force && npx clasp deploy
```

### CI/CD (GitHub Actions)

Thêm GitHub Secrets:
- `SECRET_SALT` — chuỗi bí mật
- `LICENSE_SERVER_URL` — URL license server
- `CLASP_CREDENTIALS` — nội dung file `~/.clasprc.json`
- `CLASP_JSON` — nội dung file `.clasp.json`

Push lên branch `main` → tự động test → build → deploy.

## License Server

Xem `license-server/README` — deploy riêng như GAS Web App standalone.

1. Tạo GAS project mới (standalone)
2. Copy code từ `license-server/main.js`
3. Thiết lập Script Properties:
   - `SECRET_SALT` — **cùng giá trị** với app chính
   - `WHITELIST` — danh sách email cho phép kích hoạt, ngăn cách bởi dấu phẩy
4. Deploy as Web App → `Execute as: User accessing` / `Who has access: Anyone`
5. Lấy URL → điền vào Script Properties `LICENSE_SERVER_URL` của app chính

## Tài khoản mặc định

Khi chạy lần đầu, hệ thống tự tạo:
- **Username:** `admin` / **Password:** `admin123`
- Vai trò: Quản trị viên

> ⚠️ Đổi mật khẩu ngay sau khi đăng nhập lần đầu.

## Chia sẻ cho người dùng khác

1. Mở Google Spreadsheet → **Tạo bản sao** (File → Make a copy)
2. Bản sao có Script ID khác → license riêng
3. Người dùng truy cập Web App lần đầu → tự động redirect sang License Server → kích hoạt
4. Thêm người dùng vào sheet `_Người Dùng` của Central Sheet và cấp quyền trong `_Phân Quyền`
