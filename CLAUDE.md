# Appscripts Monorepo

## Wiki

Read `../wiki/index.md` before taking any action. It contains project knowledge, architectural decisions, and workflows that inform all work here.



npm workspaces monorepo chứa các ứng dụng Google Apps Script.

## Structure

```
packages/gas-core/       # Shared GAS modules (config-base, cache, utils, sheets-crud, auth-core, access-token, refresh-token, session-epoch, handoff, sso, drive-io, license)
apps/sso-portal/         # SSO Portal — centralized login, user management, app launcher (parent app)
apps/docmgr/             # Quản Lý Tài Liệu — React client + GAS server (SSO child app)
apps/license-server/     # License activation — standalone GAS Web App + Node dev runner
scripts/                 # Shared build scripts (bundle-server, obfuscate, convert-gs) — all accept --app <name>
```

## Key Concepts

- **GAS has no module system.** All files are concatenated into one scope at build time. Order matters.
- **gas-core** is NOT an npm package — it's plain JS files auto-included by `scripts/bundle-server.js` before app files.
- **Build concat order:** gas-core (config-base→cache→utils→sheets-crud→auth-core→access-token→refresh-token→session-epoch→handoff→sso→drive-io→license) → app server files (config→sheets→auth→documents→main).
- **Override pattern** for extending gas-core at app level:
  ```js
  var _coreDeleteRow = deleteRow
  deleteRow = function(sheet, rowIdx) { checkReferences(sheet, rowIdx); _coreDeleteRow(sheet, rowIdx) }
  ```
- **Build-time encoded vars** (`__ENCODED_SECRET_SALT__`, `__ENCODED_LICENSE_URL__`) are reversed-base64 strings injected from `.env` by `bundle-server.js`. Decoded at runtime by `_decode()` in license.js.

## License Flow

```
User opens app (doGet)
  → checkLicense() — reads LICENSE_ACTIVATED from ScriptProperties
  → If false: redirect to License Server

License Server (apps/license-server/main.js):
  1. User lands with ?scriptId=...&callback=...&app=...&ver=...
  2. Server gets user email via Session.getActiveUser()
  3. Checks email in Whitelist tab (per-app or wildcard *)
  4. If allowed: token = SHA256(scriptId + app + SECRET_SALT)
  5. Redirects back: callback?activate=<token>

App receives callback (doGet with ?activate=token):
  → activateWithToken(token)
  → salt = _decode(__ENCODED_SECRET_SALT)  ← build-time injected
  → expected = SHA256(scriptId + __APP_ID + salt)
  → If token === expected: save LICENSE_ACTIVATED=true + LICENSE_TOKEN to ScriptProperties

Every API call → checkLicense():
  → Reads LICENSE_ACTIVATED flag AND LICENSE_TOKEN
  → Re-computes expected = SHA256(scriptId + __APP_ID + salt)
  → If stored token ≠ expected → revoke (clear both keys) → return false
  → Prevents bypass by manually setting LICENSE_ACTIVATED=true
```

**Key points:**
- `SECRET_SALT` must be **identical** in both app `.env` and license-server Script Properties.
- Salt is encoded (reversed base64) at build time, decoded at runtime — never stored in plain text in deployed code.
- Each Google Sheet copy has a unique `scriptId` → unique token → separate license.
- License Server is container-bound to its own Google Sheet with tabs: Whitelist, Audit Logs, Admins.

## SSO Architecture

```
SSO Portal (parent app) — container-bound to its own Google Sheet
  ├── Manages: _Người Dùng, _Ứng Dụng, _Hệ Thống, _Handoffs sheets
  ├── Login by email, password hashed with SHA-256(username + password)
  ├── Single-device: mintRefreshToken replaces all tokens (new login revokes old)
  ├── Access token stored in CacheService + sheet (AccessToken, AccessTokenExpiry)
  └── Opens child apps via iframe: ?token=ACCESS_TOKEN&parent=PARENT_SHEET_ID

Child app (docmgr) — container-bound to its own Google Sheet
  ├── doGet(): lightweight — only injects __SSO_TOKEN__ + __SSO_PARENT__ as strings
  ├── Client calls api_ssoLogin() → validateAccessTokenCrossScript(parentSheetId, token)
  ├── Auto-assigns role ('Nhân viên') on first SSO visit
  ├── Manages local authorization only (_Phân Quyền sheet)
  ├── Parent sheet ID stored once in ScriptProperties (SSO_PARENT_SHEET_ID)
  └── License check disabled — SSO Portal manages access
```

**Auth modules:** `access-token.js` (mint/validate + cross-script), `refresh-token.js` (single-device), `session-epoch.js` (global revocation), `handoff.js` (legacy).
**Cross-script:** Child reads parent's `_Người Dùng` sheet to validate access token (CacheService is per-script, Sheets are shared).

## Commands

```bash
npm install                # Install all workspaces
npm run dev:sso            # SSO Portal Vite dev server (port 5174)
npm run dev:docmgr         # Doc Manager Vite dev server (port 5173)
npm run dev:license        # License server local (port 3001)
npm run test:docmgr        # Jest — 48 tests
npm run build:sso          # SSO Portal client + server bundle
npm run build:docmgr       # Doc Manager client + server bundle + obfuscate
npm run build:license      # .js → .gs conversion
```

## Testing

- Test config: `apps/docmgr/jest.config.js`
- Test setup: `apps/docmgr/src/server/__tests__/setup.js` — loads gas-core then app files via `vm.runInContext` into global scope
- GAS API mocks: `apps/docmgr/src/server/__tests__/mocks/gas.js`
- Run: `npx jest --config apps/docmgr/jest.config.js`

## Code Style

- Plain ES5-style `var`/`function` in all server `.js` files (GAS V8 runtime, but code is shared/concat'd — keep simple).
- React client uses modern JSX, hooks, Tailwind CSS.
- Vietnamese UI strings in app-level code; English in gas-core (shared).
- No TypeScript — entire project is plain JS.

## Sensitive Files (gitignored)

- `apps/*/.clasp.json` — contains GAS Script IDs
- `apps/*/.env` — contains SECRET_SALT, LICENSE_SERVER_URL
- `.clasprc.json` — clasp OAuth credentials

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
