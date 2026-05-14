import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import gasCall from '../gasClient.js'

const AuthContext = createContext(null)

const TOKEN_KEY = 'sso_portal_token'
const SSO_TOKEN_KEY = 'sso_portal_sso_token'
const PARENT_SHEET_KEY = 'sso_portal_sheet_id'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ssoToken, setSsoToken] = useState('')
  const [parentSheetId, setParentSheetId] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const expiredFiredRef = useRef(false)

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (!saved) {
      setLoading(false)
      return
    }
    gasCall('api_validateSession', saved)
      .then(sess => {
        if (!sess) throw new Error('expired')
        setSession({ ...sess, token: saved })
        setSsoToken(localStorage.getItem(SSO_TOKEN_KEY) || '')
        setParentSheetId(localStorage.getItem(PARENT_SHEET_KEY) || '')
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(SSO_TOKEN_KEY)
        localStorage.removeItem(PARENT_SHEET_KEY)
        setLoading(false)
      })
  }, [])

  const login = useCallback(async (email, password) => {
    expiredFiredRef.current = false
    const res = await gasCall('api_login', email, password)
    localStorage.setItem(TOKEN_KEY, res.token)
    localStorage.setItem(SSO_TOKEN_KEY, res.ssoToken)
    localStorage.setItem(PARENT_SHEET_KEY, res.parentSheetId)
    setSession({ ...res.user, token: res.token })
    setSsoToken(res.ssoToken)
    setParentSheetId(res.parentSheetId)
    return res
  }, [])

  const logout = useCallback(async () => {
    const token = session?.token
    setSession(null)
    setSsoToken('')
    setParentSheetId('')
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(SSO_TOKEN_KEY)
    localStorage.removeItem(PARENT_SHEET_KEY)
    if (token) await gasCall('api_logout', token).catch(() => {})
  }, [session])

  const updateSession = useCallback((updates) => {
    setSession(prev => prev ? { ...prev, ...updates } : prev)
  }, [])

  const expireSession = useCallback(() => {
    if (expiredFiredRef.current) return
    expiredFiredRef.current = true
    setSessionExpired(true)
  }, [])

  const acknowledgeExpiry = useCallback(async () => {
    setSessionExpired(false)
    await logout()
  }, [logout])

  // Server is source of truth — sliding window in validateSession() keeps session alive
  // during active use. Modal only fires when an actual API call returns session expired.
  useEffect(() => {
    window.__onSessionExpired = expireSession
    return () => { window.__onSessionExpired = null }
  }, [expireSession])

  const value = { session, loading, ssoToken, parentSheetId, login, logout, updateSession, sessionExpired, acknowledgeExpiry }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
