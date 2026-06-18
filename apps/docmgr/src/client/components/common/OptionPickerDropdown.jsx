import { useState, useRef, useEffect } from 'react'

// Generic multi-select dropdown: chips trigger + search box + checkbox list.
// Mirrors UserPickerDropdown UX but for flat { value, label } options.
export default function OptionPickerDropdown({ options, value, onChange, placeholder = '-- Chọn --', testId }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => { if (open && searchRef.current) searchRef.current.focus() }, [open])

  const selected = value || []
  const selectedSet = new Set(selected)
  const labelOf = (val) => { const o = (options || []).find(o => o.value === val); return o ? o.label : val }

  const q = search.toLowerCase()
  const filtered = q ? (options || []).filter(o => o.label.toLowerCase().includes(q)) : (options || [])

  function toggle(val) {
    onChange(selectedSet.has(val) ? selected.filter(v => v !== val) : [...selected, val])
  }

  return (
    <div ref={ref} className="relative flex-1">
      {/* Trigger */}
      <div data-testid={testId} onClick={() => setOpen(!open)}
        className="w-full bg-surface-container-low rounded-xl px-3 py-2 text-sm text-left flex flex-wrap items-center gap-1.5 min-h-[38px] focus:outline-none cursor-pointer">
        {selected.map(val => (
          <span key={val} className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full">
            {labelOf(val)}
            <button type="button" onClick={e => { e.stopPropagation(); onChange(selected.filter(v => v !== val)) }}
              className="ml-0.5 hover:text-error transition-colors cursor-pointer">
              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>close</span>
            </button>
          </span>
        ))}
        {selected.length === 0 && <span className="text-on-surface-variant">{placeholder}</span>}
        <span className="material-symbols-outlined text-on-surface-variant shrink-0 ml-auto" style={{ fontSize: 16 }}>
          {open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-outline-variant/40 max-h-72 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-outline-variant/30">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" style={{ fontSize: 14 }}>search</span>
              <input ref={searchRef}
                className="w-full bg-surface-container-low border-none rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map(o => {
              const isSelected = selectedSet.has(o.value)
              return (
                <button key={o.value} type="button" data-testid={testId ? `${testId}-opt-${o.value}` : undefined}
                  onClick={() => toggle(o.value)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-1.5 transition-colors cursor-pointer border-b border-outline-variant/10 last:border-b-0 ${isSelected ? 'bg-primary/8' : 'hover:bg-surface-container-low/50'}`}>
                  <input type="checkbox" checked={isSelected} readOnly
                    className="w-3.5 h-3.5 rounded border-outline-variant accent-primary pointer-events-none" />
                  <span className="text-sm text-on-surface truncate flex-1">{o.label}</span>
                </button>
              )
            })}
            {filtered.length === 0 && <div className="px-3 py-4 text-center text-on-surface-variant text-xs">Không tìm thấy</div>}
          </div>
        </div>
      )}
    </div>
  )
}
