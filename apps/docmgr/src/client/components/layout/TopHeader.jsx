import { useState, useEffect, useRef } from 'react'
import Icon from '../common/Icon.jsx'
import logoUrl from '../../assets/logo.png'

const ROLE_LABELS = {
  'admin':          'Quản trị hệ thống',
  'Quản trị viên':  'Quản trị viên',
  'Giám đốc':       'Giám đốc',
  'Văn thư':        'Văn thư',
  'Trưởng phòng':   'Trưởng phòng',
  'Nhân viên':      'Nhân viên',
  'Xem':            'Chỉ xem',
}

const ROLE_COLORS = {
  'admin':          'bg-red-100 text-red-700',
  'Quản trị viên':  'bg-red-100 text-red-700',
  'Giám đốc':       'bg-purple-100 text-purple-700',
  'Văn thư':        'bg-blue-100 text-blue-700',
  'Trưởng phòng':   'bg-gray-100 text-gray-600',
  'Nhân viên':      'bg-gray-100 text-gray-600',
  'Xem':            'bg-gray-100 text-gray-500',
}

export default function TopHeader({ username, email, role, onToggleSidebar, onBellClick, unreadCount = 0, hasNewUnread = false, companyName = '' }) {
  const initial = (username || email || 'U')[0].toUpperCase()
  const roleLabel = ROLE_LABELS[role] || role || ''
  const roleColor = ROLE_COLORS[role] || 'bg-gray-100 text-gray-600'

  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef(null)

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return
    function handleClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [popoverOpen])

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-outline-variant px-4 h-14 flex items-center gap-2 shrink-0 shadow-md3-1 relative">
      {/* Hamburger */}
      <button
        onClick={onToggleSidebar}
        className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
        title="Thu gọn / mở rộng"
      >
        <Icon name="menu" size={22} />
      </button>

      {/* Brand / spacer */}
      <div className="flex-1 min-w-0" />

      {/* Company name — centered with SBM logo */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-2">
        <img src={logoUrl} alt="SBM" className="h-6 shrink-0" />
        {companyName && (
          <span className="text-sm font-semibold text-on-surface tracking-wide truncate max-w-[240px]">{companyName}</span>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={onBellClick}
            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
            title={unreadCount > 0 ? `${unreadCount} hồ sơ chưa đọc` : 'Thông báo'}
          >
            <span className={unreadCount > 0 ? 'bell-shake' : ''}>
              <Icon name={unreadCount > 0 ? 'notifications_active' : 'notifications'} size={22} />
            </span>
          </button>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-error text-on-error rounded-full text-[10px] flex items-center justify-center font-bold px-1 pointer-events-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        {/* Username + role badge (hidden on small screens) */}
        {username && (
          <div className="hidden md:flex items-center gap-2 ml-1">
            <span className="text-sm font-medium text-on-surface max-w-[120px] truncate">{username}</span>
            {roleLabel && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${roleColor}`}>{roleLabel}</span>
            )}
          </div>
        )}

        {/* User avatar + popover */}
        <div className="relative ml-1" ref={popoverRef}>
          <button
            onClick={() => setPopoverOpen(v => !v)}
            className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-semibold hover:ring-2 hover:ring-primary/40 transition-all"
            title="Tài khoản"
          >
            {initial}
          </button>

          {popoverOpen && (
            <div className="absolute right-0 top-11 w-64 bg-white rounded-2xl shadow-md3-3 border border-outline-variant overflow-hidden z-50">
              {/* User info header */}
              <div className="px-4 py-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center text-base font-bold shrink-0">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{username || '—'}</p>
                  <p className="text-xs text-on-surface-variant truncate">{email || '—'}</p>
                </div>
              </div>
              {/* Role badge */}
              <div className="px-4 py-3 flex items-center gap-2">
                <Icon name="shield_person" size={16} className="text-primary shrink-0" />
                <span className="text-xs text-on-surface-variant">Vai trò:</span>
                <span className="text-xs font-medium text-primary">{roleLabel}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

