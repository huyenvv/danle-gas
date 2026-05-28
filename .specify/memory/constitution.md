<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Bump rationale: MINOR — added principles VII–VIII, expanded testing/design/deploy sections

Added principles:
  - VII. Test via vm.runInContext
  - VIII. Shared Design System

Expanded sections:
  - Build & Deploy Constraints (icon sync, deploy command)
  - Code Style & Conventions (E2E, Jest config details)

Added sections:
  - Working Preferences (from user memory/feedback)

Templates requiring updates:
  ✅ plan-template.md — no conflicts
  ✅ spec-template.md — no conflicts
  ✅ tasks-template.md — no conflicts

Follow-up TODOs: none
-->

# Appscripts Monorepo Constitution

## Core Principles

### I. GAS Concatenation Discipline

GAS has no module system. All server files are concatenated into a single
global scope at build time. This constraint is non-negotiable and drives
every architectural decision.

- File concat order MUST be preserved: gas-core modules in fixed order
  (`config-base → cache → utils → sheets-crud → auth-core → access-token
  → refresh-token → session-epoch → handoff → sso → drive-io → license`),
  then app server files (`config → sheets → auth → others → main`).
- All server code MUST use plain ES5-style `var` / `function` declarations.
  No `let`, `const`, arrow functions, classes, or ES modules in server files.
- Every function and variable shares one global scope. Name collisions are
  silent bugs. Prefix or namespace intentionally.
- `main.js` MUST be concatenated last — it contains GAS entry points
  (`doGet`, `api_*` functions).

### II. Shared Core, App Override

`packages/gas-core/` provides shared modules consumed by all apps. It is
NOT an npm package — `bundle-server.js` physically concatenates its files
before app files.

- gas-core functions MUST remain app-agnostic. No app-specific logic,
  sheet names, or UI strings in gas-core.
- Apps extend gas-core via the override pattern:
  ```js
  var _coreDeleteRow = deleteRow
  deleteRow = function(sheet, rowIdx) {
    checkReferences(sheet, rowIdx); _coreDeleteRow(sheet, rowIdx)
  }
  ```
- Adding a new gas-core module requires updating the concat order in
  `bundle-server.js` AND the test setup (`vm.runInContext` load order).
- Vietnamese UI strings belong in app-level code. gas-core uses English.

### III. Security-First Secrets

Secrets MUST never appear in plain text in deployed code or source control.

- Build-time encoded vars (`__ENCODED_SECRET_SALT__`,
  `__ENCODED_LICENSE_URL__`) are reversed-base64 strings injected from
  `.env` by `bundle-server.js`. Decoded at runtime by `_decode()`.
- `.env` files, `.clasp.json`, and `.clasprc.json` MUST be gitignored.
- License tokens use SHA-256(`scriptId + appId + salt`). The salt MUST be
  identical between app `.env` and License Server Script Properties.
- Password hashing uses SHA-256(`username + password`) — username is the
  salt, NOT email.

### IV. SSO Parent-Child Separation

Authentication lives in SSO Portal (parent). Authorization lives in each
child app. Child apps MUST NOT handle login.

- SSO Portal owns `_Người Dùng` sheet — the single source of truth for
  user credentials, tokens, and epochs.
- Child apps validate parent access tokens cross-script by reading the
  parent sheet (`SpreadsheetApp.openById`). CacheService is per-script.
- After initial SSO login, child apps mint their own AT/RT and refresh
  independently. Only epoch checks go cross-script.
- Multi-device policy: 1 desktop + 1 mobile session per user. Per-device
  epoch invalidation — logging out desktop does not kick mobile.
- Refresh tokens do NOT rotate on resume (touch only) to avoid cross-tab
  race conditions.
- Client auth mount MUST wait for server validation before rendering
  authenticated UI — no optimistic cached UI (prevents stale-AT races).

### V. Surgical Changes, Simplicity First

Minimum code that solves the problem. No speculative features.

- Touch only what you must. Do not "improve" adjacent code, comments,
  or formatting unless explicitly asked.
- Match existing style even if you would do it differently.
- If your changes make imports/variables/functions unused, remove them.
  Do not remove pre-existing dead code unless asked.
- No abstractions for single-use code. No error handling for impossible
  scenarios. No "flexibility" that was not requested.
- Every changed line MUST trace directly to the user's request.
- When asked to "hide" something, comment out or conditionally render —
  do NOT delete the code.

### VI. Sheets-as-Database Integrity

Google Sheets serve as the database. Referential integrity MUST be
enforced in application code since Sheets has no constraints.

- Before deleting a lookup record (Danh Mục, Dự Án, Nhà Cung Cấp),
  check for references in `Hồ Sơ` and block if found.
- Before deleting a parent category, check for child categories.
- Schema changes require bumping `SCHEMA_V` in Script Properties to
  force `ensureInitialized()` re-validation on next deploy.
- Unread tracking uses inverted records in `_Đã Đọc` (has record =
  unread, delete = mark read). Do not invert this logic.
- Role derivation: DocMgr gets role from SSO Portal's `_Phân Bổ`
  assignments (highest-priority wins), not from local `_Phân Quyền.Quyền`.
  Priority: Giám đốc(6) > Phó GĐ(5) > Văn thư(4) > admin(3) >
  Trưởng phòng(2) > Phó phòng(1) > Nhân viên(0).

### VII. Test via vm.runInContext

GAS server code has no `module.exports`. Tests MUST simulate the GAS
global scope using Node.js `vm.createContext(globalThis)`.

- Test setup loads files in the same concat order as production:
  gas-core files → app server files, each via `vm.runInContext`.
- GAS API mocks (`mocks/gas.js`) provide in-memory implementations of
  `SpreadsheetApp`, `CacheService`, `LockService`, `PropertiesService`,
  `DriveApp`, `Utilities`, `HtmlService`, `ScriptApp`, `Session`.
- `SpreadsheetApp._addExternalSheet(ssId, sheetName, rows)` mocks
  cross-script `openById` calls for SSO parent sheet validation.
- Test helpers: `resetGAS()` (clear all mocks), `setSheetData(name, rows)`
  (create mock sheet from plain objects), `getSheetData(name)`.
- Adding a new gas-core module MUST update both `bundle-server.js` concat
  order AND `GAS_CORE_FILES` array in every app's `setup.js`.
- Jest config: docmgr uses `projects` (server=node, client=jsdom);
  shared tests at `tests/jest.config.js`.
- E2E: Playwright specs in `apps/<app>/e2e/` — SSO login flow, document
  workflow, responsive, sync-cache. Run: `node scripts/test-sso-flow.js`.

### VIII. Shared Design System

All apps share identical Tailwind CSS tokens, Material Design 3 color
naming, and SBM company branding. Visual consistency is non-negotiable.

- `tailwind.config.js` MUST be identical across all apps (SSO Portal,
  DocMgr, WorkMgr). Copy from existing app when creating a new one.
- Colors: navy primary (`#01458e`), orange accent (`#e87a1e`), MD3
  surface system. See wiki `gas-design-system` for full palette.
- Font: Be Vietnam Pro (weights 300–800) with Vietnamese diacritics.
- Icons: Google Material Symbols Outlined. Max ~71 icon names in the
  Google Fonts URL — exceeding this returns HTTP 400 and breaks ALL icons.
- `scripts/sync-icons.js` auto-scans client source and updates
  `icon_names` in `index.html`. Hooked into `build:client`.
- Component patterns (buttons, cards, modals, tables, role badges) are
  documented in wiki `gas-design-system`. Follow existing patterns.

## Build & Deploy Constraints

- Client: Vite build → `dist/gas/index.html` (single-file bundle).
  `sync-icons.js` runs as part of `build:client` to keep icon font URL
  in sync with code usage.
- Server: `bundle-server.js` → concat gas-core + app files → inject env
  vars → `dist/gas/Code.js`.
- Obfuscation: variable renaming only (`hexadecimal`). All other
  transforms (stringArray, splitStrings, controlFlowFlattening,
  deadCodeInjection) are incompatible with GAS V8 + Vietnamese Unicode.
- `reservedNames: ['^api_', '^doGet$']` MUST preserve GAS entry points.
- Deploy: `npm run deploy:<app>` — reads `DEPLOYMENT_ID` from `.env` to
  update the live deployment. **Never use bare `clasp push`** — it only
  uploads source to editor; the `/exec` URL still serves the old version.
- API consolidation: `api_getInitialData` (page load, 1 call) and
  `api_pollUpdates` (background, every 60s) to minimize GAS concurrent
  execution limits.

## Code Style & Conventions

- Server files: plain ES5 `var`/`function`. No TypeScript.
- Client files: modern React + JSX + hooks + Tailwind CSS.
- Vietnamese UI strings in app-level code; English in gas-core.
- Unit tests: Jest + `vm.runInContext`. Run: `npm run test:docmgr`.
- E2E tests: Playwright. Specs in `apps/<app>/e2e/*.spec.js`.
  SSO flow regression: `node scripts/test-sso-flow.js`.
- Search: server-side keyword search triggered on Enter. Vietnamese
  diacritics-insensitive via NFD decomposition + regex. All other filters
  are client-side.

## Working Preferences

These preferences are derived from user feedback and MUST be respected.

- **Ask, don't guess.** When requirements are unclear, ask immediately.
  Do not assume or silently pick an interpretation.
- **Never remove code unless explicitly asked.** When asked to "hide",
  use conditional rendering or comments. Accidental removals erode trust.
- **Deploy via `npm run deploy:<app>`**, never bare `clasp push`.
- **Icon sync is automated.** `sync-icons.js` is hooked into build.
  When adding new Material Symbols icons, run the build or the script
  standalone: `node scripts/sync-icons.js --app <name>`.
- **Concise responses.** User is Vietnamese, prefers practical solutions
  over perfect ones, and expects terse communication.

## Governance

This constitution captures the non-negotiable architectural constraints
of the Appscripts monorepo. All changes MUST comply.

- Amendments require updating this file, bumping the version, and
  verifying consistency with spec/plan/tasks templates.
- Versioning follows SemVer: MAJOR for principle removals/redefinitions,
  MINOR for new principles or expanded guidance, PATCH for clarifications.
- Use `CLAUDE.md` and the wiki (`../wiki/`) as runtime development
  guidance — this constitution defines the boundaries, not the workflows.
- Document workflow (4-status: Chờ duyệt → Chờ xử lý → Đang xử lý →
  Hoàn thành) and role-based transition rules are defined in wiki
  `document-workflow`. Consult before modifying any status logic.

**Version**: 1.1.0 | **Ratified**: 2026-05-28 | **Last Amended**: 2026-05-28
