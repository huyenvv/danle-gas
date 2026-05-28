# Build System

## Pipeline

```
Client: Vite → dist/gas/index.html (sync-icons.js in build:client)
Server: bundle-server.js → concat gas-core+app → env inject → dist/gas/Code.js
Obfusc: variable rename only (hexadecimal) → overwrite Code.js
Deploy: deploy.js → build → clasp push → update deployment (DEPLOYMENT_ID from .env)
```

## Concat Order

gas-core: `config-base→cache→utils→sheets-crud→auth-core→access-token→refresh-token→session-epoch→handoff→sso→drive-io→license`
App: auto-sorted `config→sheets→auth→others→main` (main last).

## Env Injection

| Placeholder | Source |
|---|---|
| `__ENCODED_LICENSE_URL__` | encode(LICENSE_SERVER_URL) |
| `__ENCODED_SECRET_SALT__` | encode(SECRET_SALT) |
| `__APP_ID__` | APP_ID |
| `__APP_VERSION__` | APP_VERSION |

Encode=base64→reverse. Decode at runtime via `_decode()`.

## Obfuscation

Variable rename only. Incompatible: stringArray (corrupts Vietnamese), splitStrings, transformObjectKeys, controlFlowFlattening, deadCodeInjection. `reservedNames: ['^api_', '^doGet$']`.

## Deploy

`npm run deploy:<app>` — never bare `clasp push` (/exec stays old). deploy.js reads DEPLOYMENT_ID from .env.

## API Consolidation

`api_getInitialData` (1 call on load). `api_pollUpdates` (60s background). Search server-side on Enter, other filters client-side.

## Icon Sync

`sync-icons.js` auto-scans client → updates icon_names in index.html. Max ~71 icons (HTTP 400 if exceeded). Hooked into build, standalone: `node scripts/sync-icons.js --app <name>`.
