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
    function _storeSession(res) {
      localStorage.setItem(ACCESS_KEY, res.accessToken)
      localStorage.setItem(REFRESH_KEY, res.refreshToken)
      localStorage.setItem(USER_KEY, JSON.stringify(res.user))
      setSession({ ...res.user })
      setLoading(false)
    }
    function _fail(msg) {
      _clearAuth()
      setAccessDenied(true)
      setAccessError(msg)
      setLoading(false)
    }

    // Priority 1: SSO token from portal → exchange for local session.
    // SSO is authoritative: drop any stale local auth so MainApp doesn't render
    // (from a cached user) and fire API calls with the previous user's AT/RT
    // while api_ssoLogin is still in flight.
    const ssoToken = window.__SSO_TOKEN__
    const ssoParent = window.__SSO_PARENT__
    if (ssoToken) {
      window.__SSO_TOKEN__ = ''
      window.__SSO_PARENT__ = ''
      _clearAuth()
      const deviceType = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      gasCall('api_ssoLogin', ssoParent, ssoToken, deviceType)
        .then(_storeSession)
        .catch(err => _fail(err.message === 'USER_LOCKED'
          ? 'Tài khoản đã bị khóa. Liên hệ admin.'
          : 'Phiên đăng nhập hết hạn. Vui lòng mở lại từ SSO Portal.'))
      return
    }

    // Priority 2: saved refresh_token → auto-resume
    const rt = localStorage.getItem(REFRESH_KEY)
    if (rt) {
      const cached = localStorage.getItem(USER_KEY)
      if (cached) {
        try { setSession(JSON.parse(cached)); setLoading(false) } catch (_) {}
      }
      gasCall('api_resume', rt)
        .then(_storeSession)
        .catch(err => _fail(err.message === 'USER_LOCKED'
          ? 'Tài khoản đã bị khóa. Liên hệ admin.'
          : 'Phiên đăng nhập hết hạn. Vui lòng mở lại từ SSO Portal.'))
      return
    }

    // Dev mode: auto-login with mock when no SSO token and no refresh token
    if (import.meta.env.DEV) {
      localStorage.setItem(REFRESH_KEY, 'dev-auto')
      gasCall('api_resume', 'dev-auto')
        .then(_storeSession)
        .catch(err => _fail(err.message))
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
      // Notify parent portal → triggers immediate session check
      try { window.parent.postMessage({ type: 'child:sessionExpired' }, '*') } catch (_) {}
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
