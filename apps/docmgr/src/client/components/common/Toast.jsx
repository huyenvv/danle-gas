import { useEffect, useRef } from 'react'

const TYPE_STYLES = {
  success: 'bg-[#1e3a1e] text-white',
  error:   'bg-[#410e0b] text-white',
  info:    'bg-[#1c2b3a] text-white',
}

const TYPE_ICONS = {
  success: 'check_circle',
  error:   'error',
  info:    'info',
}

/**
 * Single toast item. Auto-dismisses after `duration` ms.
 */
export function ToastItem({ id, message, type = 'info', duration = 3500, onDismiss }) {
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(id), duration)
    return () => clearTimeout(timerRef.current)
  }, [id, duration, onDismiss])

  const cls = TYPE_STYLES[type] || TYPE_STYLES.info
  const icon = TYPE_ICONS[type] || TYPE_ICONS.info

  return (
    <div
      className={`flex items-center gap-3 min-w-[280px] max-w-sm w-auto px-4 py-3 rounded-xl shadow-md3-3 text-sm font-medium ${cls} animate-toast-in`}
      role="alert"
    >
      <span
        className="material-symbols-outlined shrink-0"
        style={{ fontSize: 20, fontVariationSettings: '"FILL" 1' }}
      >
        {icon}
      </span>
      <span className="flex-1 leading-snug">{message}</span>
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity ml-1"
        aria-label="Đóng"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
      </button>
    </div>
  )
}

/**
 * Container rendered at bottom-center of the viewport.
 * Receives `toasts` array and `onDismiss` callback.
 */
export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem {...t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}
