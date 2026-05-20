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
