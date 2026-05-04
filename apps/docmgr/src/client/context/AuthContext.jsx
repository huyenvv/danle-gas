import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import gasCall from '../gasClient.js'

const AuthContext = createContext(null)

const TOKEN_KEY = 'docmgr_token'

export function AuthProvider({ children }) {
  const [session, setSession]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [accessError, setAccessError]   = useState('')

  useEffect(() => {
    // Priority 1: SSO token injected by doGet
    const ssoToken = window.__SSO_TOKEN__
    if (ssoToken) {
      window.__SSO_TOKEN__ = ''
      gasCall('api_validateSession', ssoToken)
        .then(sess => {
          localStorage.setItem(TOKEN_KEY, ssoToken)
          setSession({ ...sess, token: ssoToken })
          setLoading(false)
        })
        .catch(err => {
          setAccessDenied(true)
          setAccessError(err.message || 'Phiên SSO không hợp lệ')
          setLoading(false)
        })
      return
    }

    // Priority 2: Saved session from localStorage
    const saved = localStorage.getItem(TOKEN_KEY)
    if (saved) {
      gasCall('api_validateSession', saved)
        .then(sess => {
          if (!sess) throw new Error('expired')
          setSession({ ...sess, token: saved })
          setLoading(false)
        })
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY)
          setAccessDenied(true)
          setAccessError('Phiên đăng nhập hết hạn. Vui lòng mở lại từ SSO Portal.')
          setLoading(false)
        })
      return
    }

    // No SSO token, no saved session
    setAccessDenied(true)
    setAccessError('Vui lòng truy cập qua SSO Portal.')
    setLoading(false)
  }, [])

  const logout = useCallback(async () => {
    const token = session?.token
    setSession(null)
    localStorage.removeItem(TOKEN_KEY)
    if (token) await gasCall('api_logout', token).catch(() => {})
    setAccessDenied(true)
    setAccessError('Đã đăng xuất. Vui lòng mở lại từ SSO Portal.')
  }, [session])

  useEffect(() => {
    function handleExpired() {
      setSession(null)
      localStorage.removeItem(TOKEN_KEY)
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
