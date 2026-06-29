<!--
Sync: 1.0.0→1.2.0 MINOR — rebalanced compression, added abbreviations
Templates: ✅ plan/spec/tasks — no conflicts
-->

# Appscripts Monorepo Constitution

## Abbreviations

GĐ=Giám đốc, PGĐ=Phó GĐ, VT=Văn thư, TP=Trưởng phòng, PP=Phó phòng,
NV=Nhân viên, PT=Phụ trách, PH=Phối hợp, NCC=Nhà Cung Cấp,
AT=Access Token, RT=Refresh Token.

## Core Principles

### I. GAS Concatenation Discipline

GAS has no module system. All server files are concatenated into a single
global scope at build time.

- Concat order MUST be preserved: gas-core (`config-base → cache → utils
  → sheets-crud → auth-core → access-token → refresh-token →
  session-epoch → handoff → sso → drive-io → license`), then app files
  (`config → sheets → auth → others → main`).
- All server code MUST use ES5 `var`/`function`. No let, const, arrow
  functions, classes, or ES modules.
- Every function and variable shares one global scope. Name collisions
  are silent bugs — prefix or namespace intentionally.
- `main.js` MUST be concatenated last — it contains GAS entry points
  (`doGet`, `api_*`).

### II. Shared Core, App Override

`packages/gas-core/` provides shared modules consumed by all apps. It is
NOT an npm package — `bundle-server.js` concatenates its files before
app files.

- gas-core MUST remain app-agnostic. No app-specific logic, sheet names,
  or Vietnamese strings.
- Apps extend gas-core via the override pattern:
  `var _coreFn = fn; fn = function() { extra(); _coreFn() }`
- New gas-core module → update `bundle-server.js` concat order AND test
  `setup.js` load order.

### III. Security-First Secrets

Secrets MUST never appear in plain text in deployed code or source control.

- Build-time encoded vars (`__ENCODED_SECRET_SALT__`,
  `__ENCODED_LICENSE_URL__`): reversed-base64, injected from `.env`,
  decoded at runtime by `_decode()`.
- `.env`, `.clasp.json`, `.clasprc.json` MUST be gitignored.
- License: SHA-256(`scriptId + appId + salt`). Salt MUST be identical
  between app `.env` and License Server Script Properties.
- Password: SHA-256(`username + password`) — username is salt, NOT email.

### IV. SSO Parent-Child Separation

Authentication lives in SSO Portal (parent). Authorization lives in each
child app. Child apps MUST NOT handle login.

- `_Người Dùng` sheet is the single source of truth for credentials,
  tokens, and epochs.
- Cross-script validation via `SpreadsheetApp.openById` (CacheService
  is per-script, Sheets are shared).
- After initial SSO login, child mints own AT/RT and refreshes
  independently. Only epoch checks go cross-script.
- Multi-device: 1 desktop + 1 mobile per user. Per-device epoch
  invalidation — logout one does not kick the other.
- RT does NOT rotate on resume (touch only) to prevent cross-tab race.
- Client auth MUST wait for server validation before rendering — no
  optimistic cached UI.

### V. Surgical Changes, Simplicity First

Minimum code that solves the problem. No speculative features.

- Touch only what the request requires. Do not "improve" adjacent code,
  comments, or formatting.
- Match existing style. Remove only what YOUR changes orphaned — do not
  remove pre-existing dead code unless asked.
- No abstractions for single-use code. No error handling for impossible
  scenarios. No "flexibility" that was not requested.
- Every changed line MUST trace directly to the user's request.
- "Hide" means comment out or conditional render — never delete.

### VI. Sheets-as-Database Integrity

Google Sheets serve as the database. Referential integrity MUST be
enforced in application code.

- Delete lookup (Danh Mục / Dự Án / NCC) → check `Hồ Sơ` refs first.
- Delete category → check child categories first.
- Schema change → bump `SCHEMA_V` to force `ensureInitialized()`.
- `_Chưa Đọc`: has record = unread, delete record = read. Don't invert.
- Role from SSO `_Phân Bổ` (highest wins):
  GĐ(6) > PGĐ(5) > VT(4) > admin(3) > TP(2) > PP(1) > NV(0).

### VII. Test via vm.runInContext

GAS has no `module.exports`. Tests MUST simulate the global scope using
`vm.createContext(globalThis)`.

- Load order mirrors production: gas-core → app files via
  `vm.runInContext`.
- Mocks in `mocks/gas.js`: SpreadsheetApp, CacheService, LockService,
  PropertiesService, DriveApp, Utilities, HtmlService, ScriptApp,
  Session, GmailApp.
- `_addExternalSheet(ssId, sheet, rows)` mocks cross-script `openById`.
- Helpers: `resetGAS()`, `setSheetData(name, rows)`, `getSheetData()`.
- New gas-core module → update `GAS_CORE_FILES` in every app's `setup.js`.
- Jest: docmgr uses `projects` (server=node, client=jsdom).
  E2E: Playwright in `apps/<app>/e2e/`.

### VIII. Shared Design System

All apps MUST share identical Tailwind CSS tokens, MD3 color naming,
and SBM company branding.

- Same `tailwind.config.js` everywhere. Navy primary `#01458e`, orange
  accent `#e87a1e`, MD3 surface system.
- Font: Be Vietnam Pro (300–800). Icons: Material Symbols Outlined.
- Icon limit ~71 in Google Fonts URL — exceeding breaks ALL icons.
  `sync-icons.js` auto-syncs on build.
- Component patterns documented in wiki `gas-design-system`.

## Build & Deploy

- Client: Vite → `dist/gas/index.html`. `sync-icons.js` in `build:client`.
- Server: `bundle-server.js` → concat + env inject → `dist/gas/Code.js`.
- Obfuscation: variable rename only. Other transforms break GAS V8 +
  Vietnamese Unicode.
- `reservedNames: ['^api_', '^doGet$']`.
- Deploy: `npm run deploy:<app>` only. **Never bare `clasp push`** —
  `/exec` URL stays on old version.
- API: `api_getInitialData` (1 call on load), `api_pollUpdates` (60s).

## Working Preferences

- **Ask, don't guess** — unclear requirements → ask immediately.
- **Never remove code unless asked** — "hide" = conditional render.
- **Deploy via `npm run deploy:<app>`** only.
- **Icon sync automated** — `sync-icons.js` hooked into build.
- **Concise responses** — practical over perfect, terse.

## Governance

Non-negotiable constraints. SemVer versioning. Consult `CLAUDE.md` +
wiki for runtime guidance. Document workflow (5 statuses: Chờ duyệt →
Chờ xử lý → Đang xử lý → Hoàn thành, plus Từ chối loop) defined in
memory `document-workflow.md`. SCHEMA_V = 4.

**Version**: 1.3.0 | **Ratified**: 2026-05-28 | **Last Amended**: 2026-05-29
