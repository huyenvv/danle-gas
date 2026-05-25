import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useToast } from './ToastContext.jsx'
import gasCall from '../gasClient.js'

const PortalDataContext = createContext(null)

const APPS_CACHE_KEY = 'sso_apps_cache'
const USERS_CACHE_KEY = 'sso_users_cache'
const MAIL_CACHE_KEY = 'sso_mail_config_cache'
const PHONGBAN_CACHE_KEY = 'sso_phongban_cache'
const ASSIGNMENTS_CACHE_KEY = 'sso_assignments_cache'

export function PortalDataProvider({ children }) {
  const { tokenFresh } = useAuth()
  const { addToast } = useToast()

  const [apps, setApps] = useState(() => {
    if (typeof window !== 'undefined' && window.__INITIAL_APPS__) {
      const data = window.__INITIAL_APPS__
      delete window.__INITIAL_APPS__
      try { localStorage.setItem(APPS_CACHE_KEY, JSON.stringify(data)) } catch (_) {}
      return data
    }
    try { return JSON.parse(localStorage.getItem(APPS_CACHE_KEY)) || [] } catch (_) { return [] }
  })

  const [users, setUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USERS_CACHE_KEY)) || [] } catch (_) { return [] }
  })

  const [mailConfig, setMailConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem(MAIL_CACHE_KEY)) || {} } catch (_) { return {} }
  })

  const [phongBan, setPhongBan] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PHONGBAN_CACHE_KEY)) || [] } catch (_) { return [] }
  })

  const [assignments, setAssignments] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ASSIGNMENTS_CACHE_KEY)) || [] } catch (_) { return [] }
  })

  const [loadingApps, setLoadingApps] = useState(apps.length === 0)
  // `syncing` = true while we're re-validating session after the tab was
  // backgrounded long enough that AT may have gone stale. Blocks user clicks
  // (via overlay) so they can't open an app with a stale token in its URL.
  const [syncing, setSyncing] = useState(false)
  const hiddenAtRef = useRef(0)
  const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000 // AT lifetime (24h) — only block UI when token likely expired

  const sync = useCallback((silent = false) => {
    if (!silent) setLoadingApps(true)
    const token = localStorage.getItem('sso_access_token')
    return gasCall('api_portalSync', token)
      .then(data => {
        // Only update state when data actually changed — avoids re-renders
        // that would destroy preloaded iframes in Dashboard
        if (data.apps) {
          const json = JSON.stringify(data.apps)
          setApps(prev => {
            if (JSON.stringify(prev) === json) return prev
            try { localStorage.setItem(APPS_CACHE_KEY, json) } catch (_) {}
            return data.apps
          })
        }
        if (data.users !== undefined) {
          const json = JSON.stringify(data.users)
          setUsers(prev => {
            if (JSON.stringify(prev) === json) return prev
            try { localStorage.setItem(USERS_CACHE_KEY, json) } catch (_) {}
            return data.users
          })
        }
        if (data.mailConfig !== undefined) {
          const json = JSON.stringify(data.mailConfig)
          setMailConfig(prev => {
            if (JSON.stringify(prev) === json) return prev
            try { localStorage.setItem(MAIL_CACHE_KEY, json) } catch (_) {}
            return data.mailConfig
          })
        }
        if (data.phongBan !== undefined) {
          const json = JSON.stringify(data.phongBan)
          setPhongBan(prev => {
            if (JSON.stringify(prev) === json) return prev
            try { localStorage.setItem(PHONGBAN_CACHE_KEY, json) } catch (_) {}
            return data.phongBan
          })
        }
        if (data.assignments !== undefined) {
          const json = JSON.stringify(data.assignments)
          setAssignments(prev => {
            if (JSON.stringify(prev) === json) return prev
            try { localStorage.setItem(ASSIGNMENTS_CACHE_KEY, json) } catch (_) {}
            return data.assignments
          })
        }
        return data
      })
      .catch(err => { if (!silent) addToast(err.message, 'error') })
      .finally(() => setLoadingApps(false))
  }, [addToast])

  // Initial sync + periodic heartbeat (60s) + visibilitychange + child postMessage
  useEffect(() => {
    if (!tokenFresh) return
    sync(true) // always silent — loadingApps state handles initial spinner
    const interval = setInterval(() => sync(true), 60 * 1000)
    function onVisChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      if (document.visibilityState !== 'visible') return
      const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0
      hiddenAtRef.current = 0
      if (hiddenFor > STALE_THRESHOLD_MS) {
        // Backgrounded long enough that the heartbeat may have been throttled
        // and AT may be stale. Block UI while we re-validate.
        setSyncing(true)
        sync(true).finally(() => setSyncing(false))
      } else {
        sync(true)
      }
    }
    function onChildMessage(e) {
      if (e.data && e.data.type === 'child:sessionExpired') sync(true)
    }
    document.addEventListener('visibilitychange', onVisChange)
    window.addEventListener('message', onChildMessage)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisChange)
      window.removeEventListener('message', onChildMessage)
    }
  }, [tokenFresh, sync])

  const value = { apps, setApps, users, setUsers, mailConfig, setMailConfig, phongBan, setPhongBan, assignments, setAssignments, loadingApps, sync, syncing }
  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>
}

export function usePortalData() {
  return useContext(PortalDataContext)
}
