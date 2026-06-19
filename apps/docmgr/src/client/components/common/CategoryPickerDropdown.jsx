import { useState, useRef, useEffect, useMemo } from 'react'
import { viMatch } from '../../utils/viSearch.js'

// Single-select category picker: search box + collapsible parent/child tree.
// Collapse state is in-memory only (not persisted). Parents are expanded by
// default; searching force-expands so matches stay visible.
//
// Props:
//  - categories: danhMuc rows ({ ID, 'Tên danh mục', 'Danh mục cha', Icon })
//  - value: selected category ID ('' = none)
//  - onChange(id): called with the chosen ID ('' when picking the root option)
//  - rootOption: label for the value='' entry (e.g. "— Không có (gốc) —"); omitted = no root row
//  - excludeIds: Set of IDs to hide (self + descendants when editing a category)
//  - defaultCollapsed: if true, start with every parent collapsed (only roots shown)
//  - testId: base test id; trigger = testId, options = `${testId}-opt-<id>`
export default function CategoryPickerDropdown({ categories, value, onChange, placeholder = '-- Chọn --', rootOption, excludeIds, defaultCollapsed = false, testId }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(() => new Set()) // ids whose children are hidden; empty = all expanded
  const ref = useRef(null)
  const searchRef = useRef(null)

  // defaultCollapsed: mỗi lần mở dropdown, thu gọn mọi danh mục cha (chỉ hiện gốc).
  // Tính tại thời điểm mở để dùng categories đã tải xong (lookups async).
  useEffect(() => {
    if (!open || !defaultCollapsed) return
    const parents = new Set()
    ;(categories || []).forEach(c => {
      const p = String(c['Danh mục cha'] || '')
      if (p) parents.add(p)
    })
    setCollapsed(parents)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => { if (open && searchRef.current) searchRef.current.focus() }, [open])

  const cats = categories || []
  const exclude = excludeIds || new Set()

  const childrenOf = useMemo(() => {
    const m = {}
    cats.forEach(c => {
      const p = String(c['Danh mục cha'] || '')
      ;(m[p] = m[p] || []).push(c)
    })
    return m
  }, [cats])

  // When searching, show matched nodes + their ancestor chain (for context).
  const q = search.trim()
  const visibleIds = useMemo(() => {
    if (!q) return null // null = no filter
    const show = new Set()
    cats.forEach(c => {
      if (!viMatch(c['Tên danh mục'], q)) return
      let cur = c
      while (cur) {
        show.add(String(cur.ID))
        const pid = String(cur['Danh mục cha'] || '')
        cur = pid ? cats.find(x => String(x.ID) === pid) : null
      }
    })
    return show
  }, [q, cats])

  function toggleCollapse(id) {
    setCollapsed(prev => {
      const next = new Set(prev)
      const k = String(id)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  function select(id) {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  function renderNodes(parentId, depth) {
    const kids = (childrenOf[String(parentId || '')] || []).filter(c => !exclude.has(String(c.ID)))
    return kids.flatMap(c => {
      const id = String(c.ID)
      if (visibleIds && !visibleIds.has(id)) return []
      const childCount = (childrenOf[id] || []).filter(x => !exclude.has(String(x.ID))).length
      const hasChildren = childCount > 0
      const isOpen = visibleIds ? true : !collapsed.has(id) // search force-expands
      const isSelected = String(value) === id
      return [
        <button key={id} type="button" data-testid={testId ? `${testId}-opt-${id}` : undefined}
          onClick={() => select(id)}
          style={{ paddingLeft: depth * 16 + 8 }}
          className={`w-full text-left flex items-center gap-1.5 pr-3 py-1.5 transition-colors cursor-pointer border-b border-outline-variant/10 ${isSelected ? 'bg-primary/8' : 'hover:bg-surface-container-low/50'}`}>
          {hasChildren ? (
            <span role="button" tabIndex={-1} aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
              onClick={e => { e.stopPropagation(); toggleCollapse(id) }}
              className="w-4 h-4 shrink-0 flex items-center justify-center rounded text-on-surface-variant hover:bg-primary/10 hover:text-primary cursor-pointer">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{isOpen ? 'expand_more' : 'chevron_right'}</span>
            </span>
          ) : <span className="w-4 shrink-0" />}
          <span className="material-symbols-outlined text-on-surface-variant shrink-0" style={{ fontSize: 15 }}>{c.Icon || 'folder_open'}</span>
          <span className="text-sm text-on-surface truncate flex-1">{c['Tên danh mục']}</span>
          {hasChildren && <span className="text-[10px] text-on-surface-variant bg-surface-container px-1.5 rounded-full shrink-0">{childCount}</span>}
          {isSelected && <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: 14 }}>check</span>}
        </button>,
        ...(isOpen ? renderNodes(id, depth + 1) : [])
      ]
    })
  }

  const selectedCat = value ? cats.find(c => String(c.ID) === String(value)) : null
  const nodes = renderNodes('', 0)

  return (
    <div ref={ref} className="relative">
      <button type="button" data-testid={testId}
        onClick={() => setOpen(!open)}
        className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 text-sm text-left flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer">
        {selectedCat ? (
          <>
            <span className="material-symbols-outlined text-on-surface-variant shrink-0" style={{ fontSize: 16 }}>{selectedCat.Icon || 'folder_open'}</span>
            <span className="flex-1 truncate text-on-surface">{selectedCat['Tên danh mục']}</span>
          </>
        ) : (
          <span className="text-on-surface-variant flex-1 truncate">{rootOption || placeholder}</span>
        )}
        <span className="material-symbols-outlined text-on-surface-variant shrink-0" style={{ fontSize: 16 }}>{open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-outline-variant/40 max-h-72 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-outline-variant/30">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" style={{ fontSize: 14 }}>search</span>
              <input ref={searchRef}
                className="w-full bg-surface-container-low border-none rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                placeholder="Tìm danh mục..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {rootOption && (
              <button type="button" data-testid={testId ? `${testId}-opt-root` : undefined}
                onClick={() => select('')}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors border-b border-outline-variant/20 cursor-pointer ${!value ? 'bg-primary/8 text-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
                {rootOption}
              </button>
            )}
            {nodes}
            {nodes.length === 0 && <div className="px-3 py-4 text-center text-on-surface-variant text-xs">Không tìm thấy</div>}
          </div>
        </div>
      )}
    </div>
  )
}
