import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import logoUrl from '../assets/logo.png'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
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
  const { session, logout } = useAuth()
  const { addToast } = useToast()
  const confirm = useConfirm()
  const [apps, setApps] = useState([])
  const [activeApp, setActiveApp] = useState(null)
  const [iframeUrl, setIframeUrl] = useState('')
  const [openingApp, setOpeningApp] = useState(false)
  const [tab, setTab] = useState('apps')
  const [loadingApps, setLoadingApps] = useState(true)
  const [showChangePass, setShowChangePass] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const autoOpenDoneRef = useRef(false)
  const prefetchedRef = useRef(new Set())

  const LAST_APP_KEY = 'sso_last_app_id'
  const APPS_CACHE_KEY = 'sso_apps_cache'

  // Fetch từ server, cập nhật cache + state
  const refreshApps = useCallback((silent = false) => {
    if (!silent) setLoadingApps(true)
    const accessToken = localStorage.getItem('sso_access_token')
    return gasCall('api_getApps', accessToken)
      .then(data => {
        localStorage.setItem(APPS_CACHE_KEY, JSON.stringify(data))
        setApps(data)
      })
      .catch(err => { if (!silent) addToast(err.message, 'error') })
      .finally(() => { if (!silent) setLoadingApps(false) })
  }, [])

  useEffect(() => {
    // Server-injected data từ doGet — nhanh nhất, không cần round trip
    if (typeof window !== 'undefined' && window.__INITIAL_APPS__) {
      const data = window.__INITIAL_APPS__
      delete window.__INITIAL_APPS__
      try { localStorage.setItem(APPS_CACHE_KEY, JSON.stringify(data)) } catch (_) {}
      setApps(data)
      setLoadingApps(false)
      autoOpenDoneRef.current = true
      return
    }

    // Dùng cache ngay lập tức nếu có — không cần loading
    const cached = localStorage.getItem(APPS_CACHE_KEY)
    if (cached) {
      try {
        const data = JSON.parse(cached)
        setApps(data)
        setLoadingApps(false)
        autoOpenDoneRef.current = true
        return // không fetch server, chờ user bấm refresh
      } catch (_) { /* cache lỗi, fetch lại */ }
    }
    // Chưa có cache → fetch lần đầu
    refreshApps(false).then(() => {
      autoOpenDoneRef.current = true
    })
  }, [refreshApps])

  async function openApp(app) {
    if (!app['Webapp URL']) {
      addToast('App chưa có URL', 'error')
      return
    }
    setOpeningApp(true)
    try {
      const accessToken = localStorage.getItem('sso_access_token')
      const { handoffToken } = await gasCall('api_createHandoff', accessToken, app['ID'])
      const base = app['Webapp URL']
      const sep = base.includes('?') ? '&' : '?'
      const url = base + sep + 'handoff=' + encodeURIComponent(handoffToken)
      localStorage.setItem(LAST_APP_KEY, String(app.ID))
      setIframeUrl(url)
      setActiveApp(app)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setOpeningApp(false)
    }
  }

  // Prefetch URL — ping ?prefetch=1 để GAS warm up execution container.
  // Server trả HTML rỗng, không tạo session. Khi user click thật sau đó,
  // container đã ấm → tránh được cold start (~2-5s).
  function prefetchApp(app) {
    if (!app || !app['Webapp URL']) return
    if (prefetchedRef.current.has(app.ID)) return
    prefetchedRef.current.add(app.ID)
    const base = app['Webapp URL']
    const sep = base.includes('?') ? '&' : '?'
    const url = base + sep + 'prefetch=1'
    const iframe = document.createElement('iframe')
    iframe.src = url
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden'
    iframe.setAttribute('aria-hidden', 'true')
    iframe.setAttribute('tabindex', '-1')
    document.body.appendChild(iframe)
    // Remove khi đã warm xong; cũng cho phép prefetch lại sau 4 phút (container ~5 phút TTL)
    setTimeout(() => { iframe.remove() }, 10000)
    setTimeout(() => { prefetchedRef.current.delete(app.ID) }, 240000)
  }

  if (activeApp) {
    return (
      <IframeOverlay
        url={iframeUrl}
        apps={apps.filter(a => a['Webapp URL'])}
        activeApp={activeApp}
        onSwitch={openApp}
        onBack={() => { localStorage.removeItem(LAST_APP_KEY); setActiveApp(null); setIframeUrl('') }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface-container-lowest border-b border-outline-variant/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="SBM" className="h-8" />
            <span className="text-outline-variant/40">|</span>
            <h1 className="text-sm font-semibold text-primary">Cổng Đăng Nhập</h1>
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
                  <button onClick={async () => { if (await confirm('Bạn có chắc muốn đăng xuất?')) logout() }}
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
                  ? 'border-accent text-primary font-semibold'
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
              <button onClick={() => refreshApps(false)} disabled={loadingApps} title="Làm mới danh sách"
                className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container border border-outline-variant transition-colors disabled:opacity-40">
                <span className={`material-symbols-outlined text-base${loadingApps ? ' animate-spin' : ''}`}>refresh</span>
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
                  <AppCard key={app.ID} app={app} onClick={() => openApp(app)} onPrefetch={() => prefetchApp(app)} />
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
