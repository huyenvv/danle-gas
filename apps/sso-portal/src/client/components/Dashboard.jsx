import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import gasCall from '../gasClient.js'
import AppCard from './AppCard.jsx'
import IframeOverlay from './IframeOverlay.jsx'
import UserManager from './UserManager.jsx'
import AppManager from './AppManager.jsx'
import SettingsPage from './SettingsPage.jsx'
import ChangePasswordModal from './ChangePasswordModal.jsx'

const TABS = [
  { id: 'apps', label: 'Ứng dụng', icon: 'apps' },
  { id: 'users', label: 'Người dùng', icon: 'group' },
  { id: 'app-mgr', label: 'Quản lý App', icon: 'app_registration' },
  { id: 'settings', label: 'Cài đặt', icon: 'settings' },
]

export default function Dashboard() {
  const { session, ssoToken, parentSheetId, logout } = useAuth()
  const { addToast } = useToast()
  const [apps, setApps] = useState([])
  const [activeApp, setActiveApp] = useState(null)
  const [tab, setTab] = useState('apps')
  const [loadingApps, setLoadingApps] = useState(true)
  const [showChangePass, setShowChangePass] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const pollTimerRef = useRef(null)
  const autoOpenDoneRef = useRef(false)

  const LAST_APP_KEY = 'sso_last_app_id'

  const loadApps = useCallback((isInitial) => {
    setLoadingApps(true)
    gasCall('api_getApps', session.token)
      .then(data => {
        setApps(data)
        setLoadingApps(false)
        // Auto-open cached app only on first load
        if (isInitial && !autoOpenDoneRef.current) {
          autoOpenDoneRef.current = true
          const lastId = localStorage.getItem(LAST_APP_KEY)
          if (lastId) {
            const cached = data.find(a => String(a.ID) === lastId && a['Trạng thái'] === 'Active' && a['Webapp URL'])
            if (cached) setActiveApp(cached)
          }
        }
      })
      .catch(err => { addToast(err.message, 'error'); setLoadingApps(false) })
  }, [session.token])

  useEffect(() => {
    loadApps(true)
    // Poll every 60 seconds for fresh app list
    pollTimerRef.current = setInterval(() => loadApps(false), 60000)
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current) }
  }, [loadApps])

  function openApp(app) {
    if (!app['Webapp URL']) {
      addToast('App chưa có URL', 'error')
      return
    }
    if (!ssoToken || !parentSheetId) {
      addToast('Phiên SSO không hợp lệ. Vui lòng đăng nhập lại.', 'error')
      return
    }
    localStorage.setItem(LAST_APP_KEY, String(app.ID))
    setActiveApp(app)
  }

  function buildIframeUrl(app) {
    const base = app['Webapp URL']
    const sep = base.includes('?') ? '&' : '?'
    return base + sep
      + 'sso_email=' + encodeURIComponent(session.email)
      + '&sso_token=' + encodeURIComponent(ssoToken)
      + '&parent_sheet_id=' + encodeURIComponent(parentSheetId)
  }

  if (activeApp) {
    return (
      <IframeOverlay
        url={buildIframeUrl(activeApp)}
        apps={apps.filter(a => a['Webapp URL'])}
        activeApp={activeApp}
        onSwitch={openApp}
        onBack={() => { localStorage.removeItem(LAST_APP_KEY); setActiveApp(null) }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface-container-lowest border-b border-outline-variant/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-primary">shield_person</span>
            <h1 className="text-base font-bold text-on-surface">SSO Portal</h1>
          </div>
          <div className="relative">
            <button onClick={() => setShowUserMenu(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-surface-container transition">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-sm text-primary">person</span>
              </div>
              <span className="text-sm font-medium text-on-surface hidden sm:inline">{session.username}</span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">expand_more</span>
            </button>
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-surface-container-lowest rounded-2xl shadow-md3-3 border border-outline-variant/30 py-1">
                  <div className="px-4 py-2 border-b border-outline-variant/30">
                    <p className="text-sm font-medium text-on-surface">{session.username}</p>
                    <p className="text-xs text-on-surface-variant">{session.email}</p>
                  </div>
                  <button onClick={() => { setShowChangePass(true); setShowUserMenu(false) }}
                    className="w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container flex items-center gap-2 transition">
                    <span className="material-symbols-outlined text-lg">key</span>
                    Đổi mật khẩu
                  </button>
                  <button onClick={logout}
                    className="w-full px-4 py-2 text-left text-sm text-error hover:bg-error-container/40 flex items-center gap-2 transition">
                    <span className="material-symbols-outlined text-lg">logout</span>
                    Đăng xuất
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-surface-container-lowest border-b border-outline-variant/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto">
          {(session.role === 'admin' ? TABS : TABS.filter(t => t.id === 'apps')).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition whitespace-nowrap
                ${tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}>
              <span className="material-symbols-outlined text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 page-enter">
        {tab === 'apps' && (
          <>
            <div className="flex justify-end mb-4">
              <button onClick={loadApps} title="Làm mới danh sách"
                className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container border border-outline-variant transition-colors">
                <span className="material-symbols-outlined text-base">refresh</span>
              </button>
            </div>
            {loadingApps ? (
              <div className="flex items-center justify-center py-20">
                <span className="material-symbols-outlined text-4xl text-primary animate-pulse">apps</span>
              </div>
            ) : apps.length === 0 ? (
              <div className="text-center py-20">
                <span className="material-symbols-outlined text-5xl text-outline-variant">apps</span>
                <p className="mt-3 text-on-surface-variant">Chưa có ứng dụng nào</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {apps.filter(a => a['Trạng thái'] === 'Active').map(app => (
                  <AppCard key={app.ID} app={app} onClick={() => openApp(app)} />
                ))}
              </div>
            )}
          </>
        )}
        {tab === 'users' && <UserManager />}
        {tab === 'app-mgr' && <AppManager apps={apps} setApps={setApps} />}
        {tab === 'settings' && <SettingsPage />}
      </main>

      {showChangePass && <ChangePasswordModal onClose={() => setShowChangePass(false)} />}
    </div>
  )
}
