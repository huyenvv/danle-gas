# Workmgr SP0 — Móng & seam lõi + lát cắt Nhãn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng móng kiến trúc SOLID/portable cho workmgr và chứng minh bằng lát cắt dọc "Nhãn" chạy được trên CẢ Google Sheets (GAS) lẫn SQLite (Node local), cùng một Service/Repository/contract.

**Architecture:** App workmgr self-contained (không dùng gas-core). Lớp `DataStore` (collection-oriented, domain ASCII) có 2 adapter cùng hợp đồng: `SheetsDataStore` (GAS) và `SqliteDataStore` (Node dev). Service → Repository → DataStore. Client gọi `api.*` qua `Transport` (Gas hoặc Http). Cùng một bộ file `src/server` chạy 2 runtime: GAS concat (bundle) và Node vm-context (jest + dev-server).

**Tech Stack:** Plain ES5-style JS (server, GAS V8), React + Vite + Tailwind (client), Jest (test), Node `http` + `better-sqlite3` (dev-server), `vm` module (nạp server vào Node).

## Global Constraints

- Server `.js` dùng `var`/`function` kiểu ES5 (code concat trong GAS V8) — verbatim từ CLAUDE.md.
- UI tiếng Việt; tên hàm/biến code tiếng Anh.
- **Domain object dùng field ASCII** (`id`, `name`, `color`…). Tên cột VN (sheet) / cột SQL chỉ tồn tại **bên trong adapter**.
- Mỗi commit ≤ 10 file; message tiếng Việt nêu *cái gì + vì sao*; cuối message: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Không đụng** `packages/gas-core`, `apps/docmgr`, `apps/sso-portal`, `apps/license-server`.
- Branch dùng quy ước `feat/...` không bắt buộc; nhánh tên `workmgr-rebuild`.
- Mọi lệnh chạy trong worktree `../Appscripts-workmgr` (trừ Task 1 bước tạo worktree).
- `better-sqlite3` chỉ là devDependency, chỉ dùng trong `dev-server/` — KHÔNG được lọt vào bundle GAS.

---

## File Structure (khoá quyết định phân rã)

Mới tạo trong `apps/workmgr/`:

```
server-files.js                 # NGUỒN DUY NHẤT thứ tự nạp file server (dùng bởi bundle + jest + dev-server)
server-runtime.js               # Node loader: nạp src/server vào 1 vm context + cấp globals
src/server/
  app-config.js                 # COLLECTIONS (tên logic) + hằng số app
  core/
    config.js                   # getCentralSheet / script props (chỉ GAS gọi)
    cache.js                    # Cache seam — GAS CacheService (Node inject in-memory)
    clock.js                    # Clock seam — now()
    schema.js                   # REGISTRY field ASCII ↔ header sheet (VN) ↔ cột SQL + helper map
    data-store.js               # factory getDataStore()/setDataStore() (default Sheets)
    sheets-data-store.js        # SheetsDataStore — CRUD collection trên SpreadsheetApp
  domain/
    activity-log.js             # ActivityLog.append()
    audit-log.js                # AuditLog.append()
    label-repository.js         # LabelRepository trên DataStore
  services/
    label-service.js            # LabelService — nghiệp vụ + requireAuth stub
  transport/
    api-labels.js               # api_getLabels / api_addLabel / api_updateLabel / api_deleteLabel
    main.js                     # doGet + _wrap + requireAuth stub (nạp cuối)
  __tests__/
    setup.js                    # harness self-contained (nạp qua server-runtime)
    mocks/gas.js                # mock GAS (copy từ bản cũ)
    sheets-data-store.test.js
    datastore-parity.test.js    # cùng test cho Sheets + Sqlite
    label-slice.test.js         # repo + service + transport
dev-server/
  sqlite-data-store.js          # SqliteDataStore (better-sqlite3) cùng hợp đồng DataStore
  server.js                     # HTTP POST /api → dispatch api_* ; inject Sqlite + node cache/clock
src/client/api/
  index.js                      # ráp `api` từ contracts + transport
  transport/gas-transport.js
  transport/http-transport.js
  contracts/labels.js
src/client/components/labels/LabelManager.jsx   # UI tối thiểu nối api.labels
```

Sửa:
```
scripts/bundle-server.js        # thêm chế độ self-contained (đọc apps/<app>/server-files.js, bỏ gas-core)
apps/workmgr/package.json       # script dev:server, devDeps better-sqlite3; cờ gasBundle.selfContained
apps/workmgr/jest.config.js     # (giữ nguyên — testMatch đã phủ __tests__)
package.json (root)             # script dev:workmgr (client + dev-server song song)
```

---

## Task 1: Worktree + build self-contained (bỏ gas-core)

**Files:**
- Create: `apps/workmgr/server-files.js`
- Modify: `scripts/bundle-server.js`
- Modify: `apps/workmgr/package.json`
- Move: `apps/workmgr/src` → `apps/workmgr/legacy-src` (git mv, làm tham chiếu nghiệp vụ)

**Interfaces:**
- Produces: `apps/workmgr/server-files.js` export mảng đường dẫn (relative `src/server/`) đúng thứ tự nạp; `bundle-server.js` chế độ self-contained.

- [ ] **Step 1: Tạo branch + worktree**

Run (từ `/Users/vanhuyen.vu/Documents/Vuhu/Projects/Appscripts`):
```bash
git worktree add -b workmgr-rebuild ../Appscripts-workmgr master
cd ../Appscripts-workmgr && npm install
```
Expected: worktree tạo tại `../Appscripts-workmgr`, `npm install` xong. **Mọi task sau chạy trong worktree này.**

- [ ] **Step 2: Dời src cũ làm tham chiếu**

```bash
git mv apps/workmgr/src apps/workmgr/legacy-src
mkdir -p apps/workmgr/src/server/core apps/workmgr/src/server/domain apps/workmgr/src/server/services apps/workmgr/src/server/transport apps/workmgr/src/server/__tests__/mocks apps/workmgr/src/client/api/transport apps/workmgr/src/client/api/contracts apps/workmgr/src/client/components/labels apps/workmgr/dev-server
git mv apps/workmgr/legacy-src/server/__tests__/mocks/gas.js apps/workmgr/src/server/__tests__/mocks/gas.js
```
(Mock GAS dùng lại nguyên; phần còn lại của `legacy-src` chỉ để đọc tham chiếu.)

- [ ] **Step 3: Khai báo thứ tự nạp file server**

Create `apps/workmgr/server-files.js`:
```js
// Nguồn DUY NHẤT về thứ tự nạp file server (concat GAS = nạp Node = harness test).
// Đường dẫn tương đối so với apps/workmgr/src/server/. Thứ tự = phụ thuộc (main cuối).
module.exports = [
  'app-config.js',
  'core/config.js',
  'core/cache.js',
  'core/clock.js',
  'core/schema.js',
  'core/data-store.js',
  'core/sheets-data-store.js',
  'domain/activity-log.js',
  'domain/audit-log.js',
  'domain/label-repository.js',
  'services/label-service.js',
  'transport/api-labels.js',
  'transport/main.js',
]
```

- [ ] **Step 4: Thêm cờ self-contained vào package.json**

Edit `apps/workmgr/package.json` — thêm trong object gốc (cạnh `"scripts"`):
```json
  "gasBundle": { "selfContained": true },
```
và thêm script:
```json
    "dev:server": "node dev-server/server.js",
```
và devDependencies:
```json
    "better-sqlite3": "^11.0.0"
```
Rồi `npm install` trong worktree.

- [ ] **Step 5: Cho bundle-server hiểu self-contained**

Edit `scripts/bundle-server.js` — sau khi tính `appDir`/`serverDir`, đọc cờ và đổi nguồn file:
```js
// ── Chế độ self-contained: bỏ gas-core, nạp theo apps/<app>/server-files.js ────
let appPkg = {};
try { appPkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')); } catch (e) {}
const selfContained = !!(appPkg.gasBundle && appPkg.gasBundle.selfContained);
```
Thay khối tạo `appFiles` + khối concat gas-core bằng nhánh điều kiện:
```js
let orderedAppFiles;
if (selfContained) {
  orderedAppFiles = require(path.join(appDir, 'server-files.js')); // relative tới serverDir
} else {
  orderedAppFiles = fs.readdirSync(serverDir)
    .filter(f => f.endsWith('.js') && !f.startsWith('_'))
    .sort((a, b) => {
      const order = ['config.js', 'sheets.js', 'auth.js'];
      const ai = order.indexOf(a), bi = order.indexOf(b);
      if (a === 'main.js') return 1;
      if (b === 'main.js') return -1;
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
}

const parts = [];
if (!selfContained) {
  GAS_CORE_FILES.forEach(f => {
    const filePath = path.join(gasCoreDir, f);
    if (fs.existsSync(filePath)) {
      parts.push(`// ---- gas-core/${f} ----\n${fs.readFileSync(filePath, 'utf8')}`);
    }
  });
}
orderedAppFiles.forEach(f => {
  const content = fs.readFileSync(path.join(serverDir, f), 'utf8');
  parts.push(`// ---- ${f} ----\n${content}`);
});
```
(Xoá khối `appFiles.forEach` cũ và khối `GAS_CORE_FILES.forEach` cũ — thay bằng đoạn trên. Giữ phần inject env vars phía dưới nguyên.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(workmgr): nhánh rebuild + build self-contained (bỏ gas-core)

Dời src cũ sang legacy-src làm tham chiếu nghiệp vụ. Thêm server-files.js làm
nguồn duy nhất thứ tự nạp file server. bundle-server đọc cờ gasBundle.selfContained
để bỏ gas-core và nạp theo server-files.js — workmgr tự chứa, dễ tách server ngoài.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Node loader + jest harness self-contained

**Files:**
- Create: `apps/workmgr/server-runtime.js`
- Create: `apps/workmgr/src/server/__tests__/setup.js`
- Create: `apps/workmgr/src/server/app-config.js` (tối thiểu để nạp được)
- Create stub rỗng cho từng file trong `server-files.js` (chỉ để loader chạy; nội dung thật ở task sau)

**Interfaces:**
- Produces: `server-runtime.js` export `loadServer(ctx, globals)`; `setup.js` export `{ resetGAS, ctx }`.
- Consumes: `apps/workmgr/server-files.js` (Task 1).

- [ ] **Step 1: Viết loader Node dùng chung**

Create `apps/workmgr/server-runtime.js`:
```js
// Nạp toàn bộ file server (plain-JS) vào 1 vm context — dùng cho jest và dev-server.
// Cùng thứ tự với bundle GAS (server-files.js) nên Node không bao giờ lệch bundle.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SERVER_DIR = path.join(__dirname, 'src', 'server');
const ORDER = require('./server-files.js');

function loadServer(ctx, globals) {
  if (globals) Object.assign(ctx, globals);
  ORDER.forEach(rel => {
    const p = path.join(SERVER_DIR, rel);
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: rel });
  });
  return ctx;
}

module.exports = { loadServer, SERVER_DIR, ORDER };
```

- [ ] **Step 2: Tạo stub rỗng cho mọi file server**

Tạo từng file dưới đây với nội dung 1 dòng comment (sẽ thay ở task sau), để loader nạp không lỗi:
```bash
cd ../Appscripts-workmgr/apps/workmgr/src/server
for f in core/config.js core/cache.js core/clock.js core/schema.js core/data-store.js core/sheets-data-store.js domain/activity-log.js domain/audit-log.js domain/label-repository.js services/label-service.js transport/api-labels.js transport/main.js; do echo "// stub" > "$f"; done
```
Và `app-config.js`:
```js
// ===== Hằng số & danh sách collection của workmgr =====
var COLLECTIONS = { LABELS: 'labels', ACTIVITIES: 'activities', AUDIT: 'audit' }
```

- [ ] **Step 3: Viết jest setup self-contained**

Create `apps/workmgr/src/server/__tests__/setup.js`:
```js
// Harness self-contained: KHÔNG nạp gas-core. Nạp src/server qua server-runtime
// vào context có sẵn GAS mocks (global). DataStore mặc định = Sheets (chạy trên mock).
require('./mocks/gas.js')
const vm = require('vm')
const { loadServer } = require('../../../server-runtime.js')

const ctx = vm.createContext(globalThis)
loadServer(ctx)

function resetGAS() {
  SpreadsheetApp._reset()
  CacheService.getScriptCache()._reset()
  if (typeof PropertiesService !== 'undefined') PropertiesService._reset()
}

module.exports = { resetGAS, ctx }
```

- [ ] **Step 4: Test khói — loader nạp được**

Create `apps/workmgr/src/server/__tests__/smoke.test.js`:
```js
const { resetGAS } = require('./setup')
beforeEach(() => resetGAS())

test('nạp server self-contained: COLLECTIONS tồn tại', () => {
  expect(typeof COLLECTIONS).toBe('object')
  expect(COLLECTIONS.LABELS).toBe('labels')
})
```

- [ ] **Step 5: Chạy — phải PASS**

Run: `npm --prefix apps/workmgr test -- smoke`
Expected: 1 passed. (Nếu lỗi `require better-sqlite3` thì sai — chưa file nào cần nó.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(test): harness workmgr self-contained qua server-runtime

server-runtime.js nạp src/server vào vm context theo server-files.js (dùng chung
jest + dev-server). Stub rỗng các file để loader chạy. Test khói xác nhận nạp được.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Schema registry (domain ASCII ↔ storage)

**Files:**
- Modify: `apps/workmgr/src/server/core/schema.js`
- Test: `apps/workmgr/src/server/__tests__/schema.test.js`

**Interfaces:**
- Produces:
  - `getSchema(collection) -> { sheet, table, idField, fields }`
  - `sheetHeaders(collection) -> string[]` (header VN đúng thứ tự)
  - `domainToSheet(collection, obj) -> object` (key = header VN)
  - `sheetToDomain(collection, row) -> object` (key = field ASCII)
  - `domainToSqlRow(collection, obj) -> object` (key = cột SQL) / `sqlRowToDomain(collection, row)`

- [ ] **Step 1: Viết test schema**

Create `apps/workmgr/src/server/__tests__/schema.test.js`:
```js
require('./setup')

test('labels: map domain ASCII ↔ header sheet VN', () => {
  const dom = { id: 5, name: 'Bug', color: '#e53935' }
  const row = domainToSheet('labels', dom)
  expect(row).toEqual({ 'ID': 5, 'Tên nhãn': 'Bug', 'Màu sắc': '#e53935' })
  expect(sheetToDomain('labels', row)).toEqual(dom)
})

test('labels: sheetHeaders đúng thứ tự', () => {
  expect(sheetHeaders('labels')).toEqual(['ID', 'Tên nhãn', 'Màu sắc'])
})

test('labels: map domain ↔ cột SQL', () => {
  const dom = { id: 5, name: 'Bug', color: '#e53935' }
  const row = domainToSqlRow('labels', dom)
  expect(row).toEqual({ id: 5, name: 'Bug', color: '#e53935' })
  expect(sqlRowToDomain('labels', row)).toEqual(dom)
})
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npm --prefix apps/workmgr test -- schema`
Expected: FAIL ("domainToSheet is not defined").

- [ ] **Step 3: Cài schema.js**

Replace `apps/workmgr/src/server/core/schema.js`:
```js
// ===== REGISTRY: domain (ASCII) ↔ lưu trữ (sheet header VN / cột SQL) =====
// Mọi tên cột VN/SQL chỉ sống ở đây + trong adapter. Service/Repo/client chỉ thấy field ASCII.
var SCHEMA = {
  labels: {
    sheet: 'Nhãn', table: 'labels', idField: 'id',
    fields: [
      { d: 'id',    h: 'ID',       c: 'id',    sql: 'INTEGER PRIMARY KEY' },
      { d: 'name',  h: 'Tên nhãn', c: 'name',  sql: 'TEXT' },
      { d: 'color', h: 'Màu sắc',  c: 'color', sql: 'TEXT' },
    ],
  },
  activities: {
    sheet: '_Hoạt Động', table: 'activities', idField: 'id',
    fields: [
      { d: 'id',         h: 'ID',            c: 'id',          sql: 'INTEGER PRIMARY KEY' },
      { d: 'type',       h: 'Loại',          c: 'type',        sql: 'TEXT' },
      { d: 'description',h: 'Mô tả',         c: 'description', sql: 'TEXT' },
      { d: 'objectType', h: 'Đối tượng',     c: 'object_type', sql: 'TEXT' },
      { d: 'objectId',   h: 'Mã đối tượng',  c: 'object_id',   sql: 'TEXT' },
      { d: 'userId',     h: 'UserID',        c: 'user_id',     sql: 'TEXT' },
      { d: 'userName',   h: 'Tên người dùng',c: 'user_name',   sql: 'TEXT' },
      { d: 'at',         h: 'Thời gian',     c: 'at',          sql: 'TEXT' },
    ],
  },
  audit: {
    sheet: '_Nhật Ký', table: 'audit', idField: 'id',
    fields: [
      { d: 'id',      h: 'ID',        c: 'id',      sql: 'INTEGER PRIMARY KEY' },
      { d: 'at',      h: 'Thời gian', c: 'at',      sql: 'TEXT' },
      { d: 'user',    h: 'Người dùng',c: 'user',    sql: 'TEXT' },
      { d: 'email',   h: 'Email',     c: 'email',   sql: 'TEXT' },
      { d: 'action',  h: 'Hành động', c: 'action',  sql: 'TEXT' },
      { d: 'type',    h: 'Loại',      c: 'type',    sql: 'TEXT' },
      { d: 'target',  h: 'Đối tượng', c: 'target',  sql: 'TEXT' },
      { d: 'details', h: 'Chi tiết',  c: 'details', sql: 'TEXT' },
    ],
  },
}

function getSchema(collection) {
  var s = SCHEMA[collection]
  if (!s) throw new Error('Schema không tồn tại cho collection: ' + collection)
  return s
}
function sheetHeaders(collection) {
  return getSchema(collection).fields.map(function(f) { return f.h })
}
function _mapBy(collection, fromKey, toKey, obj) {
  var out = {}
  getSchema(collection).fields.forEach(function(f) {
    if (obj.hasOwnProperty(f[fromKey])) out[f[toKey]] = obj[f[fromKey]]
  })
  return out
}
function domainToSheet(collection, obj)  { return _mapBy(collection, 'd', 'h', obj) }
function sheetToDomain(collection, row)  { return _mapBy(collection, 'h', 'd', row) }
function domainToSqlRow(collection, obj) { return _mapBy(collection, 'd', 'c', obj) }
function sqlRowToDomain(collection, row) { return _mapBy(collection, 'c', 'd', row) }
```

- [ ] **Step 4: Chạy — PASS**

Run: `npm --prefix apps/workmgr test -- schema`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): schema registry domain ASCII ↔ sheet VN / cột SQL

Mỗi collection khai báo field domain + cách map sang header sheet (VN) và cột SQL.
Đây là lớp giữ Service/Repo/client thuần ASCII, để adapter Sheets/SQLite tự ánh xạ.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Cache seam + Clock seam + config

**Files:**
- Modify: `apps/workmgr/src/server/core/cache.js`
- Modify: `apps/workmgr/src/server/core/clock.js`
- Modify: `apps/workmgr/src/server/core/config.js`
- Test: `apps/workmgr/src/server/__tests__/cache.test.js`

**Interfaces:**
- Produces:
  - `cacheGet(key)`, `cachePut(key, value, ttl)`, `cacheRemove(key)`, `getDataVersion(name)`, `incrementDataVersion(name)`, `invalidateSheetCache(name)` — mặc định backend GAS CacheService; có thể `setCacheBackend(impl)` để Node inject in-memory.
  - `clockNow() -> string` ISO; `setClock(fn)`.
  - `getCentralSheet()`, `getConfig(k)`, `setConfig(k,v)`.

- [ ] **Step 1: Viết test cache + clock**

Create `apps/workmgr/src/server/__tests__/cache.test.js`:
```js
const { resetGAS } = require('./setup')
beforeEach(() => resetGAS())

test('cachePut/Get vòng đời + version', () => {
  cachePut('k', { a: 1 })
  expect(cacheGet('k')).toEqual({ a: 1 })
  expect(getDataVersion('Nhãn')).toBe(0)
  invalidateSheetCache('Nhãn')
  expect(getDataVersion('Nhãn')).toBe(1)
})

test('clockNow trả ISO string; setClock override được', () => {
  setClock(function () { return '2026-01-01T00:00:00.000Z' })
  expect(clockNow()).toBe('2026-01-01T00:00:00.000Z')
})
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npm --prefix apps/workmgr test -- cache`
Expected: FAIL ("cachePut is not defined").

- [ ] **Step 3: Cài cache.js (seam)**

Replace `apps/workmgr/src/server/core/cache.js` (copy+refactor từ gas-core/cache.js, thêm điểm inject backend):
```js
// ===== Cache seam — mặc định GAS CacheService; Node có thể inject in-memory =====
var CACHE_TTL = 600
var CACHE_MAX_TTL = 21600
var CACHE_CHUNK_SIZE = 20000

var _cacheBackend = null
function setCacheBackend(impl) { _cacheBackend = impl } // {get,put,remove,getAll}
function _getCache() {
  if (_cacheBackend) return _cacheBackend
  return CacheService.getScriptCache()
}

function cacheGet(key) {
  var val = _getCache().get(key)
  if (val == null) return null
  if (val.charAt(0) === '{' && val.indexOf('__chunks__') !== -1) {
    try {
      var meta = JSON.parse(val)
      if (meta && meta.__chunks__) {
        var keys = []
        for (var i = 0; i < meta.__chunks__; i++) keys.push(key + '.' + i)
        var parts = _getCache().getAll(keys)
        var str = ''
        for (var j = 0; j < meta.__chunks__; j++) {
          var p = parts[key + '.' + j]
          if (p == null) return null
          str += p
        }
        try { return JSON.parse(str) } catch (e) { return str }
      }
    } catch (e) {}
  }
  try { return JSON.parse(val) } catch (e) { return val }
}

function cachePut(key, value, ttl) {
  var t = ttl || CACHE_TTL
  if (t > CACHE_MAX_TTL) t = CACHE_MAX_TTL
  var str = JSON.stringify(value)
  try {
    if (str.length <= CACHE_CHUNK_SIZE) { _getCache().put(key, str, t); return }
    var n = Math.ceil(str.length / CACHE_CHUNK_SIZE)
    var map = {}
    map[key] = JSON.stringify({ __chunks__: n })
    for (var i = 0; i < n; i++) map[key + '.' + i] = str.substring(i * CACHE_CHUNK_SIZE, (i + 1) * CACHE_CHUNK_SIZE)
    _getCache().putAll(map, t)
  } catch (e) { if (typeof Logger !== 'undefined') Logger.log('cachePut skip ' + key + ': ' + e.message) }
}

function cacheRemove(key) { _getCache().remove(key) }
function getDataVersion(name) { return cacheGet('ver_' + name) || 0 }
function incrementDataVersion(name) { var next = (getDataVersion(name) || 0) + 1; cachePut('ver_' + name, next, 86400); return next }
function invalidateSheetCache(name) { cacheRemove('data_' + name); incrementDataVersion(name) }
```
(Lưu ý: GAS `CacheService.getScriptCache()` không có `putAll`/`getAll` đồng nhất với mock — mock đã có `getAll`; `putAll` chỉ chạy nhánh chunk lớn, không cần cho Nhãn. Để an toàn, mock GAS chunk-path không kích hoạt ở SP0.)

- [ ] **Step 4: Cài clock.js**

Replace `apps/workmgr/src/server/core/clock.js`:
```js
// ===== Clock seam — now() trả ISO string; inject để test/dev =====
var _clock = null
function setClock(fn) { _clock = fn }
function clockNow() { return _clock ? _clock() : new Date().toISOString() }
```

- [ ] **Step 5: Cài config.js**

Replace `apps/workmgr/src/server/core/config.js` (copy+refactor từ gas-core/config-base.js, bỏ phần password):
```js
// ===== Config / Spreadsheet access (chỉ runtime GAS gọi) =====
function _getProps() { return PropertiesService.getScriptProperties() }
function getConfig(key) { return _getProps().getProperty(key) }
function setConfig(key, value) { _getProps().setProperty(key, value) }

function getCentralSheet() {
  var id = getConfig('CENTRAL_SHEET_ID')
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet()
}
function getSheet(sheetName) {
  var ss = getCentralSheet()
  var sheet = ss.getSheetByName(sheetName)
  if (!sheet) throw new Error('Sheet không tồn tại: ' + sheetName)
  return sheet
}
function ensureSheet(sheetName, headers) {
  var ss = getCentralSheet()
  var sheet = ss.getSheetByName(sheetName)
  if (!sheet) {
    sheet = ss.insertSheet(sheetName)
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
  }
  return sheet
}
```

- [ ] **Step 6: Chạy — PASS**

Run: `npm --prefix apps/workmgr test -- cache`
Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(core): cache seam + clock seam + config (copy+refactor gas-core)

Cache mặc định GAS CacheService, thêm setCacheBackend để Node inject in-memory.
Clock now() inject được cho test/dev. config.js rút từ config-base (bỏ password).
Các seam này để chạy cùng code trên GAS lẫn Node.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Hợp đồng DataStore + factory

**Files:**
- Modify: `apps/workmgr/src/server/core/data-store.js`
- Test: `apps/workmgr/src/server/__tests__/data-store.test.js`

**Interfaces:**
- Produces:
  - `getDataStore() -> DataStore` (singleton; default = `createSheetsDataStore()` từ Task 6)
  - `setDataStore(impl)` (điểm inject cho Node/test)
  - Hợp đồng `DataStore`: `getAll(c)`, `getAllWithVersion(c)`, `getVersion(c)`, `insert(c, rec)`, `update(c, id, fields)`, `remove(c, id)`, `batch(c, ops)`, `ensureSchema()`.

- [ ] **Step 1: Viết test factory (dùng fake DataStore)**

Create `apps/workmgr/src/server/__tests__/data-store.test.js`:
```js
const { resetGAS } = require('./setup')
beforeEach(() => { resetGAS(); setDataStore(null) })

test('setDataStore inject + getDataStore trả đúng impl', () => {
  const fake = { getAll: () => [{ id: 1 }] }
  setDataStore(fake)
  expect(getDataStore()).toBe(fake)
  expect(getDataStore().getAll('labels')).toEqual([{ id: 1 }])
})

test('không inject → default là SheetsDataStore (có getAll)', () => {
  setDataStore(null)
  expect(typeof getDataStore().getAll).toBe('function')
})
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npm --prefix apps/workmgr test -- data-store`
Expected: FAIL ("setDataStore is not defined").

- [ ] **Step 3: Cài data-store.js**

Replace `apps/workmgr/src/server/core/data-store.js`:
```js
// ===== Factory DataStore — điểm hoán đổi DUY NHẤT giữa các backend =====
// default = SheetsDataStore (GAS). Node/test dùng setDataStore(SqliteDataStore...).
var _dataStore = null
function setDataStore(impl) { _dataStore = impl }
function getDataStore() {
  if (!_dataStore) _dataStore = createSheetsDataStore()
  return _dataStore
}
```

- [ ] **Step 4: Chạy — PASS** (cần Task 6 cho nhánh default; test 2 sẽ pass sau Task 6)

Run: `npm --prefix apps/workmgr test -- data-store -t inject`
Expected: test "inject" passed. (Test default chờ Task 6.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): factory DataStore + điểm inject (setDataStore)

Factory là nơi duy nhất chọn backend. default SheetsDataStore; Node/test inject
adapter khác (SQLite) qua setDataStore. Đây là 1 dòng cần đổi khi chuyển DB.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: SheetsDataStore (adapter GAS)

**Files:**
- Modify: `apps/workmgr/src/server/core/sheets-data-store.js`
- Test: `apps/workmgr/src/server/__tests__/sheets-data-store.test.js`

**Interfaces:**
- Consumes: `schema.js` (Task 3), `cache.js` (Task 4), `config.js` (`getCentralSheet`, `ensureSheet`), `clockNow`.
- Produces: `createSheetsDataStore() -> DataStore`. Trả/nhận **domain object ASCII**; ánh xạ sang header sheet VN nội bộ. `insert` gán `id` (max+1). Lưu cache key `data_<sheet>`.

- [ ] **Step 1: Viết test SheetsDataStore**

Create `apps/workmgr/src/server/__tests__/sheets-data-store.test.js`:
```js
const { resetGAS } = require('./setup')

beforeEach(() => {
  resetGAS()
  setDataStore(null) // dùng default Sheets
  // tạo sheet 'Nhãn' với header VN
  SpreadsheetApp._addSheet('Nhãn', [['ID', 'Tên nhãn', 'Màu sắc']])
})

test('insert gán id + getAll trả domain ASCII', () => {
  const ds = getDataStore()
  const rec = ds.insert('labels', { name: 'Bug', color: '#e53935' })
  expect(rec.id).toBe(1)
  expect(rec.name).toBe('Bug')
  const all = ds.getAll('labels')
  expect(all).toEqual([{ id: 1, name: 'Bug', color: '#e53935' }])
})

test('update theo id + remove', () => {
  const ds = getDataStore()
  ds.insert('labels', { name: 'Bug', color: '#000' })
  expect(ds.update('labels', 1, { color: '#fff' })).toBe(true)
  expect(ds.getAll('labels')[0].color).toBe('#fff')
  expect(ds.remove('labels', 1)).toBe(true)
  expect(ds.getAll('labels')).toEqual([])
})

test('getVersion tăng sau mỗi ghi', () => {
  const ds = getDataStore()
  const v0 = ds.getVersion('labels')
  ds.insert('labels', { name: 'X', color: '#1' })
  expect(ds.getVersion('labels')).toBe(v0 + 1)
})
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npm --prefix apps/workmgr test -- sheets-data-store`
Expected: FAIL ("createSheetsDataStore is not defined").

- [ ] **Step 3: Cài sheets-data-store.js**

Replace `apps/workmgr/src/server/core/sheets-data-store.js`:
```js
// ===== SheetsDataStore — adapter DataStore trên SpreadsheetApp =====
// Vào/ra là domain object ASCII; ánh xạ sang header sheet VN qua schema.js.
function createSheetsDataStore() {
  function _sheet(collection) {
    var s = getSchema(collection)
    return ensureSheet(s.sheet, sheetHeaders(collection))
  }
  function _readRaw(collection) {
    var s = getSchema(collection)
    var cached = cacheGet('data_' + s.sheet)
    if (cached) return cached
    var sheet = _sheet(collection)
    var values = sheet.getDataRange().getValues()
    var headers = values[0] || []
    var rows = []
    for (var i = 1; i < values.length; i++) {
      var obj = {}
      headers.forEach(function (h, c) { obj[h] = values[i][c] })
      rows.push(obj)
    }
    cachePut('data_' + s.sheet, rows)
    return rows
  }
  function _nextId(collection) {
    var rows = _readRaw(collection)
    var max = 0
    rows.forEach(function (r) { var n = Number(r['ID']); if (n > max) max = n })
    return max + 1
  }
  return {
    getAll: function (collection) {
      return _readRaw(collection).map(function (row) { return sheetToDomain(collection, row) })
    },
    getVersion: function (collection) { return getDataVersion(getSchema(collection).sheet) },
    getAllWithVersion: function (collection) {
      return { data: this.getAll(collection), version: this.getVersion(collection) }
    },
    insert: function (collection, record) {
      var s = getSchema(collection)
      var dom = {}
      for (var k in record) dom[k] = record[k]
      if (dom.id == null) dom.id = _nextId(collection)
      var headers = sheetHeaders(collection)
      var rowObj = domainToSheet(collection, dom)
      var sheet = _sheet(collection)
      sheet.appendRow(headers.map(function (h) { return rowObj.hasOwnProperty(h) ? rowObj[h] : '' }))
      invalidateSheetCache(s.sheet)
      return dom
    },
    update: function (collection, id, fields) {
      var s = getSchema(collection)
      var sheet = _sheet(collection)
      var values = sheet.getDataRange().getValues()
      var headers = values[0] || []
      var idCol = headers.indexOf('ID')
      if (idCol === -1) throw new Error('Sheet không có cột ID: ' + s.sheet)
      var rowObj = domainToSheet(collection, fields)
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][idCol]) === String(id)) {
          headers.forEach(function (h, c) {
            if (rowObj.hasOwnProperty(h)) sheet.getRange(i + 1, c + 1).setValue(rowObj[h])
          })
          invalidateSheetCache(s.sheet)
          return true
        }
      }
      throw new Error('Không tìm thấy bản ghi ID: ' + id)
    },
    remove: function (collection, id) {
      var s = getSchema(collection)
      var sheet = _sheet(collection)
      var values = sheet.getDataRange().getValues()
      var headers = values[0] || []
      var idCol = headers.indexOf('ID')
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][idCol]) === String(id)) {
          sheet.deleteRow(i + 1)
          invalidateSheetCache(s.sheet)
          return true
        }
      }
      throw new Error('Không tìm thấy bản ghi ID: ' + id)
    },
    batch: function (collection, ops) {
      var self = this
      ops.forEach(function (op) {
        if (op.type === 'add') self.insert(collection, op.data)
        else if (op.type === 'update') self.update(collection, op.id, op.data)
        else if (op.type === 'delete') self.remove(collection, op.id)
      })
      return { success: true, count: ops.length }
    },
    ensureSchema: function () { /* Sheets: ensureSheet đã lo; no-op tổng quát */ },
  }
}
```

- [ ] **Step 4: Chạy — PASS** (cả test data-store default lẫn sheets-data-store)

Run: `npm --prefix apps/workmgr test -- sheets-data-store data-store`
Expected: tất cả passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): SheetsDataStore — CRUD collection trên SpreadsheetApp

Adapter đầu tiên của hợp đồng DataStore. Vào/ra domain ASCII, map sang header VN
qua schema; gán id max+1; cache theo sheet. Test phủ insert/getAll/update/remove/version.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Node dev-server skeleton (HTTP /api)

**Files:**
- Modify: `apps/workmgr/dev-server/server.js`
- Modify: `package.json` (root) — script `dev:workmgr`

**Interfaces:**
- Consumes: `server-runtime.js` (Task 2), GAS shims tối thiểu, `setCacheBackend`/`setClock`/`setDataStore`.
- Produces: HTTP server cổng 3100, `POST /api` body `{ method, args }` → gọi `ctx[method](...args)` → trả JSON envelope `{success,payload}`/`{success:false,error}`. (Task 9 gắn SqliteDataStore; SP0 này dùng tạm Sheets-shim? Không — DataStore inject ở Task 9. Tạm thời route trả 501 nếu chưa có datastore.)

- [ ] **Step 1: Viết dev-server skeleton**

Replace `apps/workmgr/dev-server/server.js`:
```js
// Dev-server Node: nạp src/server vào 1 vm context với globals Node, phục vụ POST /api.
// Mô phỏng google.script.run: client gửi {method, args} → chạy api_* → trả envelope.
const http = require('http')
const vm = require('vm')
const { loadServer } = require('../server-runtime.js')

// ── Globals tối thiểu cho runtime Node (không có GAS) ──
const _mem = {}
const cacheBackend = {
  get: (k) => (_mem[k] !== undefined ? _mem[k] : null),
  put: (k, v) => { _mem[k] = v },
  remove: (k) => { delete _mem[k] },
  getAll: (keys) => { const o = {}; keys.forEach(k => o[k] = _mem[k] ?? null); return o },
  putAll: (map) => { Object.assign(_mem, map) },
}
const ctx = vm.createContext({
  Logger: { log: (...a) => console.log('[gas]', ...a) },
  console,
  JSON, Math, Date, Object, Array, String, Number, Boolean, isNaN, parseInt, parseFloat,
})
loadServer(ctx)
ctx.setCacheBackend(cacheBackend)

// SqliteDataStore sẽ được gắn ở Task 9:
try { require('./wire-sqlite.js')(ctx) } catch (e) { console.warn('SQLite chưa gắn:', e.message) }

const PORT = 3100
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  if (req.method !== 'POST' || req.url !== '/api') { res.writeHead(404); return res.end() }
  let body = ''
  req.on('data', c => body += c)
  req.on('end', () => {
    let out
    try {
      const { method, args } = JSON.parse(body || '{}')
      if (typeof ctx[method] !== 'function') throw new Error('Method không tồn tại: ' + method)
      out = ctx[method].apply(null, args || [])
    } catch (e) { out = { success: false, error: e.message } }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(out))
  })
}).listen(PORT, () => console.log('workmgr dev-server: http://localhost:' + PORT + '/api'))
```

- [ ] **Step 2: Tạo wire-sqlite stub (Task 9 sẽ thay)**

Create `apps/workmgr/dev-server/wire-sqlite.js`:
```js
// Stub — Task 9 thay bằng gắn SqliteDataStore thật.
module.exports = function () { throw new Error('chưa cài SqliteDataStore') }
```

- [ ] **Step 3: Thêm script root dev:workmgr**

Edit root `package.json` scripts — thêm:
```json
    "dev:workmgr": "npm --prefix apps/workmgr run dev:server"
```
(Chạy client Vite riêng bằng `npm --prefix apps/workmgr run dev`. Task 13 nối client.)

- [ ] **Step 4: Chạy thử — server lên (chấp nhận cảnh báo SQLite)**

Run: `node apps/workmgr/dev-server/server.js &` rồi
```bash
curl -s -X POST localhost:3100/api -H 'Content-Type: application/json' -d '{"method":"clockNow","args":[]}'
```
Expected: JSON một chuỗi ISO (clockNow trả string). In `SQLite chưa gắn`. Dừng server: `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(dev): Node dev-server HTTP /api (mô phỏng google.script.run)

Nạp src/server vào vm context với cache in-memory; POST /api {method,args} →
chạy api_* → trả envelope. Đây là 'server ngoài' thu nhỏ để verify transport HTTP.
SqliteDataStore gắn ở task sau.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: SqliteDataStore (adapter Node) + parity test

**Files:**
- Modify: `apps/workmgr/dev-server/sqlite-data-store.js`
- Test: `apps/workmgr/src/server/__tests__/datastore-parity.test.js`

**Interfaces:**
- Consumes: `better-sqlite3`, `schema.js` qua context (parity test nạp schema vào context).
- Produces: `createSqliteDataStore(db) -> DataStore` cùng hợp đồng (domain ASCII ↔ cột SQL). `createSchema(db, schemaList)` tạo bảng từ schema.

- [ ] **Step 1: Viết SqliteDataStore (Node module)**

Replace `apps/workmgr/dev-server/sqlite-data-store.js`:
```js
// SqliteDataStore — adapter DataStore trên better-sqlite3 (Node dev).
// Nhận hàm schema (domainToSqlRow/sqlRowToDomain/getSchema) từ context server đã nạp,
// để cùng nguồn schema với SheetsDataStore.
function createSqliteDataStore(db, schema) {
  // schema = { getSchema, domainToSqlRow, sqlRowToDomain }
  function _cols(collection) { return schema.getSchema(collection).fields.map(f => f.c) }
  function _table(collection) { return schema.getSchema(collection).table }
  return {
    getAll(collection) {
      const rows = db.prepare('SELECT * FROM ' + _table(collection)).all()
      return rows.map(r => schema.sqlRowToDomain(collection, r))
    },
    getVersion() { return 0 }, // SQL không cần version-cache; giữ hợp đồng
    getAllWithVersion(collection) { return { data: this.getAll(collection), version: 0 } },
    insert(collection, record) {
      const row = schema.domainToSqlRow(collection, record)
      delete row.id // để SQLite tự tăng
      const cols = Object.keys(row)
      const sql = 'INSERT INTO ' + _table(collection) + ' (' + cols.join(',') + ') VALUES (' +
        cols.map(() => '?').join(',') + ')'
      const info = db.prepare(sql).run(cols.map(c => row[c]))
      return Object.assign({ id: info.lastInsertRowid }, record, { id: info.lastInsertRowid })
    },
    update(collection, id, fields) {
      const row = schema.domainToSqlRow(collection, fields)
      delete row.id
      const cols = Object.keys(row)
      if (!cols.length) return true
      const sql = 'UPDATE ' + _table(collection) + ' SET ' + cols.map(c => c + '=?').join(',') + ' WHERE id=?'
      const info = db.prepare(sql).run([...cols.map(c => row[c]), id])
      if (info.changes === 0) throw new Error('Không tìm thấy bản ghi ID: ' + id)
      return true
    },
    remove(collection, id) {
      const info = db.prepare('DELETE FROM ' + _table(collection) + ' WHERE id=?').run(id)
      if (info.changes === 0) throw new Error('Không tìm thấy bản ghi ID: ' + id)
      return true
    },
    batch(collection, ops) {
      const self = this
      const tx = db.transaction(() => { ops.forEach(op => {
        if (op.type === 'add') self.insert(collection, op.data)
        else if (op.type === 'update') self.update(collection, op.id, op.data)
        else if (op.type === 'delete') self.remove(collection, op.id)
      }) })
      tx()
      return { success: true, count: ops.length }
    },
    ensureSchema() {},
  }
}

function createSqliteSchema(db, schema, collections) {
  collections.forEach(collection => {
    const s = schema.getSchema(collection)
    const defs = s.fields.map(f => f.c + ' ' + (f.d === 'id' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'TEXT'))
    db.prepare('CREATE TABLE IF NOT EXISTS ' + s.table + ' (' + defs.join(', ') + ')').run()
  })
}

module.exports = { createSqliteDataStore, createSqliteSchema }
```

- [ ] **Step 2: Viết parity test (cùng test trên 2 adapter)**

Create `apps/workmgr/src/server/__tests__/datastore-parity.test.js`:
```js
const { resetGAS } = require('./setup')
const Database = require('better-sqlite3')
const { createSqliteDataStore, createSqliteSchema } = require('../../../dev-server/sqlite-data-store')

// Cùng kịch bản CRUD chạy trên cả Sheets lẫn Sqlite → chứng minh hợp đồng portable.
function runContract(makeStore) {
  const ds = makeStore()
  const a = ds.insert('labels', { name: 'Bug', color: '#e53935' })
  expect(typeof a.id === 'number' || typeof a.id === 'bigint').toBe(true)
  expect(ds.getAll('labels').map(r => ({ name: r.name, color: r.color })))
    .toEqual([{ name: 'Bug', color: '#e53935' }])
  ds.update('labels', a.id, { color: '#fff' })
  expect(ds.getAll('labels')[0].color).toBe('#fff')
  ds.remove('labels', a.id)
  expect(ds.getAll('labels')).toEqual([])
}

test('SheetsDataStore tuân hợp đồng', () => {
  resetGAS()
  setDataStore(null)
  SpreadsheetApp._addSheet('Nhãn', [['ID', 'Tên nhãn', 'Màu sắc']])
  runContract(() => getDataStore())
})

test('SqliteDataStore tuân hợp đồng (cùng kịch bản)', () => {
  const db = new Database(':memory:')
  const schema = { getSchema, domainToSqlRow, sqlRowToDomain }
  createSqliteSchema(db, schema, ['labels'])
  runContract(() => createSqliteDataStore(db, schema))
})
```

- [ ] **Step 3: Chạy — PASS cả hai**

Run: `npm --prefix apps/workmgr test -- datastore-parity`
Expected: 2 passed. **Nếu fail → hợp đồng DataStore thiết kế hụt, sửa hợp đồng/adapter trước khi đi tiếp.**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(dev): SqliteDataStore + parity test (verify hợp đồng portable)

Adapter thứ 2 của DataStore trên better-sqlite3, map domain ASCII ↔ cột SQL từ
cùng schema. Parity test chạy CÙNG kịch bản CRUD trên Sheets lẫn SQLite — nếu
hợp đồng sai sẽ lòi ra ngay. Đây là phép verify thiết kế.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Gắn SqliteDataStore vào dev-server

**Files:**
- Modify: `apps/workmgr/dev-server/wire-sqlite.js`

**Interfaces:**
- Consumes: `sqlite-data-store.js` (Task 8), context đã nạp server (`getSchema`,`domainToSqlRow`,`sqlRowToDomain`,`setDataStore`).
- Produces: gắn SQLite (`workmgr-dev.sqlite`) vào factory của context; seed bảng `labels`.

- [ ] **Step 1: Cài wire-sqlite thật**

Replace `apps/workmgr/dev-server/wire-sqlite.js`:
```js
// Gắn SqliteDataStore vào context dev-server: tạo bảng + inject vào factory.
const path = require('path')
const Database = require('better-sqlite3')
const { createSqliteDataStore, createSqliteSchema } = require('./sqlite-data-store')

module.exports = function (ctx) {
  const db = new Database(path.join(__dirname, 'workmgr-dev.sqlite'))
  const schema = {
    getSchema: ctx.getSchema,
    domainToSqlRow: ctx.domainToSqlRow,
    sqlRowToDomain: ctx.sqlRowToDomain,
  }
  createSqliteSchema(db, schema, ['labels', 'activities', 'audit'])
  ctx.setDataStore(createSqliteDataStore(db, schema))
  console.log('SqliteDataStore đã gắn:', path.join(__dirname, 'workmgr-dev.sqlite'))
}
```

- [ ] **Step 2: Bỏ qua file db khỏi git**

Append vào `apps/workmgr/.gitignore` (tạo nếu chưa có):
```
dev-server/*.sqlite
```

- [ ] **Step 3: Chạy server — gắn SQLite OK**

Run: `node apps/workmgr/dev-server/server.js &` rồi
```bash
curl -s -X POST localhost:3100/api -H 'Content-Type: application/json' -d '{"method":"clockNow","args":[]}'
kill %1
```
Expected: in `SqliteDataStore đã gắn: ...workmgr-dev.sqlite`, không còn cảnh báo. (api_getLabels có ở Task 12.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(dev): gắn SqliteDataStore vào dev-server (file workmgr-dev.sqlite)

Tạo bảng từ schema + inject vào factory context. Dev-server giờ chạy trên SQLite
thật, đúng đường tương lai server ngoài + SQL.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: ActivityLog + AuditLog

**Files:**
- Modify: `apps/workmgr/src/server/domain/activity-log.js`
- Modify: `apps/workmgr/src/server/domain/audit-log.js`
- Test: `apps/workmgr/src/server/__tests__/logs.test.js`

**Interfaces:**
- Consumes: `getDataStore()`, `clockNow()`.
- Produces:
  - `logActivity(session, type, objectType, objectId, description)` → insert collection `activities`.
  - `logAudit(session, action, type, target, details)` → insert collection `audit`.
  - Best-effort: nuốt lỗi (không ném) — ghi log phụ trợ không được làm hỏng nghiệp vụ.

- [ ] **Step 1: Viết test logs**

Create `apps/workmgr/src/server/__tests__/logs.test.js`:
```js
const { resetGAS } = require('./setup')
beforeEach(() => {
  resetGAS(); setDataStore(null)
  SpreadsheetApp._addSheet('_Hoạt Động', [['ID','Loại','Mô tả','Đối tượng','Mã đối tượng','UserID','Tên người dùng','Thời gian']])
  SpreadsheetApp._addSheet('_Nhật Ký', [['ID','Thời gian','Người dùng','Email','Hành động','Loại','Đối tượng','Chi tiết']])
  setClock(() => '2026-06-29T00:00:00.000Z')
})

test('logActivity ghi 1 dòng domain ASCII', () => {
  logActivity({ userId: 7, name: 'Admin' }, 'Tạo nhãn', 'Nhãn', 3, 'Bug')
  const rows = getDataStore().getAll('activities')
  expect(rows.length).toBe(1)
  expect(rows[0]).toMatchObject({ type: 'Tạo nhãn', objectType: 'Nhãn', objectId: 3, userName: 'Admin', at: '2026-06-29T00:00:00.000Z' })
})

test('logAudit ghi 1 dòng', () => {
  logAudit({ username: 'admin', email: 'a@test.com' }, 'Phân quyền', 'Nhãn', '3', 'x')
  expect(getDataStore().getAll('audit').length).toBe(1)
})

test('lỗi datastore không làm ném (best-effort)', () => {
  setDataStore({ insert: () => { throw new Error('boom') } })
  expect(() => logActivity({ userId: 1 }, 't', 'o', 1, 'd')).not.toThrow()
})
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npm --prefix apps/workmgr test -- logs`
Expected: FAIL ("logActivity is not defined").

- [ ] **Step 3: Cài activity-log.js**

Replace `apps/workmgr/src/server/domain/activity-log.js`:
```js
// ===== ActivityLog — nhật ký hoạt động (append-only, best-effort) =====
function logActivity(session, type, objectType, objectId, description) {
  try {
    getDataStore().insert('activities', {
      type: type,
      description: description || '',
      objectType: objectType,
      objectId: objectId,
      userId: session && session.userId,
      userName: (session && session.name) || '',
      at: clockNow(),
    })
  } catch (e) { if (typeof Logger !== 'undefined') Logger.log('logActivity: ' + e.message) }
}
```

- [ ] **Step 4: Cài audit-log.js**

Replace `apps/workmgr/src/server/domain/audit-log.js`:
```js
// ===== AuditLog — nhật ký quản trị (append-only, best-effort) =====
function logAudit(session, action, type, target, details) {
  try {
    getDataStore().insert('audit', {
      at: clockNow(),
      user: (session && session.username) || 'system',
      email: (session && session.email) || '',
      action: action || '',
      type: type || '',
      target: target || '',
      details: details || '',
    })
  } catch (e) { if (typeof Logger !== 'undefined') Logger.log('logAudit: ' + e.message) }
}
```

- [ ] **Step 5: Chạy — PASS**

Run: `npm --prefix apps/workmgr test -- logs`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(domain): ActivityLog + AuditLog (append-only, best-effort)

Ghi qua DataStore bằng domain ASCII; nuốt lỗi để không làm hỏng nghiệp vụ chính.
Hạ tầng log dùng chung cho mọi service sau này.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: LabelRepository + LabelService

**Files:**
- Modify: `apps/workmgr/src/server/domain/label-repository.js`
- Modify: `apps/workmgr/src/server/services/label-service.js`
- Test: `apps/workmgr/src/server/__tests__/label-service.test.js`

**Interfaces:**
- Consumes: `getDataStore()`, `logActivity`, `requireAuth` (stub — Task 12 cung cấp ở main; ở test ta định nghĩa tạm).
- Produces:
  - `createLabelRepository() -> { list(), add(fields), update(id,fields), remove(id) }`
  - `LabelService`: `labelList(session)`, `labelAdd(session, data)`, `labelUpdate(session, id, data)`, `labelRemove(session, id)`. Service validate `name` không rỗng; ghi activity.

- [ ] **Step 1: Viết test service**

Create `apps/workmgr/src/server/__tests__/label-service.test.js`:
```js
const { resetGAS } = require('./setup')
const SESSION = { userId: 1, name: 'Admin', username: 'admin', role: 'admin' }
beforeEach(() => {
  resetGAS(); setDataStore(null)
  SpreadsheetApp._addSheet('Nhãn', [['ID', 'Tên nhãn', 'Màu sắc']])
  SpreadsheetApp._addSheet('_Hoạt Động', [['ID','Loại','Mô tả','Đối tượng','Mã đối tượng','UserID','Tên người dùng','Thời gian']])
})

test('labelAdd validate name + trả domain', () => {
  expect(() => labelAdd(SESSION, { name: '', color: '#1' })).toThrow('Tên nhãn')
  const rec = labelAdd(SESSION, { name: 'Bug', color: '#e53935' })
  expect(rec).toMatchObject({ id: 1, name: 'Bug', color: '#e53935' })
})

test('labelList / update / remove', () => {
  labelAdd(SESSION, { name: 'Bug', color: '#1' })
  expect(labelList(SESSION).length).toBe(1)
  labelUpdate(SESSION, 1, { color: '#2' })
  expect(labelList(SESSION)[0].color).toBe('#2')
  labelRemove(SESSION, 1)
  expect(labelList(SESSION)).toEqual([])
})
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npm --prefix apps/workmgr test -- label-service`
Expected: FAIL ("labelAdd is not defined").

- [ ] **Step 3: Cài label-repository.js**

Replace `apps/workmgr/src/server/domain/label-repository.js`:
```js
// ===== LabelRepository — domain Nhãn trên DataStore =====
function createLabelRepository() {
  var C = 'labels'
  return {
    list: function () { return getDataStore().getAll(C) },
    add: function (fields) { return getDataStore().insert(C, fields) },
    update: function (id, fields) { return getDataStore().update(C, id, fields) },
    remove: function (id) { return getDataStore().remove(C, id) },
  }
}
```

- [ ] **Step 4: Cài label-service.js**

Replace `apps/workmgr/src/server/services/label-service.js`:
```js
// ===== LabelService — nghiệp vụ Nhãn (thuần, không gọi GAS trực tiếp) =====
function _labelRepo() { return createLabelRepository() }

function labelList(session) { return _labelRepo().list() }

function labelAdd(session, data) {
  if (!data || !String(data.name || '').trim()) throw new Error('Tên nhãn không được để trống')
  var rec = _labelRepo().add({ name: data.name, color: data.color || '' })
  logActivity(session, 'Tạo nhãn', 'Nhãn', rec.id, rec.name)
  return rec
}

function labelUpdate(session, id, data) {
  if (data && data.name !== undefined && !String(data.name).trim()) throw new Error('Tên nhãn không được để trống')
  var ok = _labelRepo().update(id, data)
  logActivity(session, 'Cập nhật nhãn', 'Nhãn', id, (data && data.name) || '')
  return ok
}

function labelRemove(session, id) {
  var ok = _labelRepo().remove(id)
  logActivity(session, 'Xóa nhãn', 'Nhãn', id, '')
  return ok
}
```

- [ ] **Step 5: Chạy — PASS**

Run: `npm --prefix apps/workmgr test -- label-service`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(domain+service): LabelRepository + LabelService

Repository giấu DataStore sau API domain; Service validate + ghi activity, không
gọi GAS trực tiếp. Nghiệp vụ thuần, test bằng mock datastore mặc định.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Transport — doGet + _wrap + api_labels (+ requireAuth stub)

**Files:**
- Modify: `apps/workmgr/src/server/transport/main.js`
- Modify: `apps/workmgr/src/server/transport/api-labels.js`
- Test: `apps/workmgr/src/server/__tests__/label-slice.test.js`

**Interfaces:**
- Consumes: LabelService (Task 11).
- Produces:
  - `_wrap(fn) -> {success, payload}|{success:false,error}`
  - `requireAuth(token) -> session` **stub SP0**: token rỗng → ném `INVALID_SSO`; ngược lại trả session dev `{userId:0, name:'Dev', username:'dev', role:'admin'}`. (TODO SP1: thay bằng SSO thật.)
  - `api_getLabels(token)`, `api_addLabel(token,data)`, `api_updateLabel(token,id,data)`, `api_deleteLabel(token,id)`.
  - `doGet(e)` trả HtmlService (giữ tương thích GAS).

- [ ] **Step 1: Viết test lát cắt (transport envelope)**

Create `apps/workmgr/src/server/__tests__/label-slice.test.js`:
```js
const { resetGAS } = require('./setup')
beforeEach(() => {
  resetGAS(); setDataStore(null)
  SpreadsheetApp._addSheet('Nhãn', [['ID', 'Tên nhãn', 'Màu sắc']])
  SpreadsheetApp._addSheet('_Hoạt Động', [['ID','Loại','Mô tả','Đối tượng','Mã đối tượng','UserID','Tên người dùng','Thời gian']])
})

test('api_* trả envelope success + payload domain', () => {
  const add = api_addLabel('dev-token', { name: 'Bug', color: '#1' })
  expect(add).toEqual({ success: true, payload: { id: 1, name: 'Bug', color: '#1' } })
  const list = api_getLabels('dev-token')
  expect(list.success).toBe(true)
  expect(list.payload).toEqual([{ id: 1, name: 'Bug', color: '#1' }])
})

test('requireAuth stub: token rỗng → envelope lỗi', () => {
  const res = api_getLabels('')
  expect(res).toEqual({ success: false, error: 'INVALID_SSO' })
})
```

- [ ] **Step 2: Chạy — FAIL**

Run: `npm --prefix apps/workmgr test -- label-slice`
Expected: FAIL ("api_addLabel is not defined").

- [ ] **Step 3: Cài main.js (wrap + auth stub + doGet)**

Replace `apps/workmgr/src/server/transport/main.js`:
```js
// ===== Transport entry (GAS) — thin =====
function _wrap(fn) {
  try { return { success: true, payload: fn() } }
  catch (e) { return { success: false, error: (e && e.message) || String(e) || 'Lỗi không xác định' } }
}

// STUB SP0 — TODO SP1: thay bằng validate access token SSO thật.
function requireAuth(token) {
  if (!token) throw new Error('INVALID_SSO')
  return { userId: 0, name: 'Dev', username: 'dev', email: '', role: 'admin' }
}

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Quản Lý Công Việc')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}
```

- [ ] **Step 4: Cài api-labels.js**

Replace `apps/workmgr/src/server/transport/api-labels.js`:
```js
// ===== API Nhãn — ánh xạ 1-1 với api.labels phía client =====
function api_getLabels(token)            { return _wrap(function () { return labelList(requireAuth(token)) }) }
function api_addLabel(token, data)       { return _wrap(function () { return labelAdd(requireAuth(token), data) }) }
function api_updateLabel(token, id, data){ return _wrap(function () { return labelUpdate(requireAuth(token), id, data) }) }
function api_deleteLabel(token, id)      { return _wrap(function () { return labelRemove(requireAuth(token), id) }) }
```

- [ ] **Step 5: Chạy — PASS + toàn bộ test xanh**

Run: `npm --prefix apps/workmgr test`
Expected: tất cả file test passed.

- [ ] **Step 6: Verify dev-server end-to-end qua HTTP (SQLite)**

```bash
node apps/workmgr/dev-server/server.js &
sleep 1
curl -s -X POST localhost:3100/api -H 'Content-Type: application/json' -d '{"method":"api_addLabel","args":["dev-token",{"name":"Bug","color":"#e53935"}]}'
curl -s -X POST localhost:3100/api -H 'Content-Type: application/json' -d '{"method":"api_getLabels","args":["dev-token"]}'
kill %1
```
Expected: lần 1 `{"success":true,"payload":{"id":1,...}}`; lần 2 list chứa nhãn vừa thêm — **chạy thật trên SQLite**.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(transport): doGet + _wrap + api_labels (auth stub SP0)

api_* ánh xạ 1-1 hợp đồng client, gọi LabelService qua requireAuth (stub dev,
TODO SP1 thay SSO thật). Verify end-to-end qua dev-server HTTP trên SQLite.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 13: Client — apiClient + 2 transport + contract Nhãn

**Files:**
- Modify: `apps/workmgr/src/client/api/transport/gas-transport.js`
- Modify: `apps/workmgr/src/client/api/transport/http-transport.js`
- Modify: `apps/workmgr/src/client/api/contracts/labels.js`
- Modify: `apps/workmgr/src/client/api/index.js`

**Interfaces:**
- Produces:
  - `Transport`: hàm `call(method, args) -> Promise<payload>` (giải envelope; reject khi `success:false`).
  - `gasTransport` (google.script.run), `httpTransport` (fetch `localhost:3100/api`).
  - `api.labels.list()/add(data)/update(id,data)/remove(id)`.
  - `api.index`: chọn transport theo môi trường (`google.script.run` có → gas, ngược lại http).

- [ ] **Step 1: Cài gas-transport**

Replace `apps/workmgr/src/client/api/transport/gas-transport.js`:
```js
// Transport GAS — gọi google.script.run, giải envelope {success,payload}.
export function gasTransport(method, args) {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler((res) => {
        if (res && res.success) resolve(res.payload)
        else reject(new Error((res && res.error) || 'Lỗi không xác định'))
      })
      .withFailureHandler((err) => reject(new Error(err && err.message || String(err))))
      [method](...args)
  })
}
```

- [ ] **Step 2: Cài http-transport**

Replace `apps/workmgr/src/client/api/transport/http-transport.js`:
```js
// Transport HTTP — POST /api {method,args} tới dev-server (server ngoài tương lai).
const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3100/api'
export function httpTransport(method, args) {
  return fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, args }),
  })
    .then((r) => r.json())
    .then((res) => {
      if (res && res.success) return res.payload
      throw new Error((res && res.error) || 'Lỗi không xác định')
    })
}
```

- [ ] **Step 3: Cài contract labels**

Replace `apps/workmgr/src/client/api/contracts/labels.js`:
```js
// Hợp đồng domain Nhãn — không biết transport. args khớp api_* phía server.
export function makeLabels(call) {
  return {
    list: () => call('api_getLabels', ['__token__']),
    add: (data) => call('api_addLabel', ['__token__', data]),
    update: (id, data) => call('api_updateLabel', ['__token__', id, data]),
    remove: (id) => call('api_deleteLabel', ['__token__', id]),
  }
}
```
(SP0 dùng token giả `__token__`; SP1 sẽ thay bằng access token thật từ AuthContext.)

- [ ] **Step 4: Cài api/index**

Replace `apps/workmgr/src/client/api/index.js`:
```js
// Ráp `api` từ contracts + transport đã chọn theo môi trường.
import { gasTransport } from './transport/gas-transport'
import { httpTransport } from './transport/http-transport'
import { makeLabels } from './contracts/labels'

const isGas = typeof google !== 'undefined' && google.script && google.script.run
const transport = isGas ? gasTransport : httpTransport
const call = (method, args) => transport(method, args)

export const api = {
  labels: makeLabels(call),
}
export default api
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(client): apiClient + GasTransport/HttpTransport + contract Nhãn

UI gọi api.labels.* (theo domain), không chạm google.script.run/fetch. Chọn
transport theo môi trường: GAS→google.script.run, dev→HTTP dev-server. Đổi server
ngoài sau chỉ là đổi transport, contract giữ nguyên.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 14: Client — LabelManager UI nối api.labels + chạy thật

**Files:**
- Modify: `apps/workmgr/src/client/components/labels/LabelManager.jsx`
- Create (nếu thiếu cho Vite chạy): `apps/workmgr/src/client/main.jsx`, `apps/workmgr/src/client/App.jsx`, `apps/workmgr/src/client/index.html` (tối thiểu render LabelManager)

**Interfaces:**
- Consumes: `api.labels` (Task 13).
- Produces: trang quản lý Nhãn tối thiểu (list + thêm + xóa) chạy trên Vite dev → HttpTransport → dev-server → SQLite.

- [ ] **Step 1: Cài LabelManager**

Replace `apps/workmgr/src/client/components/labels/LabelManager.jsx`:
```jsx
import { useEffect, useState } from 'react'
import api from '../../api'

export default function LabelManager() {
  const [labels, setLabels] = useState([])
  const [name, setName] = useState('')
  const [color, setColor] = useState('#1e88e5')
  const [err, setErr] = useState('')

  async function load() {
    try { setLabels(await api.labels.list()) } catch (e) { setErr(e.message) }
  }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    setErr('')
    try { await api.labels.add({ name, color }); setName(''); await load() }
    catch (e) { setErr(e.message) }
  }
  async function remove(id) {
    try { await api.labels.remove(id); await load() } catch (e) { setErr(e.message) }
  }

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h2>Quản lý Nhãn</h2>
      {err && <p style={{ color: 'red' }}>{err}</p>}
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên nhãn" />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button type="submit">Thêm</button>
      </form>
      <ul>
        {labels.map((l) => (
          <li key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 14, height: 14, background: l.color, display: 'inline-block', borderRadius: 3 }} />
            {l.name}
            <button onClick={() => remove(l.id)} style={{ marginLeft: 'auto' }}>Xóa</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Cài entry tối thiểu cho Vite**

Create `apps/workmgr/src/client/App.jsx`:
```jsx
import LabelManager from './components/labels/LabelManager'
export default function App() { return <LabelManager /> }
```
Create `apps/workmgr/src/client/main.jsx`:
```jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
createRoot(document.getElementById('root')).render(<App />)
```
Create `apps/workmgr/src/client/index.html`:
```html
<!doctype html>
<html lang="vi">
  <head><meta charset="utf-8" /><title>Quản Lý Công Việc</title></head>
  <body><div id="root"></div><script type="module" src="/src/client/main.jsx"></script></body>
</html>
```
(Kiểm tra `apps/workmgr/vite.config.js` trỏ `root`/entry đúng `src/client/index.html`; chỉnh nếu cần để Vite tìm thấy entry.)

- [ ] **Step 3: Chạy thật end-to-end (client + dev-server + SQLite)**

```bash
node apps/workmgr/dev-server/server.js &
npm --prefix apps/workmgr run dev &
```
Mở `http://localhost:5173` (cổng Vite). Thêm 1 nhãn → thấy xuất hiện; reload trang → vẫn còn (đã lưu SQLite). Xóa → biến mất.
Dừng: `kill %1 %2`.
Expected: CRUD Nhãn hoạt động qua HttpTransport → dev-server → SQLite.

- [ ] **Step 4: Verify build GAS không chứa gas-core / sqlite**

```bash
npm --prefix apps/workmgr run build:server
grep -c "gas-core/" apps/workmgr/dist/gas/Code.js
grep -c "better-sqlite3" apps/workmgr/dist/gas/Code.js
grep -rn "SpreadsheetApp" apps/workmgr/src/server | grep -v "core/sheets-data-store.js" | grep -v "core/config.js"
```
Expected: hai `grep -c` in `0`; `grep -rn` không in dòng nào (SpreadsheetApp chỉ ở adapter/config).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(client): LabelManager nối api.labels — chạy thật trên SQLite

Trang Nhãn tối thiểu (list/thêm/xóa) đi xuyên UI→api.labels→HttpTransport→
dev-server→SQLite. Lát cắt dọc SP0 hoàn tất: cùng Service/Repository/contract
chạy trên cả Sheets (GAS) lẫn SQLite (local).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (đã chạy)

**1. Spec coverage:**
- Build self-contained (bỏ gas-core) → Task 1. ✓
- DataStore + SheetsDataStore + SqliteDataStore + factory → Task 5/6/8/9. ✓
- schema ASCII ↔ storage → Task 3. ✓
- Clock/Cache seam → Task 4. ✓
- Node dev-server + HttpTransport → Task 7/9/13. ✓
- ActivityLog/AuditLog → Task 10. ✓
- Lát cắt Nhãn end-to-end 2 đường + parity → Task 6/8/11/12/14. ✓
- Client transport seam (Gas/Http) + contract → Task 13. ✓
- Tiêu chí grep/no-gas-core/no-sqlite → Task 14 Step 4. ✓

**2. Placeholder scan:** không còn TODO mơ hồ; "stub" của requireAuth là chủ ý SP0 (đánh dấu TODO SP1), code đầy đủ.

**3. Type consistency:** DataStore methods (`getAll/getVersion/getAllWithVersion/insert/update/remove/batch/ensureSchema`) đồng nhất giữa Sheets (Task 6) và Sqlite (Task 8); service gọi `labelList/labelAdd/labelUpdate/labelRemove` khớp `api_*` (Task 12) và contract client (Task 13); schema helper names (`domainToSheet/sheetToDomain/domainToSqlRow/sqlRowToDomain/getSchema/sheetHeaders`) dùng nhất quán Task 3/6/8.

**Lưu ý thực thi:** Task 5 Step 4 chỉ chạy test "inject" (nhánh default cần Task 6); chạy lại đầy đủ ở Task 6 Step 4.
