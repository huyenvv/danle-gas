# Build System

## Pipeline

Client: Vite→`dist/gas/index.html` (sync-icons.js in build:client)
Server: bundle-server.js→concat gas-core+app→env inject→`dist/gas/Code.js`
Obfusc: variable rename only (hexadecimal)→overwrite Code.js
Deploy: deploy.js→build→clasp push→update deployment via DEPLOYMENT_ID from .env

## Concat

gas-core: config-base→cache→utils→sheets-crud→auth-core→access-token→refresh-token→session-epoch→handoff→sso→drive-io→license
App: config→sheets→auth→others→main (main last)

## Env

`__ENCODED_LICENSE_URL__`=encode(LICENSE_SERVER_URL), `__ENCODED_SECRET_SALT__`=encode(SECRET_SALT), `__APP_ID__`, `__APP_VERSION__`. Encode=base64→reverse, decode via `_decode()`.

## Obfuscation

Variable rename only. stringArray/splitStrings/transformObjectKeys/controlFlowFlattening/deadCodeInjection all break GAS V8+Vietnamese. `reservedNames:['^api_','^doGet$']`.

## Deploy

`npm run deploy:<app>` only. Never bare `clasp push` (/exec stays old).

## API

`api_getInitialData`(1 call load), `api_pollUpdates`(60s). `api_transitionDocument(token, id, action, data, updateData)` — optional 5th param `updateData({formData, fileInfos, keepFileIds})` saves edits before transitioning (single call). Search server-side Enter, other filters client-side.

## Icons

`sync-icons.js` auto-scans client→updates index.html icon_names. Max ~71 (HTTP 400 if exceeded). Hooked into build. Standalone: `node scripts/sync-icons.js --app <name>`.
