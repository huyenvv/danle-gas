# SSO Architecture

Auth in Portal (parent). Authz in child apps. Children never login.

## Tokens

| Token | TTL | Storage | Purpose |
|---|---|---|---|
| Access | 30min | CacheService + `_Người Dùng` sheet | API auth; cross-script via sheet |
| Refresh | 30d sliding | `_Người Dùng` JSON array per device | Resume. No rotation |
| Global Epoch | permanent | `_Người Dùng.LastLogoutAt` | Kick ALL devices |
| Device Epoch | permanent | `_Người Dùng.LogoutEpochs` `{desktop,mobile}` | Kick one device |

Multi-device: 1 desktop + 1 mobile. Per-device epoch invalidation.

## Login

SHA-256(username+password) → label=desktop|mobile → revoke prev AT → bumpEpochDevice(label) → mintRefreshToken(label) → mintAccessToken → client stores AT+RT+user+parentSheetId.

## Child SSO

Portal iframe: `?token=AT&parent=PARENT_SHEET_ID` → doGet injects `__SSO_TOKEN__`+`__SSO_PARENT__` (no cross-script in doGet) → client `api_ssoLogin` → `validateAccessTokenCrossScript` reads parent sheet → auto-assign 'Nhân viên' first visit → child mints own AT/RT.

After SSO: child refreshes independently. Epoch checks still cross-script (parent alive? locked?).

## Token Refresh

RT no rotation — `touchRefreshToken` updates `lastUsedAt` only. Prevents 2-tab race. AT rotates on every resume (prev AT revoked via cache).

## Auth Modules

| Module | Functions |
|---|---|
| `auth-core.js` | requireAuth, requireAdmin, _verifyPassword |
| `access-token.js` | mint/validate/validateCrossScript/revoke AT |
| `refresh-token.js` | mint/lookup/touch/revoke RT (per-label) |
| `session-epoch.js` | bumpEpoch (global), bumpEpochDevice (label), isBeforeEpoch, isBeforeEpochCrossScript |
| `sso.js` | ssoStoreParentSheetId, ssoGetParentSheetId |
