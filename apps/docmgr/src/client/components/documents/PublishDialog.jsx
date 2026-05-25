import { useState } from 'react'

function RecipientColumn({ label, users, phongBan, assignments, selectedIds, onChange }) {
  const [search, setSearch] = useState('')
  // Department checkbox state: { deptId: { leadersOnly: bool } }
  const [deptOpts, setDeptOpts] = useState({})

  function toggleUser(userId) {
    const next = new Set(selectedIds)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    onChange(next)
  }

  // Get user IDs that belong to a dept (from assignments)
  function getDeptUserIds(deptId) {
    return (assignments || [])
      .filter(a => String(a['PhongBanID']) === String(deptId))
      .map(a => String(a['UserID']))
  }

  function getDeptUsers(deptId) {
    const ids = new Set(getDeptUserIds(deptId))
    return users.filter(u => ids.has(String(u.ID)))
  }

  // Leaders = Trưởng phòng + Phó phòng from assignments
  function getDeptLeaderIds(deptId) {
    return (assignments || [])
      .filter(a => String(a['PhongBanID']) === String(deptId) && (a['Chức vụ'] === 'Trưởng phòng' || a['Chức vụ'] === 'Phó phòng'))
      .map(a => String(a['UserID']))
  }

  function hasDeptLeaders(deptId) {
    return getDeptLeaderIds(deptId).length > 0 && getDeptUsers(deptId).length > getDeptLeaderIds(deptId).length
  }

  function handleDeptToggle(dept) {
    const deptUsers = getDeptUsers(dept.ID)
    const leadersOnly = deptOpts[dept.ID]?.leadersOnly || false
    const leaderIds = getDeptLeaderIds(dept.ID)
    const targetUsers = leadersOnly
      ? deptUsers.filter(u => leaderIds.includes(String(u.ID)))
      : deptUsers
    const targetIds = targetUsers.map(u => String(u.ID))
    const allSelected = targetIds.length > 0 && targetIds.every(id => selectedIds.has(id))

    const next = new Set(selectedIds)
    if (allSelected) {
      targetIds.forEach(id => next.delete(id))
    } else {
      targetIds.forEach(id => next.add(id))
    }
    onChange(next)
  }

  function handleLeadersOnlyToggle(dept) {
    const deptId = dept.ID
    const wasLeadersOnly = deptOpts[deptId]?.leadersOnly || false
    const newLeadersOnly = !wasLeadersOnly
    setDeptOpts(prev => ({ ...prev, [deptId]: { ...prev[deptId], leadersOnly: newLeadersOnly } }))

    // If dept has selected users, re-calculate
    const deptUsers = getDeptUsers(deptId)
    const deptUserIds = deptUsers.map(u => String(u.ID))
    const hasAnySelected = deptUserIds.some(id => selectedIds.has(id))
    if (hasAnySelected) {
      const leaderIds = getDeptLeaderIds(deptId)
      const next = new Set(selectedIds)
      deptUserIds.forEach(id => next.delete(id))
      const idsToAdd = newLeadersOnly
        ? deptUsers.filter(u => leaderIds.includes(String(u.ID))).map(u => String(u.ID))
        : deptUserIds
      idsToAdd.forEach(id => next.add(id))
      onChange(next)
    }
  }

  // Group users by department using assignments (multi-dept: user appears in each dept they're assigned to)
  function groupByDept() {
    const depts = phongBan || []
    const allAssignments = assignments || []
    const groups = []

    // Each department from _Phòng Ban
    depts.forEach(dept => {
      const deptUserIds = new Set(getDeptUserIds(dept.ID))
      const deptUsers = users.filter(u => deptUserIds.has(String(u.ID)))
      if (deptUsers.length > 0) {
        groups.push({ name: dept['Tên phòng ban'], users: deptUsers, dept })
      }
    })

    // Company-level assignments (no PhongBanID)
    const companyUserIds = new Set(
      allAssignments
        .filter(a => !a['PhongBanID'] || a['PhongBanID'] === '')
        .map(a => String(a['UserID']))
    )
    // Unassigned: users with no assignment at all
    const assignedIds = new Set(allAssignments.map(a => String(a['UserID'])))
    const unassigned = users.filter(u => !assignedIds.has(String(u.ID)) && !companyUserIds.has(String(u.ID)))

    // Company-level users not in any dept
    const companyOnlyUsers = users.filter(u => companyUserIds.has(String(u.ID)) && !groups.some(g => g.users.some(gu => String(gu.ID) === String(u.ID))))
    if (companyOnlyUsers.length > 0) {
      groups.unshift({ name: 'Ban lãnh đạo', users: companyOnlyUsers, dept: null })
    }

    if (unassigned.length > 0) {
      groups.push({ name: 'Chưa phân phòng', users: unassigned, dept: null })
    }

    return groups
  }

  // Filter by search
  const q = search.toLowerCase()
  const groups = groupByDept().map(g => {
    if (!q) return g
    const filtered = g.users.filter(u => {
      const name = (u['Tên nhân viên'] || '').toLowerCase()
      const email = (u['Email'] || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
    return { ...g, users: filtered }
  }).filter(g => g.users.length > 0)

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <p className="text-xs font-semibold text-on-surface-variant mb-2 uppercase tracking-wide">{label}</p>

      {/* Search */}
      <div className="relative mb-2">
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" style={{ fontSize: 16 }}>search</span>
        <input
          className="w-full bg-surface-container-low border-none rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Tìm kiếm..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grouped checkbox list */}
      <div className="border border-outline-variant/40 rounded-xl overflow-hidden flex-1 overflow-y-auto max-h-[320px]">
        {groups.map(group => {
          const deptUserIds = group.users.map(u => String(u.ID))
          const leadersOnly = group.dept ? (deptOpts[group.dept.ID]?.leadersOnly || false) : false
          const leaderIds = group.dept ? getDeptLeaderIds(group.dept.ID) : []
          const targetIds = leadersOnly
            ? deptUserIds.filter(id => leaderIds.includes(id))
            : deptUserIds
          const selectedCount = targetIds.filter(id => selectedIds.has(id)).length
          const allSelected = targetIds.length > 0 && selectedCount === targetIds.length
          const someSelected = selectedCount > 0 && !allSelected
          const showLeadersToggle = group.dept && hasDeptLeaders(group.dept.ID)

          return (
            <div key={group.name}>
              {/* Department header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-low border-b border-outline-variant/30">
                <input type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected }}
                  onChange={() => group.dept && handleDeptToggle(group.dept)}
                  disabled={!group.dept}
                  className="w-4 h-4 rounded border-outline-variant accent-primary cursor-pointer" />
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide flex-1 min-w-0 truncate">{group.name}</span>
                {showLeadersToggle && (
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] text-on-surface-variant whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={leadersOnly}
                      onChange={() => handleLeadersOnlyToggle(group.dept)}
                      className="w-3 h-3 rounded border-outline-variant accent-secondary cursor-pointer" />
                    <span>Chỉ T,P</span>
                  </label>
                )}
                <span className="text-[10px] font-medium text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full">
                  {selectedCount}/{targetIds.length}
                </span>
              </div>
              {/* Users */}
              {group.users.map(u => {
                const uid = String(u.ID)
                const checked = selectedIds.has(uid)
                const name = u['Tên nhân viên'] || u['Tên đăng nhập'] || u['Email']
                return (
                  <label key={u.ID}
                    className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer transition-colors border-b border-outline-variant/20 last:border-b-0
                      ${checked ? 'bg-primary/5' : 'hover:bg-surface-container-low/50'}`}>
                    <input type="checkbox"
                      checked={checked}
                      onChange={() => toggleUser(uid)}
                      className="w-4 h-4 rounded border-outline-variant accent-primary cursor-pointer" />
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary">{name.charAt(0).toUpperCase()}</span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-on-surface truncate">{name}</p>
                      {u['Email'] && <p className="text-[11px] text-on-surface-variant truncate">{u['Email']}</p>}
                    </div>
                  </label>
                )
              })}
            </div>
          )
        })}
        {groups.length === 0 && (
          <div className="px-3 py-6 text-center text-on-surface-variant text-sm">Không tìm thấy</div>
        )}
      </div>

      {/* Summary */}
      <p className="text-xs text-on-surface-variant text-center mt-2">
        Đã chọn {selectedIds.size} người
      </p>
    </div>
  )
}

export default function PublishDialog({ users, phongBan, assignments, onPublish, onClose, loading }) {
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
              assignments={assignments}
              selectedIds={toIds}
              onChange={setToIds}
            />
            <div className="w-px bg-outline-variant shrink-0" />
            <RecipientColumn
              label="CC:"
              users={users}
              phongBan={phongBan}
              assignments={assignments}
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
