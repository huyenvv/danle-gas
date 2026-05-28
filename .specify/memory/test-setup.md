# Test Setup

## Strategy

GAS has no exports. Tests use `vm.createContext(globalThis)` + `vm.runInContext`. Load order mirrors production: gas-core → app files.

## Mocks (mocks/gas.js)

SpreadsheetApp (in-memory sheets + `_addExternalSheet` for cross-script), CacheService (KV), LockService (no-op), PropertiesService (KV), DriveApp (file tree), Utilities (UUID/SHA256/base64), HtmlService, ScriptApp, Session (`_setEmail`), GmailApp (`_sent` array).

## Helpers

`resetGAS()` — clear all. `setSheetData(name, rows)` — mock sheet from objects. `getSheetData(name)`. DocMgr also: `seedUser()`, `createSession()`, `setupRoleSheets()`.

## Jest Config

DocMgr: `projects` — server(node) + client(jsdom). Shared: `tests/jest.config.js` node.

## Test Files

### DocMgr Server
auth, config, documents, sheets, license, drive, accessToken, refreshToken, sessionEpoch, handoff, notification, main, getAllData

### SSO Portal Server
login, password, users, orgStructure, batchSaveAssignments

## E2E (Playwright)

DocMgr: workflow, documents, auth, responsive, sync-cache
SSO: session, users, responsive, sync-cache, login, forced-password
Regression: `node scripts/test-sso-flow.js` (~60s headless)

## Commands

```
npm run test:docmgr    npm run test:shared    node scripts/test-sso-flow.js
```
