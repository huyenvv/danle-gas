import { useEffect, useRef } from 'react'
import Icon from './Icon.jsx'

/**
 * Shared popup modal shell.
 *
 * Props:
 *   open       — boolean, controls visibility
 *   title      — string
 *   icon       — material symbol name (optional)
 *   onClose    — () => void
 *   onSave     — () => void (called on Save button click)
 *   saving     — boolean, disables Save + shows spinner
 *   error      — string | null, shown as error banner
 *   children   — form content
 *   maxWidth   — Tailwind max-width class (default 'max-w-lg')
 *   saveLabel  — string (default 'Lưu')
 */
export default function FormModal({
  open,
  title,
  icon,
  onClose,
  onSave,
  saving = false,
  error = '',
  children,
  maxWidth = 'max-w-lg',
  saveLabel = 'Lưu',
}) {
  const backdropRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onMouseDown={e => { if (e.target === backdropRef.current) onClose() }}
    >
      <div
        className={`bg-white rounded-3xl shadow-md3-3 w-full ${maxWidth} flex flex-col max-h-[90vh] overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant shrink-0">
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
              <Icon name={icon} size={18} className="text-on-primary-container" />
            </div>
          )}
          <h2 className="text-base font-semibold text-on-surface flex-1">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Đóng"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-6 py-3 bg-error-container text-on-error-container text-sm border-b border-outline-variant shrink-0">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-full border border-outline-variant text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2 rounded-full bg-primary text-on-primary text-sm font-medium hover:bg-primary-700 transition-colors shadow-md3-1 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
            )}
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
