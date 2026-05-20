import { useRef } from 'react'

export default function AppCard({ app, onClick, onPrefetch }) {
  const icon = app['Icon'] || 'apps'
  const name = app['Tên App'] || 'Untitled'
  const desc = app['Mô tả'] || ''
  const hasUrl = !!app['Webapp URL']
  const hoverTimerRef = useRef(null)

  function handleEnter() {
    if (!hasUrl || !onPrefetch) return
    if (hoverTimerRef.current) return
    // Debounce: chỉ prefetch khi user thực sự dừng ở card ~300ms
    hoverTimerRef.current = setTimeout(() => { onPrefetch() }, 300)
  }

  function handleLeave() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      disabled={!hasUrl}
      className={`group relative text-left w-full bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5 transition-all duration-200
        ${hasUrl
          ? 'hover:shadow-md3-3 hover:border-accent/30 hover:-translate-y-0.5 cursor-pointer'
          : 'opacity-60 cursor-not-allowed'
        }`}
    >
      {/* Icon */}
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors
        ${hasUrl ? 'bg-primary/10 group-hover:bg-primary/15' : 'bg-surface-container'}`}>
        <span className={`material-symbols-outlined text-2xl ${hasUrl ? 'text-primary' : 'text-outline'}`}>
          {icon}
        </span>
      </div>

      {/* Name */}
      <h3 className="text-sm font-semibold text-on-surface mb-1 line-clamp-1">{name}</h3>

      {/* Description */}
      {desc && (
        <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">{desc}</p>
      )}

      {/* URL indicator */}
      {!hasUrl && (
        <div className="mt-3 flex items-center gap-1 text-xs text-outline">
          <span className="material-symbols-outlined text-sm">link_off</span>
          Chưa cấu hình URL
        </div>
      )}

      {/* Hover arrow */}
      {hasUrl && (
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="material-symbols-outlined text-lg text-accent">arrow_forward</span>
        </div>
      )}
    </button>
  )
}
