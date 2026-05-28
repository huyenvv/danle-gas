import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import gasCall from '../gasClient.js'

const AuthContext = createContext(null)

const ACCESS_KEY = 'sso_access_token'
const REFRESH_KEY = 'sso_refresh_token'
const USER_KEY = 'sso_user'
const PARENT_SHEET_KEY = 'sso_parent_sheet_id'

// --- Device info (fetched once on load, non-blocking) ---
function _parseUA() {
  const ua = navigator.userAgent
  let browser = 'Unknown', os = 'Unknown'
  if (/Edg\//.test(ua)) browser = 'Edge ' + (ua.match(/Edg\/([\d.]+)/)||[])[1]
  else if (/OPR\//.test(ua)) browser = 'Opera ' + (ua.match(/OPR\/([\d.]+)/)||[])[1]
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome ' + (ua.match(/Chrome\/([\d.]+)/)||[])[1]
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari ' + (ua.match(/Version\/([\d.]+)/)||[])[1]
  else if (/Firefox\//.test(ua)) browser = 'Firefox ' + (ua.match(/Firefox\/([\d.]+)/)||[])[1]
  if (/Windows NT 10/.test(ua)) os = /Windows NT 10\.0/.test(ua) ? 'Windows 10+' : 'Windows'
  else if (/Mac OS X/.test(ua)) os = 'macOS ' + ((ua.match(/Mac OS X ([\d_]+)/)||[])[1]||'').replace(/_/g,'.')
  else if (/Android/.test(ua)) os = 'Android ' + (ua.match(/Android ([\d.]+)/)||[])[1]
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS ' + ((ua.match(/OS ([\d_]+)/)||[])[1]||'').replace(/_/g,'.')
  else if (/Linux/.test(ua)) os = 'Linux'
  return { browser, os }
}

const _deviceInfoPromise = (async () => {
  const { browser, os } = _parseUA()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  const screen = `${window.screen.width}×${window.screen.height}`
  let ip = ''
  try {
    const r = await fetch('https://api.ipify.org?format=text', { signal: AbortSignal.timeout(3000) })
    ip = await r.text()
  } catch {}
  return { ip, browser, os, screen, tz }
})()

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
    const deviceInfo = await _deviceInfoPromise
    const res = await gasCall('api_login', email, password, deviceType, deviceInfo)
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
