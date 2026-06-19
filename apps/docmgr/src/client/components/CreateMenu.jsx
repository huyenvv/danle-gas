import { useState, useRef, useEffect } from 'react'
import Icon from './common/Icon.jsx'

// Split button: primary action (Tạo hồ sơ mới) + caret dropdown (Nhập từ Excel,
// In danh mục hồ sơ). Used in the sidebar CTA (compact=false, supports collapsed)
// and the documents list toolbar (compact=true). The caret appears when there is
// at least one secondary action (onImport or onExport).
export default function CreateMenu({ onCreate, onImport, onExport, label = 'Tạo hồ sơ mới', compact = false, collapsed = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  if (!onCreate && !onImport && !onExport) return null

  const hasMenu = !!(onImport || onExport)

  return (
    <div ref={ref} className="relative">
      <div className={`flex items-stretch bg-accent text-white rounded-full overflow-hidden ${compact ? 'shadow-md3-1' : 'shadow-md3-2 w-full'}`}>
        <button
          onClick={onCreate || onImport || onExport}
          title={label}
          className={`flex items-center gap-2 font-medium text-sm hover:bg-accent-hover transition-colors ${compact ? 'px-4 py-2' : `flex-1 py-2.5 ${collapsed ? 'justify-center px-0' : 'px-4'}`}`}
        >
          <Icon name="add" size={18} />
          {(!collapsed || compact) && <span>{label}</span>}
        </button>
        {hasMenu && (
          <button
            onClick={() => setOpen(o => !o)}
            title="Thêm tùy chọn"
            aria-label="Thêm tùy chọn"
            className={`flex items-center justify-center hover:bg-accent-hover transition-colors border-l border-white/25 ${collapsed && !compact ? 'px-1.5' : 'px-2'}`}
          >
            <Icon name={open ? 'arrow_drop_up' : 'arrow_drop_down'} size={20} />
          </button>
        )}
      </div>

      {open && hasMenu && (
        <div className={`absolute mt-1 z-20 bg-surface-container-low border border-outline-variant rounded-xl shadow-md3-2 py-1 ${compact ? 'right-0 min-w-[180px]' : 'left-0 right-0'}`}>
          {onCreate && (
            <button
              onClick={() => { setOpen(false); onCreate() }}
              className={`w-full flex items-center text-on-surface hover:bg-surface-container whitespace-nowrap ${collapsed ? 'justify-center px-1 py-2 text-xs font-medium' : 'gap-3 px-3 py-2.5 text-sm'}`}
            >
              {!collapsed && <Icon name="note_add" size={18} className="text-on-surface-variant" />}
              <span>{collapsed ? 'Tạo' : 'Tạo hồ sơ mới'}</span>
            </button>
          )}
          {onImport && (
            <button
              onClick={() => { setOpen(false); onImport() }}
              className={`w-full flex items-center text-on-surface hover:bg-surface-container whitespace-nowrap ${collapsed ? 'justify-center px-1 py-2 text-xs font-medium' : 'gap-3 px-3 py-2.5 text-sm'}`}
            >
              {!collapsed && <Icon name="upload_file" size={18} className="text-on-surface-variant" />}
              <span>{collapsed ? 'Excel' : 'Nhập từ Excel'}</span>
            </button>
          )}
          {onExport && (
            <button
              onClick={() => { setOpen(false); onExport() }}
              className={`w-full flex items-center text-on-surface hover:bg-surface-container whitespace-nowrap ${collapsed ? 'justify-center px-1 py-2 text-xs font-medium' : 'gap-3 px-3 py-2.5 text-sm'}`}
            >
              {!collapsed && <Icon name="file_download" size={18} className="text-on-surface-variant" />}
              <span>{collapsed ? 'In DM' : 'In danh mục hồ sơ'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
