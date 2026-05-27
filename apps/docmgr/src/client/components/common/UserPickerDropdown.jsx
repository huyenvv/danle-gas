import { useState, useRef, useEffect } from 'react'
import { groupUsersByDept } from '../../utils/groupUsers.js'

export default function UserPickerDropdown({ users, phongBan, assignments, value, onChange, placeholder = '-- Chọn --', exclude = [], multiple = false }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus()
  }, [open])

  const allUsers = users || []
  const selectedValues = multiple ? (value || []) : (value ? [value] : [])
  const selectedSet = new Set(selectedValues)

  const excludeSet = new Set(exclude)
  const filteredUsers = allUsers.filter(u => !excludeSet.has(u['Tên đăng nhập']))

  const q = search.toLowerCase()
  const groups = groupUsersByDept(filteredUsers, phongBan, assignments).map(g => {
    if (!q) return g
    const matched = g.users.filter(u => {
      const name = (u['Tên nhân viên'] || '').toLowerCase()
      const email = (u['Email'] || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
    return { ...g, users: matched }
  }).filter(g => g.users.length > 0)

  function handleSelect(uname) {
    if (multiple) {
      const next = selectedSet.has(uname)
        ? selectedValues.filter(v => v !== uname)
        : [...selectedValues, uname]
      onChange(next)
    } else {
      onChange(uname)
      setOpen(false)
      setSearch('')
    }
  }

  function handleRemove(uname) {
    if (multiple) onChange(selectedValues.filter(v => v !== uname))
    else onChange('')
  }

  function getUserName(uname) {
    const u = allUsers.find(u => u['Tên đăng nhập'] === uname)
    return u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : uname
  }

  // Single-select trigger
  const singleDisplay = !multiple && selectedValues.length > 0 ? getUserName(selectedValues[0]) : ''

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      {multiple ? (
        <div
          onClick={() => setOpen(!open)}
          className="w-full bg-surface-container-low rounded-xl px-3 py-2 text-sm text-left flex flex-wrap items-center gap-1.5 min-h-[38px] focus:outline-none cursor-pointer">
          {selectedValues.map(uname => {
            const name = getUserName(uname)
            return (
              <span key={uname} className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full">
                <span className="w-4 h-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[8px] font-bold shrink-0">{name.charAt(0).toUpperCase()}</span>
                {name}
                <button type="button" onClick={e => { e.stopPropagation(); handleRemove(uname) }}
                  className="ml-0.5 hover:text-error transition-colors cursor-pointer">
                  <span className="material-symbols-outlined" style={{ fontSize: 10 }}>close</span>
                </button>
              </span>
            )
          })}
          {selectedValues.length === 0 && <span className="text-on-surface-variant">{placeholder}</span>}
          <span className="material-symbols-outlined text-on-surface-variant shrink-0 ml-auto" style={{ fontSize: 16 }}>
            {open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
          </span>
        </div>
      ) : (
        <button type="button"
          onClick={() => setOpen(!open)}
          className="w-full bg-surface-container-low rounded-xl px-3 py-2.5 text-sm text-left flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer">
          {singleDisplay ? (
            <>
              <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-primary">{singleDisplay.charAt(0).toUpperCase()}</span>
              </span>
              <span className="flex-1 truncate">{singleDisplay}</span>
            </>
          ) : (
            <span className="text-on-surface-variant flex-1">{placeholder}</span>
          )}
          <span className="material-symbols-outlined text-on-surface-variant shrink-0" style={{ fontSize: 16 }}>
            {open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
          </span>
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-outline-variant/40 max-h-72 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-outline-variant/30">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" style={{ fontSize: 14 }}>search</span>
              <input ref={searchRef}
                className="w-full bg-surface-container-low border-none rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                placeholder="Tìm kiếm..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {!multiple && value && (
              <button type="button"
                onClick={() => { onChange(''); setOpen(false); setSearch('') }}
                className="w-full text-left px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container-low transition-colors border-b border-outline-variant/20 cursor-pointer">
                Bỏ chọn
              </button>
            )}
            {groups.map(group => (
              <div key={group.name}>
                <div className="px-3 py-1 bg-surface-container-low/60 border-b border-outline-variant/20">
                  <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">{group.name}</span>
                </div>
                {group.users.map(u => {
                  const uname = u['Tên đăng nhập']
                  const name = u['Tên nhân viên'] || uname
                  const isSelected = selectedSet.has(uname)
                  return (
                    <button key={u.ID} type="button"
                      onClick={() => handleSelect(uname)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-1.5 transition-colors cursor-pointer border-b border-outline-variant/10 last:border-b-0
                        ${isSelected ? 'bg-primary/8' : 'hover:bg-surface-container-low/50'}`}>
                      {multiple ? (
                        <input type="checkbox" checked={isSelected} readOnly
                          className="w-3.5 h-3.5 rounded border-outline-variant accent-primary pointer-events-none" />
                      ) : null}
                      <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-primary">{name.charAt(0).toUpperCase()}</span>
                      </span>
                      <span className="text-sm text-on-surface truncate flex-1">{name}</span>
                      {!multiple && isSelected && <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: 14 }}>check</span>}
                    </button>
                  )
                })}
              </div>
            ))}
            {groups.length === 0 && (
              <div className="px-3 py-4 text-center text-on-surface-variant text-xs">Không tìm thấy</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
