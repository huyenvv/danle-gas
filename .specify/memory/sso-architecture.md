# SSO Architecture Reference

## Pattern

Authentication in SSO Portal (parent). Authorization in each child app.
Child apps never handle login — only local roles.

## Token Types

| Token | TTL | Storage | Purpose |
|---|---|---|---|
| Access Token | 30 min | CacheService + `_Người Dùng` sheet | API auth; cross-script via sheet |
| Refresh Token | 30 days sliding | `_Người Dùng` sheet (JSON array per device) | Silent resume. No rotation on resume |
| Global Epoch | permanent | `_Người Dùng.LastLogoutAt` | Kick ALL devices (admin-lock) |
| Per-device Epoch | permanent | `_Người Dùng.LogoutEpochs` JSON `{desktop, mobile}` | Kick one device type only |

Multi-device: 1 desktop + 1 mobile per user. Per-device epoch invalidation.

## Login Flow

```
User submits email + password
  → SHA-256(username + password) — username is salt, NOT email
  → label = (deviceType === 'mobile') ? 'mobile' : 'desktop'
  → Revoke previous AT for same label
  → bumpEpochDevice(label) — invalidates child-app RTs of same label
  → mintRefreshToken(label) — replaces entry with same label
  → mintAccessToken() — CacheService + sheet
  → Client stores: access_token, refresh_token, user, parent_sheet_id
```

## Child App SSO Flow

```
Portal opens child via iframe: ?token=ACCESS_TOKEN&parent=PARENT_SHEET_ID
  → doGet injects __SSO_TOKEN__ + __SSO_PARENT__ (no cross-script in doGet)
  → Client: api_ssoLogin(parent, token)
    → validateAccessTokenCrossScript reads parent sheet
    → Auto-assigns 'Nhân viên' on first visit (owner → 'admin')
    → Child mints OWN AT/RT — independent refresh from here
  → Epoch checks still go cross-script (parent alive? user locked?)
```

## Token Refresh (no rotation)

RT does NOT rotate on resume — `touchRefreshToken` only updates `lastUsedAt`.
Prevents cross-tab race: two tabs resuming simultaneously both get same RT.
AT still rotates on every resume (previous AT explicitly revoked via cache).

## Client Auth Mount

Both portal and child wait for server validation before rendering auth UI.
No optimistic cached UI — prevents stale-AT races on hard reload.

## Gas-Core Auth Modules

| Module | Key Functions |
|---|---|
| `auth-core.js` | `requireAuth`, `requireAdmin`, `_verifyPassword` |
| `access-token.js` | `mintAccessToken`, `validateAccessToken`, `validateAccessTokenCrossScript` |
| `refresh-token.js` | `mintRefreshToken`, `lookupRefreshToken`, `touchRefreshToken`, `revokeRefreshToken` |
| `session-epoch.js` | `bumpEpoch`, `bumpEpochDevice`, `isBeforeEpoch`, `isBeforeEpochCrossScript` |
| `sso.js` | `ssoStoreParentSheetId`, `ssoGetParentSheetId` |
