import { useState } from 'react'
import { usePortalData } from '../context/PortalDataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import gasCall from '../gasClient.js'

function Icon({ name, size = 20, className = '', filled = false }) {
  return (
    <span className={`material-symbols-outlined ${className}`}
      style={{ fontSize: size, fontVariationSettings: filled ? '"FILL" 1' : '"FILL" 0' }}>
      {name}
    </span>
  )
}

function parsePho(val) {
  if (!val) return []
  try {
    const arr = typeof val === 'string' ? JSON.parse(val) : val
    return Array.isArray(arr) ? arr.map(String) : []
  } catch (_) { return [] }
}

export default function PhongBanManager() {
  const { phongBan, users, sync } = usePortalData()
  const { addToast } = useToast()
  const confirm = useConfirm()

  // View mode: open existing dept
  const [selectedDeptId, setSelectedDeptId] = useState(null)
  // Create mode: new dept with local form state
  const [creating, setCreating] = useState(false)
  const [createData, setCreateData] = useState({ name: '', truong: '', pho: [], memberIds: [] })

  const [saving, setSaving] = useState(false)


  function getToken() { return localStorage.getItem('sso_access_token') }
  function getUserById(userId) { return (users || []).find(u => String(u.ID) === String(userId)) }
  function getUserName(userId) {
    const u = getUserById(userId)
    return u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : ''
  }
  const activeUsers = (users || []).filter(u => u['Trạng thái'] !== 'Locked')
  const avatar = (name) => (name || '?')[0].toUpperCase()

  // === VIEW MODE data ===
  const selectedDept = selectedDeptId ? (phongBan || []).find(d => d.ID === selectedDeptId) : null
  const viewDeptName = selectedDept ? selectedDept['Tên phòng ban'] : ''
  const viewMembers = selectedDept ? (users || []).filter(u => u['Phòng ban'] === viewDeptName) : []
  const viewTruongId = selectedDept ? String(selectedDept['Trưởng'] || '') : ''
  const viewPhoIds = selectedDept ? parsePho(selectedDept['Phó']) : []
  const viewAvailableUsers = activeUsers.filter(u => u['Phòng ban'] !== viewDeptName || !u['Phòng ban'])

  // === CREATE MODE helpers ===
  const createMembers = creating ? activeUsers.filter(u => createData.memberIds.includes(String(u.ID))) : []
  const createAvailable = creating ? activeUsers.filter(u => !createData.memberIds.includes(String(u.ID))) : []

  function openCreate() {
    setCreating(true)
    setCreateData({ name: '', truong: '', pho: [], memberIds: [] })

  }

  function closeModal() {
    setSelectedDeptId(null)
    setCreating(false)

  }

  // === CREATE handlers ===
  async function handleCreate() {
    if (!createData.name.trim()) { addToast('Vui lòng nhập tên phòng ban', 'error'); return }
    setSaving(true)
    try {
      const data = {
        'Tên phòng ban': createData.name.trim(),
        'Trưởng': createData.truong || '',
        'Phó': createData.pho,
      }
      await gasCall('api_addPhongBan', getToken(), data)
      // Assign members
      for (const uid of createData.memberIds) {
        await gasCall('api_updateUser', getToken(), uid, { 'Phòng ban': createData.name.trim() })
      }
      addToast('Thêm phòng ban thành công', 'success')
      setCreating(false)
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function createAddMember(userId) {
    const uid = String(userId)
    setCreateData(d => ({ ...d, memberIds: [...d.memberIds, uid] }))

  }

  function createRemoveMember(userId) {
    const uid = String(userId)
    setCreateData(d => ({
      ...d,
      memberIds: d.memberIds.filter(id => id !== uid),
      truong: d.truong === uid ? '' : d.truong,
      pho: d.pho.filter(id => id !== uid),
    }))
  }

  function createSetTruong(newId) {
    setCreateData(d => ({
      ...d,
      truong: newId,
      pho: newId ? d.pho.filter(id => id !== newId) : d.pho,
      memberIds: newId && !d.memberIds.includes(newId) ? [...d.memberIds, newId] : d.memberIds,
    }))
  }

  function createAddPho(userId) {
    const uid = String(userId)
    setCreateData(d => ({
      ...d,
      pho: [...d.pho, uid],
      truong: d.truong === uid ? '' : d.truong,
      memberIds: !d.memberIds.includes(uid) ? [...d.memberIds, uid] : d.memberIds,
    }))
  }

  function createRemovePho(userId) {
    setCreateData(d => ({ ...d, pho: d.pho.filter(id => id !== String(userId)) }))
  }

  // === VIEW handlers ===
  async function handleDeleteDept() {
    if (!selectedDept) return
    if (!await confirm(`Xóa phòng ban "${viewDeptName}"? Tất cả thành viên sẽ bị xóa khỏi phòng ban.`)) return
    try {
      await gasCall('api_deletePhongBan', getToken(), selectedDept.ID)
      addToast('Đã xóa phòng ban', 'success')
      closeModal()
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  async function handleAddMember(userId) {
    setSaving(true)
    try {
      await gasCall('api_updateUser', getToken(), userId, { 'Phòng ban': viewDeptName })
  
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveMember(userId) {
    const u = getUserById(userId)
    const name = u ? (u['Tên nhân viên'] || u['Email']) : userId
    if (!await confirm(`Xóa "${name}" khỏi phòng ban ${viewDeptName}?`)) return
    setSaving(true)
    try {
      if (String(userId) === viewTruongId) {
        await gasCall('api_updatePhongBan', getToken(), selectedDept.ID, { 'Trưởng': '' })
      }
      if (viewPhoIds.includes(String(userId))) {
        await gasCall('api_updatePhongBan', getToken(), selectedDept.ID, { 'Phó': viewPhoIds.filter(id => id !== String(userId)) })
      }
      await gasCall('api_updateUser', getToken(), userId, { 'Phòng ban': '' })
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangeTruong(newId) {
    setSaving(true)
    try {
      const updateData = { 'Trưởng': newId }
      if (newId && viewPhoIds.includes(String(newId))) {
        updateData['Phó'] = viewPhoIds.filter(id => id !== String(newId))
      }
      await gasCall('api_updatePhongBan', getToken(), selectedDept.ID, updateData)
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddPho(userId) {
    setSaving(true)
    try {
      const updateData = { 'Phó': [...viewPhoIds, String(userId)] }
      if (String(userId) === viewTruongId) updateData['Trưởng'] = ''
      await gasCall('api_updatePhongBan', getToken(), selectedDept.ID, updateData)
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemovePho(userId) {
    setSaving(true)
    try {
      await gasCall('api_updatePhongBan', getToken(), selectedDept.ID, { 'Phó': viewPhoIds.filter(id => id !== String(userId)) })
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ===================== SHARED MODAL RENDERER =====================
  function renderModal({ isCreate, deptLabel, memberList, truong, pho, available, onClose, leaderCandidates }) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.2)] w-full max-w-3xl flex flex-col overflow-hidden max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/40 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="apartment" size={22} className="text-primary" />
              </div>
              <div>
                {isCreate ? (
                  <input type="text" value={createData.name} autoFocus
                    onChange={e => setCreateData(d => ({ ...d, name: e.target.value }))}
                    className="font-bold text-on-surface text-lg w-full px-3 py-1.5 rounded-xl bg-surface-container-low border border-outline-variant/40 outline-none focus:ring-2 focus:ring-primary/20 transition placeholder:text-on-surface-variant/40"
                    placeholder="Nhập tên phòng ban..." />
                ) : (
                  <h2 className="font-bold text-on-surface text-lg">{deptLabel}</h2>
                )}
                <p className="text-xs text-on-surface-variant">{memberList.length} thành viên</p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors">
              <Icon name="close" size={22} className="text-on-surface-variant" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
            {/* Leadership */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Trưởng */}
              <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/40 p-4">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">Trưởng phòng</p>
                {truong && getUserById(truong) ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-amber-700">{avatar(getUserName(truong))}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-on-surface text-sm truncate">{getUserName(truong)}</p>
                      <p className="text-xs text-on-surface-variant truncate">{getUserById(truong)?.['Email']}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant italic">Chưa chỉ định</p>
                )}
                <div className="mt-3">
                  <select value={truong}
                    onChange={e => isCreate ? createSetTruong(e.target.value) : handleChangeTruong(e.target.value)}
                    disabled={saving}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border-none text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-50">
                    <option value="">-- Chọn trưởng phòng --</option>
                    {leaderCandidates.map(u => (
                      <option key={u.ID} value={String(u.ID)}>{u['Tên nhân viên'] || u['Tên đăng nhập']}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Phó */}
              <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/40 p-4">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">
                  Phó phòng {pho.length > 0 && <span className="text-primary">({pho.length})</span>}
                </p>
                {pho.length > 0 ? (
                  <div className="space-y-2">
                    {pho.map(id => {
                      const u = getUserById(id)
                      return (
                        <div key={id} className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-blue-700">{avatar(getUserName(id))}</span>
                          </div>
                          <span className="text-sm text-on-surface flex-1 truncate">{u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : id}</span>
                          <button onClick={() => isCreate ? createRemovePho(id) : handleRemovePho(id)} disabled={saving}
                            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-error/10 transition-colors disabled:opacity-50">
                            <Icon name="close" size={14} className="text-on-surface-variant hover:text-error" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant italic">Chưa có phó phòng</p>
                )}
                <div className="mt-3">
                  <select value=""
                    onChange={e => { if (e.target.value) isCreate ? createAddPho(e.target.value) : handleAddPho(e.target.value) }}
                    disabled={saving}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border-none text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-50">
                    <option value="">+ Thêm phó phòng...</option>
                    {leaderCandidates
                      .filter(u => String(u.ID) !== truong && !pho.includes(String(u.ID)))
                      .map(u => (
                        <option key={u.ID} value={String(u.ID)}>{u['Tên nhân viên'] || u['Tên đăng nhập']}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Members (exclude Trưởng/Phó — already shown above) */}
            <div>
              {(() => {
                const regularMembers = memberList.filter(u => {
                  const uid = String(u.ID)
                  return uid !== truong && !pho.includes(uid)
                })
                return (<>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                  Nhân viên ({regularMembers.length})
                </p>
              </div>

              <div className="mb-3">
                <select value=""
                  onChange={e => { if (e.target.value) isCreate ? createAddMember(e.target.value) : handleAddMember(e.target.value) }}
                  disabled={saving}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-50">
                  <option value="">+ Thêm nhân viên...</option>
                  {available.map(u => (
                    <option key={u.ID} value={u.ID}>{u['Tên nhân viên'] || u['Tên đăng nhập']} ({u['Email']})</option>
                  ))}
                </select>
              </div>

              <div className="bg-white rounded-xl border border-outline-variant/40 overflow-hidden">
                {regularMembers.length === 0 ? (
                  <div className="px-4 py-8 text-center text-on-surface-variant text-sm">
                    Chưa có thành viên nào
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-outline-variant/40">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Nhân viên</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Chức vụ</th>
                        <th className="px-4 py-2.5 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {regularMembers.map(u => {
                        const uid = String(u.ID)
                        return (
                          <tr key={u.ID} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <span className="text-xs font-bold text-primary">{avatar(u['Tên đăng nhập'])}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-on-surface text-sm truncate">{u['Tên nhân viên'] || u['Tên đăng nhập']}</p>
                                  <p className="text-xs text-on-surface-variant truncate">{u['Email']}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {u['Chức vụ'] || 'Nhân viên'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <button onClick={() => isCreate ? createRemoveMember(uid) : handleRemoveMember(u.ID)}
                                disabled={saving}
                                title="Xóa khỏi phòng ban"
                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-error/10 transition-colors disabled:opacity-50">
                                <Icon name="close" size={16} className="text-on-surface-variant hover:text-error" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              </>)
              })()}
            </div>

            {/* Footer: Create button OR Delete button */}
            <div className={`border-t border-outline-variant/40 pt-4 flex ${isCreate ? 'justify-end gap-3' : 'justify-start'}`}>
              {isCreate ? (
                <>
                  <button onClick={onClose} disabled={saving}
                    className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant text-sm font-medium hover:bg-surface-container transition-colors">
                    Hủy
                  </button>
                  <button onClick={handleCreate} disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-md3-1">
                    {saving ? 'Đang tạo...' : 'Tạo phòng ban'}
                  </button>
                </>
              ) : (
                <button onClick={handleDeleteDept} disabled={saving}
                  className="flex items-center gap-2 text-xs font-medium text-error hover:bg-error/10 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                  <Icon name="delete" size={16} />
                  Xóa phòng ban
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===================== MAIN RENDER =====================
  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Icon name="apartment" size={20} className="text-primary" />
          <span className="text-sm font-medium text-on-surface">{phongBan.length} phòng ban</span>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1">
          <Icon name="add" size={18} />
          Thêm phòng ban
        </button>
      </div>

      {/* Department cards grid */}
      {phongBan.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-10 text-center text-on-surface-variant">
          Chưa có phòng ban nào
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {phongBan.map(dept => {
            const count = (users || []).filter(u => u['Phòng ban'] === dept['Tên phòng ban']).length
            const truong = dept['Trưởng'] ? getUserName(dept['Trưởng']) : ''
            return (
              <button key={dept.ID} onClick={() => setSelectedDeptId(dept.ID)}
                className="bg-white rounded-2xl shadow-card p-5 text-left hover:shadow-md transition-shadow group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Icon name="apartment" size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface truncate">{dept['Tên phòng ban']}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {truong ? `Trưởng: ${truong}` : 'Chưa có trưởng phòng'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                    <Icon name="group" size={12} />
                    {count} thành viên
                  </span>
                  {parsePho(dept['Phó']).length > 0 && (
                    <span className="text-xs text-on-surface-variant">
                      · {parsePho(dept['Phó']).length} phó
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {creating && renderModal({
        isCreate: true,
        deptLabel: '',
        memberList: createMembers,
        truong: createData.truong,
        pho: createData.pho,
        available: createAvailable,
        leaderCandidates: activeUsers,
        onClose: closeModal,
      })}

      {/* View modal */}
      {selectedDept && renderModal({
        isCreate: false,
        deptLabel: viewDeptName,
        memberList: viewMembers,
        truong: viewTruongId,
        pho: viewPhoIds,
        available: viewAvailableUsers,
        leaderCandidates: viewMembers,
        onClose: closeModal,
      })}
    </div>
  )
}
