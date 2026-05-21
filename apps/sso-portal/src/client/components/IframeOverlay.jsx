import { useState, useEffect } from 'react'

export default function IframeOverlay({ url, apps, activeApp, onSwitch, onBack, preloaded, preloadReady }) {
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [iframeLoading, setIframeLoading] = useState(!preloaded)
  const otherApps = apps.filter(a => a.ID !== activeApp.ID)

  useEffect(() => { if (!preloaded && url) setIframeLoading(true) }, [url, preloaded])

  const showLoading = preloaded ? !preloadReady : iframeLoading
  const transparent = preloaded && preloadReady

  return (
    <div className={`fixed inset-0 z-40 ${transparent ? 'pointer-events-none' : ''}`}>
      {showLoading && (
        <div className="absolute top-0 inset-x-0 z-30 h-1 overflow-hidden pointer-events-none">
          <div className="h-full w-2/5 bg-primary rounded-r"
            style={{ animation: 'iframeLoadBar 1.2s ease-in-out infinite alternate' }} />
          <style>{`@keyframes iframeLoadBar{0%{transform:translateX(-10%)}100%{transform:translateX(200%)}}`}</style>
        </div>
      )}
      {!preloaded && (
        <iframe
          src={url}
          className="w-full h-full border-none"
          allow="clipboard-write"
          onLoad={() => setIframeLoading(false)}
        />
      )}

      {/* Navbar — top center, collapsible */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 z-50 transition-transform duration-300 ease-in-out pointer-events-auto"
        style={{ transform: `translateX(-50%) translateY(${collapsed ? '-100%' : '0'})` }}
      >
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest/95 backdrop-blur-sm rounded-b-2xl shadow-md3-2 border border-t-0 border-outline-variant/30 min-w-[340px] max-w-[500px] relative">
          <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #01458e, #e87a1e)' }} />
          {/* App info */}
          <span className="material-symbols-outlined text-lg text-primary">{activeApp['Icon'] || 'apps'}</span>
          <span className="text-sm font-semibold text-on-surface truncate max-w-[140px]">{activeApp['Tên App']}</span>

          <div className="w-px h-5 bg-outline-variant/40 mx-1" />

          {/* Switch app dropdown */}
          {otherApps.length > 0 && (
            <div className="relative">
              <button onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container transition">
                <span className="material-symbols-outlined text-sm text-accent">swap_horiz</span>
                <span className="hidden sm:inline">Chuyển</span>
                <span className="material-symbols-outlined text-xs">expand_more</span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute top-full mt-1 left-0 z-50 w-52 bg-surface-container-lowest rounded-2xl shadow-md3-3 border border-outline-variant/30 py-1 animate-toast-in">
                    {otherApps.map(app => (
                      <button key={app.ID}
                        onClick={() => { setMenuOpen(false); onSwitch(app) }}
                        className="w-full px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container flex items-center gap-2 transition">
                        <span className="material-symbols-outlined text-base text-on-surface-variant">{app['Icon'] || 'apps'}</span>
                        <span className="truncate">{app['Tên App']}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Back to dashboard */}
          <button onClick={onBack}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container transition ml-auto">
            <span className="material-symbols-outlined text-sm">dashboard</span>
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          {/* Collapse button */}
          <button onClick={() => setCollapsed(true)}
            className="p-1 rounded-lg hover:bg-surface-container transition"
            title="Ẩn thanh điều hướng">
            <span className="material-symbols-outlined text-sm text-on-surface-variant">keyboard_arrow_up</span>
          </button>
        </div>
      </div>

      {/* V-arrow handle when collapsed */}
      {collapsed && (
        <div
          className="fixed top-0 left-1/2 -translate-x-1/2 z-50 cursor-pointer group pointer-events-auto"
          onClick={() => setCollapsed(false)}
          title="Hiện thanh điều hướng"
        >
          <div className="w-[200px] h-[14px] flex items-start justify-center">
            <svg width="200" height="14" viewBox="0 0 200 14" className="drop-shadow-sm">
              <path
                d="M0,0 Q100,14 200,0 L200,0 L0,0 Z"
                className="fill-surface-container-lowest/80 group-hover:fill-surface-container-lowest transition-colors"
              />
              <path
                d="M80,4 L100,10 L120,4"
                fill="none"
                className="stroke-on-surface-variant/50 group-hover:stroke-primary transition-colors"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
