// GAS client — calls google.script.run (real) or mock (dev)

const IS_GAS = typeof google !== 'undefined' && google.script && google.script.run

const ACCESS_KEY = 'sso_access_token'
const REFRESH_KEY = 'sso_refresh_token'
const USER_KEY = 'sso_user'
const PARENT_SHEET_KEY = 'sso_parent_sheet_id'

let _refreshInFlight = null

// Token errors that should NOT be retried (genuine auth failures)
const _FATAL_TOKEN_ERRORS = ['TOKEN_REVOKED', 'USER_LOCKED']

function _doRefreshOnce(rt) {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          const p = res.payload
          localStorage.setItem(ACCESS_KEY, p.accessToken)
          localStorage.setItem(REFRESH_KEY, p.refreshToken)
          localStorage.setItem(USER_KEY, JSON.stringify(p.user))
          if (p.parentSheetId) localStorage.setItem(PARENT_SHEET_KEY, p.parentSheetId)
          resolve(p.accessToken)
        } else {
          const errMsg = (res && res.error) || 'TOKEN_REVOKED'
          reject(new Error(errMsg))
        }
      })
      .withFailureHandler(err => reject(err))
      .api_resume(rt)
  })
}

function _doRefresh() {
  if (_refreshInFlight) return _refreshInFlight
  const rt = localStorage.getItem(REFRESH_KEY)
  if (!rt) return Promise.reject(new Error('TOKEN_REVOKED'))
  _refreshInFlight = _doRefreshOnce(rt).catch(err => {
    // Fatal token errors — don't retry
    if (_FATAL_TOKEN_ERRORS.includes(err.message)) {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem(USER_KEY)
      throw err
    }
    // Transient error (network not ready after wake) — retry once after 2s
    return new Promise(r => setTimeout(r, 2000)).then(() => _doRefreshOnce(rt))
  }).catch(err => {
    // Final failure — clean up if token error
    if (_FATAL_TOKEN_ERRORS.includes(err.message)) {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem(USER_KEY)
    }
    throw err
  }).finally(() => { _refreshInFlight = null })
  return _refreshInFlight
}

function gasCall(fnName, ...args) {
  if (IS_GAS) {
    return _gasCallOnce(fnName, args).catch(err => {
      if (err.message === 'TOKEN_EXPIRED') {
        return _doRefresh().then(newAccess => {
          // Replace first arg if it was the (now-stale) access token
          const newArgs = [...args]
          if (newArgs.length > 0 && typeof newArgs[0] === 'string' && newArgs[0].length > 10) {
            newArgs[0] = newAccess
          }
          return _gasCallOnce(fnName, newArgs)
        }).catch(refreshErr => {
          window.dispatchEvent(new CustomEvent('auth:sessionExpired', { detail: { message: refreshErr.message } }))
          throw refreshErr
        })
      }
      if (err.message === 'TOKEN_REVOKED' || err.message === 'USER_LOCKED') {
        window.dispatchEvent(new CustomEvent('auth:sessionExpired', { detail: { message: err.message } }))
      }
      throw err
    })
  }
  // Dev only — mock is dynamically imported so it's dead-code-eliminated from
  // the production bundle (Vite replaces process.env.NODE_ENV at build time).
  if (process.env.NODE_ENV !== 'production') {
    return import('./gasClient.mock.js').then(m => m.mockCall(fnName, ...args))
  }
  return Promise.reject(new Error('gasClient: no GAS runtime available'))
}

function _gasCallOnce(fnName, args) {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          resolve(res.payload)
        } else {
          const errMsg = res ? res.error : 'Lỗi không xác định'
          reject(new Error(errMsg))
        }
      })
      .withFailureHandler(err => reject(new Error(err.message || String(err))))
      [fnName](...args)
  })
}

export default gasCall
