import { useState, useRef, useEffect } from 'react'

function RecipientColumn({ label, users, phongBan, selectedIds, onChange }) {
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Department checkbox state: { deptId: { all: bool, leadersOnly: bool } }
  const [deptChecks, setDeptChecks] = useState({})

  function toggleUser(userId) {
    const next = new Set(selectedIds)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    onChange(next)
  }

  function getDeptUsers(dept) {
    const deptName = dept['Tên phòng ban']
    return users.filter(u => u['Phòng ban'] === deptName)
  }

  function getDeptLeaderIds(dept) {
    const ids = []
    if (dept['Trưởng']) ids.push(String(dept['Trưởng']))
    if (dept['Phó']) {
      try {
        const arr = typeof dept['Phó'] === 'string' ? JSON.parse(dept['Phó']) : dept['Phó']
        if (Array.isArray(arr)) arr.forEach(id => ids.push(String(id)))
      } catch (_) {}
    }
    return ids
  }

  function hasDeptLeaders(dept) {
    return getDeptLeaderIds(dept).length > 0 && getDeptUsers(dept).length > getDeptLeaderIds(dept).length
  }

  function handleDeptToggle(dept) {
    const deptId = dept.ID
    const isChecked = deptChecks[deptId]?.all
    const leadersOnly = deptChecks[deptId]?.leadersOnly || false
    const next = new Set(selectedIds)

    if (isChecked) {
      // Uncheck — remove dept users
      const deptUserIds = getDeptUsers(dept).map(u => String(u.ID))
      deptUserIds.forEach(id => next.delete(id))
      setDeptChecks(prev => ({ ...prev, [deptId]: { all: false, leadersOnly: false } }))
    } else {
      // Check — add users based on leadersOnly
      const deptUsers = getDeptUsers(dept)
      const leaderIds = getDeptLeaderIds(dept)
      const idsToAdd = leadersOnly
        ? deptUsers.filter(u => leaderIds.includes(String(u.ID))).map(u => String(u.ID))
        : deptUsers.map(u => String(u.ID))
      idsToAdd.forEach(id => next.add(id))
      setDeptChecks(prev => ({ ...prev, [deptId]: { all: true, leadersOnly } }))
    }
    onChange(next)
  }

  function handleLeadersOnlyToggle(dept) {
    const deptId = dept.ID
    const wasLeadersOnly = deptChecks[deptId]?.leadersOnly || false
    const isDeptChecked = deptChecks[deptId]?.all || false
    const newLeadersOnly = !wasLeadersOnly

    setDeptChecks(prev => ({ ...prev, [deptId]: { ...prev[deptId], leadersOnly: newLeadersOnly } }))

    if (isDeptChecked) {
      // Re-calculate which users to include
      const next = new Set(selectedIds)
      const deptUsers = getDeptUsers(dept)
      const leaderIds = getDeptLeaderIds(dept)

      // Remove all dept users first
      deptUsers.forEach(u => next.delete(String(u.ID)))
      // Add back based on new filter
      const idsToAdd = newLeadersOnly
        ? deptUsers.filter(u => leaderIds.includes(String(u.ID))).map(u => String(u.ID))
        : deptUsers.map(u => String(u.ID))
      idsToAdd.forEach(id => next.add(id))
      onChange(next)
    }
  }

  // Selected users for display as chips
  const selectedUsers = users.filter(u => selectedIds.has(String(u.ID)))

  // Filtered users for dropdown
  const filteredDropdown = users.filter(u => {
    if (selectedIds.has(String(u.ID))) return false
    if (!search) return true
    const name = (u['Tên nhân viên'] || '').toLowerCase()
    const email = (u['Email'] || '').toLowerCase()
    return name.includes(search.toLowerCase()) || email.includes(search.toLowerCase())
  })

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-on-surface-variant mb-2 uppercase tracking-wide">{label}</p>

      {/* Multi-select dropdown */}
      <div className="relative" ref={dropdownRef}>
        <div
          className="w-full bg-surface-container-low rounded-xl px-3 py-2 min-h-[40px] flex flex-wrap gap-1.5 items-center cursor-text border border-transparent focus-within:ring-2 focus-within:ring-primary/20"
          onClick={() => setDropdownOpen(true)}
        >
          {selectedUsers.map(u => (
            <span key={u.ID} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
              {u['Tên nhân viên'] || u['Tên đăng nhập']}
              <button type="button" onClick={e => { e.stopPropagation(); toggleUser(String(u.ID)) }}
                className="hover:text-error transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
              </button>
            </span>
          ))}
          <input
            className="flex-1 min-w-[80px] bg-transparent text-sm focus:outline-none text-on-surface"
            placeholder={selectedUsers.length ? '' : 'Chọn người...'}
            value={search}
            onChange={e => { setSearch(e.target.value); setDropdownOpen(true) }}
            onFocus={() => setDropdownOpen(true)}
          />
        </div>

        {dropdownOpen && filteredDropdown.length > 0 && (
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-md3-3 max-h-40 overflow-y-auto">
            {filteredDropdown.map(u => {
              const name = u['Tên nhân viên'] || u['Tên đăng nhập']
              const email = u['Email'] || ''
              return (
                <button key={u.ID} type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 flex items-center gap-2"
                  onClick={() => { toggleUser(String(u.ID)); setSearch('') }}>
                  <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-on-surface truncate">{name}</span>
                    {email && <span className="block text-on-surface-variant text-xs truncate">{email}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Department checkboxes */}
      <div className="mt-3 space-y-1.5 max-h-[240px] overflow-y-auto">
        {phongBan.map(dept => {
          const deptId = dept.ID
          const isChecked = deptChecks[deptId]?.all || false
          const leadersOnly = deptChecks[deptId]?.leadersOnly || false
          const showLeadersToggle = hasDeptLeaders(dept)

          return (
            <div key={deptId} className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer min-w-0 flex-1">
                <input type="checkbox" checked={isChecked} onChange={() => handleDeptToggle(dept)}
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20 accent-primary cursor-pointer" />
                <span className="text-on-surface truncate">{dept['Tên phòng ban']}</span>
              </label>
              {showLeadersToggle && (
                <label className="flex items-center gap-1 cursor-pointer text-xs text-on-surface-variant whitespace-nowrap">
                  <input type="checkbox" checked={leadersOnly} onChange={() => handleLeadersOnlyToggle(dept)}
                    className="w-3.5 h-3.5 rounded border-outline-variant text-secondary focus:ring-secondary/20 accent-secondary cursor-pointer" />
                  <span>Chỉ T,P</span>
                </label>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PublishDialog({ users, phongBan, onPublish, onClose, loading }) {
  const [toIds, setToIds] = useState(new Set())
  const [ccIds, setCcIds] = useState(new Set())
  const [error, setError] = useState('')

  function handlePublish() {
    if (toIds.size === 0) {
      setError('Vui lòng chọn ít nhất 1 người nhận')
      return
    }
    setError('')
    onPublish(Array.from(toIds), Array.from(ccIds))
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose() }}>
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-[0_12px_40px_rgba(0,83,219,0.12)]">

        {/* Header */}
        <div className="bg-surface-container-low px-6 py-4 flex items-center gap-3 border-b border-outline-variant shrink-0">
          <div className="w-9 h-9 rounded-xl bg-amber-600/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-amber-600" style={{ fontSize: 20 }}>send</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-on-surface text-base">Phát hành hồ sơ</h3>
            <p className="text-xs text-on-surface-variant">Chọn người nhận email thông báo</p>
          </div>
          <button onClick={onClose} disabled={loading}
            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-40 disabled:pointer-events-none">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex gap-6">
            <RecipientColumn
              label="Người nhận:"
              users={users}
              phongBan={phongBan}
              selectedIds={toIds}
              onChange={setToIds}
            />
            <div className="w-px bg-outline-variant shrink-0" />
            <RecipientColumn
              label="CC:"
              users={users}
              phongBan={phongBan}
              selectedIds={ccIds}
              onChange={setCcIds}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 bg-error-container text-on-error-container rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-error" style={{ fontSize: 18 }}>error</span>
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="bg-surface-container-low border-t border-outline-variant px-6 py-4 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} disabled={loading}
            className="px-5 py-2.5 border border-outline-variant rounded-full text-sm text-on-surface hover:bg-surface-container transition-colors font-medium disabled:opacity-60">
            Hủy
          </button>
          <button type="button" onClick={handlePublish} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-full text-sm font-medium hover:bg-amber-700 disabled:opacity-60 transition-colors shadow-md3-2">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
            {loading ? 'Đang xử lý…' : 'Phát hành'}
          </button>
        </div>
      </div>
    </div>
  )
}
