# Thiết kế: Build lại app `workmgr` theo SOLID, portable sang server riêng + SQL

- **Ngày:** 2026-06-29
- **Trạng thái:** Đã duyệt thiết kế (kiến trúc + phân rã + SP0), chờ user review spec → ghi plan SP0
- **Người yêu cầu:** Van Huyen Vu

## 1. Mục tiêu

Dựng lại app `workmgr` (Quản Lý Công Việc) bằng **chuỗi commit nhỏ, dễ review**, theo kiến trúc **SOLID** và **abstract tối đa** để tương lai gần:

1. **Tách runtime** — chuyển code chạy trên 1 **server riêng** (Node/HTTP) thay vì Google Apps Script.
2. **Đổi database** — bỏ Google Sheets, dùng **SQL** (Postgres / MySQL / SQLite).

Yêu cầu cốt lõi: khi chuyển, **sửa tối thiểu** — chủ yếu viết adapter mới + đổi điểm cấu hình, không đụng nghiệp vụ và UI.

## 2. Quyết định đã chốt (trong brainstorm)

| # | Quyết định | Lựa chọn |
|---|---|---|
| 1 | Cách build lại | **Viết mới từ đầu, lịch sử commit sạch**; lấy *bộ tính năng* từ `src/` hiện tại làm chuẩn nghiệp vụ. |
| 2 | Độ sâu abstraction hiện tại | **Seam-only** — chạy trên GAS như hiện nay, nhưng nghiệp vụ + truy xuất dữ liệu nằm sau interface; không viết Node server cho production ngay. |
| 3 | Nơi code sống | **Nhánh mới + worktree riêng** (`workmgr-rebuild` tại `../Appscripts-workmgr`), cô lập khỏi `master`. |
| 4 | Phạm vi build lại | **Cả server lẫn client**; hợp đồng client–server đi cùng nhau (đổi transport sau không phải sửa UI). |
| 5 | Kiểu kiến trúc | **Phương án A** — Repository theo domain + `DataStore` mỏng. |
| 6 | `gas-core` | **Không đụng** `gas-core` (giữ docmgr/sso nguyên). Phần nào cần dùng thì **copy ra app workmgr, refactor lại SOLID** đặt sau seam. App workmgr **self-contained**. |
| 7 | DB cho local dev | **Thêm SQLite** chạy ở local dev (Node) — vừa tiện test, vừa là phép **verify** thiết kế (adapter thứ 2 cùng hợp đồng `DataStore`). |
| 8 | Domain field naming | **ASCII chuẩn** (`{id, name, color, title, status…}`); mỗi adapter tự ánh xạ sang lưu trữ của nó (header VN của sheet, cột SQL). |

## 3. Bộ tính năng cần đạt (nguồn: `apps/workmgr/src/server`)

- **Công việc (Task):** CRUD theo phòng ban (sheet `CV_<deptId>`), Kanban chuyển trạng thái có luật, tiến độ %, subtasks, nhãn, archive theo thời gian, `_TaskIndex` (denormalized) cho dashboard nhanh.
- **Lịch (Schedule):** đăng ký công tác/họp, workflow duyệt 2 cấp (Nhân viên → Trưởng/Phó phòng → Giám đốc), email thông báo.
- **Bình luận, Hoạt động (activity log), Nhật ký (audit log), Nhãn.**
- **Phòng ban & Người dùng:** đọc từ SSO parent (`_Phòng Ban`, `_Phân Bổ`, `_Người Dùng`) + phân quyền cục bộ (`_Phân Quyền`).
- **Xuyên suốt:** auth SSO (access/refresh token, epoch), phân quyền theo vai trò + CRUD theo resource + luật theo phòng ban, cache, dashboard thống kê.

## 4. Kiến trúc tổng quan (Phương án A)

```
UI React (pages/components)  — KHÔNG gọi google.script.run / fetch trực tiếp
   │  gọi  api.tasks.list(filters) / api.schedules.approve(id) …  (hợp đồng thuần theo domain)
   ▼
apiClient ── adapter ──► GasTransport (google.script.run)    [local dev: HttpTransport (fetch)]
   ▼  (cùng một hợp đồng api.*  ⇄  hàm api_* phía server)
Transport server: doGet + api_* (thin) + _wrap
   ▼
Service (TaskService, ScheduleService, LabelService…) — nghiệp vụ THUẦN, không gọi GAS API
   ▼  phụ thuộc interface
Repository theo domain (TaskRepository, ScheduleRepository, UserDirectory, DepartmentDirectory,
                        CommentRepository, LabelRepository, ActivityLog, AuditLog)
   ▼
DataStore(interface) → SheetsDataStore   Storage → DriveStorage   Identity → SsoProvider   Notifier → MailNotifier
   │                  [tương lai: SqlDataStore]        [S3/GCS]            [JWT/SQL]              [SMTP/Queue]
   ▼
Google APIs (SpreadsheetApp/Sheets, DriveApp, MailApp, CacheService) | (local dev: SQLite, in-memory cache)
```

### 4.1 Các seam (điểm hoán đổi tương lai)

| Seam | Hợp đồng | Adapter hiện tại | Tương lai |
|---|---|---|---|
| Dữ liệu bảng | `DataStore` — `getAll/getAllWithVersion/getVersion/insert/update/remove/batch/ensureSchema` theo *collection* | `SheetsDataStore` (+ `SqliteDataStore` ở local dev) | `SqlDataStore` (Postgres/MySQL) |
| File đính kèm | `Storage` — `saveFile/deleteFile/getUrl` | `DriveStorage` | `S3/GcsStorage` |
| Danh tính | `IdentityProvider` — `validateToken/getUser`, đọc directory | `SsoProvider` (cross-script) | `JwtProvider`/SQL |
| Thông báo | `Notifier` — `send(to, subject, body)` | `MailNotifier` (MailApp) | `Smtp/QueueNotifier` |
| Phụ trợ test | `Clock` (now), `Cache` | GAS impl | Node impl |
| Transport (client) | `Transport.call(method, args)` | `GasTransport` | `HttpTransport` |

- **Repository** nói ngôn ngữ domain, **giấu** chi tiết lưu trữ. Ví dụ: Task lưu mỗi-phòng-1-sheet `CV_<id>`; `TaskRepository.findByDept(deptId)` ẩn điều đó — tương lai SQL chỉ là `WHERE dept_id = ?`, Service không hề biết.
- **Factory** là nơi duy nhất `new` adapter cụ thể; có default (Sheets) và **điểm inject** (cho test/dev/SQLite).

### 4.2 Domain model chuẩn hoá (quyết định #8)

- Domain object dùng **field ASCII** (`id`, `name`, `color`, `title`, `status`, `priority`, `deptId`, `assigneeId`…).
- `core/schema.js` là **REGISTRY**: mỗi collection khai báo field domain + cách map sang từng lưu trữ:
  - sang **header sheet** tiếng Việt (cho `SheetsDataStore`),
  - sang **cột SQL** ascii + DDL (cho `SqliteDataStore`/SQL tương lai).
- Mọi tên cột VN/SQL chỉ tồn tại **bên trong adapter**; Service/Repo/client chỉ thấy field ASCII. Đây là điểm SQLite ép phải làm đúng — và là tiêu chí verify.

## 5. Phân rã sub-project

Mỗi SP = 1 chu kỳ **spec → plan → build** riêng, commit nhỏ. Sau mỗi SP có app chạy được + test xanh.

| SP | Tên | Nội dung chính | Chứng minh |
|---|---|---|---|
| **SP0** | Móng & seam lõi | Branch+worktree, build self-contained (bỏ gas-core), test harness. `DataStore`+`SheetsDataStore`+`SqliteDataStore`, `schema.js`, `Clock`/`Cache`, factory. Node dev-server + `HttpTransport`. `ActivityLog`/`AuditLog`. | **Lát cắt dọc Nhãn (Labels)** chạy end-to-end trên CẢ Sheets (GAS) lẫn SQLite (local) + test xanh |
| **SP1** | Danh tính & phân quyền | `IdentityProvider` (copy+refactor sso/access-token/refresh-token/epoch/auth-core), phân quyền cục bộ (`_Phân Quyền`), session/token | Login/resume/logout chạy thật |
| **SP2** | Directory | `UserDirectory` + `DepartmentDirectory` (đọc SSO parent now → SQL sau) | Quản lý người dùng + đọc phòng ban |
| **SP3** | Công việc | `TaskRepository` (giấu per-dept sheet), `TaskService` (luật trạng thái/tiến độ/quyền), index, archive, Comments, Dashboard | TaskList/Kanban/Timeline/Detail/Dashboard |
| **SP4** | Lịch | `ScheduleService` (workflow duyệt), `Notifier` seam (Mail), `Storage` seam (file đính kèm) | Schedule/Calendar + email |

## 6. SP0 — Thiết kế chi tiết

### 6.1 Cấu trúc thư mục

```
apps/workmgr/
  src/server/                    # plain-JS — chạy CẢ GAS (concat) lẫn Node (nạp vào vm context)
    app-config.js                # danh sách collection, hằng số app
    core/
      schema.js                  # REGISTRY: collection → field ASCII + map header sheet (VN) + map/DDL SQL
      config.js                  # getCentralSheet, script properties  (chỉ GAS gọi)
      cache.js                   # Cache seam (GAS CacheService; Node inject in-memory)
      clock.js                   # Clock seam (now)
      data-store.js              # HỢP ĐỒNG DataStore + factory (default Sheets + điểm inject)
      sheets-data-store.js       # SheetsDataStore: domain(ASCII) ↔ header sheet(VN) qua schema
    domain/
      label-repository.js        # LabelRepository trên DataStore
      activity-log.js            # ActivityLog (append-only)
      audit-log.js               # AuditLog (append-only)
    services/
      label-service.js           # LabelService — nghiệp vụ thuần
    transport/
      main.js                    # doGet + _wrap (thin)
      api-labels.js              # api_getLabels/api_addLabel/api_updateLabel/api_deleteLabel
  dev-server/                    # NODE-ONLY — KHÔNG vào bundle GAS
    server.js                    # HTTP: nạp src/server vào context + Node globals + inject SqliteDataStore → route api.*
    sqlite-data-store.js         # SqliteDataStore (better-sqlite3), cùng hợp đồng, domain ↔ cột SQL
    schema.sql                   # tạo bảng sinh từ schema.js
  src/client/api/
    index.js                     # ráp `api` từ contracts + transport đã chọn
    transport/gas-transport.js   # google.script.run (prod)
    transport/http-transport.js  # fetch → dev-server (local)
    contracts/labels.js          # api.labels.{list,add,update,remove}
  src/client/components/labels/LabelManager.jsx
```

### 6.2 Hợp đồng `DataStore` (collection-oriented)

- `getAll(collection) -> Object[]` (domain object ASCII)
- `getAllWithVersion(collection) -> {data, version}` / `getVersion(collection) -> number`
- `insert(collection, record) -> record` (gán `id` trong adapter)
- `update(collection, id, fields) -> boolean`
- `remove(collection, id) -> boolean`
- `batch(collection, ops)` , `ensureSchema(defs)` (Sheets: đảm bảo cột; SQL: migration/no-op)

`SheetsDataStore` bọc logic sheets-crud cũ (lock, cache, rowsToObjects/objectToRow, versioning) + dùng `schema.js` map ASCII ↔ header VN. `SqliteDataStore` cài cùng hợp đồng trên `better-sqlite3`, map ASCII ↔ cột SQL.

### 6.3 Lát cắt dọc Nhãn — verify hai đường

- **GAS prod:** UI → `api.labels` → GasTransport → `api_getLabels` → LabelService → LabelRepository → DataStore=**Sheets** → sheet `Nhãn`.
- **Local dev:** UI → `api.labels` → HttpTransport → route Node → *cùng* LabelService/Repository → DataStore=**SQLite** → file `.sqlite`.
- Cùng một Service/Repository/contract; chỉ khác transport + adapter.
- **Auth tạm:** SP0 dùng `requireAuth` stub (token bất kỳ → session dev), đánh dấu TODO → SP1 thay bằng SSO thật. Giữ SP0 tập trung vào seam dữ liệu.

### 6.4 Một bộ file server chạy 2 runtime

- GAS: `bundle-server.js` concat (đã **opt-out gas-core** cho workmgr — chỉ gộp file của app).
- Node (dev-server + jest): nạp đúng các file `src/server` vào 1 context, cấp Node globals (cache in-memory, clock) và **inject** `SqliteDataStore` vào factory. `SheetsDataStore` không bị gọi → `SpreadsheetApp` không cần tồn tại lúc chạy (chỉ tham chiếu trong thân hàm, không lỗi lúc nạp).
- `better-sqlite3` Node-only, nằm ở `dev-server/`, không lọt bundle GAS.

### 6.5 Thay đổi build & test

- `scripts/bundle-server.js`: thêm cơ chế opt-out gas-core (app khai báo self-contained → bỏ qua `GAS_CORE_FILES`).
- Jest harness riêng cho workmgr (nạp file server vào vm + mock GAS) — kèm **parity test**: cùng bộ test CRUD chạy trên cả `SheetsDataStore` (mock) lẫn `SqliteDataStore`.
- `package.json`: script `dev:workmgr` chạy client (Vite) + Node dev-server + SQLite.

### 6.6 Chuỗi commit SP0 (~15 commit nhỏ, ≤10 file/commit, message tiếng Việt)

1. `chore`: tạo branch + worktree + build self-contained (opt-out gas-core)
2. `chore(test)`: jest harness + mock GAS cho workmgr
3. `feat(core)`: schema registry (domain ASCII ↔ storage map) + app-config
4. `feat(core)`: config + cache seam + clock
5. `feat(core)`: hợp đồng DataStore + factory (default Sheets + điểm inject)
6. `feat(core)`: SheetsDataStore (domain ↔ header VN qua schema)
7. `test(core)`: test SheetsDataStore
8. `feat(dev)`: Node dev-server skeleton (nạp context + HTTP)
9. `feat(dev)`: SqliteDataStore + schema.sql + inject vào factory
10. `test(core)`: parity test trên SqliteDataStore
11. `feat(domain)`: ActivityLog + AuditLog
12. `feat(domain+service)`: LabelRepository + LabelService
13. `feat(transport)`: doGet + _wrap + api_labels (GAS) + route mapping (Node)
14. `feat(client)`: api contract + GasTransport + HttpTransport
15. `feat(client)`: LabelManager UI nối api.labels

### 6.7 Tiêu chí thành công SP0

- Build GAS workmgr **không** chứa gas-core / `better-sqlite3`; chỉ file app.
- `npm run dev:workmgr` chạy client + Node dev-server + SQLite; **Nhãn CRUD chạy thật trên SQLite**.
- Cùng `LabelService`/`LabelRepository` **pass test trên cả** SheetsDataStore lẫn SqliteDataStore (parity).
- LabelManager render + CRUD được qua `api.labels` (HttpTransport ở dev).
- Grep: không tên cột VN/SQL rò rỉ ngoài adapter; không `SpreadsheetApp` ngoài `core/sheets-data-store.js` (+ `core/config.js`).
- Mỗi commit ≤10 file, build/đọc độc lập.

## 7. Rủi ro & giảm thiểu

- **Hợp đồng DataStore thiết kế hụt:** chính việc viết `SqliteDataStore` song song trong SP0 phơi bày sớm; sửa hợp đồng khi còn rẻ (chỉ Labels).
- **2 runtime lệch hành vi:** parity test bắt buộc cho mọi adapter DataStore.
- **Phình scope client:** SP0 chỉ làm LabelManager + lớp transport; UI còn lại theo SP sau.
- **Đụng độ tên hàm GAS (global scope):** giữ quy ước module = file + factory function; tránh trùng tên với gas-core (đã không gộp gas-core nữa).
- **Copy gas-core gây drift với bản gốc:** chấp nhận — workmgr cố ý fork để portable; ghi chú nguồn copy trong mỗi file.

## 8. Không làm (YAGNI)

- Không viết adapter Postgres/MySQL thật (chỉ SQLite cho dev + để chỗ cắm).
- Không Node server cho **production** ở giai đoạn này (chỉ dev-server local).
- Không DI container/service locator — factory + inject thủ công là đủ.
- Không đụng `gas-core`, docmgr, sso-portal, license-server.
- Không refactor sớm những gì SP sau mới cần (Identity, Task, Schedule…).

---

## 9. Sửa đổi v2 (2026-06-30) — sau review của user trên SP0 v1

SP0 v1 (plain JS, 16 commit, test 21/21, parity Sheets↔SQLite đạt) đã build xong và được user review. User góp ý 3 điểm kiến trúc; sau khi đánh giá kỹ thuật + verify code, **chấp nhận cả 3** và chuyển kiến trúc sang v2. SP0 v1 giữ làm tham chiếu (lịch sử git + nhánh).

### 9.1 Ba thay đổi

1. **TypeScript toàn bộ** (server, dev-server, client).
   - Type hoá các *port*: `DataStore`, `Storage`, `Cache`, `Clock`, domain models, kiểu field trong schema → bắt lỗi mapping lúc compile (đúng loại bug "số ↔ string" gặp ở SP0 v1 Task 8).
   - **Build GAS:** `esbuild` bundle TS ESM → **1 file IIFE**; entrypoint (`doGet`, `api_*`) gán vào `globalThis` để GAS gọi được. **Đã spike chứng minh chạy** (target es2019 = GAS V8). esbuild lo transpile/bundle (không type-check).
   - **Type-check:** `tsc --noEmit` riêng (thêm devDep `typescript` + `@types/google-apps-script`).
   - Client + dev-server: TS chạy tự nhiên qua Vite/tsx.

2. **Module thật thay bộ máy global-scope.** Bỏ `server-files.js`, `server-runtime.js`, nạp `vm`-context. Phụ thuộc giữa file bằng `import` thật. Test = `import` bình thường (jest + esbuild transform). Dev-server import thẳng composition root. → Gọn hơn nhiều, ít "ma thuật".

3. **Cache là decorator (SRP — góp ý P2).** `CachingDataStore implements DataStore` bọc *bất kỳ* `DataStore`, tự lo read-cache + version + invalidation. Adapter (`SheetsDataStore`, `SqliteDataStore`) chỉ còn **I/O thuần**. Composition root ghép: GAS = `new CachingDataStore(new SheetsDataStore(...))`; SQLite không bọc (local nhanh). "Cache là 1 storage bọc ngoài" — đúng như user nói.
   - *Đã verify SP0 v1:* Repository đã sạch (không gọi cache), Service đã tách riêng — chỗ bẩn duy nhất là adapter ôm cache. v2 sửa đúng chỗ đó.

### 9.2 Cấu trúc hexagonal (góp ý P3 — tách code đặc thù platform)

```
apps/workmgr/src/
  core/                 # THUẦN — 0 import platform
    ports/              #   DataStore.ts, Storage.ts, Cache.ts, Clock.ts (interface)
    domain/             #   models (Label, Activity, Audit…) + repositories (LabelRepository…)
    services/           #   LabelService… (nghiệp vụ thuần, phụ thuộc port)
    schema.ts           #   registry field ASCII ↔ storage, có kiểu
    caching-data-store.ts  # decorator (bọc DataStore bất kỳ)
  adapters/
    gas/                # sheets-data-store.ts, gas-cache.ts, gas-config.ts (SpreadsheetApp/Properties/CacheService)
    sqlite/             # sqlite-data-store.ts (better-sqlite3, Node)
    http/               # (tương lai)
  composition/          # root nối port→adapter theo runtime
    gas.ts              #   CachingDataStore(SheetsDataStore) + MailNotifier…
    node.ts             #   SqliteDataStore… (cho dev-server + test parity)
  transport/
    gas-entry.ts        # doGet + api_* → gán globalThis (entry bundle GAS)
  client/               # React + TS, api/ contract + transport (Gas/Http)
build/
  bundle-gas.ts|js      # esbuild bundle transport/gas-entry → dist/gas/Code.js (thay bundle-server cho workmgr)
```

Repository + Service trong `core/` chỉ phụ thuộc **interface** trong `core/ports/`. Code platform chỉ nằm trong `adapters/`. Tương lai server thật = thêm `adapters/postgres/` + `adapters/http/` + `composition/server.ts`, **không đụng core**.

### 9.3 Test model v2
- jest + transform esbuild (hoặc ts-jest) — `import` thật, không vm-concat.
- **Contract/parity test:** một bộ test cho hợp đồng `DataStore`, chạy với CẢ `SheetsDataStore` (mock SpreadsheetApp) lẫn `SqliteDataStore` (better-sqlite3 in-memory) — giữ tinh thần verify của v1.
- Unit-test core bằng fake adapter in-memory (nhanh, không cần GAS mock).

### 9.4 Tiêu chí thành công SP0 v2
- `tsc --noEmit` sạch (type-safe toàn bộ).
- `esbuild` bundle ra `dist/gas/Code.js` 1 file; `doGet`/`api_*` là global; **0** gas-core, **0** better-sqlite3 trong bundle.
- Parity test xanh trên cả 2 adapter; lát cắt Nhãn e2e chạy thật trên SQLite qua dev-server.
- `core/` không import gì từ `adapters/` hay GAS/SQLite (kiểm bằng lint/grep) — chứng minh hexagonal kín.
- Adapter không gọi cache (cache chỉ ở `CachingDataStore`).
- Commit nhỏ, dễ review.

### 9.5 Lưu ý chuyển tiếp
- SP1–SP4 không đổi về phạm vi tính năng; chỉ kế thừa cấu trúc v2 (port/adapter/composition + TS).
- SP0 v1 (commit `6dba3b6..2d67ce5`) giữ trong lịch sử nhánh làm tham chiếu; v2 build đè bằng commit mới.
