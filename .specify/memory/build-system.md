# Build System Reference

## Pipeline

```
Client:   Vite → dist/gas/index.html (single-file bundle)
          sync-icons.js runs in build:client (auto-updates Material Symbols URL)

Server:   bundle-server.js
            → concat gas-core (fixed order) + app server files
            → inject .env vars as encoded placeholders
            → dist/gas/Code.js

Obfusc:   obfuscate.js → variable rename only (hexadecimal)
            → overwrite Code.js

Deploy:   deploy.js → npm run build → clasp push --force → update deployment
```

## Gas-Core Concat Order (fixed)

`config-base → cache → utils → sheets-crud → auth-core → access-token
→ refresh-token → session-epoch → handoff → sso → drive-io → license`

App server files auto-sorted: `config → sheets → auth → others → main`
(main always last).

## Env Var Injection

| Placeholder | Source |
|---|---|
| `__ENCODED_LICENSE_URL__` | encode(LICENSE_SERVER_URL) |
| `__ENCODED_SECRET_SALT__` | encode(SECRET_SALT) |
| `__APP_ID__` | APP_ID |
| `__APP_VERSION__` | APP_VERSION |

Encode = base64 then reverse. Decoded at runtime by `_decode()`.

## Obfuscation Constraints (GAS V8 + Vietnamese)

Only variable renaming is safe. Incompatible transforms:

| Transform | Problem |
|---|---|
| `stringArray` + encoding | Corrupts Vietnamese Unicode |
| `splitStrings` | Splits Vietnamese property keys |
| `transformObjectKeys` | Breaks computed property access |
| `controlFlowFlattening` | Indirect property chains fail on GAS V8 |
| `deadCodeInjection` | Crashes on GAS V8 runtime |

`reservedNames: ['^api_', '^doGet$']` preserves GAS entry points.

## Deploy Commands

```bash
npm run deploy:sso        # SSO Portal
npm run deploy:docmgr     # Doc Manager
npm run deploy:workmgr    # Work Manager
npm run deploy:license    # License Server
```

Never use bare `clasp push` — it uploads source but `/exec` URL stays old.
`deploy.js` reads `DEPLOYMENT_ID` from `.env` to update live deployment.

## API Consolidation

| Call | Replaces | When |
|---|---|---|
| `api_getInitialData` | getAllData + getDocuments + getStats + getUnreadIds + getConfig | Page load (1 call) |
| `api_pollUpdates` | getDocuments + unreadIds + optionally lookups | Background every 60s |

Search is server-side (Enter). All other filters are client-side.

## Icon Sync

`scripts/sync-icons.js` auto-scans client source for Material Symbols
icon names and updates the Google Fonts URL in `index.html`.
Hooked into `build:client`. Standalone: `node scripts/sync-icons.js --app <name>`.
Max ~71 icons in URL — exceeding returns HTTP 400, breaks ALL icons.
