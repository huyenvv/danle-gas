import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import gasCall from '../gasClient.js'

const AuthContext = createContext(null)

const TOKEN_KEY = 'sso_portal_token'
const SSO_TOKEN_KEY = 'sso_portal_sso_token'
const PARENT_SHEET_KEY = 'sso_portal_sheet_id'
const SESSION_CACHE_KEY = 'sso_portal_session'
const VALIDATED_AT_KEY = 'sso_portal_validated_at'
const BG_VALIDATE_INTERVAL = 10 * 60 * 1000 // 10 phút

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ssoToken, setSsoToken] = useState('')
  const [parentSheetId, setParentSheetId] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const expiredFiredRef = useRef(false)

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (!saved) { setLoading(false); return }

    // Optimistic load: hiển thị ngay từ cache nếu có
    const cachedSession = localStorage.getItem(SESSION_CACHE_KEY)
    if (cachedSession) {
      try {
        const sess = JSON.parse(cachedSession)
        setSession({ ...sess, token: saved })
        setSsoToken(localStorage.getItem(SSO_TOKEN_KEY) || '')
        setParentSheetId(localStorage.getItem(PARENT_SHEET_KEY) || '')
        setLoading(false)

        // Validate ngầm — chỉ khi đã quá 10 phút kể từ lần validate cuối
        const lastValidated = Number(localStorage.getItem(VALIDATED_AT_KEY) || 0)
        if (Date.now() - lastValidated < BG_VALIDATE_INTERVAL) return

        gasCall('api_validateSession', saved)
          .then(fresh => {
            if (!fresh) throw new Error('expired')
            localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(fresh))
            localStorage.setItem(VALIDATED_AT_KEY, String(Date.now()))
            setSession({ ...fresh, token: saved })
            // Server rotate SSO_Token mỗi 5h — đồng bộ về client
            if (fresh.ssoToken && fresh.ssoToken !== localStorage.getItem(SSO_TOKEN_KEY)) {
              localStorage.setItem(SSO_TOKEN_KEY, fresh.ssoToken)
              setSsoToken(fresh.ssoToken)
            }
          })
          .catch(() => {
            // Token hết hạn — clear và force logout
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(SSO_TOKEN_KEY)
            localStorage.removeItem(PARENT_SHEET_KEY)
            localStorage.removeItem(SESSION_CACHE_KEY)
            localStorage.removeItem(VALIDATED_AT_KEY)
            expiredFiredRef.current = true
            setSessionExpired(true)
          })
        return
      } catch (_) { /* cache lỗi, validate bình thường */ }
    }

    // Chưa có cache — validate bình thường (lần đầu sau login)
    gasCall('api_validateSession', saved)
      .then(sess => {
        if (!sess) throw new Error('expired')
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(sess))
        localStorage.setItem(VALIDATED_AT_KEY, String(Date.now()))
        setSession({ ...sess, token: saved })
        // Ưu tiên ssoToken vừa rotate từ server (nếu có), fallback về localStorage
        const ssoFromServer = sess.ssoToken
        const ssoCurrent = localStorage.getItem(SSO_TOKEN_KEY) || ''
        if (ssoFromServer && ssoFromServer !== ssoCurrent) {
          localStorage.setItem(SSO_TOKEN_KEY, ssoFromServer)
        }
        setSsoToken(ssoFromServer || ssoCurrent)
        setParentSheetId(localStorage.getItem(PARENT_SHEET_KEY) || '')
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(SSO_TOKEN_KEY)
        localStorage.removeItem(PARENT_SHEET_KEY)
        localStorage.removeItem(SESSION_CACHE_KEY)
        localStorage.removeItem(VALIDATED_AT_KEY)
        setLoading(false)
      })
  }, [])

  const login = useCallback(async (email, password) => {
    expiredFiredRef.current = false
    const res = await gasCall('api_login', email, password)
    localStorage.setItem(TOKEN_KEY, res.token)
    localStorage.setItem(SSO_TOKEN_KEY, res.ssoToken)
    localStorage.setItem(PARENT_SHEET_KEY, res.parentSheetId)
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(res.user))
    localStorage.setItem(VALIDATED_AT_KEY, String(Date.now()))
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
    localStorage.removeItem(SESSION_CACHE_KEY)
    localStorage.removeItem(VALIDATED_AT_KEY)
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

  // Heartbeat: ping api_validateSession mỗi 30 phút.
  // Server sẽ rotate SSO_Token nếu đã 5h kể từ lần rotate gần nhất.
  // Khi token rotate, đồng bộ về localStorage + state → Dashboard sẽ phát hiện thay đổi
  // và reload iframe app con với URL chứa token mới.
  useEffect(() => {
    if (!session?.token) return
    const id = setInterval(() => {
      gasCall('api_validateSession', session.token)
        .then(fresh => {
          if (!fresh) return
          localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(fresh))
          localStorage.setItem(VALIDATED_AT_KEY, String(Date.now()))
          if (fresh.ssoToken && fresh.ssoToken !== localStorage.getItem(SSO_TOKEN_KEY)) {
            localStorage.setItem(SSO_TOKEN_KEY, fresh.ssoToken)
            setSsoToken(fresh.ssoToken)
          }
        })
        .catch(() => { /* lỗi mạng tạm thời — bỏ qua, lần API call tiếp theo sẽ trigger expire nếu thực sự hết */ })
    }, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [session?.token])

  const value = { session, loading, ssoToken, parentSheetId, login, logout, updateSession, sessionExpired, acknowledgeExpiry }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
