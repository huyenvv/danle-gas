# Refresh-Token Auth Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 2-token-coexist auth (SSO_Token + per-app session) with refresh-token + handoff + session-epoch pattern. Solve logout cascade, admin lock kick, persistent login, multi-device tracking, account switching.

**Architecture:**
- **Portal (cha):** Issues `refresh_token` (30d sliding, in sheet `_Người Dùng.RefreshTokens`) + `access_token` (30 min, in CacheService). Client auto-resumes on page load using refresh_token. Logout/lock bumps `user.LastLogoutAt` (session epoch).
- **Handoff:** Portal mints single-use `handoff_token` (60s, in sheet `_Handoffs`) when user clicks an app. Iframe URL has `?handoff=<token>`. Child consumes handoff once → mints its own refresh+access tokens.
- **Child (con — docmgr):** Same pattern as portal but stores its tokens in `_Phân Quyền.RefreshTokens`. On refresh, checks parent's `user.LastLogoutAt` to cascade logout/lock (cached 5 min cross-script).
- **No migration:** Existing logged-in sessions invalidated (users re-login once). Old `SSO_Token`/`SSO_Expiry` columns kept untouched but unused.

**Tech Stack:** Google Apps Script (V8), React 18, gas-core shared library, Jest tests in docmgr.

**Scope:** SSO Portal + docmgr only. workmgr/license-server unchanged (TODO for follow-up).

---

## File Structure

**Create:**
- `packages/gas-core/refresh-token.js` — Core refresh-token primitives (mint, rotate, revoke, validate, lookup).
- `packages/gas-core/handoff.js` — Handoff token primitives (mint, consume — sheet-backed).
- `packages/gas-core/access-token.js` — Access token primitives (mint, validate — cache-backed).
- `packages/gas-core/session-epoch.js` — Epoch check helpers (read user.LastLogoutAt, cached).
- `apps/docmgr/src/server/__tests__/refreshToken.test.js`
- `apps/docmgr/src/server/__tests__/handoff.test.js`
- `apps/docmgr/src/server/__tests__/accessToken.test.js`
- `apps/docmgr/src/server/__tests__/sessionEpoch.test.js`

**Modify:**
- `packages/gas-core/auth-core.js` — Strip old `validateSession`/`logout`; delegate to new modules.
- `packages/gas-core/sso.js` — Remove `ssoValidateToken` + cache (`_ssoValidateCacheKey`, `SSO_VALIDATE_CACHE_TTL`). Keep `ssoStoreParentSheetId`, `ssoGetParentSheetId`, `validatePasswordPolicy`.
- `apps/sso-portal/src/server/config.js` — Add `LastLogoutAt`, `RefreshTokens` columns to USERS schema. Add new `HANDOFFS` sheet.
- `apps/sso-portal/src/server/auth.js` — `login()` returns `{accessToken, refreshToken, user, parentSheetId}`. Remove `SSO_Token`/`SSO_Expiry` writes. Add `portalLogoutAllDevices`. `portalLockUser` bumps LastLogoutAt.
- `apps/sso-portal/src/server/main.js` — Replace `api_validateSession` with `api_resume`. Add `api_createHandoff`, `api_logoutAllDevices`. Keep `api_logout`.
- `apps/sso-portal/src/client/gasClient.js` — Refresh interceptor: catch 'expired' → call api_resume → retry once.
- `apps/sso-portal/src/client/context/AuthContext.jsx` — Replace TOKEN_KEY/SSO_TOKEN_KEY/PARENT_SHEET_KEY/SESSION_CACHE_KEY/VALIDATED_AT_KEY with ACCESS_KEY + REFRESH_KEY + USER_KEY + PARENT_SHEET_KEY. Auto-resume on mount via api_resume. Add storage event listener for multi-tab sync.
- `apps/sso-portal/src/client/components/Dashboard.jsx` — Remove iframeReloadKey + ssoToken-change reload. Call api_createHandoff right before opening iframe; URL has `?handoff=<token>` instead of sso_email+sso_token+parent_sheet_id. Remove blind 30-min reload.
- `apps/sso-portal/src/client/components/AppCard.jsx` — Prefetch still works (no token, just `?prefetch=1`).
- `apps/docmgr/src/server/config.js` — Add `RefreshTokens` column to APP_ROLES schema.
- `apps/docmgr/src/server/auth.js` — Replace `ssoCreateSession` with `mintTokensForUser`. Remove role-sync logic from validateSession (move to api_resume).
- `apps/docmgr/src/server/main.js` — `doGet` reads `?handoff=` instead of `?sso_email=&sso_token=`. Replace `api_validateSession` with `api_resume`. Add `api_logout`. Remove `?prefetch=1` handler (unchanged, keep).
- `apps/docmgr/src/client/gasClient.js` — Refresh interceptor.
- `apps/docmgr/src/client/context/AuthContext.jsx` — TOKEN_KEY → ACCESS_KEY + REFRESH_KEY + USER_KEY. Auto-resume on mount.

**Constants summary:**
- `ACCESS_TOKEN_TTL = 1800` (30 min, in CacheService)
- `REFRESH_TOKEN_TTL_MS = 30 * 86400 * 1000` (30 days sliding, in sheet)
- `HANDOFF_TOKEN_TTL_MS = 60 * 1000` (60s, single-use, in sheet)
- `EPOCH_CACHE_TTL = 300` (5 min, cross-script epoch lookup cache)

---

## Localstorage Schema (client)

**Portal:**
- `sso_access_token`: opaque UUID
- `sso_refresh_token`: opaque UUID
- `sso_user`: JSON of user session data (id, email, role, displayName, etc.)
- `sso_parent_sheet_id`: parent sheet ID (for child handoff URLs)

**docmgr:**
- `docmgr_access_token`: opaque UUID
- `docmgr_refresh_token`: opaque UUID
- `docmgr_user`: JSON of user session data

**Removed keys:** `sso_portal_token`, `sso_portal_sso_token`, `sso_portal_sheet_id`, `sso_portal_session`, `sso_portal_validated_at`, `docmgr_token`.

---

## Sheet Schema Changes

**`_Người Dùng` (portal):** Add columns:
- `LastLogoutAt` — number (unix ms) — session epoch
- `RefreshTokens` — JSON: `[{token, deviceId, createdAt, lastUsedAt, ua, ipHash, label}]`

(Existing `SSO_Token`, `SSO_Expiry` columns left in place but no longer read/written.)

**`_Handoffs` (portal — NEW sheet):**
- Columns: `Token, UserID, AppID, CreatedAt, ExpiresAt, Consumed`
- Single source of truth for handoff validation; child reads via `openById(parent)`.

**`_Phân Quyền` (docmgr):** Add column:
- `RefreshTokens` — JSON: same shape as portal

---

## Error Codes

API responses use existing `{success, payload, error}` wrap. New error semantics for client interceptor:

| Server throws | Client interpretation |
|---|---|
| `'TOKEN_EXPIRED'` | access_token expired → trigger refresh |
| `'TOKEN_REVOKED'` | refresh_token revoked (logout/lock/epoch) → clear localStorage, redirect to login |
| `'HANDOFF_INVALID'` | handoff_token expired/consumed/missing → redirect to portal |
| `'USER_LOCKED'` | user.Trạng thái === 'Locked' → show locked screen |

The client gasClient interceptor distinguishes these to decide retry vs hard logout.

---

## Phase 0 — gas-core Primitives (TDD)

### Task 1: Access token primitives + tests

**Files:**
- Create: `packages/gas-core/access-token.js`
- Create: `apps/docmgr/src/server/__tests__/accessToken.test.js`

- [ ] **Step 1: Write failing tests**

Create `apps/docmgr/src/server/__tests__/accessToken.test.js`:

```js
const { loadGAS, resetGAS } = require('./setup')

describe('access token primitives', () => {
  beforeEach(() => resetGAS())

  test('mintAccessToken returns opaque UUID + caches session', () => {
    loadGAS()
    const token = mintAccessToken({ userId: 'u1', email: 'a@x.com', role: 'admin' })
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(10)
    const session = validateAccessToken(token)
    expect(session.userId).toBe('u1')
    expect(session.email).toBe('a@x.com')
  })

  test('validateAccessToken returns null for unknown token', () => {
    loadGAS()
    expect(validateAccessToken('nope')).toBeNull()
  })

  test('revokeAccessToken kills the token', () => {
    loadGAS()
    const token = mintAccessToken({ userId: 'u1' })
    revokeAccessToken(token)
    expect(validateAccessToken(token)).toBeNull()
  })

  test('validateAccessToken slides cache TTL', () => {
    loadGAS()
    const token = mintAccessToken({ userId: 'u1' })
    // Confirm token still valid after multiple reads
    expect(validateAccessToken(token).userId).toBe('u1')
    expect(validateAccessToken(token).userId).toBe('u1')
  })
})
```

- [ ] **Step 2: Verify test fails**

Run: `npx jest --config apps/docmgr/jest.config.js src/server/__tests__/accessToken.test.js`
Expected: FAIL — `mintAccessToken is not defined`.

- [ ] **Step 3: Implement access-token.js**

Create `packages/gas-core/access-token.js`:

```js
// ===== Access token — short-lived (30 min), cache-only =====

var ACCESS_TOKEN_TTL = 1800 // 30 min — balances security vs sheet write load

function mintAccessToken(sessionData) {
  var token = generateUuid()
  cachePut('at_' + token, sessionData, ACCESS_TOKEN_TTL)
  return token
}

function validateAccessToken(token) {
  if (!token) return null
  var session = cacheGet('at_' + token)
  if (!session) return null
  // Sliding TTL on read — keep alive during active use
  cachePut('at_' + token, session, ACCESS_TOKEN_TTL)
  return session
}

function revokeAccessToken(token) {
  if (token) cacheRemove('at_' + token)
}
```

- [ ] **Step 4: Verify test passes**

Run: `npx jest --config apps/docmgr/jest.config.js src/server/__tests__/accessToken.test.js`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gas-core/access-token.js apps/docmgr/src/server/__tests__/accessToken.test.js
git commit -m "feat(gas-core): add access-token primitives (mint/validate/revoke)"
```

---

### Task 2: Refresh token primitives + tests

**Files:**
- Create: `packages/gas-core/refresh-token.js`
- Create: `apps/docmgr/src/server/__tests__/refreshToken.test.js`

- [ ] **Step 1: Write failing tests**

Create `apps/docmgr/src/server/__tests__/refreshToken.test.js`:

```js
const { loadGAS, resetGAS, getSheetData, setSheetData } = require('./setup')

describe('refresh token primitives', () => {
  beforeEach(() => {
    resetGAS()
    loadGAS()
    setSheetData('_Người Dùng', [
      { ID: 1, Email: 'a@x.com', 'Tên đăng nhập': 'a', RefreshTokens: '', LastLogoutAt: 0 },
    ])
  })

  test('mintRefreshToken adds entry to user.RefreshTokens', () => {
    var token = mintRefreshToken('_Người Dùng', 1, { ua: 'Chrome', ipHash: 'abc', label: 'Laptop' })
    expect(typeof token).toBe('string')
    var users = getSheetData('_Người Dùng')
    var tokens = JSON.parse(users[0].RefreshTokens)
    expect(tokens.length).toBe(1)
    expect(tokens[0].token).toBe(token)
    expect(tokens[0].ua).toBe('Chrome')
    expect(tokens[0].label).toBe('Laptop')
  })

  test('lookupRefreshToken finds user + token entry', () => {
    var token = mintRefreshToken('_Người Dùng', 1, {})
    var found = lookupRefreshToken('_Người Dùng', token)
    expect(found.userId).toBe(1)
    expect(found.entry.token).toBe(token)
  })

  test('lookupRefreshToken returns null for unknown token', () => {
    mintRefreshToken('_Người Dùng', 1, {})
    expect(lookupRefreshToken('_Người Dùng', 'unknown')).toBeNull()
  })

  test('lookupRefreshToken returns null when token expired (lastUsedAt > 30d)', () => {
    var token = mintRefreshToken('_Người Dùng', 1, {})
    var users = getSheetData('_Người Dùng')
    var tokens = JSON.parse(users[0].RefreshTokens)
    tokens[0].lastUsedAt = Date.now() - 31 * 86400 * 1000
    setSheetData('_Người Dùng', [{ ...users[0], RefreshTokens: JSON.stringify(tokens) }])
    expect(lookupRefreshToken('_Người Dùng', token)).toBeNull()
  })

  test('rotateRefreshToken replaces entry, returns new token', () => {
    var oldToken = mintRefreshToken('_Người Dùng', 1, { label: 'Laptop' })
    var newToken = rotateRefreshToken('_Người Dùng', 1, oldToken)
    expect(newToken).not.toBe(oldToken)
    var users = getSheetData('_Người Dùng')
    var tokens = JSON.parse(users[0].RefreshTokens)
    expect(tokens.length).toBe(1)
    expect(tokens[0].token).toBe(newToken)
    expect(tokens[0].label).toBe('Laptop')  // preserved
  })

  test('revokeRefreshToken removes specific entry', () => {
    var t1 = mintRefreshToken('_Người Dùng', 1, {})
    var t2 = mintRefreshToken('_Người Dùng', 1, {})
    revokeRefreshToken('_Người Dùng', 1, t1)
    var users = getSheetData('_Người Dùng')
    var tokens = JSON.parse(users[0].RefreshTokens)
    expect(tokens.length).toBe(1)
    expect(tokens[0].token).toBe(t2)
  })

  test('revokeAllRefreshTokens clears array', () => {
    mintRefreshToken('_Người Dùng', 1, {})
    mintRefreshToken('_Người Dùng', 1, {})
    revokeAllRefreshTokens('_Người Dùng', 1)
    var users = getSheetData('_Người Dùng')
    var tokens = JSON.parse(users[0].RefreshTokens || '[]')
    expect(tokens.length).toBe(0)
  })
})
```

- [ ] **Step 2: Verify test fails**

Run: `npx jest --config apps/docmgr/jest.config.js src/server/__tests__/refreshToken.test.js`
Expected: FAIL — `mintRefreshToken is not defined`.

- [ ] **Step 3: Implement refresh-token.js**

Create `packages/gas-core/refresh-token.js`:

```js
// ===== Refresh token — long-lived (30 days sliding), sheet-backed =====
// Per-device entries in user.RefreshTokens (JSON array).

var REFRESH_TOKEN_TTL_MS = 30 * 86400 * 1000 // 30 days sliding

function _parseRefreshTokens(raw) {
  if (!raw) return []
  try { return JSON.parse(raw) } catch(e) { return [] }
}

function _writeRefreshTokens(sheetName, userId, tokens) {
  var update = { 'RefreshTokens': JSON.stringify(tokens) }
  updateRow(sheetName, userId, update)
}

function mintRefreshToken(sheetName, userId, meta) {
  var now = new Date().getTime()
  var token = generateUuid() + generateUuid().replace(/-/g, '') // double UUID for entropy
  var entry = {
    token: token,
    createdAt: now,
    lastUsedAt: now,
    ua: (meta && meta.ua) || '',
    ipHash: (meta && meta.ipHash) || '',
    label: (meta && meta.label) || '',
  }
  var users = getSheetData(sheetName)
  var user = users.find(function(u) { return String(u['ID']) === String(userId) })
  if (!user) throw new Error('User not found: ' + userId)
  var tokens = _parseRefreshTokens(user['RefreshTokens'])
  tokens.push(entry)
  _writeRefreshTokens(sheetName, userId, tokens)
  return token
}

function lookupRefreshToken(sheetName, token) {
  if (!token) return null
  var users = getSheetData(sheetName)
  var now = new Date().getTime()
  for (var i = 0; i < users.length; i++) {
    var tokens = _parseRefreshTokens(users[i]['RefreshTokens'])
    for (var j = 0; j < tokens.length; j++) {
      if (tokens[j].token === token) {
        // Sliding TTL check — token expired if last used > 30 days ago
        if (now - tokens[j].lastUsedAt > REFRESH_TOKEN_TTL_MS) return null
        return { userId: users[i]['ID'], entry: tokens[j], user: users[i] }
      }
    }
  }
  return null
}

function rotateRefreshToken(sheetName, userId, oldToken) {
  var users = getSheetData(sheetName)
  var user = users.find(function(u) { return String(u['ID']) === String(userId) })
  if (!user) throw new Error('User not found: ' + userId)
  var tokens = _parseRefreshTokens(user['RefreshTokens'])
  var idx = -1
  for (var i = 0; i < tokens.length; i++) {
    if (tokens[i].token === oldToken) { idx = i; break }
  }
  if (idx === -1) throw new Error('TOKEN_NOT_FOUND')
  var now = new Date().getTime()
  var newToken = generateUuid() + generateUuid().replace(/-/g, '')
  tokens[idx] = {
    token: newToken,
    createdAt: tokens[idx].createdAt,
    lastUsedAt: now,
    ua: tokens[idx].ua,
    ipHash: tokens[idx].ipHash,
    label: tokens[idx].label,
  }
  _writeRefreshTokens(sheetName, userId, tokens)
  return newToken
}

function revokeRefreshToken(sheetName, userId, token) {
  var users = getSheetData(sheetName)
  var user = users.find(function(u) { return String(u['ID']) === String(userId) })
  if (!user) return
  var tokens = _parseRefreshTokens(user['RefreshTokens'])
  tokens = tokens.filter(function(t) { return t.token !== token })
  _writeRefreshTokens(sheetName, userId, tokens)
}

function revokeAllRefreshTokens(sheetName, userId) {
  _writeRefreshTokens(sheetName, userId, [])
}
```

- [ ] **Step 4: Verify test passes**

Run: `npx jest --config apps/docmgr/jest.config.js src/server/__tests__/refreshToken.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gas-core/refresh-token.js apps/docmgr/src/server/__tests__/refreshToken.test.js
git commit -m "feat(gas-core): add refresh-token primitives (mint/lookup/rotate/revoke)"
```

---

### Task 3: Session epoch primitives + tests

**Files:**
- Create: `packages/gas-core/session-epoch.js`
- Create: `apps/docmgr/src/server/__tests__/sessionEpoch.test.js`

- [ ] **Step 1: Write failing tests**

Create `apps/docmgr/src/server/__tests__/sessionEpoch.test.js`:

```js
const { loadGAS, resetGAS, getSheetData, setSheetData } = require('./setup')

describe('session epoch', () => {
  beforeEach(() => {
    resetGAS()
    loadGAS()
  })

  test('isBeforeEpoch returns true when token createdAt < user.LastLogoutAt', () => {
    setSheetData('_Người Dùng', [
      { ID: 1, Email: 'a@x.com', LastLogoutAt: 2000 },
    ])
    expect(isBeforeEpoch('_Người Dùng', 1, 1000)).toBe(true)
    expect(isBeforeEpoch('_Người Dùng', 1, 3000)).toBe(false)
  })

  test('isBeforeEpoch returns false when LastLogoutAt missing', () => {
    setSheetData('_Người Dùng', [
      { ID: 1, Email: 'a@x.com', LastLogoutAt: '' },
    ])
    expect(isBeforeEpoch('_Người Dùng', 1, 1000)).toBe(false)
  })

  test('bumpEpoch sets user.LastLogoutAt to now', () => {
    setSheetData('_Người Dùng', [
      { ID: 1, Email: 'a@x.com', LastLogoutAt: 0 },
    ])
    var before = Date.now()
    bumpEpoch('_Người Dùng', 1)
    var users = getSheetData('_Người Dùng')
    expect(Number(users[0].LastLogoutAt)).toBeGreaterThanOrEqual(before)
  })
})
```

- [ ] **Step 2: Verify test fails**

Run: `npx jest --config apps/docmgr/jest.config.js src/server/__tests__/sessionEpoch.test.js`
Expected: FAIL — `isBeforeEpoch is not defined`.

- [ ] **Step 3: Implement session-epoch.js**

Create `packages/gas-core/session-epoch.js`:

```js
// ===== Session epoch — bump LastLogoutAt to invalidate all tokens minted before =====

function isBeforeEpoch(sheetName, userId, tokenCreatedAt) {
  var users = getSheetData(sheetName)
  var user = users.find(function(u) { return String(u['ID']) === String(userId) })
  if (!user) return true // unknown user — treat as revoked
  var epoch = Number(user['LastLogoutAt']) || 0
  if (!epoch) return false
  return Number(tokenCreatedAt) < epoch
}

function bumpEpoch(sheetName, userId) {
  updateRow(sheetName, userId, { 'LastLogoutAt': new Date().getTime() })
}

// Cross-script variant — child opens parent sheet by ID to check parent's epoch.
// Cached 5 min to reduce openById frequency.
var EPOCH_CACHE_TTL = 300 // 5 min

function isBeforeEpochCrossScript(parentSheetId, parentSheetName, userId, tokenCreatedAt) {
  var cacheKey = 'epoch_' + parentSheetId + '_' + userId
  var cached = cacheGet(cacheKey)
  var epoch
  if (cached !== null && cached !== undefined) {
    epoch = Number(cached) || 0
  } else {
    try {
      var ss = SpreadsheetApp.openById(parentSheetId)
      var sheet = ss.getSheetByName(parentSheetName)
      if (!sheet) return true
      var data = sheet.getDataRange().getValues()
      var headers = data[0]
      var idCol = headers.indexOf('ID')
      var epochCol = headers.indexOf('LastLogoutAt')
      if (idCol === -1 || epochCol === -1) return false
      epoch = 0
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][idCol]) === String(userId)) {
          epoch = Number(data[i][epochCol]) || 0
          break
        }
      }
      cachePut(cacheKey, epoch, EPOCH_CACHE_TTL)
    } catch(e) {
      Logger.log('Epoch cross-script error: ' + e.message)
      return false // fail open — don't block on cross-script glitch
    }
  }
  if (!epoch) return false
  return Number(tokenCreatedAt) < epoch
}
```

- [ ] **Step 4: Verify test passes**

Run: `npx jest --config apps/docmgr/jest.config.js src/server/__tests__/sessionEpoch.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gas-core/session-epoch.js apps/docmgr/src/server/__tests__/sessionEpoch.test.js
git commit -m "feat(gas-core): add session-epoch primitives for logout cascade"
```

---

### Task 4: Handoff token primitives + tests

**Files:**
- Create: `packages/gas-core/handoff.js`
- Create: `apps/docmgr/src/server/__tests__/handoff.test.js`

- [ ] **Step 1: Write failing tests**

Create `apps/docmgr/src/server/__tests__/handoff.test.js`:

```js
const { loadGAS, resetGAS, getSheetData, setSheetData } = require('./setup')

describe('handoff tokens', () => {
  beforeEach(() => {
    resetGAS()
    loadGAS()
    setSheetData('_Handoffs', [])
  })

  test('mintHandoff appends row with userId/appId/exp', () => {
    var token = mintHandoff(1, 'docmgr')
    expect(typeof token).toBe('string')
    var rows = getSheetData('_Handoffs')
    expect(rows.length).toBe(1)
    expect(String(rows[0].UserID)).toBe('1')
    expect(rows[0].AppID).toBe('docmgr')
    expect(rows[0].Consumed).toBe('FALSE')
    expect(Number(rows[0].ExpiresAt)).toBeGreaterThan(Date.now())
  })

  test('consumeHandoff returns userId + marks consumed', () => {
    var token = mintHandoff(1, 'docmgr')
    var result = consumeHandoff(token, 'docmgr')
    expect(result.userId).toBe(1)
    var rows = getSheetData('_Handoffs')
    expect(rows[0].Consumed).toBe('TRUE')
  })

  test('consumeHandoff fails on second use (single-use)', () => {
    var token = mintHandoff(1, 'docmgr')
    consumeHandoff(token, 'docmgr')
    expect(() => consumeHandoff(token, 'docmgr')).toThrow('HANDOFF_INVALID')
  })

  test('consumeHandoff fails on wrong appId', () => {
    var token = mintHandoff(1, 'docmgr')
    expect(() => consumeHandoff(token, 'workmgr')).toThrow('HANDOFF_INVALID')
  })

  test('consumeHandoff fails on expired token', () => {
    var token = mintHandoff(1, 'docmgr')
    var rows = getSheetData('_Handoffs')
    rows[0].ExpiresAt = Date.now() - 1000
    setSheetData('_Handoffs', rows)
    expect(() => consumeHandoff(token, 'docmgr')).toThrow('HANDOFF_INVALID')
  })

  test('consumeHandoff fails on unknown token', () => {
    expect(() => consumeHandoff('unknown', 'docmgr')).toThrow('HANDOFF_INVALID')
  })
})
```

- [ ] **Step 2: Verify test fails**

Run: `npx jest --config apps/docmgr/jest.config.js src/server/__tests__/handoff.test.js`
Expected: FAIL — `mintHandoff is not defined`.

- [ ] **Step 3: Implement handoff.js**

Create `packages/gas-core/handoff.js`:

```js
// ===== Handoff token — single-use, 60s TTL, sheet-backed (cross-script readable) =====

var HANDOFF_TOKEN_TTL_MS = 60 * 1000
var SHEET_HANDOFFS = '_Handoffs'

function mintHandoff(userId, appId) {
  var now = new Date().getTime()
  var token = generateUuid() + generateUuid().replace(/-/g, '')
  addRow(SHEET_HANDOFFS, {
    'Token': token,
    'UserID': userId,
    'AppID': appId,
    'CreatedAt': now,
    'ExpiresAt': now + HANDOFF_TOKEN_TTL_MS,
    'Consumed': 'FALSE',
  })
  return token
}

function consumeHandoff(token, expectedAppId) {
  if (!token) throw new Error('HANDOFF_INVALID')
  var rows = getSheetData(SHEET_HANDOFFS)
  var row = rows.find(function(r) { return r['Token'] === token })
  if (!row) throw new Error('HANDOFF_INVALID')
  if (String(row['Consumed']) === 'TRUE') throw new Error('HANDOFF_INVALID')
  if (Number(row['ExpiresAt']) < new Date().getTime()) throw new Error('HANDOFF_INVALID')
  if (row['AppID'] !== expectedAppId) throw new Error('HANDOFF_INVALID')
  updateRow(SHEET_HANDOFFS, row['ID'], { 'Consumed': 'TRUE' })
  return { userId: row['UserID'], appId: row['AppID'] }
}

// Cross-script variant — child calls this with parent sheet ID
function consumeHandoffCrossScript(parentSheetId, token, expectedAppId) {
  if (!token) throw new Error('HANDOFF_INVALID')
  var ss = SpreadsheetApp.openById(parentSheetId)
  var sheet = ss.getSheetByName(SHEET_HANDOFFS)
  if (!sheet) throw new Error('HANDOFF_INVALID')
  var data = sheet.getDataRange().getValues()
  var headers = data[0]
  var col = {
    id: headers.indexOf('ID'),
    token: headers.indexOf('Token'),
    userId: headers.indexOf('UserID'),
    appId: headers.indexOf('AppID'),
    exp: headers.indexOf('ExpiresAt'),
    consumed: headers.indexOf('Consumed'),
  }
  if (col.token === -1) throw new Error('HANDOFF_INVALID')
  for (var i = 1; i < data.length; i++) {
    if (data[i][col.token] === token) {
      if (String(data[i][col.consumed]) === 'TRUE') throw new Error('HANDOFF_INVALID')
      if (Number(data[i][col.exp]) < new Date().getTime()) throw new Error('HANDOFF_INVALID')
      if (data[i][col.appId] !== expectedAppId) throw new Error('HANDOFF_INVALID')
      // Mark consumed — write 'TRUE' to cell
      sheet.getRange(i + 1, col.consumed + 1).setValue('TRUE')
      return { userId: data[i][col.userId], appId: data[i][col.appId] }
    }
  }
  throw new Error('HANDOFF_INVALID')
}
```

- [ ] **Step 4: Verify test passes**

Run: `npx jest --config apps/docmgr/jest.config.js src/server/__tests__/handoff.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gas-core/handoff.js apps/docmgr/src/server/__tests__/handoff.test.js
git commit -m "feat(gas-core): add handoff token primitives (single-use, 60s, cross-script)"
```

---

### Task 5: Strip old auth-core + sso.js

**Files:**
- Modify: `packages/gas-core/auth-core.js`
- Modify: `packages/gas-core/sso.js`

- [ ] **Step 1: Edit auth-core.js**

Replace entire contents of `packages/gas-core/auth-core.js`:

```js
// ===== Auth core — password hashing only =====
// Session management moved to access-token.js / refresh-token.js / session-epoch.js.

function hashPassword(username, password) {
  return _hashPassword(username, password)
}

function _verifyPassword(username, password, storedHash) {
  return _hashPassword(username, password) === storedHash
}
```

- [ ] **Step 2: Edit sso.js**

Replace entire contents of `packages/gas-core/sso.js`:

```js
// ===== SSO parent sheet ID config + password policy =====
// Token validation moved to handoff.js + session-epoch.js.

function ssoGetParentSheetId() {
  return getConfig('SSO_PARENT_SHEET_ID') || ''
}

function ssoStoreParentSheetId(sheetId) {
  if (!sheetId) return
  var current = getConfig('SSO_PARENT_SHEET_ID')
  if (current && current !== sheetId) return
  if (!current) setConfig('SSO_PARENT_SHEET_ID', sheetId)
}

function validatePasswordPolicy(password) {
  if (!password || password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự'
  if (!/[A-Z]/.test(password)) return 'Mật khẩu phải có ít nhất 1 chữ hoa (A-Z)'
  if (!/[a-z]/.test(password)) return 'Mật khẩu phải có ít nhất 1 chữ thường (a-z)'
  if (!/[0-9]/.test(password)) return 'Mật khẩu phải có ít nhất 1 số (0-9)'
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%^&*...)'
  return ''
}
```

- [ ] **Step 3: Verify all existing tests still pass**

Run: `npm run test:docmgr`
Expected: PASS — existing tests + new gas-core tests (will fail if anything calls old `validateSession`/`logout`/`ssoValidateToken`).
If failures, note which tests need updating — fix in Task 13 (server tests update).

- [ ] **Step 4: Commit**

```bash
git add packages/gas-core/auth-core.js packages/gas-core/sso.js
git commit -m "refactor(gas-core): strip old session management, keep password + sso config helpers"
```

---

## Phase 1 — Portal Server

### Task 6: Update portal schema (new columns + _Handoffs sheet)

**Files:**
- Modify: `apps/sso-portal/src/server/config.js:27-29`

- [ ] **Step 1: Edit USERS headers + add _Handoffs**

In `apps/sso-portal/src/server/config.js`, find the `tabDefs` array (around line 26-30) and update:

```js
var SHEETS = {
  USERS: '_Người Dùng',
  APPS: '_Ứng Dụng',
  SYS: '_Hệ Thống',
  HANDOFFS: '_Handoffs',
}
```

```js
var tabDefs = [
  { name: SHEETS.USERS, headers: ['ID', 'Tên đăng nhập', 'Mật khẩu', 'Email', 'Tên nhân viên', 'Trạng thái', 'MustChangePass', 'Đăng nhập cuối', 'Phòng ban', 'Quyền', 'SSO_Token', 'SSO_Expiry', 'RefreshTokens', 'LastLogoutAt'] },
  { name: SHEETS.APPS,  headers: ['ID', 'Tên App', 'Webapp URL', 'Icon', 'Mô tả', 'Trạng thái'] },
  { name: SHEETS.SYS,   headers: ['Key', 'Value'] },
  { name: SHEETS.HANDOFFS, headers: ['ID', 'Token', 'UserID', 'AppID', 'CreatedAt', 'ExpiresAt', 'Consumed'] },
]
```

Note: `ensureMissingColumns` (already called in `_ensureAllTabsExist`) will add new columns to existing sheets automatically. New `_Handoffs` sheet will be created on next `ensureInitialized` call.

- [ ] **Step 2: Commit**

```bash
git add apps/sso-portal/src/server/config.js
git commit -m "feat(sso): add RefreshTokens, LastLogoutAt, _Handoffs schema"
```

---

### Task 7: Update bundle-server include order

**Files:**
- Modify: `scripts/bundle-server.js`

- [ ] **Step 1: Verify new gas-core files included automatically**

Run: `node scripts/bundle-server.js --app sso-portal`
Expected: Should bundle the new files. Inspect output `apps/sso-portal/dist/gas/Code.js` and confirm `mintAccessToken`, `mintRefreshToken`, `mintHandoff`, `bumpEpoch` appear.

If not, find the gas-core file order list in `scripts/bundle-server.js` and add the new files:

```js
const gasCoreOrder = [
  'config-base', 'cache', 'utils', 'sheets-crud',
  'auth-core',
  'access-token', 'refresh-token', 'session-epoch', 'handoff',  // ← NEW
  'drive-io', 'license', 'sso',
]
```

(Exact field name varies — check existing file.)

- [ ] **Step 2: Commit if changed**

```bash
git add scripts/bundle-server.js
git commit -m "build: include new gas-core auth modules in bundle order"
```

If bundle already picks them up (e.g., glob), no changes needed — skip commit.

---

### Task 8: Portal login() returns refresh+access tokens

**Files:**
- Modify: `apps/sso-portal/src/server/auth.js:3-49`

- [ ] **Step 1: Rewrite login()**

In `apps/sso-portal/src/server/auth.js`, replace the `login()` function:

```js
function login(email, password) {
  var users = getSheetData(SHEETS.USERS)
  var user = users.find(function(u) { return u['Email'] && u['Email'].toLowerCase() === email.toLowerCase() })

  if (!user) throw new Error('Email hoặc mật khẩu không đúng')
  if (user['Trạng thái'] === 'Locked') throw new Error('Tài khoản đã bị khóa. Liên hệ quản trị viên.')
  if (!_verifyPassword(user['Tên đăng nhập'], password, user['Mật khẩu'])) {
    throw new Error('Email hoặc mật khẩu không đúng')
  }

  updateRow(SHEETS.USERS, user['ID'], { 'Đăng nhập cuối': now() })

  var ownerEmail = ''
  try { ownerEmail = getAppSheet().getOwner().getEmail() } catch(e) {}
  var isOwner = !!(ownerEmail && user['Email'].toLowerCase() === ownerEmail.toLowerCase())
  var isAdmin = isOwner || user['Quyền'] === 'Quản trị'

  var sessionData = {
    userId: user['ID'],
    username: user['Tên đăng nhập'],
    email: user['Email'],
    displayName: user['Tên nhân viên'] || user['Email'],
    role: isAdmin ? 'admin' : 'user',
    isOwner: isOwner,
    mustChangePass: user['MustChangePass'] === 'TRUE' || user['MustChangePass'] === true,
  }

  var refreshToken = mintRefreshToken(SHEETS.USERS, user['ID'], { label: 'Web' })
  var accessToken = mintAccessToken(sessionData)

  return {
    accessToken: accessToken,
    refreshToken: refreshToken,
    user: sessionData,
    parentSheetId: getAppSheet().getId(),
  }
}
```

- [ ] **Step 2: Add portalLogoutAllDevices to auth.js**

Append to `apps/sso-portal/src/server/auth.js`:

```js
function portalLogoutAllDevices(userId) {
  revokeAllRefreshTokens(SHEETS.USERS, userId)
  bumpEpoch(SHEETS.USERS, userId)
  return { success: true }
}
```

- [ ] **Step 3: Update portalLockUser to bump epoch + revoke all**

Find existing `portalLockUser` function. Replace body to:

```js
function portalLockUser(token, targetUserId) {
  requireAdminAccess(token)  // function name may vary; use whatever validates admin
  updateRow(SHEETS.USERS, targetUserId, { 'Trạng thái': 'Locked' })
  revokeAllRefreshTokens(SHEETS.USERS, targetUserId)
  bumpEpoch(SHEETS.USERS, targetUserId)
  return { success: true }
}
```

If `requireAdminAccess` doesn't exist, use whatever admin check the file already uses (e.g., a `requireAdmin(token)` helper that throws if not admin). Find current usage in the file and match it.

- [ ] **Step 4: Commit**

```bash
git add apps/sso-portal/src/server/auth.js
git commit -m "feat(sso): login returns access+refresh tokens; lock/logoutAll bump epoch"
```

---

### Task 9: Portal main.js — replace endpoints

**Files:**
- Modify: `apps/sso-portal/src/server/main.js`

- [ ] **Step 1: Replace api_validateSession with api_resume**

In `apps/sso-portal/src/server/main.js`, delete the existing `SSO_ROTATE_INTERVAL_MS` constant and replace `api_validateSession` with `api_resume`:

```js
function api_resume(refreshToken) {
  return _wrap(function() {
    var found = lookupRefreshToken(SHEETS.USERS, refreshToken)
    if (!found) throw new Error('TOKEN_REVOKED')
    var user = found.user
    if (user['Trạng thái'] === 'Locked') throw new Error('USER_LOCKED')
    if (isBeforeEpoch(SHEETS.USERS, found.userId, found.entry.createdAt)) {
      // Token minted before epoch bump — revoke and reject
      revokeRefreshToken(SHEETS.USERS, found.userId, refreshToken)
      throw new Error('TOKEN_REVOKED')
    }

    var ownerEmail = ''
    try { ownerEmail = getAppSheet().getOwner().getEmail() } catch(e) {}
    var isOwner = !!(ownerEmail && user['Email'] && user['Email'].toLowerCase() === ownerEmail.toLowerCase())
    var isAdmin = isOwner || user['Quyền'] === 'Quản trị'

    var sessionData = {
      userId: user['ID'],
      username: user['Tên đăng nhập'],
      email: user['Email'],
      displayName: user['Tên nhân viên'] || user['Email'],
      role: isAdmin ? 'admin' : 'user',
      isOwner: isOwner,
      mustChangePass: user['MustChangePass'] === 'TRUE' || user['MustChangePass'] === true,
    }

    var newRefreshToken = rotateRefreshToken(SHEETS.USERS, found.userId, refreshToken)
    var newAccessToken = mintAccessToken(sessionData)

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: sessionData,
      parentSheetId: getAppSheet().getId(),
    }
  })
}
```

- [ ] **Step 2: Replace api_logout**

Replace the existing `api_logout`:

```js
function api_logout(refreshToken) {
  return _wrap(function() {
    var found = lookupRefreshToken(SHEETS.USERS, refreshToken)
    if (found) {
      revokeRefreshToken(SHEETS.USERS, found.userId, refreshToken)
    }
    return { success: true }
  })
}
```

- [ ] **Step 3: Add api_logoutAllDevices**

Append after `api_logout`:

```js
function api_logoutAllDevices(accessToken) {
  return _wrap(function() {
    var session = validateAccessToken(accessToken)
    if (!session) throw new Error('TOKEN_EXPIRED')
    return portalLogoutAllDevices(session.userId)
  })
}
```

- [ ] **Step 4: Add api_createHandoff**

Append:

```js
function api_createHandoff(accessToken, appId) {
  return _wrap(function() {
    var session = validateAccessToken(accessToken)
    if (!session) throw new Error('TOKEN_EXPIRED')
    if (!appId) throw new Error('Missing appId')
    var handoffToken = mintHandoff(session.userId, appId)
    return { handoffToken: handoffToken }
  })
}
```

- [ ] **Step 5: Update other api_* wrappers to use validateAccessToken**

Find every existing `api_*` function that does `requireAuth(token)` or similar — they all need to use `validateAccessToken` now. Search pattern: `requireAuth\|requireAdmin`.

Replace each with:

```js
var session = validateAccessToken(token)
if (!session) throw new Error('TOKEN_EXPIRED')
// (for admin endpoints) if (session.role !== 'admin') throw new Error('Chỉ admin')
```

OR — simpler — fix the helpers themselves. In `apps/sso-portal/src/server/auth.js`, find `requireAuth` and `requireAdmin` and replace bodies:

```js
function requireAuth(accessToken) {
  var session = validateAccessToken(accessToken)
  if (!session) throw new Error('TOKEN_EXPIRED')
  return session
}

function requireAdmin(accessToken) {
  var session = requireAuth(accessToken)
  if (session.role !== 'admin') throw new Error('Chỉ quản trị viên mới có quyền')
  return session
}
```

(Existing call sites unchanged — just the implementations.)

- [ ] **Step 6: Commit**

```bash
git add apps/sso-portal/src/server/main.js apps/sso-portal/src/server/auth.js
git commit -m "feat(sso): api_resume, api_createHandoff, api_logoutAllDevices; access-token-based auth"
```

---

## Phase 2 — Portal Client

### Task 10: Portal gasClient refresh interceptor

**Files:**
- Modify: `apps/sso-portal/src/client/gasClient.js`

- [ ] **Step 1: Add refresh interceptor**

Open `apps/sso-portal/src/client/gasClient.js`. Find the success handler block (around line 65-93 based on docmgr's similar file). The portal's file may have similar structure.

Add at top of file:

```js
const ACCESS_KEY = 'sso_access_token'
const REFRESH_KEY = 'sso_refresh_token'
const USER_KEY = 'sso_user'
const PARENT_SHEET_KEY = 'sso_parent_sheet_id'

let _refreshInFlight = null

function _doRefresh() {
  if (_refreshInFlight) return _refreshInFlight
  const rt = localStorage.getItem(REFRESH_KEY)
  if (!rt) return Promise.reject(new Error('TOKEN_REVOKED'))
  _refreshInFlight = new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(res => {
        _refreshInFlight = null
        if (res && res.success) {
          localStorage.setItem(ACCESS_KEY, res.payload.accessToken)
          localStorage.setItem(REFRESH_KEY, res.payload.refreshToken)
          localStorage.setItem(USER_KEY, JSON.stringify(res.payload.user))
          if (res.payload.parentSheetId) localStorage.setItem(PARENT_SHEET_KEY, res.payload.parentSheetId)
          resolve(res.payload.accessToken)
        } else {
          // Hard logout
          localStorage.removeItem(ACCESS_KEY)
          localStorage.removeItem(REFRESH_KEY)
          localStorage.removeItem(USER_KEY)
          reject(new Error((res && res.error) || 'TOKEN_REVOKED'))
        }
      })
      .withFailureHandler(err => {
        _refreshInFlight = null
        reject(err)
      })
      .api_resume(rt)
  })
  return _refreshInFlight
}
```

Then in the success handler, detect `TOKEN_EXPIRED` error and retry:

```js
// Inside withSuccessHandler, after `if (res && res.success)` else branch:
if (errMsg === 'TOKEN_EXPIRED' && !args.__retried) {
  args.__retried = true
  _doRefresh()
    .then(newAccess => {
      // Replace token arg if it's the first arg (convention)
      if (args.length > 0 && args[0] === localStorage.getItem(ACCESS_KEY)) {
        args[0] = newAccess
      }
      _activeCount--
      _queue.unshift({ fnName, args, resolve, reject, retries, totalRetries, baseDelayMs })
      _processQueue()
    })
    .catch(refreshErr => {
      window.dispatchEvent(new CustomEvent('auth:sessionExpired', { detail: { message: refreshErr.message } }))
      reject(new Error(refreshErr.message))
    })
  return
}
```

Note: The exact line-level integration depends on the existing gasClient structure. The principle is:
1. Catch `TOKEN_EXPIRED` from any API response
2. Call `_doRefresh()` (deduplicated)
3. Update access_token arg in queued call
4. Re-queue and process

If existing `_isSessionExpired(errMsg)` check exists, expand it to include 'TOKEN_EXPIRED' string. Adapt the retry logic to use `_doRefresh` instead of immediately firing `auth:sessionExpired`.

- [ ] **Step 2: Verify build**

Run: `npm run build:sso`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add apps/sso-portal/src/client/gasClient.js
git commit -m "feat(sso): client refresh interceptor — auto-resume on TOKEN_EXPIRED"
```

---

### Task 11: Portal AuthContext — refresh-token flow

**Files:**
- Modify: `apps/sso-portal/src/client/context/AuthContext.jsx`

- [ ] **Step 1: Replace entire file**

Replace `apps/sso-portal/src/client/context/AuthContext.jsx` contents:

```jsx
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import gasCall from '../gasClient.js'

const AuthContext = createContext(null)

const ACCESS_KEY = 'sso_access_token'
const REFRESH_KEY = 'sso_refresh_token'
const USER_KEY = 'sso_user'
const PARENT_SHEET_KEY = 'sso_parent_sheet_id'

function _clearAuthStorage() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(PARENT_SHEET_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const expiredFiredRef = useRef(false)

  // Auto-resume on mount
  useEffect(() => {
    const rt = localStorage.getItem(REFRESH_KEY)
    if (!rt) { setLoading(false); return }

    // Optimistic: render from cached user
    const cachedUser = localStorage.getItem(USER_KEY)
    if (cachedUser) {
      try { setUser(JSON.parse(cachedUser)) } catch(_) {}
    }

    gasCall('api_resume', rt)
      .then(res => {
        localStorage.setItem(ACCESS_KEY, res.accessToken)
        localStorage.setItem(REFRESH_KEY, res.refreshToken)
        localStorage.setItem(USER_KEY, JSON.stringify(res.user))
        if (res.parentSheetId) localStorage.setItem(PARENT_SHEET_KEY, res.parentSheetId)
        setUser(res.user)
        setLoading(false)
      })
      .catch(() => {
        _clearAuthStorage()
        setUser(null)
        setLoading(false)
      })
  }, [])

  const login = useCallback(async (email, password) => {
    expiredFiredRef.current = false
    const res = await gasCall('api_login', email, password)
    localStorage.setItem(ACCESS_KEY, res.accessToken)
    localStorage.setItem(REFRESH_KEY, res.refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    localStorage.setItem(PARENT_SHEET_KEY, res.parentSheetId)
    setUser(res.user)
    return res
  }, [])

  const logout = useCallback(async () => {
    const rt = localStorage.getItem(REFRESH_KEY)
    _clearAuthStorage()
    setUser(null)
    if (rt) await gasCall('api_logout', rt).catch(() => {})
  }, [])

  const logoutAllDevices = useCallback(async () => {
    const at = localStorage.getItem(ACCESS_KEY)
    if (at) await gasCall('api_logoutAllDevices', at).catch(() => {})
    _clearAuthStorage()
    setUser(null)
  }, [])

  // Session-expired event (from gasClient interceptor)
  useEffect(() => {
    function handleExpired() {
      if (expiredFiredRef.current) return
      expiredFiredRef.current = true
      setSessionExpired(true)
    }
    window.addEventListener('auth:sessionExpired', handleExpired)
    return () => window.removeEventListener('auth:sessionExpired', handleExpired)
  }, [])

  // Multi-tab sync — when another tab changes refresh_token, reload to re-validate
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== REFRESH_KEY) return
      if (e.newValue !== e.oldValue) {
        window.location.reload()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const acknowledgeExpiry = useCallback(async () => {
    setSessionExpired(false)
    _clearAuthStorage()
    setUser(null)
  }, [])

  const value = {
    session: user,
    loading,
    login,
    logout,
    logoutAllDevices,
    sessionExpired,
    acknowledgeExpiry,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 2: Update Dashboard.jsx to read from new context shape**

Find any references to `useAuth().ssoToken` or `useAuth().parentSheetId` in Dashboard.jsx. They no longer exist on context — read from localStorage instead OR add explicit getters to context. Simplest: read at point of use:

```js
// Inside Dashboard component
const ssoUser = useAuth().session
// where needed: localStorage.getItem('sso_parent_sheet_id')
```

(Dashboard rework happens in Task 12.)

- [ ] **Step 3: Commit**

```bash
git add apps/sso-portal/src/client/context/AuthContext.jsx
git commit -m "feat(sso): AuthContext uses refresh-token auto-resume; multi-tab sync"
```

---

### Task 12: Dashboard — handoff flow + remove rotation reload

**Files:**
- Modify: `apps/sso-portal/src/client/components/Dashboard.jsx`

- [ ] **Step 1: Replace iframe URL builder + opener**

In `apps/sso-portal/src/client/components/Dashboard.jsx`, find `buildIframeUrl` and the `useEffect` that watches `ssoToken` change. Replace with handoff-based flow:

```jsx
const [activeApp, setActiveApp] = useState(null)
const [iframeUrl, setIframeUrl] = useState('')
const [openingApp, setOpeningApp] = useState(false)

async function openApp(app) {
  if (!app['Webapp URL']) {
    addToast('App chưa có URL', 'error')
    return
  }
  setOpeningApp(true)
  try {
    const accessToken = localStorage.getItem('sso_access_token')
    const { handoffToken } = await gasCall('api_createHandoff', accessToken, app['ID'])
    const base = app['Webapp URL']
    const sep = base.includes('?') ? '&' : '?'
    const url = base + sep + 'handoff=' + encodeURIComponent(handoffToken)
    localStorage.setItem(LAST_APP_KEY, String(app.ID))
    setIframeUrl(url)
    setActiveApp(app)
  } catch (err) {
    addToast(err.message, 'error')
  } finally {
    setOpeningApp(false)
  }
}
```

- [ ] **Step 2: Remove ssoToken change reload + prevSsoTokenRef**

Delete the `useEffect` that does `setIframeReloadKey` on ssoToken change. Delete `prevSsoTokenRef`, `iframeReloadKey` state, `&_r=` cache-buster from URL. Keep `setActiveApp(null)` for back-to-dashboard.

- [ ] **Step 3: Update prefetch to use handoff URL? No — keep prefetch as ?prefetch=1**

Prefetch in `AppCard` is fine — it uses `?prefetch=1` which doesn't need a token, just warms the GAS container.

- [ ] **Step 4: Pass url prop to IframeOverlay**

```jsx
if (activeApp) {
  return (
    <IframeOverlay
      url={iframeUrl}
      apps={apps.filter(a => a['Webapp URL'])}
      activeApp={activeApp}
      onSwitch={openApp}
      onBack={() => { localStorage.removeItem(LAST_APP_KEY); setActiveApp(null); setIframeUrl('') }}
    />
  )
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build:sso`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add apps/sso-portal/src/client/components/Dashboard.jsx
git commit -m "feat(sso): handoff-based iframe open; remove rotation reload"
```

---

## Phase 3 — docmgr Server

### Task 13: Update docmgr schema

**Files:**
- Modify: `apps/docmgr/src/server/config.js:27`

- [ ] **Step 1: Add RefreshTokens column to APP_ROLES**

Find APP_ROLES headers:

```js
{ name: SHEETS.APP_ROLES, headers: ['ID', 'UserID', 'Tên đăng nhập', 'AppID', 'Quyền', 'Phân quyền chi tiết', 'Được tạo hồ sơ', 'Được tạo danh mục con', 'RefreshTokens'] },
```

- [ ] **Step 2: Commit**

```bash
git add apps/docmgr/src/server/config.js
git commit -m "feat(docmgr): add RefreshTokens column to _Phân Quyền schema"
```

---

### Task 14: docmgr doGet — consume handoff

**Files:**
- Modify: `apps/docmgr/src/server/main.js:1-145`

- [ ] **Step 1: Rewrite doGet**

Replace `doGet` function in `apps/docmgr/src/server/main.js`:

```js
function doGet(e) {
  try {
    // Warm-up ping — no session created
    if (e && e.parameter && e.parameter.prefetch === '1') {
      return HtmlService.createHtmlOutput('<!doctype html><title>warm</title>')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    }

    ensureInitialized()

    var handoff = e && e.parameter && e.parameter.handoff
    var parentSheetId = e && e.parameter && e.parameter.parent_sheet_id

    if (parentSheetId) {
      ssoStoreParentSheetId(parentSheetId)
    }

    var injectedAccess = ''
    var injectedRefresh = ''
    var injectedUser = null

    if (handoff) {
      // Consume handoff (cross-script to parent sheet)
      var parentId = ssoGetParentSheetId()
      if (!parentId) {
        return _errorPage('Chưa cấu hình SSO_PARENT_SHEET_ID', 'Liên hệ admin.')
      }
      var consumed
      try {
        consumed = consumeHandoffCrossScript(parentId, handoff, APP_ID)
      } catch(err) {
        return _errorPage('Handoff không hợp lệ', 'Vui lòng mở lại từ SSO Portal.')
      }

      // Load user from parent sheet
      var parentSs = SpreadsheetApp.openById(parentId)
      var parentUsers = parentSs.getSheetByName('_Người Dùng').getDataRange().getValues()
      var headers = parentUsers[0]
      var userRow = null
      for (var i = 1; i < parentUsers.length; i++) {
        if (String(parentUsers[i][headers.indexOf('ID')]) === String(consumed.userId)) {
          userRow = {}
          headers.forEach(function(h, c) { userRow[h] = parentUsers[i][c] })
          break
        }
      }
      if (!userRow) return _errorPage('Không tìm thấy user', '')

      // Auto-assign role if not exists in local APP_ROLES
      var roles = getSheetData(SHEETS.APP_ROLES)
      var appRole = roles.find(function(r) {
        return String(r['UserID']) === String(userRow['ID']) && r['AppID'] === APP_ID
      })
      if (!appRole) {
        var ownerEmail = ''
        try { ownerEmail = getCentralSheet().getOwner().getEmail() } catch(e) {}
        var autoRole = (userRow['Email'] && ownerEmail && String(userRow['Email']).toLowerCase() === ownerEmail.toLowerCase()) ? 'admin' : 'Nhân viên'
        addRow(SHEETS.APP_ROLES, {
          'UserID': userRow['ID'],
          'Tên đăng nhập': userRow['Tên đăng nhập'],
          'AppID': APP_ID,
          'Quyền': autoRole,
          'Phân quyền chi tiết': '',
        })
        invalidateSheetCache(SHEETS.APP_ROLES)
        roles = getSheetData(SHEETS.APP_ROLES)
        appRole = roles.find(function(r) { return String(r['UserID']) === String(userRow['ID']) && r['AppID'] === APP_ID })
      }

      // Mint child tokens
      var tokens = _mintTokensForUser(userRow, appRole)
      injectedAccess = tokens.accessToken
      injectedRefresh = tokens.refreshToken
      injectedUser = tokens.session
    }

    var content = HtmlService.createHtmlOutputFromFile('index').getContent()
    if (injectedAccess) {
      var parts = [
        'window.__ACCESS_TOKEN__=' + JSON.stringify(injectedAccess) + ';',
        'window.__REFRESH_TOKEN__=' + JSON.stringify(injectedRefresh) + ';',
        'window.__USER__=' + JSON.stringify(injectedUser) + ';',
      ]
      // Initial data (existing pattern)
      try {
        var lookups = getAllData(injectedUser)
        var docsResult = getDocuments(injectedAccess, {})
        var docs = docsResult.data || []
        var byStatus = {}
        var totalValue = 0
        docs.forEach(function(d) {
          var s = d['Tình trạng'] || 'Không rõ'
          byStatus[s] = (byStatus[s] || 0) + 1
          totalValue += Number(d['Giá trị HĐ']) || 0
        })
        var daDocRows = getSheetData(SHEETS.DA_DOC)
        var unreadIds = daDocRows
          .filter(function(r) { return String(r['UserID']) === String(injectedUser.userId) })
          .map(function(r) { return String(r['DocID']) })
        var companyName = getConfig('COMPANY_NAME') || ''
        var initialData = {
          lookups: lookups, docs: docs,
          stats: { total: docs.length, byStatus: byStatus, totalValue: totalValue },
          unreadIds: unreadIds, companyName: companyName,
        }
        var isAdmin = injectedUser.role === 'admin' || injectedUser.role === 'Quản trị viên' || injectedUser.role === 'Giám đốc'
        if (isAdmin) {
          initialData.configs = {
            ROOT_FOLDER_ID: getConfig('ROOT_FOLDER_ID') || null,
            ROOT_FOLDER_NAME: getConfig('ROOT_FOLDER_NAME') || null,
            COMPANY_NAME: companyName || null,
            MAIL_TEMPLATES: getConfig('MAIL_TEMPLATES') || null,
            APP_URL: getConfig('APP_URL') || null,
          }
        }
        parts.push('window.__INITIAL_DATA__=' + JSON.stringify(initialData) + ';')
      } catch(dataErr) {
        Logger.log('doGet inject initial data error: ' + dataErr.message)
      }
      content = content.replace('</head>', '<script>' + parts.join('') + '</script></head>')
    }
    return HtmlService.createHtmlOutput(content)
      .setTitle('Quản Lý Tài Liệu')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)

  } catch(err) {
    return HtmlService.createHtmlOutput('<h2>Lỗi</h2><p>' + (err && err.message ? err.message : String(err)) + '</p>')
  }
}

function _errorPage(title, message) {
  return HtmlService.createHtmlOutput(
    '<html><head><meta charset="UTF-8"><style>'
    + 'body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f2f5}'
    + '.box{text-align:center;background:#fff;padding:48px 32px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:400px}'
    + '</style></head><body><div class="box">'
    + '<div style="font-size:48px;margin-bottom:16px">&#128274;</div>'
    + '<h2 style="color:#c62828;margin-bottom:8px">' + title + '</h2>'
    + '<p style="color:#6b7280">' + message + '</p>'
    + '</div></body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

function _mintTokensForUser(user, appRole) {
  var depts = []
  try {
    var deptVal = user['Phòng ban']
    if (deptVal && typeof deptVal === 'string' && deptVal.charAt(0) === '[') depts = JSON.parse(deptVal)
    else if (deptVal) depts = [deptVal]
  } catch(e) {}

  var perms = getPermissions(appRole)
  var canCreate = (perms && perms.hoSo && perms.hoSo.c) || appRole['Được tạo hồ sơ'] === 'TRUE' || appRole['Được tạo hồ sơ'] === true
  var canCreateSubCat = (perms && perms.danhMuc && perms.danhMuc.c) || appRole['Được tạo danh mục con'] === 'TRUE' || appRole['Được tạo danh mục con'] === true

  var sessionData = {
    userId: user['ID'],
    username: user['Tên đăng nhập'],
    name: user['Tên nhân viên'] || user['Tên đăng nhập'] || '',
    email: user['Email'],
    role: appRole['Quyền'],
    departments: depts,
    permissions: perms,
    canCreate: !!canCreate,
    canCreateSubCat: !!canCreateSubCat,
  }

  // Find the APP_ROLES row ID for the refresh-token entry
  var roles = getSheetData(SHEETS.APP_ROLES)
  var roleRow = roles.find(function(r) { return String(r['UserID']) === String(user['ID']) && r['AppID'] === APP_ID })
  var refreshToken = mintRefreshToken(SHEETS.APP_ROLES, roleRow['ID'], { label: 'Web', ipHash: '' })
  var accessToken = mintAccessToken(sessionData)

  return { accessToken: accessToken, refreshToken: refreshToken, session: sessionData }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/docmgr/src/server/main.js
git commit -m "feat(docmgr): doGet consumes handoff token, mints child refresh+access"
```

---

### Task 15: docmgr api_resume + api_logout + helpers

**Files:**
- Modify: `apps/docmgr/src/server/main.js` (continue from Task 14)

- [ ] **Step 1: Replace api_validateSession with api_resume**

Delete the old `api_validateSession`. Add:

```js
function api_resume(refreshToken) {
  return _wrap(function() {
    var found = lookupRefreshToken(SHEETS.APP_ROLES, refreshToken)
    if (!found) throw new Error('TOKEN_REVOKED')
    var roleRow = found.user

    // Cross-script epoch check against parent SSO portal
    var parentId = ssoGetParentSheetId()
    if (parentId && isBeforeEpochCrossScript(parentId, '_Người Dùng', roleRow['UserID'], found.entry.createdAt)) {
      revokeRefreshToken(SHEETS.APP_ROLES, roleRow['ID'], refreshToken)
      throw new Error('TOKEN_REVOKED')
    }

    // Reload user info from parent for fresh email/dept
    var userInfo = null
    if (parentId) {
      try {
        var parentSs = SpreadsheetApp.openById(parentId)
        var parentUsers = parentSs.getSheetByName('_Người Dùng').getDataRange().getValues()
        var headers = parentUsers[0]
        for (var i = 1; i < parentUsers.length; i++) {
          if (String(parentUsers[i][headers.indexOf('ID')]) === String(roleRow['UserID'])) {
            userInfo = {}
            headers.forEach(function(h, c) { userInfo[h] = parentUsers[i][c] })
            break
          }
        }
      } catch(e) { Logger.log('Parent lookup error: ' + e.message) }
    }
    if (!userInfo) throw new Error('TOKEN_REVOKED')
    if (userInfo['Trạng thái'] === 'Locked') {
      revokeRefreshToken(SHEETS.APP_ROLES, roleRow['ID'], refreshToken)
      throw new Error('USER_LOCKED')
    }

    var perms = getPermissions(roleRow)
    var depts = []
    try {
      var dv = userInfo['Phòng ban']
      if (dv && typeof dv === 'string' && dv.charAt(0) === '[') depts = JSON.parse(dv)
      else if (dv) depts = [dv]
    } catch(e) {}

    var sessionData = {
      userId: userInfo['ID'],
      username: userInfo['Tên đăng nhập'],
      name: userInfo['Tên nhân viên'] || userInfo['Tên đăng nhập'] || '',
      email: userInfo['Email'],
      role: roleRow['Quyền'],
      departments: depts,
      permissions: perms,
      canCreate: !!(perms && perms.hoSo && perms.hoSo.c),
      canCreateSubCat: !!(perms && perms.danhMuc && perms.danhMuc.c),
    }

    var newRefreshToken = rotateRefreshToken(SHEETS.APP_ROLES, roleRow['ID'], refreshToken)
    var newAccessToken = mintAccessToken(sessionData)
    return { accessToken: newAccessToken, refreshToken: newRefreshToken, user: sessionData }
  })
}

function api_logout(refreshToken) {
  return _wrap(function() {
    var found = lookupRefreshToken(SHEETS.APP_ROLES, refreshToken)
    if (found) revokeRefreshToken(SHEETS.APP_ROLES, found.userId, refreshToken)
    return { success: true }
  })
}
```

- [ ] **Step 2: Update requireAuth in docmgr/auth.js**

In `apps/docmgr/src/server/auth.js`, replace `requireAuth`:

```js
function requireAuth(accessToken) {
  var session = validateAccessToken(accessToken)
  if (!session) throw new Error('TOKEN_EXPIRED')
  return session
}
```

Remove `ssoCreateSession` function (replaced by `_mintTokensForUser` in main.js).

Also remove `SESSION_TTL` references that are no longer used.

- [ ] **Step 3: Verify existing tests still pass**

Run: `npm run test:docmgr`
Expected: PASS — some tests may need updates for new error messages. Update if needed.

- [ ] **Step 4: Commit**

```bash
git add apps/docmgr/src/server/main.js apps/docmgr/src/server/auth.js
git commit -m "feat(docmgr): api_resume with epoch check; api_logout; access-token auth"
```

---

## Phase 4 — docmgr Client

### Task 16: docmgr gasClient refresh interceptor

**Files:**
- Modify: `apps/docmgr/src/client/gasClient.js`

- [ ] **Step 1: Mirror Task 10 portal interceptor for docmgr**

Add at top of `apps/docmgr/src/client/gasClient.js`:

```js
const ACCESS_KEY = 'docmgr_access_token'
const REFRESH_KEY = 'docmgr_refresh_token'
const USER_KEY = 'docmgr_user'

let _refreshInFlight = null

function _doRefresh() {
  if (_refreshInFlight) return _refreshInFlight
  const rt = localStorage.getItem(REFRESH_KEY)
  if (!rt) return Promise.reject(new Error('TOKEN_REVOKED'))
  _refreshInFlight = new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(res => {
        _refreshInFlight = null
        if (res && res.success) {
          localStorage.setItem(ACCESS_KEY, res.payload.accessToken)
          localStorage.setItem(REFRESH_KEY, res.payload.refreshToken)
          localStorage.setItem(USER_KEY, JSON.stringify(res.payload.user))
          resolve(res.payload.accessToken)
        } else {
          localStorage.removeItem(ACCESS_KEY)
          localStorage.removeItem(REFRESH_KEY)
          localStorage.removeItem(USER_KEY)
          reject(new Error((res && res.error) || 'TOKEN_REVOKED'))
        }
      })
      .withFailureHandler(err => { _refreshInFlight = null; reject(err) })
      .api_resume(rt)
  })
  return _refreshInFlight
}
```

In the existing success handler error branch, integrate:

```js
if (errMsg === 'TOKEN_EXPIRED' && !args.__retried) {
  args.__retried = true
  _doRefresh()
    .then(newAccess => {
      if (args.length > 0) args[0] = newAccess
      _activeCount--
      _queue.unshift({ fnName, args, resolve, reject, retries, totalRetries, baseDelayMs })
      _processQueue()
    })
    .catch(refreshErr => {
      window.dispatchEvent(new CustomEvent('auth:sessionExpired', { detail: { message: refreshErr.message } }))
      reject(new Error(refreshErr.message))
    })
  return
}
```

Make sure the existing `_isSessionExpired` check matches 'TOKEN_EXPIRED'.

- [ ] **Step 2: Commit**

```bash
git add apps/docmgr/src/client/gasClient.js
git commit -m "feat(docmgr): client refresh interceptor — auto-resume on TOKEN_EXPIRED"
```

---

### Task 17: docmgr AuthContext — refresh-token flow

**Files:**
- Modify: `apps/docmgr/src/client/context/AuthContext.jsx`

- [ ] **Step 1: Replace entire file**

Replace `apps/docmgr/src/client/context/AuthContext.jsx`:

```jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import gasCall from '../gasClient.js'

const AuthContext = createContext(null)

const ACCESS_KEY = 'docmgr_access_token'
const REFRESH_KEY = 'docmgr_refresh_token'
const USER_KEY = 'docmgr_user'

function _clearAuth() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [accessError, setAccessError] = useState('')

  useEffect(() => {
    // Priority 1: tokens injected by doGet (fresh handoff)
    const injectedAccess = window.__ACCESS_TOKEN__
    const injectedRefresh = window.__REFRESH_TOKEN__
    const injectedUser = window.__USER__
    if (injectedAccess && injectedRefresh && injectedUser) {
      window.__ACCESS_TOKEN__ = ''
      window.__REFRESH_TOKEN__ = ''
      window.__USER__ = null
      localStorage.setItem(ACCESS_KEY, injectedAccess)
      localStorage.setItem(REFRESH_KEY, injectedRefresh)
      localStorage.setItem(USER_KEY, JSON.stringify(injectedUser))
      setSession({ ...injectedUser, accessToken: injectedAccess })
      setLoading(false)
      return
    }

    // Priority 2: saved refresh_token → auto-resume
    const rt = localStorage.getItem(REFRESH_KEY)
    if (rt) {
      gasCall('api_resume', rt)
        .then(res => {
          localStorage.setItem(ACCESS_KEY, res.accessToken)
          localStorage.setItem(REFRESH_KEY, res.refreshToken)
          localStorage.setItem(USER_KEY, JSON.stringify(res.user))
          setSession({ ...res.user, accessToken: res.accessToken })
          setLoading(false)
        })
        .catch(err => {
          _clearAuth()
          setAccessDenied(true)
          if (err.message === 'USER_LOCKED') {
            setAccessError('Tài khoản đã bị khóa. Liên hệ admin.')
          } else {
            setAccessError('Phiên đăng nhập hết hạn. Vui lòng mở lại từ SSO Portal.')
          }
          setLoading(false)
        })
      return
    }

    setAccessDenied(true)
    setAccessError('Vui lòng truy cập qua SSO Portal.')
    setLoading(false)
  }, [])

  const logout = useCallback(async () => {
    const rt = localStorage.getItem(REFRESH_KEY)
    setSession(null)
    _clearAuth()
    if (rt) await gasCall('api_logout', rt).catch(() => {})
    setAccessDenied(true)
    setAccessError('Đã đăng xuất.')
  }, [])

  useEffect(() => {
    function handleExpired() {
      setSession(null)
      _clearAuth()
      setAccessDenied(true)
      setAccessError('Phiên đăng nhập đã hết hạn. Vui lòng mở lại từ SSO Portal.')
    }
    window.addEventListener('auth:sessionExpired', handleExpired)
    return () => window.removeEventListener('auth:sessionExpired', handleExpired)
  }, [])

  const value = { session, loading, accessDenied, accessError, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 2: Update any session.token references to session.accessToken**

Search docmgr client for `session.token` and replace with `session.accessToken`:

```bash
grep -rn "session\.token\|session?.token" apps/docmgr/src/client/
```

Update each match.

- [ ] **Step 3: Verify build + tests**

Run: `npm run build:docmgr && npm run test:docmgr`
Expected: build success, tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/docmgr/src/client/context/AuthContext.jsx apps/docmgr/src/client/
git commit -m "feat(docmgr): AuthContext uses refresh-token auto-resume + handoff inject"
```

---

## Phase 5 — Cleanup & Integration

### Task 18: Remove old SSO_Token/SSO_Expiry write paths

**Files:**
- Modify: `apps/sso-portal/src/server/auth.js`
- Modify: `apps/sso-portal/src/server/main.js`

- [ ] **Step 1: Remove SSO_Token / SSO_Expiry writes in auth.js**

Search `apps/sso-portal/src/server/auth.js` for 'SSO_Token' and 'SSO_Expiry'. Remove any remaining `updateRow(...{'SSO_Token': ...})` calls. Already removed in Task 8 but double-check.

- [ ] **Step 2: Search for any remaining refs across all source**

```bash
grep -rn "SSO_Token\|SSO_Expiry\|SSO_TOKEN_TTL\|ssoCreateSession\|ssoValidateToken" apps/sso-portal/src/ apps/docmgr/src/ packages/gas-core/ | grep -v __tests__
```

Expected: no matches (or only references in sheet column comments). Remove any straggler code.

- [ ] **Step 3: Commit if cleanups made**

```bash
git add -u
git commit -m "chore: remove leftover SSO_Token references"
```

---

### Task 19: Add "Logout all devices" UI in portal

**Files:**
- Modify: `apps/sso-portal/src/client/components/Dashboard.jsx` (user menu)

- [ ] **Step 1: Add menu item**

Find the user menu dropdown in Dashboard.jsx (around line 156-176). Add between "Đổi mật khẩu" and "Đăng xuất":

```jsx
<button onClick={async () => {
  if (await confirm('Đăng xuất khỏi tất cả thiết bị? Bạn sẽ phải đăng nhập lại trên mọi nơi.')) {
    await logoutAllDevices()
  }
}}
  className="w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container flex items-center gap-2 transition">
  <span className="material-symbols-outlined text-lg">devices_off</span>
  Đăng xuất tất cả thiết bị
</button>
```

Get `logoutAllDevices` from useAuth().

- [ ] **Step 2: Add 'devices_off' icon to index.html icon_names**

In `apps/sso-portal/src/client/index.html`, find the `icon_names=` query param and add `devices_off` to the list.

- [ ] **Step 3: Build + commit**

```bash
npm run build:sso
git add apps/sso-portal/src/client/
git commit -m "feat(sso): add 'Logout all devices' menu item"
```

---

### Task 20: Full integration test

**Files:** (no new files)

- [ ] **Step 1: Run full test suite**

```bash
npm run test:docmgr
```

Expected: All tests pass (including 4 new test files from Phase 0).

- [ ] **Step 2: Build all**

```bash
npm run build:sso && npm run build:docmgr
```

Expected: both build successfully.

- [ ] **Step 3: Deploy**

```bash
node scripts/deploy.js --app sso-portal && node scripts/deploy.js --app docmgr
```

Expected: both deploy to existing deployment IDs.

- [ ] **Step 4: Manual smoke test**

Open SSO Portal URL. Verify:
1. Login → dashboard appears
2. Click docmgr → iframe opens with content
3. Reload portal page → still logged in (auto-resume working)
4. Logout → redirected to login
5. Login again → reach dashboard
6. Open docmgr → load
7. Wait > 30 min (or manually clear access token in DevTools localStorage) → make an API call → should silently refresh and succeed
8. Admin lock a test user → that user's open iframe stops working ≤ 30 min
9. "Logout all devices" → all sessions die

- [ ] **Step 5: Commit any small fixes from smoke test**

```bash
git add -u
git commit -m "fix: minor issues from integration smoke test"
```

---

## Self-review checklist (reference for executor)

After completing all tasks, verify:

- [ ] No references to `SSO_Token`, `SSO_Expiry`, `ssoValidateToken`, `ssoCreateSession`, `SSO_TOKEN_TTL`, `SSO_VALIDATE_CACHE_TTL`, `SESSION_TTL`, `SSO_ROTATE_INTERVAL_MS` remain in source (only in sheet column definitions, which are kept for backward compatibility).
- [ ] No references to localStorage keys `sso_portal_token`, `sso_portal_sso_token`, `sso_portal_sheet_id`, `sso_portal_session`, `sso_portal_validated_at`, `docmgr_token` remain in source.
- [ ] `api_validateSession` removed from both portal and docmgr server.
- [ ] `api_resume`, `api_createHandoff`, `api_logoutAllDevices` exist in portal server.
- [ ] `api_resume`, `api_logout` exist in docmgr server.
- [ ] doGet in docmgr reads `?handoff=` (not `?sso_email=&sso_token=`).
- [ ] Dashboard.jsx calls `api_createHandoff` before opening iframe.
- [ ] Storage event listener in portal AuthContext for multi-tab sync.
- [ ] All 4 new gas-core test files pass.

---

## Risk notes

- **Cross-script `openById` cost**: Each child api_resume opens parent sheet (epoch check + user lookup). ~1-2s. Acceptable since refresh is once per 30 min.
- **Race condition on concurrent refresh**: Two tabs refresh same refresh_token simultaneously → second one fails because token was rotated by first. Client interceptor uses `_refreshInFlight` deduplication, but cross-tab race is still possible. Acceptable — second tab will see TOKEN_REVOKED and reload via storage event.
- **Handoff replay attack**: Handoff is single-use, marked `Consumed=TRUE` in sheet. Reload of doGet URL fails on second try → user must go back to portal. This is intended.
- **Audit log**: Not implemented in this plan. Add as follow-up (append to `_Nhật Ký` sheet on every login/refresh/revoke/lock).
- **workmgr / license-server**: Unchanged. To migrate, apply Phase 3-4 pattern to each child app individually.
