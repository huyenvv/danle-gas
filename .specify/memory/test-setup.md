# Test Setup

No exports in GAS. Tests: `vm.createContext(globalThis)`+`vm.runInContext`, load order mirrors production.

## Mocks (mocks/gas.js)

SpreadsheetApp(in-memory sheets, `_addExternalSheet` for cross-script), CacheService(KV), LockService(no-op), PropertiesService(KV), DriveApp(file tree), Utilities(UUID/SHA256/base64), HtmlService, ScriptApp, Session(`_setEmail`), GmailApp(`_sent[]`).

## Helpers

`resetGAS()`, `setSheetData(name,rows)`, `getSheetData(name)`. DocMgr: `seedUser()`, `createSession()`, `setupRoleSheets()`.

## Config

DocMgr: `projects`(server=node, client=jsdom). Shared: `tests/jest.config.js` node.

## Files

DocMgr: auth, config, documents, sheets, license, drive, accessToken, refreshToken, sessionEpoch, handoff, notification, main, getAllData
SSO: login, password, users, orgStructure, batchSaveAssignments
E2E(Playwright): docmgr(workflow,documents,auth,responsive,sync-cache), sso(session,users,responsive,sync-cache,login,forced-password)

## Run

`npm run test:docmgr` · `npm run test:shared` · `node scripts/test-sso-flow.js`
