<!--
Sync: 1.0.0→1.1.0 MINOR — added VII–VIII, working preferences
Templates: ✅ plan/spec/tasks — no conflicts
-->

# Appscripts Monorepo Constitution

## Core Principles

### I. GAS Concatenation Discipline

No module system. All server files concat into single global scope.

- Concat order fixed: gas-core (`config-base→cache→utils→sheets-crud→auth-core→access-token→refresh-token→session-epoch→handoff→sso→drive-io→license`) → app files (`config→sheets→auth→others→main`).
- Server: ES5 `var`/`function` only. No let/const/arrow/class/ESM.
- Single global scope — name collisions are silent bugs.
- `main.js` always last (contains `doGet`, `api_*`).

### II. Shared Core, App Override

`packages/gas-core/` — plain JS concat'd before app files by `bundle-server.js`. NOT an npm package.

- gas-core: app-agnostic only. No app-specific logic/sheet names/Vietnamese strings.
- Override pattern: `var _coreFn = fn; fn = function() { extra(); _coreFn() }`
- New gas-core module → update `bundle-server.js` AND test `setup.js` load order.

### III. Security-First Secrets

No plaintext secrets in deployed code or source control.

- `__ENCODED_SECRET_SALT__`, `__ENCODED_LICENSE_URL__`: reversed-base64, injected from `.env` by bundler, decoded by `_decode()`.
- `.env`, `.clasp.json`, `.clasprc.json` gitignored.
- License: SHA-256(`scriptId+appId+salt`). Salt identical in app `.env` and License Server.
- Password: SHA-256(`username+password`) — username is salt, NOT email.

### IV. SSO Parent-Child Separation

Auth in SSO Portal (parent). Authz in child apps. Children never handle login.

- `_Người Dùng` sheet = single source of truth (credentials, tokens, epochs).
- Cross-script validation via `openById` (CacheService is per-script).
- After SSO login, child mints own AT/RT, refreshes independently. Only epoch checks cross-script.
- Multi-device: 1 desktop + 1 mobile. Per-device epoch — logout one doesn't kick other.
- RT no rotation on resume (touch only) — prevents cross-tab race.
- Client auth: wait for server validation, no optimistic cached UI.

### V. Surgical Changes, Simplicity First

- Touch only what's needed. Don't "improve" adjacent code.
- Match existing style. Remove only what YOUR changes orphaned.
- No speculative abstractions/flexibility/error handling.
- Every changed line traces to user's request.
- "Hide" = comment out / conditional render, never delete.

### VI. Sheets-as-Database Integrity

Sheets = database. Referential integrity enforced in app code.

- Delete lookup (Danh Mục/Dự Án/NCC) → check `Hồ Sơ` references first.
- Delete category → check children first.
- Schema change → bump `SCHEMA_V` to force `ensureInitialized()`.
- `_Đã Đọc`: has record = unread, delete = read. Don't invert.
- Role from SSO `_Phân Bổ` (highest wins): GĐ(6)>PGĐ(5)>VT(4)>admin(3)>TP(2)>PP(1)>NV(0).

### VII. Test via vm.runInContext

No `module.exports` in GAS. Tests use `vm.createContext(globalThis)`.

- Load order mirrors production: gas-core → app files via `vm.runInContext`.
- Mocks (`mocks/gas.js`): SpreadsheetApp, CacheService, LockService, PropertiesService, DriveApp, Utilities, HtmlService, ScriptApp, Session, GmailApp.
- `_addExternalSheet(ssId, sheet, rows)` mocks cross-script `openById`.
- Helpers: `resetGAS()`, `setSheetData(name, rows)`, `getSheetData(name)`.
- New gas-core module → update `GAS_CORE_FILES` in every app's `setup.js`.
- Jest: docmgr `projects` (server=node, client=jsdom). E2E: Playwright in `apps/<app>/e2e/`.

### VIII. Shared Design System

Identical Tailwind tokens + MD3 colors + SBM branding across all apps.

- Same `tailwind.config.js` everywhere. Navy primary `#01458e`, orange accent `#e87a1e`, MD3 surface system.
- Font: Be Vietnam Pro (300–800). Icons: Material Symbols Outlined.
- Icon limit ~71 in Google Fonts URL. `sync-icons.js` auto-syncs on build.
- Component patterns in wiki `gas-design-system`.

## Build & Deploy

- Client: Vite → `dist/gas/index.html`. `sync-icons.js` in `build:client`.
- Server: `bundle-server.js` → concat + env inject → `dist/gas/Code.js`.
- Obfuscation: variable rename only. Other transforms break GAS V8 + Vietnamese.
- `reservedNames: ['^api_', '^doGet$']`.
- Deploy: `npm run deploy:<app>` (reads DEPLOYMENT_ID from .env). **Never bare `clasp push`** — /exec stays old.
- API: `api_getInitialData` (1 call on load), `api_pollUpdates` (60s background).

## Code Style

- Server: ES5 var/function, no TS. Client: React+JSX+hooks+Tailwind.
- Vietnamese in app code, English in gas-core.
- Search: server-side on Enter, NFD diacritics-insensitive. Other filters client-side.

## Working Preferences

- **Ask, don't guess** — unclear → ask immediately.
- **Never remove code unless asked** — "hide" = conditional render.
- **Deploy via `npm run deploy:<app>`** only.
- **Icon sync automated** — `sync-icons.js` hooked into build.
- **Concise responses** — practical over perfect, terse.

## Governance

Non-negotiable constraints. SemVer versioning. Consult `CLAUDE.md` + wiki for workflows. Document workflow (4-status: Chờ duyệt→Chờ xử lý→Đang xử lý→Hoàn thành) defined in wiki `document-workflow`.

**Version**: 1.1.0 | **Ratified**: 2026-05-28 | **Last Amended**: 2026-05-28
