import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import gasCall from '../gasClient.js'

const AuthContext = createContext(null)

const ACCESS_KEY = 'sso_access_token'
const REFRESH_KEY = 'sso_refresh_token'
const USER_KEY = 'sso_user'
const PARENT_SHEET_KEY = 'sso_parent_sheet_id'

function _clearAuthStorage() {
  // Clear ALL localStorage — portal + child apps share script.google.com origin.
  // Prevents stale child-app tokens when switching users.
  localStorage.clear()
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tokenFresh, setTokenFresh] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const expiredFiredRef = useRef(false)

  // Auto-resume on mount.
  // No cached-user optimistic UI: showing Dashboard before tokenFresh lets the user
  // click an app card while LS still holds the previous session's (now-rotated)
  // access token, so the iframe URL would carry a stale AT and child-app
  // validateAccessTokenCrossScript would return SSO_TOKEN_EXPIRED.
  useEffect(() => {
    const rt = localStorage.getItem(REFRESH_KEY)
    if (!rt) { setLoading(false); return }

    gasCall('api_resume', rt)
      .then(res => {
        localStorage.setItem(ACCESS_KEY, res.accessToken)
        localStorage.setItem(REFRESH_KEY, res.refreshToken)
        localStorage.setItem(USER_KEY, JSON.stringify(res.user))
        if (res.parentSheetId) localStorage.setItem(PARENT_SHEET_KEY, res.parentSheetId)
        setUser(res.user)
        setTokenFresh(true)
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
    const deviceType = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    const res = await gasCall('api_login', email, password, deviceType)
    localStorage.setItem(ACCESS_KEY, res.accessToken)
    localStorage.setItem(REFRESH_KEY, res.refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    localStorage.setItem(PARENT_SHEET_KEY, res.parentSheetId)
    setUser(res.user)
    setTokenFresh(true)
    return res
  }, [])

  const logout = useCallback(async () => {
    const rt = localStorage.getItem(REFRESH_KEY)
    _clearAuthStorage()
    setUser(null)
    setTokenFresh(false)
    if (rt) await gasCall('api_logout', rt).catch(() => {})
  }, [])

  const updateSession = useCallback((updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev)
  }, [])

  // Session-expired event (from gasClient interceptor or server)
  useEffect(() => {
    function handleExpired() {
      if (expiredFiredRef.current) return
      expiredFiredRef.current = true
      setSessionExpired(true)
    }
    window.addEventListener('auth:sessionExpired', handleExpired)
    return () => window.removeEventListener('auth:sessionExpired', handleExpired)
  }, [])

  // Heartbeat is handled by PortalDataContext (api_portalSync every 60s + visibilitychange)

  // Multi-tab sync — when another tab changes REFRESH_KEY, reload
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== REFRESH_KEY) return
      if (e.newValue !== e.oldValue) window.location.reload()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const acknowledgeExpiry = useCallback(async () => {
    setSessionExpired(false)
    _clearAuthStorage()
    setUser(null)
    setTokenFresh(false)
  }, [])

  const value = {
    session: user,
    loading,
    tokenFresh,
    login,
    logout,
    updateSession,
    sessionExpired,
    acknowledgeExpiry,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
