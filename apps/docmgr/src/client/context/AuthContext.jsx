import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import gasCall from '../gasClient.js'

const AuthContext = createContext(null)

const TOKEN_KEY = 'docmgr_token'

export function AuthProvider({ children }) {
  const [session, setSession]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [accessError, setAccessError]   = useState('')

  function doAutoLogin() {
    gasCall('api_autoLogin')
      .then(res => {
        localStorage.setItem(TOKEN_KEY, res.token)
        setSession({ ...res.user, token: res.token })
        setLoading(false)
      })
      .catch(err => {
        setAccessDenied(true)
        setAccessError(err.message || 'Không có quyền truy cập')
        setLoading(false)
      })
  }

  // On mount: try to restore saved session, then fall back to auto-login
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (!saved) { doAutoLogin(); return }
    gasCall('api_validateSession', saved)
      .then(sess => {
        if (!sess) throw new Error('Session expired')
        setSession({ ...sess, token: saved })
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        doAutoLogin()
      })
  }, [])

  const logout = useCallback(async () => {
    const token = session?.token
    setSession(null)
    localStorage.removeItem(TOKEN_KEY)
    if (token) await gasCall('api_logout', token).catch(() => {})
    window.location.reload()
  }, [session])

  const value = { session, loading, accessDenied, accessError, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
