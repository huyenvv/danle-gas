import { useState } from 'react'
import { groupUsersByDept } from '../../utils/groupUsers.js'

// Gmail/Apps Script chặn ~50 người nhận / 1 email. Phát hành gửi 1 email (TO + CC) nên giới hạn tổng
// số người nhận duy nhất mỗi lần; vượt thì phát hành thành nhiều lần.
const MAX_RECIPIENTS = 50

function RecipientColumn({ label, users, phongBan, assignments, selectedIds, onChange }) {
  const [search, setSearch] = useState('')

  function toggleUser(userId) {
    const next = new Set(selectedIds)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    onChange(next)
  }

  function getAllLeaderIds() {
    return (assignments || [])
      .filter(a => a['Chức vụ'] === 'Trưởng phòng' || a['Chức vụ'] === 'Phó phòng')
      .map(a => String(a['UserID']))
  }

  function toggleGroup(userIds) {
    const allSelected = userIds.length > 0 && userIds.every(id => selectedIds.has(id))
    const next = new Set(selectedIds)
    if (allSelected) {
      userIds.forEach(id => next.delete(id))
    } else {
      userIds.forEach(id => next.add(id))
    }
    onChange(next)
  }

  function getVisibleUsers() {
    const allAssignments = assignments || []
    const assignmentsByUser = {}
    allAssignments.forEach(a => {
      const uid = String(a['UserID'])
      if (!assignmentsByUser[uid]) assignmentsByUser[uid] = []
      assignmentsByUser[uid].push(a)
    })
    const hiddenIds = new Set()
    users.forEach(u => {
      const uid = String(u.ID)
      const ua = assignmentsByUser[uid] || []
      const hasNonAdminRole = ua.some(a => a['Chức vụ'] !== 'admin')
      if (ua.length > 0 && !hasNonAdminRole) { hiddenIds.add(uid); return }
      if (ua.length === 0 && u['Quyền'] === 'Quản trị') { hiddenIds.add(uid); return }
    })
    return users.filter(u => !hiddenIds.has(String(u.ID)))
  }

  const q = search.toLowerCase()
  const groups = groupUsersByDept(getVisibleUsers(), phongBan, assignments).map(g => {
    if (!q) return g
    const filtered = g.users.filter(u => {
      const name = (u['Tên nhân viên'] || '').toLowerCase()
      const email = (u['Email'] || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
    return { ...g, users: filtered }
  }).filter(g => g.users.length > 0)

  // Global counts (based on visible users from groups, not raw users)
  const allVisibleUsers = new Set()
  groups.forEach(g => g.users.forEach(u => allVisibleUsers.add(String(u.ID))))
  const allUserIds = [...allVisibleUsers]
  const allLeaderIds = [...new Set(getAllLeaderIds())].filter(id => allVisibleUsers.has(id))
  const allSelectedCount = allUserIds.filter(id => selectedIds.has(id)).length
  const allChecked = allUserIds.length > 0 && allSelectedCount === allUserIds.length
  const allIndeterminate = allSelectedCount > 0 && !allChecked
  const allLeadersChecked = allLeaderIds.length > 0 && allLeaderIds.every(id => selectedIds.has(id))

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
      <div className="border border-outline-variant/40 rounded-xl overflow-hidden flex-1 overflow-y-auto">
        {/* Global toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-surface-container border-b border-outline-variant/30">
          <input type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = allIndeterminate }}
            onChange={() => toggleGroup(allUserIds)}
            className="w-4 h-4 rounded border-outline-variant accent-primary cursor-pointer" />
          <span className="text-xs font-semibold text-on-surface-variant flex-1">Chọn tất cả</span>
          {allLeaderIds.length > 0 && (
            <button type="button"
              onClick={() => toggleGroup(allLeaderIds)}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${allLeadersChecked ? 'bg-primary/10 text-primary border-primary/30' : 'text-on-surface-variant border-outline-variant/40 hover:border-primary/30 hover:text-primary'}`}>
              Chỉ T,P
            </button>
          )}
          <span className="text-[10px] font-medium text-on-surface-variant bg-surface-container-low px-1.5 py-0.5 rounded-full">
            {allSelectedCount}/{allUserIds.length}
          </span>
        </div>

        {groups.map(group => {
          const groupUserIds = group.users.map(u => String(u.ID))
          const selectedCount = groupUserIds.filter(id => selectedIds.has(id)).length
          const groupAllSelected = groupUserIds.length > 0 && selectedCount === groupUserIds.length
          const someSelected = selectedCount > 0 && !groupAllSelected

          return (
            <div key={group.name}>
              {/* Department header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-low border-b border-outline-variant/30">
                <input type="checkbox"
                  checked={groupAllSelected}
                  ref={el => { if (el) el.indeterminate = someSelected }}
                  onChange={() => toggleGroup(groupUserIds)}
                  className="w-4 h-4 rounded border-outline-variant accent-primary cursor-pointer" />
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide flex-1 min-w-0 truncate">{group.name}</span>
                <span className="text-[10px] font-medium text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full">
                  {selectedCount}/{groupUserIds.length}
                </span>
              </div>
              {/* Users */}
              {group.users.map(u => {
                const uid = String(u.ID)
                const checked = selectedIds.has(uid)
                const name = u['Tên nhân viên'] || u['Tên đăng nhập'] || u['Email']
                // Role in this group's context (hide Nhân viên and admin to reduce noise)
                const deptId = group.dept ? String(group.dept.ID) : null
                const role = (assignments || []).find(a =>
                  String(a['UserID']) === uid &&
                  (deptId ? String(a['PhongBanID']) === deptId : (!a['PhongBanID'] || a['PhongBanID'] === '')) &&
                  a['Chức vụ'] && a['Chức vụ'] !== 'Nhân viên' && a['Chức vụ'] !== 'admin'
                )
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
                    {role && (
                      <span className="text-[10px] font-medium text-primary bg-primary/8 px-2 py-0.5 rounded-full shrink-0">
                        {role['Chức vụ']}
                      </span>
                    )}
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

  // Gmail/Apps Script giới hạn ~50 người nhận / 1 email; phát hành gửi 1 email duy nhất (TO + CC)
  // nên chặn tại đây. Muốn gửi nhiều hơn → phát hành thành nhiều lần.
  const uniqueRecipients = new Set([...toIds, ...ccIds]).size

  function handlePublish() {
    if (toIds.size === 0) {
      setError('Vui lòng chọn ít nhất 1 người nhận')
      return
    }
    if (uniqueRecipients > MAX_RECIPIENTS) {
      setError(`Gmail giới hạn ${MAX_RECIPIENTS} người nhận mỗi lần phát hành. Hiện đã chọn ${uniqueRecipients} (người nhận + CC). Vui lòng bớt xuống ≤ ${MAX_RECIPIENTS} hoặc phát hành thành nhiều lần.`)
      return
    }
    setError('')
    onPublish(Array.from(toIds), Array.from(ccIds))
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose() }}>
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col shadow-[0_12px_40px_rgba(0,83,219,0.12)]">

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
        <div className="bg-surface-container-low border-t border-outline-variant px-6 py-4 flex items-center justify-end gap-3 shrink-0">
          <span className={`mr-auto text-xs ${uniqueRecipients > MAX_RECIPIENTS ? 'text-error font-medium' : 'text-on-surface-variant'}`}>
            {uniqueRecipients}/{MAX_RECIPIENTS} người nhận
          </span>
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
