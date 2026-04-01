import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import gasCall from '../gasClient.js'

const AuthContext = createContext(null)

const TOKEN_KEY = 'docmgr_token'

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [loading, setLoading]   = useState(true)

  // Attempt to restore session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (!saved) { setLoading(false); return }
    gasCall('api_validateSession', saved)
      .then(sess => { setSession({ ...sess.user, token: saved }); setLoading(false) })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setLoading(false) })
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await gasCall('api_login', username, password)
    localStorage.setItem(TOKEN_KEY, res.token)
    setSession({ ...res.user, token: res.token })
    return res
  }, [])

  const logout = useCallback(async () => {
    const token = session?.token
    setSession(null)
    localStorage.removeItem(TOKEN_KEY)
    if (token) await gasCall('api_logout', token).catch(() => {})
  }, [session])

  const value = { session, loading, login, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
