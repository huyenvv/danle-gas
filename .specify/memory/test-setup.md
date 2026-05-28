# Test Setup Reference

## Strategy

GAS server code runs in global scope with no module system. Tests simulate
this using `vm.createContext(globalThis)` + `vm.runInContext`.

Files loaded in same concat order as production: gas-core → app server files.

## Mock APIs (mocks/gas.js)

| GAS API | Mock Implementation |
|---|---|
| `SpreadsheetApp` | In-memory sheets (`_sheets`, `_addSheet`, `_reset`, `_addExternalSheet`) |
| `CacheService` | In-memory key-value store |
| `LockService` | No-op (immediate acquire/release) |
| `PropertiesService` | In-memory key-value store |
| `DriveApp` | In-memory file/folder tree |
| `Utilities` | UUID, SHA256 (deterministic), base64, formatDate |
| `HtmlService` | Returns HTML output objects |
| `ScriptApp` | Fixed script ID |
| `Session` | Configurable email via `_setEmail()` |
| `GmailApp` | Captures sent emails in `_sent` array |

`SpreadsheetApp._addExternalSheet(ssId, sheetName, rows)` mocks cross-script
`openById` for SSO parent sheet validation tests.

## Test Helpers

- `resetGAS()` — clear all mocks between tests
- `setSheetData(name, rows)` — create mock sheet from array of objects
- `getSheetData(name)` — read sheet data back

DocMgr helpers also include: `seedUser()`, `createSession()`, `setupRoleSheets()`.

## Jest Config

**DocMgr** (`apps/docmgr/jest.config.js`): uses `projects`:
- `server`: testEnvironment=node, matches `src/server/__tests__/**/*.test.js`
- `client`: testEnvironment=jsdom, matches `src/client/__tests__/**/*.test.{js,jsx}`

**Shared** (`tests/jest.config.js`): testEnvironment=node, matches `tests/**/*.test.js`

## Test Coverage

### DocMgr Server Tests
| File | Coverage |
|---|---|
| `auth.test.js` | Permission system, role defaults, custom permissions |
| `config.test.js` | Sheet initialization, schema upgrades |
| `documents.test.js` | CRUD, filtering, permission checks, auditing |
| `sheets.test.js` | Referential integrity, category hierarchy |
| `license.test.js` | Token verification, activation flow |
| `drive.test.js` | File operations (upload, delete, move) |
| `accessToken.test.js` | AT mint/validate/revoke, cross-script |
| `refreshToken.test.js` | RT mint/lookup/touch/revoke |
| `sessionEpoch.test.js` | Global + per-device epoch |
| `handoff.test.js` | Legacy handoff (kept for coverage) |
| `notification.test.js` | Email notifications, unread tracking |
| `main.test.js` | doGet, API endpoint routing |
| `getAllData.test.js` | Consolidated data fetching |

### SSO Portal Server Tests
| File | Coverage |
|---|---|
| `login.test.js` | Login flow, password verification |
| `password.test.js` | Password change, forced password change |
| `users.test.js` | User CRUD, status management |
| `orgStructure.test.js` | Department/role assignments |
| `batchSaveAssignments.test.js` | Bulk assignment operations |

## E2E Tests (Playwright)

DocMgr: `apps/docmgr/e2e/` — workflow, documents, auth, responsive, sync-cache
SSO Portal: `apps/sso-portal/e2e/` — session, users, responsive, sync-cache, login, forced-password
SSO flow regression: `node scripts/test-sso-flow.js` (headless Chromium, ~60s)

## Run Commands

```bash
npm run test:docmgr                                    # DocMgr unit tests
npm run test:shared                                    # Shared tests
npx jest --config apps/docmgr/jest.config.js           # DocMgr explicit
npx jest --config apps/sso-portal/jest.config.js       # SSO Portal (if exists)
node scripts/test-sso-flow.js                          # E2E SSO regression
```
