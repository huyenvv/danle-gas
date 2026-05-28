# SSO Architecture

> Abbreviations: see constitution.md

Auth in Portal (parent). Authz in child apps.

## Tokens

| Type | TTL | Storage | Purpose |
|---|---|---|---|
| AT | 30min | CacheService + `_Người Dùng` | API auth; cross-script via sheet |
| RT | 30d sliding | `_Người Dùng` JSON per device | Resume. No rotation (touch only) |
| Global Epoch | — | `LastLogoutAt` | Kick ALL devices |
| Device Epoch | — | `LogoutEpochs {desktop,mobile}` | Kick one device |

1 desktop + 1 mobile per user. Per-device epoch.

## Login

SHA-256(username+password) → label=desktop|mobile → revoke prev AT → bumpEpochDevice(label) → mintRT(label) → mintAT → client stores AT+RT+user+parentSheetId.

## Child SSO

Portal iframe `?token=AT&parent=SHEET_ID` → doGet injects `__SSO_TOKEN__`+`__SSO_PARENT__` → client `api_ssoLogin` → `validateAccessTokenCrossScript` → auto-assign NV first visit → child mints own AT/RT, refreshes independently. Epoch checks still cross-script.

## Refresh

RT no rotation — `touchRefreshToken` updates lastUsedAt. Prevents 2-tab race. AT rotates every resume (prev revoked).

## Modules

auth-core(`requireAuth,requireAdmin,_verifyPassword`), access-token(`mint/validate/validateCrossScript/revoke`), refresh-token(`mint/lookup/touch/revoke` per-label), session-epoch(`bumpEpoch,bumpEpochDevice,isBeforeEpoch,isBeforeEpochCrossScript`), sso(`store/getParentSheetId`).
