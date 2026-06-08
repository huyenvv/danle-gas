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

export default function PhongBanManager() {
  const { phongBan, users, assignments, sync } = usePortalData()
  const { addToast } = useToast()
  const confirm = useConfirm()

  const [selectedDeptId, setSelectedDeptId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [createData, setCreateData] = useState({ name: '', moTa: '', truong: '', pho: [], nguoiPhuTrach: '', donViQuanLy: [], memberIds: [] })
  const [saving, setSaving] = useState(false)

  function getToken() { return localStorage.getItem('sso_access_token') }
  function getUserById(userId) { return (users || []).find(u => String(u.ID) === String(userId)) }
  function getUserName(userId) {
    const u = getUserById(userId)
    return u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : ''
  }
  const activeUsers = (users || []).filter(u => u['Trạng thái'] !== 'Locked')
  const avatar = (name) => (name || '?')[0].toUpperCase()

  // === Derive from assignments ===
  function getDeptAssignments(deptId) {
    return (assignments || []).filter(a => String(a['PhongBanID']) === String(deptId))
  }

  // === VIEW MODE data (derived from assignments) ===
  const selectedDept = selectedDeptId ? (phongBan || []).find(d => d.ID === selectedDeptId) : null
  const viewDeptName = selectedDept ? selectedDept['Tên phòng ban'] : ''
  const viewMoTa = selectedDept ? (selectedDept['Mô tả'] || '') : ''
  const viewDonViQuanLy = selectedDept ? (() => { try { const v = selectedDept['Đơn vị thuộc sự quản lý']; return v ? (typeof v === 'string' ? JSON.parse(v) : v) : [] } catch(_) { return [] } })() : []

  const deptAssigns = selectedDeptId ? getDeptAssignments(selectedDeptId) : []
  const viewMemberUserIds = deptAssigns.map(a => String(a['UserID']))
  const viewMembers = selectedDept ? (users || []).filter(u => viewMemberUserIds.includes(String(u.ID))) : []
  const viewTruongId = (() => { const a = deptAssigns.find(x => x['Chức vụ'] === 'Trưởng phòng'); return a ? String(a['UserID']) : '' })()
  const viewPhoIds = deptAssigns.filter(a => a['Chức vụ'] === 'Phó phòng').map(a => String(a['UserID']))
  const viewNguoiPhuTrach = (() => { const a = deptAssigns.find(x => x['Chức vụ'] === 'Người phụ trách'); return a ? String(a['UserID']) : '' })()
  const viewAvailableUsers = activeUsers.filter(u => !viewMemberUserIds.includes(String(u.ID)))

  // === CREATE MODE helpers ===
  const createMembers = creating ? activeUsers.filter(u => createData.memberIds.includes(String(u.ID))) : []
  const createAvailable = creating ? activeUsers.filter(u => !createData.memberIds.includes(String(u.ID))) : []

  function openCreate() {
    setCreating(true)
    setCreateData({ name: '', moTa: '', truong: '', pho: [], nguoiPhuTrach: '', donViQuanLy: [], memberIds: [] })
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
      const dept = await gasCall('api_addPhongBan', getToken(), {
        'Tên phòng ban': createData.name.trim(),
        'Mô tả': createData.moTa || '',
        'Đơn vị thuộc sự quản lý': JSON.stringify(createData.donViQuanLy || []),
      })

      const adds = []
      const leaderIds = new Set()
      if (createData.truong) { adds.push({ userId: createData.truong, chucVu: 'Trưởng phòng', phongBanId: dept.ID }); leaderIds.add(createData.truong) }
      createData.pho.forEach(id => { adds.push({ userId: id, chucVu: 'Phó phòng', phongBanId: dept.ID }); leaderIds.add(id) })
      if (createData.nguoiPhuTrach) { adds.push({ userId: createData.nguoiPhuTrach, chucVu: 'Người phụ trách', phongBanId: dept.ID }); leaderIds.add(createData.nguoiPhuTrach) }
      createData.memberIds.filter(id => !leaderIds.has(id)).forEach(id => adds.push({ userId: id, chucVu: 'Nhân viên', phongBanId: dept.ID }))

      if (adds.length > 0) await gasCall('api_batchSaveAssignments', getToken(), { adds, removes: [] })

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
      nguoiPhuTrach: d.nguoiPhuTrach === uid ? '' : d.nguoiPhuTrach,
    }))
  }

  function createSetTruong(newId) {
    setCreateData(d => ({
      ...d,
      truong: newId,
      pho: newId ? d.pho.filter(id => id !== newId) : d.pho,
      nguoiPhuTrach: d.nguoiPhuTrach === newId ? '' : d.nguoiPhuTrach,
      memberIds: newId && !d.memberIds.includes(newId) ? [...d.memberIds, newId] : d.memberIds,
    }))
  }

  function createAddPho(userId) {
    const uid = String(userId)
    setCreateData(d => ({
      ...d,
      pho: [...d.pho, uid],
      truong: d.truong === uid ? '' : d.truong,
      nguoiPhuTrach: d.nguoiPhuTrach === uid ? '' : d.nguoiPhuTrach,
      memberIds: !d.memberIds.includes(uid) ? [...d.memberIds, uid] : d.memberIds,
    }))
  }

  function createRemovePho(userId) {
    setCreateData(d => ({ ...d, pho: d.pho.filter(id => id !== String(userId)) }))
  }

  // === VIEW handlers (use batchSaveAssignments) ===
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
      await gasCall('api_batchSaveAssignments', getToken(), {
        adds: [{ userId, chucVu: 'Nhân viên', phongBanId: selectedDeptId }],
        removes: [],
      })
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
      const assign = deptAssigns.find(a => String(a['UserID']) === String(userId))
      if (assign) {
        await gasCall('api_batchSaveAssignments', getToken(), { adds: [], removes: [assign.ID] })
      }
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
      const removes = []
      const adds = []

      const currentTruong = deptAssigns.find(a => a['Chức vụ'] === 'Trưởng phòng')
      if (currentTruong) {
        removes.push(currentTruong.ID)
        if (String(currentTruong['UserID']) !== String(newId)) {
          adds.push({ userId: String(currentTruong['UserID']), chucVu: 'Nhân viên', phongBanId: selectedDeptId })
        }
      }

      if (newId) {
        const existing = deptAssigns.find(a => String(a['UserID']) === String(newId))
        if (existing) removes.push(existing.ID)
        adds.push({ userId: newId, chucVu: 'Trưởng phòng', phongBanId: selectedDeptId })
      }

      if (adds.length > 0 || removes.length > 0) {
        await gasCall('api_batchSaveAssignments', getToken(), { adds, removes })
      }
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
      const removes = []
      const adds = [{ userId, chucVu: 'Phó phòng', phongBanId: selectedDeptId }]

      const existing = deptAssigns.find(a => String(a['UserID']) === String(userId))
      if (existing) removes.push(existing.ID)

      await gasCall('api_batchSaveAssignments', getToken(), { adds, removes })
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
      const phoAssign = deptAssigns.find(a => a['Chức vụ'] === 'Phó phòng' && String(a['UserID']) === String(userId))
      if (phoAssign) {
        await gasCall('api_batchSaveAssignments', getToken(), {
          adds: [{ userId, chucVu: 'Nhân viên', phongBanId: selectedDeptId }],
          removes: [phoAssign.ID],
        })
      }
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangeNguoiPhuTrach(newId) {
    setSaving(true)
    try {
      const removes = []
      const adds = []

      const current = deptAssigns.find(a => a['Chức vụ'] === 'Người phụ trách')
      if (current) {
        removes.push(current.ID)
        if (String(current['UserID']) !== String(newId)) {
          adds.push({ userId: String(current['UserID']), chucVu: 'Nhân viên', phongBanId: selectedDeptId })
        }
      }

      if (newId) {
        const existing = deptAssigns.find(a => String(a['UserID']) === String(newId))
        if (existing) removes.push(existing.ID)
        adds.push({ userId: newId, chucVu: 'Người phụ trách', phongBanId: selectedDeptId })
      }

      if (adds.length > 0 || removes.length > 0) {
        await gasCall('api_batchSaveAssignments', getToken(), { adds, removes })
      }
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangeMoTa(newVal) {
    setSaving(true)
    try {
      await gasCall('api_updatePhongBan', getToken(), selectedDept.ID, { 'Mô tả': newVal })
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangeDonViQuanLy(newIds) {
    setSaving(true)
    try {
      await gasCall('api_updatePhongBan', getToken(), selectedDept.ID, { 'Đơn vị thuộc sự quản lý': JSON.stringify(newIds) })
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function getMemberRole(userId) {
    const a = deptAssigns.find(x => String(x['UserID']) === String(userId))
    return a ? a['Chức vụ'] : 'Nhân viên'
  }

  // ===================== SHARED MODAL RENDERER =====================
  function renderModal({ isCreate, deptLabel, moTa, memberList, truong, pho, nguoiPhuTrach, donViQuanLy, available, onClose, leaderCandidates }) {
    const currentDeptId = isCreate ? null : selectedDeptId
    const otherDepts = (phongBan || []).filter(d => String(d.ID) !== String(currentDeptId))
    const getDeptName = (id) => { const d = (phongBan || []).find(x => String(x.ID) === String(id)); return d ? d['Tên phòng ban'] : String(id) }
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
            {/* Mô tả */}
            <div>
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">Mô tả</p>
              {isCreate ? (
                <textarea value={createData.moTa}
                  onChange={e => setCreateData(d => ({ ...d, moTa: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition resize-none placeholder:text-on-surface-variant/40"
                  placeholder="Mô tả phòng ban..." />
              ) : (
                <textarea key={selectedDeptId}
                  defaultValue={moTa}
                  onBlur={e => { if (e.target.value !== viewMoTa) handleChangeMoTa(e.target.value) }}
                  rows={2}
                  disabled={saving}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition resize-none disabled:opacity-50"
                  placeholder="Mô tả phòng ban..." />
              )}
            </div>

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

            {/* Người phụ trách */}
            <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/40 p-4">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">Người phụ trách</p>
              {nguoiPhuTrach && getUserById(nguoiPhuTrach) ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-green-700">{avatar(getUserName(nguoiPhuTrach))}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-on-surface text-sm truncate">{getUserName(nguoiPhuTrach)}</p>
                    <p className="text-xs text-on-surface-variant truncate">{getUserById(nguoiPhuTrach)?.['Email']}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant italic">Chưa chỉ định</p>
              )}
              <div className="mt-3">
                <select value={nguoiPhuTrach}
                  onChange={e => isCreate
                    ? setCreateData(d => ({ ...d, nguoiPhuTrach: e.target.value }))
                    : handleChangeNguoiPhuTrach(e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border-none text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-50">
                  <option value="">-- Chọn người phụ trách --</option>
                  {leaderCandidates.map(u => (
                    <option key={u.ID} value={String(u.ID)}>{u['Tên nhân viên'] || u['Tên đăng nhập']}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Đơn vị thuộc sự quản lý */}
            <div>
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">Đơn vị thuộc sự quản lý</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {donViQuanLy.map(id => (
                  <span key={id} className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full">
                    {getDeptName(id)}
                    <button type="button" onClick={() => {
                      const next = donViQuanLy.filter(x => String(x) !== String(id))
                      isCreate
                        ? setCreateData(d => ({ ...d, donViQuanLy: next }))
                        : handleChangeDonViQuanLy(next)
                    }} disabled={saving} className="hover:text-error"><Icon name="close" size={10} /></button>
                  </span>
                ))}
              </div>
              <select value=""
                onChange={e => {
                  if (!e.target.value) return
                  const newId = e.target.value
                  if (donViQuanLy.some(x => String(x) === newId)) return
                  const next = [...donViQuanLy, newId]
                  isCreate
                    ? setCreateData(d => ({ ...d, donViQuanLy: next }))
                    : handleChangeDonViQuanLy(next)
                }}
                disabled={saving}
                className="w-full px-3 py-2 rounded-xl bg-surface-container-low border-none text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-50">
                <option value="">+ Thêm đơn vị...</option>
                {otherDepts.filter(d => !donViQuanLy.some(x => String(x) === String(d.ID))).map(d => (
                  <option key={d.ID} value={String(d.ID)}>{d['Tên phòng ban']}</option>
                ))}
              </select>
            </div>

            {/* Members (exclude leadership — already shown above) */}
            <div>
              {(() => {
                const regularMembers = memberList.filter(u => {
                  const uid = String(u.ID)
                  return uid !== truong && !pho.includes(uid) && uid !== nguoiPhuTrach
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
                                {isCreate ? 'Nhân viên' : getMemberRole(uid)}
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
            const da = getDeptAssignments(dept.ID)
            const count = da.length
            const truongAssign = da.find(a => a['Chức vụ'] === 'Trưởng phòng')
            const truongName = truongAssign ? getUserName(truongAssign['UserID']) : ''
            const phoCount = da.filter(a => a['Chức vụ'] === 'Phó phòng').length
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
                      {truongName ? `Trưởng: ${truongName}` : 'Chưa có trưởng phòng'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                    <Icon name="group" size={12} />
                    {count} thành viên
                  </span>
                  {phoCount > 0 && (
                    <span className="text-xs text-on-surface-variant">
                      · {phoCount} phó
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
        moTa: createData.moTa,
        memberList: createMembers,
        truong: createData.truong,
        pho: createData.pho,
        nguoiPhuTrach: createData.nguoiPhuTrach,
        donViQuanLy: createData.donViQuanLy,
        available: createAvailable,
        leaderCandidates: activeUsers,
        onClose: closeModal,
      })}

      {/* View modal */}
      {selectedDept && renderModal({
        isCreate: false,
        deptLabel: viewDeptName,
        moTa: viewMoTa,
        memberList: viewMembers,
        truong: viewTruongId,
        pho: viewPhoIds,
        nguoiPhuTrach: viewNguoiPhuTrach,
        donViQuanLy: viewDonViQuanLy,
        available: viewAvailableUsers,
        leaderCandidates: viewMembers,
        onClose: closeModal,
      })}
    </div>
  )
}
