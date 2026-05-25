import { useState, useMemo } from 'react'
import { usePortalData } from '../context/PortalDataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import gasCall from '../gasClient.js'

const COMPANY_POSITIONS = [
  { code: 'Giám đốc', max: 1 },
  { code: 'Phó GĐ', max: -1 },
  { code: 'Văn thư', max: -1 },
  { code: 'admin', max: -1 },
]

const DEPT_HEAD_POSITIONS = [
  { code: 'Trưởng phòng', max: 1 },
  { code: 'Phó phòng', max: -1 },
]

function Icon({ name, size = 20, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`} style={{ fontSize: size }}>{name}</span>
}

export default function OrgStructure() {
  const { users, phongBan, assignments, sync } = usePortalData()
  const { addToast } = useToast()
  const confirm = useConfirm()
  const [saving, setSaving] = useState(false)
  const [addingDept, setAddingDept] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')
  const [collapsed, setCollapsed] = useState({})

  // Pending changes: { adds: [{userId, chucVu, phongBanId}], removes: [assignmentId] }
  const [pendingAdds, setPendingAdds] = useState([])
  const [pendingRemoves, setPendingRemoves] = useState([])

  function toggleCollapse(id) {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function getToken() { return localStorage.getItem('sso_access_token') }

  const allUsers = (users || []).filter(u => u['Trạng thái'] !== 'Locked')
  const allDepts = phongBan || []

  // Effective assignments = server assignments - pending removes + pending adds
  const effectiveAssignments = useMemo(() => {
    const removeSet = new Set(pendingRemoves.map(String))
    const kept = (assignments || []).filter(a => !removeSet.has(String(a.ID)))
    // Add pending adds with temp IDs
    const added = pendingAdds.map((a, i) => ({
      ID: '_pending_' + i,
      'UserID': a.userId,
      'Chức vụ': a.chucVu,
      'PhongBanID': a.phongBanId || '',
      _pending: true,
    }))
    return [...kept, ...added]
  }, [assignments, pendingAdds, pendingRemoves])

  function getUserById(id) { return allUsers.find(u => String(u.ID) === String(id)) }
  function userName(u) { return u ? (u['Tên nhân viên'] || u['Email']) : '' }
  function avatar(name) { return (name || '?')[0].toUpperCase() }

  // Users with no assignments at all (effective)
  const assignedUserIds = new Set(effectiveAssignments.map(a => String(a['UserID'])))
  const unassignedUsers = allUsers.filter(u => !assignedUserIds.has(String(u.ID)))

  function getAssignments(posCode, deptId) {
    return effectiveAssignments.filter(a =>
      a['Chức vụ'] === posCode &&
      String(a['PhongBanID'] || '') === String(deptId || '')
    )
  }

  function availableUsers(deptId) {
    if (!deptId) return allUsers
    const inDept = new Set(
      effectiveAssignments.filter(a => String(a['PhongBanID']) === String(deptId)).map(a => String(a['UserID']))
    )
    return allUsers.filter(u => !inDept.has(String(u.ID)))
  }

  // --- Local pending operations ---

  function handleAssign(userId, chucVu, phongBanId) {
    setPendingAdds(prev => [...prev, { userId: String(userId), chucVu, phongBanId: phongBanId || '' }])
  }

  function handleRemove(assignmentId) {
    const idStr = String(assignmentId)
    // If it's a pending add, just remove from pending
    if (idStr.startsWith('_pending_')) {
      const idx = parseInt(idStr.replace('_pending_', ''), 10)
      setPendingAdds(prev => prev.filter((_, i) => i !== idx))
      return
    }
    // Otherwise mark for removal
    setPendingRemoves(prev => [...prev, idStr])
  }

  // Per-section pending helpers
  function getSectionPending(deptId) {
    const key = String(deptId || '')
    const adds = pendingAdds.filter(a => String(a.phongBanId || '') === key)
    const removes = pendingRemoves.filter(rid => {
      const a = (assignments || []).find(x => String(x.ID) === rid)
      return a && String(a['PhongBanID'] || '') === key
    })
    return { adds, removes, hasPending: adds.length > 0 || removes.length > 0 }
  }

  function handleSectionDiscard(deptId) {
    const key = String(deptId || '')
    const { removes } = getSectionPending(deptId)
    setPendingAdds(prev => prev.filter(a => String(a.phongBanId || '') !== key))
    setPendingRemoves(prev => prev.filter(rid => !removes.includes(rid)))
  }

  async function handleSectionSave(deptId) {
    const { adds, removes, hasPending } = getSectionPending(deptId)
    if (!hasPending) return
    setSaving(true)
    try {
      await gasCall('api_batchSaveAssignments', getToken(), { adds, removes })
      const key = String(deptId || '')
      setPendingAdds(prev => prev.filter(a => String(a.phongBanId || '') !== key))
      setPendingRemoves(prev => prev.filter(rid => !removes.includes(rid)))
      await sync(true)
      addToast('Đã lưu thay đổi', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddDept() {
    if (!newDeptName.trim() || saving) return
    setSaving(true)
    try {
      await gasCall('api_addPhongBan', getToken(), { 'Tên phòng ban': newDeptName.trim() })
      setNewDeptName('')
      setAddingDept(false)
      addToast('Thêm phòng ban thành công', 'success')
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDept(deptId) {
    const dept = allDepts.find(d => String(d.ID) === String(deptId))
    if (!dept) return
    const deptMembers = effectiveAssignments.filter(a => String(a['PhongBanID']) === String(deptId))
    if (deptMembers.length > 0) {
      addToast('Không thể xóa phòng ban vẫn còn nhân viên. Hãy chuyển hết nhân viên trước.', 'error')
      return
    }
    if (!await confirm(`Xóa phòng ban "${dept['Tên phòng ban']}"?`)) return
    setSaving(true)
    try {
      await gasCall('api_deletePhongBan', getToken(), deptId)
      addToast('Đã xóa phòng ban', 'success')
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function getUserPositions(userId) {
    return effectiveAssignments
      .filter(a => String(a['UserID']) === String(userId))
      .map(a => {
        const dept = a['PhongBanID'] ? allDepts.find(d => String(d.ID) === String(a['PhongBanID'])) : null
        return a['Chức vụ'] + (dept ? ' — ' + dept['Tên phòng ban'] : '')
      })
  }

  // ===== Render helpers =====

  function renderUserChip(assignment) {
    const u = getUserById(assignment['UserID'])
    const name = userName(u)
    const isPending = assignment._pending
    const isRemoved = pendingRemoves.includes(String(assignment.ID))
    if (isRemoved) return null

    return (
      <div key={assignment.ID}
        className={`inline-flex items-center gap-2 rounded-full pl-1 pr-2 py-1 ${isPending ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-surface-container-low'}`}>
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{avatar(name)}</span>
        </div>
        <span className="text-sm text-on-surface font-medium truncate max-w-[140px]">{name}</span>
        {isPending && <span className="text-[10px] text-primary font-medium">mới</span>}
        <button onClick={() => handleRemove(assignment.ID)} disabled={saving}
          className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-error/10 transition disabled:opacity-50"
          title="Xóa phân bổ">
          <Icon name="close" size={14} className="text-on-surface-variant hover:text-error" />
        </button>
      </div>
    )
  }

  function renderPositionRow(posCode, posMax, deptId) {
    const posAssignments = getAssignments(posCode, deptId)
    const assignedIds = new Set(posAssignments.map(a => String(a['UserID'])))
    const available = availableUsers(deptId).filter(u => !assignedIds.has(String(u.ID)))
    const isFull = posMax > 0 && posAssignments.length >= posMax

    return (
      <div key={posCode + '_' + (deptId || 'co')} className="flex flex-wrap items-center gap-2 py-2">
        <span className="text-sm font-medium text-on-surface-variant w-28 shrink-0">
          {posCode}
        </span>
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {posAssignments.map(a => renderUserChip(a))}
          {!isFull && (
            <select
              value=""
              onChange={e => { if (e.target.value) handleAssign(e.target.value, posCode, deptId) }}
              disabled={saving}
              className="w-36 text-xs px-2 py-1.5 rounded-lg bg-surface-container-low border border-dashed border-outline-variant/60 text-on-surface-variant hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-50 cursor-pointer"
            >
              <option value="">+ Thêm</option>
              {available.map(u => {
                const positions = getUserPositions(u.ID)
                const badge = positions.length > 0 ? ` (${positions.join(', ')})` : ''
                return (
                  <option key={u.ID} value={u.ID}>
                    {userName(u)}{badge}
                  </option>
                )
              })}
            </select>
          )}
        </div>
      </div>
    )
  }

  function renderSectionSaveBar(deptId) {
    const { adds, removes, hasPending } = getSectionPending(deptId)
    if (!hasPending) return null
    return (
      <div className="flex items-center justify-end gap-2 px-5 py-2.5 bg-primary/5 border-t border-primary/10">
        <span className="text-xs text-on-surface-variant flex-1">
          {adds.length > 0 && `${adds.length} thêm`}
          {adds.length > 0 && removes.length > 0 && ', '}
          {removes.length > 0 && `${removes.length} xóa`}
        </span>
        <button onClick={() => handleSectionDiscard(deptId)} disabled={saving}
          className="px-3 py-1 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container transition disabled:opacity-50">
          Hủy
        </button>
        <button onClick={() => handleSectionSave(deptId)} disabled={saving}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-on-primary hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-1">
          {saving ? <Icon name="progress_activity" size={14} className="animate-spin" /> : <Icon name="save" size={14} />}
          Lưu
        </button>
      </div>
    )
  }

  function renderMemberTable(deptId) {
    const allMembers = getAssignments('Nhân viên', deptId)
    const members = allMembers.filter(a => !pendingRemoves.includes(String(a.ID)))
    const available = availableUsers(deptId)
    return (
      <div className="mt-1">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-on-surface-variant">Nhân viên</span>
          {members.length === 0 && (
            <select
              value=""
              onChange={e => { if (e.target.value) handleAssign(e.target.value, 'Nhân viên', deptId) }}
              disabled={saving}
              className="w-36 text-xs px-2 py-1.5 rounded-lg bg-surface-container-low border border-dashed border-outline-variant/60 text-on-surface-variant hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-50 cursor-pointer"
            >
              <option value="">+ Thêm nhân viên</option>
              {available.map(u => {
                const positions = getUserPositions(u.ID)
                const badge = positions.length > 0 ? ` (${positions.join(', ')})` : ''
                return <option key={u.ID} value={u.ID}>{userName(u)}{badge}</option>
              })}
            </select>
          )}
        </div>
        {members.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-on-surface-variant">
                <th className="text-left font-medium py-1.5 pl-3 w-10">#</th>
                <th className="text-left font-medium py-1.5">Họ tên</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((a, idx) => {
                const u = getUserById(a['UserID'])
                const name = userName(u)
                const isPending = a._pending
                return (
                  <tr key={a.ID} className={`border-t border-outline-variant/20 ${isPending ? 'bg-primary/5' : 'hover:bg-surface-container-low/50'} transition`}>
                    <td className="py-2 pl-3 text-on-surface-variant">{idx + 1}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-primary">{avatar(name)}</span>
                        </div>
                        <span className="text-on-surface">{name}</span>
                        {isPending && <span className="text-[10px] text-primary font-medium bg-primary/10 px-1.5 rounded">mới</span>}
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <button onClick={() => handleRemove(a.ID)} disabled={saving}
                        className="w-6 h-6 inline-flex items-center justify-center rounded-full hover:bg-error/10 transition disabled:opacity-50"
                        title="Xóa">
                        <Icon name="close" size={14} className="text-on-surface-variant hover:text-error" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {members.length > 0 && (
          <div className="mt-2 pl-3">
            <select
              value=""
              onChange={e => { if (e.target.value) handleAssign(e.target.value, 'Nhân viên', deptId) }}
              disabled={saving}
              className="w-36 text-xs px-2 py-1.5 rounded-lg bg-surface-container-low border border-dashed border-outline-variant/60 text-on-surface-variant hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-50 cursor-pointer"
            >
              <option value="">+ Thêm nhân viên</option>
              {available.map(u => {
                const positions = getUserPositions(u.ID)
                const badge = positions.length > 0 ? ` (${positions.join(', ')})` : ''
                return <option key={u.ID} value={u.ID}>{userName(u)}{badge}</option>
              })}
            </select>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {saving && (
        <div className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] px-8 py-6 flex flex-col items-center gap-3 min-w-[220px]">
            <Icon name="progress_activity" size={32} className="text-primary animate-spin" />
            <p className="text-sm font-medium text-on-surface">Đang lưu thay đổi...</p>
          </div>
        </div>
      )}

      {/* Ban lãnh đạo */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <button onClick={() => toggleCollapse('company')} className="w-full px-5 py-4 border-b border-outline-variant/40 flex items-center gap-3 hover:bg-surface-container-low/50 transition cursor-pointer">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Icon name="stars" size={20} className="text-amber-700" />
          </div>
          <h2 className="text-base font-bold text-on-surface flex-1 text-left">Ban lãnh đạo</h2>
          <Icon name={collapsed['company'] ? 'expand_more' : 'expand_less'} size={20} className="text-on-surface-variant" />
        </button>
        {!collapsed['company'] && (
          <>
            <div className="px-5 py-3 divide-y divide-outline-variant/20">
              {COMPANY_POSITIONS.map(pos => renderPositionRow(pos.code, pos.max, ''))}
            </div>
            {renderSectionSaveBar('')}
          </>
        )}
      </div>

      {/* Department cards */}
      {allDepts.map(dept => {
        const deptAssignments = effectiveAssignments.filter(a => String(a['PhongBanID']) === String(dept.ID))
        const isCollapsed = collapsed['dept_' + dept.ID]
        return (
          <div key={dept.ID} className="bg-white rounded-2xl shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/40 flex items-center justify-between">
              <button onClick={() => toggleCollapse('dept_' + dept.ID)} className="flex items-center gap-3 flex-1 hover:opacity-80 transition cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon name="apartment" size={20} className="text-primary" />
                </div>
                <div className="text-left">
                  <h2 className="text-base font-bold text-on-surface">{dept['Tên phòng ban']}</h2>
                  <p className="text-xs text-on-surface-variant">{deptAssignments.length} vị trí</p>
                </div>
                <Icon name={isCollapsed ? 'expand_more' : 'expand_less'} size={20} className="text-on-surface-variant ml-1" />
              </button>
              <button onClick={() => handleDeleteDept(dept.ID)} disabled={saving}
                className="text-xs text-error hover:bg-error/10 px-3 py-1.5 rounded-lg transition disabled:opacity-50 flex items-center gap-1">
                <Icon name="delete" size={14} />
                Xóa
              </button>
            </div>
            {!isCollapsed && (
              <>
                <div className="px-5 py-3">
                  <div className="divide-y divide-outline-variant/20">
                    {DEPT_HEAD_POSITIONS.map(pos => renderPositionRow(pos.code, pos.max, dept.ID))}
                  </div>
                  {renderMemberTable(dept.ID)}
                </div>
                {renderSectionSaveBar(dept.ID)}
              </>
            )}
          </div>
        )
      })}

      {/* Add department */}
      {addingDept ? (
        <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
          <input type="text" value={newDeptName} autoFocus
            onChange={e => setNewDeptName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddDept(); if (e.key === 'Escape') setAddingDept(false) }}
            placeholder="Tên phòng ban..."
            className="flex-1 px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition" />
          <button onClick={handleAddDept} disabled={saving || !newDeptName.trim()}
            className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition shadow-md3-1">
            Tạo
          </button>
          <button onClick={() => { setAddingDept(false); setNewDeptName('') }}
            className="px-3 py-2 rounded-xl text-sm text-on-surface-variant hover:bg-surface-container transition">
            Hủy
          </button>
        </div>
      ) : (
        <button onClick={() => setAddingDept(true)}
          className="w-full bg-white rounded-2xl shadow-card p-4 flex items-center justify-center gap-2 text-sm font-medium text-primary hover:bg-primary/5 transition border-2 border-dashed border-primary/20">
          <Icon name="add" size={18} />
          Thêm phòng ban
        </button>
      )}

      {/* Unassigned users */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/40 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center">
            <Icon name="person_off" size={20} className="text-on-surface-variant" />
          </div>
          <h2 className="text-base font-bold text-on-surface">
            Chưa phân bổ
            {unassignedUsers.length > 0 && <span className="ml-2 text-sm font-normal text-on-surface-variant">({unassignedUsers.length})</span>}
          </h2>
        </div>
        <div className="px-5 py-4">
          {unassignedUsers.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-2">Tất cả nhân viên đã được phân bổ</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unassignedUsers.map(u => (
                <div key={u.ID} className="inline-flex items-center gap-2 bg-surface-container-low rounded-full pl-1 pr-3 py-1">
                  <div className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-on-surface-variant">{avatar(userName(u))}</span>
                  </div>
                  <span className="text-sm text-on-surface">{userName(u)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
