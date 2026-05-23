import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { usePortalData } from '../context/PortalDataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import logoUrl from '../assets/logo.png'
import { useConfirm } from '../context/ConfirmContext.jsx'
import AppCard from './AppCard.jsx'
import IframeOverlay from './IframeOverlay.jsx'
import UserManager from './UserManager.jsx'
import AppManager from './AppManager.jsx'
import SettingsPage from './SettingsPage.jsx'
import PhongBanManager from './PhongBanManager.jsx'
import ChangePasswordModal from './ChangePasswordModal.jsx'

const TABS = [
  { id: 'apps', label: 'Ứng dụng', icon: 'apps' },
  { id: 'users', label: 'Người dùng', icon: 'group' },
  { id: 'phongban', label: 'Phòng ban', icon: 'apartment' },
  { id: 'app-mgr', label: 'Quản lý App', icon: 'app_registration' },
  { id: 'settings', label: 'Cài đặt', icon: 'settings' },
]

export default function Dashboard() {
  const { session, logout, tokenFresh } = useAuth()
  const { apps, setApps, loadingApps, sync } = usePortalData()
  const { addToast } = useToast()
  const confirm = useConfirm()
  const [activeApp, setActiveApp] = useState(null)
  const [tab, setTab] = useState('apps')
  const [showChangePass, setShowChangePass] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [preloads, setPreloads] = useState({}) // { [appId]: { url, ready } }

  const LAST_APP_KEY = 'sso_last_app_id'

  // Preload ALL active apps — runs ONCE after token verified + apps available.
  // Never re-run on sync updates — child apps manage their own sessions after initial load.
  const preloadDoneRef = useRef(false)
  useEffect(() => {
    if (!tokenFresh || apps.length === 0 || preloadDoneRef.current) return
    const accessToken = localStorage.getItem('sso_access_token')
    const parentSheetId = localStorage.getItem('sso_parent_sheet_id')
    if (!accessToken || !parentSheetId) return

    preloadDoneRef.current = true

    const activeApps = apps.filter(a => a['Webapp URL'] && a['Trạng thái'] === 'Active')
    const lastId = localStorage.getItem(LAST_APP_KEY)
    const sorted = [...activeApps].sort((a, b) => {
      if (String(a.ID) === lastId) return -1
      if (String(b.ID) === lastId) return 1
      return 0
    })

    const timers = sorted.map((app, idx) => setTimeout(() => {
      setPreloads(prev => {
        if (prev[app.ID]) return prev
        const base = app['Webapp URL']
        const sep = base.includes('?') ? '&' : '?'
        return { ...prev, [app.ID]: {
          url: base + sep + 'token=' + encodeURIComponent(accessToken) + '&parent=' + encodeURIComponent(parentSheetId),
          ready: false,
        }}
      })
    }, idx * 2000))

    return () => timers.forEach(clearTimeout)
  }, [tokenFresh, apps])

  function _buildAppUrl(app) {
    const accessToken = localStorage.getItem('sso_access_token')
    const parentSheetId = localStorage.getItem('sso_parent_sheet_id')
    const base = app['Webapp URL']
    const sep = base.includes('?') ? '&' : '?'
    return base + sep + 'token=' + encodeURIComponent(accessToken) + '&parent=' + encodeURIComponent(parentSheetId)
  }

  function openApp(app) {
    if (!app['Webapp URL']) { addToast('App chưa có URL', 'error'); return }
    localStorage.setItem(LAST_APP_KEY, String(app.ID))
    // Always build fresh URL with latest token — handles token rotation
    const freshUrl = _buildAppUrl(app)
    setPreloads(prev => {
      const existing = prev[app.ID]
      if (existing && existing.url === freshUrl) return prev // same token, keep iframe
      return { ...prev, [app.ID]: { url: freshUrl, ready: false } } // new/rotated token → reload
    })
    setActiveApp(app)
  }

  const activePreload = activeApp && preloads[activeApp.ID]

  // Render all preloaded iframes — React reconciles by key, DOM nodes survive across renders
  const preloadIframes = Object.entries(preloads).map(([appId, { url }]) => (
    <iframe
      key={appId}
      src={url}
      className={`fixed inset-0 w-full h-full border-none z-40 ${activeApp && String(activeApp.ID) === String(appId) ? '' : 'invisible'}`}
      allow="clipboard-write"
      onLoad={() => setPreloads(prev => ({ ...prev, [appId]: { ...prev[appId], ready: true } }))}
    />
  ))

  if (activeApp) {
    return (
      <>
        {preloadIframes}
        <IframeOverlay
          url={null}
          preloaded={true}
          preloadReady={activePreload?.ready || false}
          apps={apps.filter(a => a['Webapp URL'] && a['Trạng thái'] === 'Active')}
          activeApp={activeApp}
          onSwitch={openApp}
          onBack={() => { setActiveApp(null) }}
        />
      </>
    )
  }

  return (
    <>
    {preloadIframes}
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
              <button onClick={() => sync(false)} disabled={loadingApps} title="Làm mới danh sách"
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
                  <AppCard key={app.ID} app={app} onClick={() => openApp(app)} />
                ))}
              </div>
            )}
          </>
        )}
        {tab === 'users' && <UserManager />}
        {tab === 'phongban' && <PhongBanManager />}
        {tab === 'app-mgr' && <AppManager apps={apps} setApps={setApps} />}
        {tab === 'settings' && <SettingsPage />}
      </main>

      {showChangePass && <ChangePasswordModal onClose={() => setShowChangePass(false)} />}
    </div>
    </>
  )
}
