# Workmgr SP0 v2 — TypeScript + Hexagonal + Cache Decorator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Làm lại móng SP0 bằng TypeScript, cấu trúc hexagonal (core/ports + adapters), cache tách thành decorator; giữ lát cắt Nhãn chạy trên cả Sheets (GAS) lẫn SQLite (Node), build GAS bằng esbuild.

**Architecture:** Xem spec §9. `core/` thuần (ports = interface, domain, services, schema, CachingDataStore) — không import platform. `adapters/gas` + `adapters/sqlite` cài port. `composition/` nối port→adapter theo runtime. `transport/gas-entry.ts` lộ `doGet`/`api_*` ra global. esbuild bundle TS→1 file GAS; `tsc --noEmit` type-check; jest + esbuild transform test bằng `import` thật.

**Tech Stack:** TypeScript, esbuild (đã có, 0.25.12), better-sqlite3 (Node dev), React+Vite (client), jest + @swc/jest hoặc esbuild-jest.

## Global Constraints
- **TypeScript strict** (`"strict": true`); không `any` trừ ranh giới GAS không tránh được (chú thích lý do).
- `core/**` **không được import** từ `adapters/**`, `composition/**`, hay GAS/better-sqlite3. Phụ thuộc chỉ qua `core/ports/*` (interface). (Kiểm bằng grep/lint ở task cuối.)
- Adapter **không gọi cache**; cache chỉ ở `core/caching-data-store.ts`.
- Domain object field **ASCII**; tên cột VN(sheet)/SQL chỉ trong `schema.ts` + adapter.
- Commit nhỏ (≤10 file), message tiếng Việt what+why, kết `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Chỉ đụng `apps/workmgr` (+ root devDeps nếu cần). Không đụng gas-core/docmgr/sso/license.
- Mọi lệnh chạy trong worktree `/Users/vanhuyen.vu/Documents/Vuhu/Projects/Appscripts-workmgr`, nhánh `workmgr-rebuild`.
- **Nguồn logic tham chiếu:** SP0 v1 đã build (cùng worktree, commit `6dba3b6..2d67ce5`) — port logic từ các file JS tương ứng, KHÔNG nghĩ lại từ đầu; chỉ thêm kiểu + đổi cấu trúc + tách cache.

---

## File Structure (đích v2)
```
apps/workmgr/
  tsconfig.json                         # strict, target es2019, moduleResolution bundler
  jest.config.cjs                       # transform esbuild, testMatch core+adapters
  build/bundle-gas.mjs                  # esbuild bundle transport/gas-entry → dist/gas/Code.js
  src/
    core/
      ports/data-store.ts               # interface DataStore + types (Collection, Record domain)
      ports/cache.ts                    # interface Cache
      ports/clock.ts                    # interface Clock
      domain/models.ts                  # Label, Activity, Audit types
      schema.ts                         # registry có kiểu + mappers
      caching-data-store.ts             # decorator implements DataStore
      domain/label-repository.ts
      domain/activity-log.ts
      domain/audit-log.ts
      services/label-service.ts
    adapters/
      gas/sheets-data-store.ts          # implements DataStore — I/O thuần (no cache)
      gas/gas-cache.ts                  # implements Cache (CacheService)
      gas/gas-config.ts                 # getCentralSheet/props (SpreadsheetApp)
      sqlite/sqlite-data-store.ts       # implements DataStore (better-sqlite3)
      sqlite/sqlite-schema.ts           # createTables từ schema
    composition/gas.ts                  # makeDataStore()=Caching(Sheets); clock…
    composition/node.ts                 # makeSqliteDataStore(db)
    transport/gas-entry.ts             # _wrap, requireAuth stub, doGet, api_*, gán globalThis
    client/api/...                      # (TS hoá ở task client)
    client/components/labels/LabelManager.tsx
  dev-server/server.ts                  # import composition/node + http dispatch api_*
  __tests__/...                         # *.test.ts dùng import thật
```
v1 cũ (`src/server/**`, `server-files.js`, `server-runtime.js`, `dev-server/*.js`) bị thay; xoá khi task tương ứng hoàn tất.

---

## Task 1: TS toolchain + esbuild GAS build (spike → thật)

**Files:** Create `apps/workmgr/tsconfig.json`, `apps/workmgr/build/bundle-gas.mjs`, `apps/workmgr/src/transport/gas-entry.ts` (tạm), root `package.json` (devDeps), `apps/workmgr/package.json` (scripts). Modify `scripts/bundle-server.js` không cần (workmgr dùng build riêng).

**Interfaces — Produces:** `npm --prefix apps/workmgr run build:gas` → `dist/gas/Code.js` (IIFE) với global `doGet`; `npm --prefix apps/workmgr run typecheck` (`tsc --noEmit`).

- [ ] **Step 1: Thêm devDeps**
Run (worktree root): `npm i -D -w apps/workmgr typescript @types/google-apps-script better-sqlite3 @types/better-sqlite3 esbuild` (esbuild có thể đã có ở root; thêm vào workmgr cho chắc). `npm i -D @swc/jest` ở root nếu dùng (Task 2 chốt transform).

- [ ] **Step 2: tsconfig.json**
Create `apps/workmgr/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es2019",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["google-apps-script", "node", "jest"],
    "noEmit": true
  },
  "include": ["src", "dev-server", "build", "__tests__"]
}
```

- [ ] **Step 3: gas-entry tạm (chứng minh global)**
Create `apps/workmgr/src/transport/gas-entry.ts`:
```ts
function doGet(): string { return 'workmgr' }
;(globalThis as any).doGet = doGet
```

- [ ] **Step 4: esbuild bundle script**
Create `apps/workmgr/build/bundle-gas.mjs`:
```js
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
await build({
  entryPoints: [resolve(root, 'src/transport/gas-entry.ts')],
  bundle: true, format: 'iife', target: 'es2019',
  outfile: resolve(root, 'dist/gas/Code.js'), legalComments: 'none',
})
console.log('GAS bundle: dist/gas/Code.js')
```

- [ ] **Step 5: scripts**
Edit `apps/workmgr/package.json` scripts: add `"typecheck": "tsc --noEmit"`, `"build:gas": "node build/bundle-gas.mjs"`. Add `apps/workmgr/dist/` to `apps/workmgr/.gitignore`.

- [ ] **Step 6: Verify**
Run: `npm --prefix apps/workmgr run build:gas` then
`node -e "const vm=require('vm'),fs=require('fs');const c=vm.createContext({});vm.runInContext(fs.readFileSync('apps/workmgr/dist/gas/Code.js','utf8'),c);console.log(typeof c.doGet==='function'?'global OK':'FAIL')"`
Expected: `global OK`. Run `npm --prefix apps/workmgr run typecheck` → no errors.

- [ ] **Step 7: Commit**
`chore(workmgr): toolchain TS + esbuild bundle GAS (lộ entry ra global)`

---

## Task 2: Jest (module thật) + core ports + domain types

**Files:** Create `apps/workmgr/jest.config.cjs`, `src/core/ports/data-store.ts`, `src/core/ports/cache.ts`, `src/core/ports/clock.ts`, `src/core/domain/models.ts`, `__tests__/smoke.test.ts`.

**Produces:**
- `DataStore` interface: `getAll(c): DomainRecord[]`, `getAllWithVersion(c): {data, version}`, `getVersion(c): number`, `insert(c, rec): DomainRecord`, `update(c, id, fields): boolean`, `remove(c, id): boolean`, `batch(c, ops): {success, count}`.
- `Cache` interface: `get<T>(k): T|null`, `put<T>(k, v, ttl?): void`, `remove(k): void`.
- `Clock` interface: `now(): string`.
- Domain types `Label`, `Activity`, `Audit`, alias `DomainRecord = Record<string, unknown>`, `Collection = 'labels'|'activities'|'audit'`.

- [ ] **Step 1: jest config (esbuild transform)**
Create `apps/workmgr/jest.config.cjs`:
```js
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.ts$': ['@swc/jest'] },
}
```
(Nếu `@swc/jest` chưa cài thì cài; hoặc dùng `esbuild-jest`. Chọn @swc/jest.)

- [ ] **Step 2: ports**
Create `src/core/ports/data-store.ts`:
```ts
export type DomainRecord = Record<string, unknown>
export type Collection = 'labels' | 'activities' | 'audit'
export type BatchOp =
  | { type: 'add'; data: DomainRecord }
  | { type: 'update'; id: string | number; data: DomainRecord }
  | { type: 'delete'; id: string | number }
export interface DataStore {
  getAll(c: Collection): DomainRecord[]
  getVersion(c: Collection): number
  getAllWithVersion(c: Collection): { data: DomainRecord[]; version: number }
  insert(c: Collection, rec: DomainRecord): DomainRecord
  update(c: Collection, id: string | number, fields: DomainRecord): boolean
  remove(c: Collection, id: string | number): boolean
  batch(c: Collection, ops: BatchOp[]): { success: boolean; count: number }
}
```
Create `src/core/ports/cache.ts`:
```ts
export interface Cache {
  get<T = unknown>(key: string): T | null
  put<T = unknown>(key: string, value: T, ttlSeconds?: number): void
  remove(key: string): void
}
```
Create `src/core/ports/clock.ts`:
```ts
export interface Clock { now(): string }
```

- [ ] **Step 3: domain models**
Create `src/core/domain/models.ts`:
```ts
export interface Label { id: number; name: string; color: string }
export interface Activity {
  id: number; type: string; description: string; objectType: string
  objectId: string | number; userId: string | number; userName: string; at: string
}
export interface Audit {
  id: number; at: string; user: string; email: string
  action: string; type: string; target: string; details: string
}
```

- [ ] **Step 4: smoke test (import thật)**
Create `__tests__/smoke.test.ts`:
```ts
import type { DataStore } from '../src/core/ports/data-store'
test('port DataStore là type, fake thoả mãn shape', () => {
  const fake: DataStore = {
    getAll: () => [], getVersion: () => 0, getAllWithVersion: () => ({ data: [], version: 0 }),
    insert: (_c, r) => r, update: () => true, remove: () => true, batch: () => ({ success: true, count: 0 }),
  }
  expect(fake.getAll('labels')).toEqual([])
})
```

- [ ] **Step 5: Run** `npm --prefix apps/workmgr test` → pass; `npm --prefix apps/workmgr run typecheck` → clean.
- [ ] **Step 6: Commit** `feat(core): ports DataStore/Cache/Clock + domain types + jest module`

---

## Task 3: schema.ts (typed registry + mappers)

**Files:** `src/core/schema.ts`, `__tests__/schema.test.ts`. **Nguồn:** port từ v1 `core/schema.js` (cùng dữ liệu field), thêm kiểu.

**Produces:** `getSchema(c)`, `sheetHeaders(c): string[]`, `domainToSheet/sheetToDomain/domainToSqlRow/sqlRowToDomain(c, obj)`. Field def có kiểu: `{ d: string; h: string; c: string; t: 'int'|'text' }` (thêm `t` để adapter SQL ép kiểu — sửa Minor SP3 sớm).

- [ ] **Step 1: test** port 3 test từ v1 `schema.test.js` sang `.ts` (import `domainToSheet`…), thêm 1 test `activities` round-trip SQL (snake_case + ép int cho objectId).
- [ ] **Step 2: RED** `npm --prefix apps/workmgr test -- schema`.
- [ ] **Step 3: impl** port `SCHEMA` từ v1 `schema.js`, thêm trường `t` ('int' cho id/objectId; 'text' còn lại), export các hàm có kiểu. Mappers dùng `t` khi cần (SQL coerce ở adapter, không ở đây).
- [ ] **Step 4: GREEN + typecheck.**
- [ ] **Step 5: Commit** `feat(core): schema registry có kiểu (ASCII↔sheet/SQL) + cờ kiểu field`

---

## Task 4: CachingDataStore decorator

**Files:** `src/core/caching-data-store.ts`, `__tests__/caching-data-store.test.ts`. **Nguồn:** logic cache từ v1 `cache.js` + phần cache trong `sheets-data-store.js`, gom vào decorator.

**Produces:** `class CachingDataStore implements DataStore` constructor `(inner: DataStore, cache: Cache)`. `getAll`/`getVersion`/`getAllWithVersion` đọc cache key `data_<c>`/`ver_<c>`; `insert/update/remove/batch` uỷ quyền `inner` rồi invalidate + bump version. **Không** chứa code GAS/SQLite.

- [ ] **Step 1: test** với fake `inner` (đếm số lần gọi) + fake in-memory `Cache`: getAll lần 2 không gọi inner (hit cache); insert làm invalidate → getAll gọi lại inner + version tăng.
- [ ] **Step 2: RED.**
- [ ] **Step 3: impl** decorator (port logic version/invalidate từ v1 cache.js: `data_`/`ver_`, bump 24h…). Đọc-through cache, write-through invalidate.
- [ ] **Step 4: GREEN + typecheck.**
- [ ] **Step 5: Commit** `feat(core): CachingDataStore decorator (tách cache khỏi adapter — SRP)`

---

## Task 5: Sheets adapter (I/O thuần) + gas-cache + gas-config

**Files:** `src/adapters/gas/sheets-data-store.ts`, `src/adapters/gas/gas-cache.ts`, `src/adapters/gas/gas-config.ts`, `__tests__/sheets-data-store.test.ts`, `__tests__/mocks/gas.ts` (port mock từ v1). **Nguồn:** v1 `sheets-data-store.js` **bỏ mọi lời gọi cache** (cache giờ ở decorator); v1 `config.js`; v1 `cache.js` phần CacheService → `gas-cache.ts` cài `Cache`.

**Produces:** `createSheetsDataStore(cfg): DataStore` — I/O thuần, không cache. `createGasCache(): Cache`. `gas-config`: `getCentralSheet/ensureSheet`.

- [ ] **Step 1: test** (mock SpreadsheetApp): insert gán id, getAll trả domain ASCII, update/remove theo ID, **không** assert cache (adapter không cache nữa). getVersion: adapter trả 0 (version do decorator lo) — hoặc bỏ version khỏi adapter? Giữ `getVersion(): 0` cho hợp đồng; decorator override.
- [ ] **Step 2: RED.**
- [ ] **Step 3: impl** port CRUD từ v1 sheets-data-store.js, **xoá** cacheGet/cachePut/invalidate; `getVersion` trả 0. `gas-cache.ts`: `get/put/remove` qua `CacheService.getScriptCache()` (port chunk-logic từ v1 cache.js nếu cần — hoặc rút gọn, value Nhãn nhỏ). `gas-config.ts` từ v1 config.js.
- [ ] **Step 4: GREEN + typecheck.**
- [ ] **Step 5: Commit** `feat(adapters/gas): SheetsDataStore I/O thuần + gas-cache + gas-config`

---

## Task 6: SQLite adapter + sqlite-schema

**Files:** `src/adapters/sqlite/sqlite-data-store.ts`, `src/adapters/sqlite/sqlite-schema.ts`. **Nguồn:** v1 `dev-server/sqlite-data-store.js`, thêm kiểu, dùng cờ `t` của schema để ép kiểu (int→number) khi đọc.

**Produces:** `createSqliteDataStore(db, schema): DataStore`, `createSqliteTables(db, schema, collections)`.

- [ ] **Step 1..4:** (test ở Task 7 parity) — impl port từ v1, ép kiểu theo `t` (đọc cột `t:'int'` → Number()), bind String() cho text. `getVersion(): 0`.
- [ ] **Step 5: typecheck.** **Commit** `feat(adapters/sqlite): SqliteDataStore có kiểu (ép kiểu theo schema)`

---

## Task 7: Parity/contract test (Sheets + SQLite + Caching)

**Files:** `__tests__/datastore-contract.test.ts`. **Nguồn:** v1 `datastore-parity.test.js`, mở rộng.

**Produces:** một hàm `runContract(make: () => DataStore)` chạy CRUD + version, gọi cho: (a) SheetsDataStore (mock), (b) SqliteDataStore (better-sqlite3 :memory:), (c) `CachingDataStore(SheetsDataStore, fake cache)`. Thêm test activities: SQLite trả objectId là **number** (nhờ cờ `t:'int'`) — verify đã sửa được divergence v1.

- [ ] **Step 1: test** runContract + 3 lời gọi + activities int-coercion assert.
- [ ] **Step 2: RED → 3: (impl đã có từ T5/T6) → GREEN.** Nếu activities trả string → sửa sqlite-data-store ép kiểu (đúng task này).
- [ ] **Step 4: typecheck. Commit** `test(core): contract test 3 cách dựng DataStore + ép kiểu int SQLite`

---

## Task 8: Domain repo + service + logs

**Files:** `src/core/domain/label-repository.ts`, `src/core/services/label-service.ts`, `src/core/domain/activity-log.ts`, `src/core/domain/audit-log.ts`, tests. **Nguồn:** v1 tương ứng; nhận `DataStore`/`Clock` qua tham số (DI thủ công), không global.

**Produces:**
- `createLabelRepository(ds: DataStore)` → `{list,add,update,remove}` typed (`Label`).
- `LabelService` factory `(repo, log)` → `labelList/labelAdd/labelUpdate/labelRemove(session, …)`; validate name; ghi activity.
- `createActivityLog(ds, clock)` / `createAuditLog(ds, clock)` → `log(...)` best-effort.

- [ ] **Step 1: test** label-service với fake repo + fake log (validate throw; add trả Label; activity được ghi).
- [ ] **Step 2: RED → 3: impl (port v1, inject deps qua tham số) → GREEN.**
- [ ] **Step 4: typecheck. Commit** `feat(core): LabelRepository + LabelService + Activity/Audit log (DI tham số)`

---

## Task 9: Composition roots + transport gas-entry

**Files:** `src/composition/gas.ts`, `src/composition/node.ts`, `src/transport/gas-entry.ts` (thay bản tạm). **Nguồn:** v1 `main.js`/`api-labels.js`.

**Produces:**
- `composition/gas.ts`: `makeApp()` → ghép `CachingDataStore(SheetsDataStore(gasConfig), gasCache)`, `clock`, repos, services. Trả object services dùng chung.
- `composition/node.ts`: `makeApp(db)` → `SqliteDataStore`, in-memory cache (hoặc no cache), services. Cho dev-server + test.
- `gas-entry.ts`: `_wrap`, `requireAuth` stub (TODO SP1), `doGet`, `api_getLabels/addLabel/updateLabel/deleteLabel` gọi `makeApp()` services; gán tất cả vào `globalThis`.

- [ ] **Step 1: test** `composition/node` makeApp(db) → api-level: gọi labelService qua composition trả envelope đúng (hoặc test ở Task 10 qua HTTP). Tối thiểu: typecheck + 1 unit test makeApp wiring.
- [ ] **Step 2..3: impl.**
- [ ] **Step 4: build:gas** lại → verify `doGet` + `api_getLabels` là global (vm sandbox), bundle 0 better-sqlite3.
- [ ] **Step 5: typecheck. Commit** `feat(workmgr): composition root GAS/Node + transport gas-entry (api_* ra global)`

---

## Task 10: Dev-server (TS, import thật) + e2e SQLite

**Files:** `dev-server/server.ts` (thay `.js` cũ), xoá `dev-server/*.js` v1 + `wire-sqlite.js`. **Nguồn:** v1 `dev-server/server.js` nhưng **bỏ vm**, import `composition/node` trực tiếp; chạy bằng `tsx`.

**Produces:** HTTP `POST /api {method,args}` → map tới api_* (từ một bảng handler do composition/node tạo, hoặc import gas-entry handlers). Guard `api_` prefix. SQLite file.

- [ ] **Step 1: impl** `server.ts` dùng `tsx` (thêm script `dev:server": "tsx dev-server/server.ts"`). Tạo handlers từ composition/node (không phụ thuộc globalThis của GAS — expose api_* dạng map).
- [ ] **Step 2: e2e** `rm -f dev-server/workmgr-dev.sqlite`; chạy `npm --prefix apps/workmgr run dev:server` nền; curl api_addLabel + api_getLabels → success trên SQLite; curl method non-api → chặn. Kill.
- [ ] **Step 3: typecheck. Commit** `feat(dev): dev-server TS import thật (bỏ vm) + e2e SQLite`

---

## Task 11: Client TS + LabelManager

**Files:** đổi `src/client/api/*` → `.ts`, `LabelManager.tsx`, entry. **Nguồn:** v1 client (a283f95, e565c67), thêm kiểu (dùng `Label` từ core qua `import type`).

- [ ] **Step 1: impl** transports + contract + index sang `.ts` (type `Transport`, `LabelsApi`); `LabelManager.tsx` typed. Vite + tsconfig nuốt TS.
- [ ] **Step 2: build client** `npm --prefix apps/workmgr run build:client` pass; typecheck pass.
- [ ] **Step 3: e2e** chạy `dev:workmgr` (client+dev-server) → UI thêm/xoá Nhãn trên SQLite (curl xác nhận data path).
- [ ] **Step 4: Commit** `feat(client): TS hoá api + LabelManager (import type từ core)`

---

## Task 12: Dọn v1 + kiểm hexagonal + verify tổng

**Files:** xoá toàn bộ file v1 còn lại (`src/server/**` cũ, `server-files.js`, `server-runtime.js`, `dev-server/*.js`). 

- [ ] **Step 1:** xoá file v1 thừa; đảm bảo không còn import tới chúng.
- [ ] **Step 2: kiểm hexagonal:** `grep -rn "adapters/\|SpreadsheetApp\|better-sqlite3" src/core` → **rỗng** (core không biết platform). `grep -rn "import" src/core/services src/core/domain | grep -i "adapters"` → rỗng.
- [ ] **Step 3: verify tổng:** `typecheck` sạch; `test` toàn bộ xanh; `build:gas` → 0 gas-core/better-sqlite3, `doGet`+`api_*` global; `build:client` ok.
- [ ] **Step 4: Commit** `chore(workmgr): xoá SP0 v1, kiểm core thuần (hexagonal) + verify tổng`

---

## Self-Review
- Spec §9 phủ: TS (T1), module test (T2), ports (T2), schema typed (T3), cache decorator (T4 — P2), hexagonal core/adapters (T5/T6/T12 — P3), parity 2 adapter (T7), DI tham số core (T8), composition+entry (T9), dev-server TS (T10), client TS (T11), kiểm core thuần (T12).
- Ép kiểu int SQLite (sửa divergence v1) ở T6/T7. `getVersion` thật do decorator (T4), adapter trả 0 — version-cache hoạt động trên đường GAS.
- requireAuth vẫn stub (SP1 thay) — không đụng.
- Không placeholder: phần mới có code đầy đủ; phần port chỉ rõ file nguồn v1 + biến đổi (typing/bỏ cache/đổi DI). Implementer đọc file v1 trong cùng worktree.
