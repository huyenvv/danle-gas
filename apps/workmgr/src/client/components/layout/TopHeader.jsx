import { useEffect, useRef, useState } from 'react'

const ROLE_LABELS = {
  admin: 'Quản trị hệ thống',
  'Quản trị viên': 'Quản trị viên',
  'Giám đốc': 'Giám đốc',
  'Trưởng phòng': 'Trưởng phòng',
  'Nhân viên': 'Nhân viên',
}

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700',
  'Quản trị viên': 'bg-red-100 text-red-700',
  'Giám đốc': 'bg-purple-100 text-purple-700',
  'Trưởng phòng': 'bg-slate-100 text-slate-600',
  'Nhân viên': 'bg-slate-100 text-slate-600',
}

export default function TopHeader({ username, email, role, appName, onToggleSidebar }) {
  const initial = (username || email || 'U')[0].toUpperCase()
  const roleLabel = ROLE_LABELS[role] || role || ''
  const roleColor = ROLE_COLORS[role] || 'bg-slate-100 text-slate-600'

  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!popoverOpen) return undefined

    function handleClick(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setPopoverOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [popoverOpen])

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-outline-variant px-4 h-14 flex items-center gap-2 shrink-0 shadow-md3-1 relative">
      <button
        onClick={onToggleSidebar}
        className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
        title="Thu gọn / mở rộng"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>

      <div className="flex-1 min-w-0" />

      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-2">
        <img src="https://sbm.com.vn/wp-content/uploads/2022/03/logo.png" alt="SBM" className="h-6 shrink-0" />
        {appName && (
          <span className="text-sm font-semibold text-on-surface tracking-wide truncate max-w-[240px]">{appName}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {username && (
          <div className="hidden md:flex items-center gap-2 ml-1">
            <span className="text-sm font-medium text-on-surface max-w-[120px] truncate">{username}</span>
            {roleLabel && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${roleColor}`}>
                {roleLabel}
              </span>
            )}
          </div>
        )}

        <div className="relative ml-1" ref={popoverRef}>
          <button
            onClick={() => setPopoverOpen((open) => !open)}
            className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-semibold hover:ring-2 hover:ring-primary/40 transition-all"
            title="Tài khoản"
          >
            {initial}
          </button>

          {popoverOpen && (
            <div className="absolute right-0 top-11 w-64 bg-white rounded-2xl shadow-md3-3 border border-outline-variant overflow-hidden z-50">
              <div className="px-4 py-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center text-base font-bold shrink-0">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{username || '—'}</p>
                  <p className="text-xs text-on-surface-variant truncate">{email || '—'}</p>
                </div>
              </div>

              <div className="px-4 py-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base shrink-0">shield_person</span>
                <span className="text-xs text-on-surface-variant">Vai trò:</span>
                <span className="text-xs font-medium text-primary">{roleLabel || '—'}</span>
              </div>

            </div>
          )}
        </div>
      </div>
    </header>
  )
}