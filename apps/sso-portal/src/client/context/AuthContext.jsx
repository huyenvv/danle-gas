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

    // Optimistic: render from cached user immediately
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
  }, [])

  const value = {
    session: user,
    loading,
    login,
    logout,
    logoutAllDevices,
    updateSession,
    sessionExpired,
    acknowledgeExpiry,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
