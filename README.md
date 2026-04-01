# Appscripts Monorepo

Monorepo chứa các ứng dụng Google Apps Script, dùng npm workspaces.

## Kiến trúc

| Layer | Công nghệ |
|---|---|
| Frontend | React 18, Tailwind CSS 3, Lucide-react, Vite (single file) |
| Backend | Google Apps Script (container-bound), Google Sheets DB |
| File storage | Google Drive |
| License | GAS License Server riêng (email whitelist + SHA256 token) |
| Build | gas-core concat → app concat → env injection → obfuscation |
| CI/CD | GitHub Actions → Jest → build → clasp push |

## Cấu trúc

```
├── packages/
│   └── gas-core/                # Shared GAS modules (~70% reuse)
│       ├── config-base.js       # getConfig, setConfig, getSheet, _hashPassword
│       ├── cache.js             # CacheService wrapper + version counters
│       ├── utils.js             # UUID, ID generator, rowsToObjects, formatDate
│       ├── sheets-crud.js       # getSheetData, addRow, updateRow, deleteRow, batchWrite
│       ├── auth-core.js         # validateSession, requireAuth, changePassword, logout
│       ├── drive-io.js          # uploadFile, deleteFile, getOrCreateFolder
│       └── license.js           # checkLicense, activateWithToken, SHA256
├── apps/
│   ├── docmgr/                  # Quản Lý Tài Liệu (React + GAS)
│   │   ├── src/client/          # React frontend
│   │   ├── src/server/          # App-specific GAS backend
│   │   │   ├── config.js        # SHEETS, APP_ID, ensureInitialized
│   │   │   ├── sheets.js        # Referential integrity overrides
│   │   │   ├── auth.js          # login (app-specific), lockUser, unlockUser
│   │   │   ├── documents.js     # Document CRUD + stats + permission filter
│   │   │   ├── main.js          # doGet() + api_* wrappers
│   │   │   └── __tests__/       # Jest tests (35 tests)
│   │   └── package.json
│   └── license-server/          # GAS Web App — kích hoạt license
│       ├── main.js              # doGet/doPost, email whitelist
│       ├── dev.js               # Local Node.js dev runner (port 3001)
│       └── package.json
├── scripts/
│   ├── bundle-server.js         # Concat gas-core + app → main.js (--app <name>)
│   ├── obfuscate.js             # javascript-obfuscator (--app <name>)
│   └── convert-gs.js            # .js → .gs cho license-server (--app <name>)
├── package.json                 # Workspaces root
└── .github/workflows/deploy.yml # CI/CD pipeline
```

**Build pipeline:** gas-core files → app server files → concat thành 1 file → inject .env → obfuscate → clasp push.

GAS không có module system nên tất cả file được concat vào chung 1 scope. App mở rộng gas-core bằng override pattern:
```js
var _coreDeleteRow = deleteRow
deleteRow = function(sheet, rowIdx) {
  checkReferences(sheet, rowIdx)  // app-specific logic
  _coreDeleteRow(sheet, rowIdx)   // gọi gas-core
}
```

## Chạy Local (Dev Mode)

### 1. Cài dependencies

```bash
npm install
```

### 2. Chạy dev server (docmgr)

```bash
npm run dev:docmgr
```

Mở trình duyệt tại `http://localhost:5173` (Vite dev server).

**Trong dev mode:**
- `gasClient.js` tự động dùng **mock** thay vì `google.script.run`
- Login mặc định: `admin` / `admin123`
- Dữ liệu mock trả về dữ liệu mẫu cứng (không cần Google Sheet)

### 3. Chạy License Server local

```bash
npm run dev:license
```

License Server chạy tại `http://localhost:3001`.

### 4. Chạy tests

```bash
npm run test:docmgr
```

Chạy 35 Jest tests cho toàn bộ backend (config, sheets, auth, documents, license).

### 5. Build

```bash
# Build docmgr (client + server + obfuscate)
npm run build:docmgr

# Build license-server (.js → .gs)
npm run build:license
```

## Deploy lên Google Apps Script

### Docmgr — lần đầu

1. **Tạo Google Spreadsheet mới**
2. Mở Extensions → Apps Script → lấy **Script ID**
3. Tạo `apps/docmgr/.clasp.json`:
   ```json
   { "scriptId": "YOUR_SCRIPT_ID", "rootDir": "./dist/gas" }
   ```
4. Tạo `apps/docmgr/.env`:
   ```
   SECRET_SALT=chuoi-bi-mat-dai-random
   LICENSE_SERVER_URL=https://script.google.com/macros/s/.../exec
   APP_ID=docmgr
   APP_VERSION=1.0.0
   ```
5. Login clasp:
   ```bash
   npx clasp login
   ```
6. Build & push:
   ```bash
   npm run build:docmgr
   cd apps/docmgr && npx clasp push --force
   ```

### CI/CD (GitHub Actions)

Thêm GitHub Secrets:
- `SECRET_SALT` — chuỗi bí mật
- `LICENSE_SERVER_URL` — URL license server
- `CLASP_CREDENTIALS` — nội dung file `~/.clasprc.json`
- `CLASP_JSON` — nội dung file `apps/docmgr/.clasp.json`

Thêm GitHub Variables:
- `APP_ID` — `docmgr`
- `APP_VERSION` — `1.0.0`

Push lên branch `main` (thay đổi trong `apps/docmgr/`, `packages/gas-core/`, hoặc `scripts/`) → tự động test → build → deploy.

## License Server

Deploy riêng như GAS Web App standalone:

1. Tạo GAS project mới (standalone)
2. Build & push:
   ```bash
   npm run build:license
   cd apps/license-server && npx clasp push --force
   ```
3. Thiết lập Script Properties:
   - `SECRET_SALT` — **cùng giá trị** với app chính
   - `WHITELIST` — danh sách email cho phép kích hoạt, ngăn cách bởi dấu phẩy
4. Deploy as Web App → `Execute as: User accessing` / `Who has access: Anyone`
5. Lấy URL → điền vào `apps/docmgr/.env` → `LICENSE_SERVER_URL=...`

### Dev mode

```bash
npm run dev:license
```

Chạy local trên port 3001, mock GAS APIs bằng Node.js. Hỗ trợ debug với VS Code (launch config "License Server").

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
