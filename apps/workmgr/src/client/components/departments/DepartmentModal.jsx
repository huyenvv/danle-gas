import { useState, useEffect } from 'react'

export default function DepartmentModal({ mode, data, users, departments, onSave, onClose }) {
  const [form, setForm] = useState({
    'Tên phòng ban': '', 'Mô tả': '', 'Trưởng phòng ID': '', 'Phó phòng ID': '',
    'PGĐ phụ trách ID': '', 'Thành viên': '', 'Đơn vị quản lý': '', 'Ghi chú': '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && data) setForm({ ...data })
  }, [mode, data])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form['Tên phòng ban'].trim()) return
    setSaving(true)
    await onSave(form, mode)
    setSaving(false)
  }

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const leaders = users.filter(u => ['admin', 'Quản trị viên', 'Giám đốc', 'Trưởng phòng'].includes(u['Quyền']))
  const deputies = users.filter(u => ['admin', 'Quản trị viên', 'Giám đốc', 'Trưởng phòng', 'Nhân viên'].includes(u['Quyền']))
  const pgds = users.filter(u => ['admin', 'Quản trị viên', 'Giám đốc'].includes(u['Quyền']))

  const memberIds = (form['Thành viên'] || '').split(',').map(s => s.trim()).filter(Boolean)
  const toggleMember = (userId) => {
    const id = String(userId)
    const next = memberIds.includes(id) ? memberIds.filter(m => m !== id) : [...memberIds, id]
    set('Thành viên', next.join(','))
  }

  const managedDeptIds = (form['Đơn vị quản lý'] || '').split(',').map(s => s.trim()).filter(Boolean)
  const toggleManagedDept = (deptId) => {
    const id = String(deptId)
    const next = managedDeptIds.includes(id) ? managedDeptIds.filter(m => m !== id) : [...managedDeptIds, id]
    set('Đơn vị quản lý', next.join(','))
  }
  const otherDepts = (departments || []).filter(d => String(d.ID) !== String(form.ID || ''))

  const getName = (u) => u['Tên nhân viên'] || u['Tên đăng nhập']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-md3-3 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <h2 className="text-lg font-bold text-on-surface">{mode === 'add' ? 'Tạo Phòng/ Ban/ NM' : 'Cập Nhật Phòng/ Ban/ NM'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container"><span className="material-symbols-outlined">close</span></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Tên phòng ban *</label>
            <input value={form['Tên phòng ban']} onChange={e => set('Tên phòng ban', e.target.value)} required className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Mô tả</label>
            <textarea value={form['Mô tả']} onChange={e => set('Mô tả', e.target.value)} rows={2} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Trưởng phòng</label>
              <select value={form['Trưởng phòng ID']} onChange={e => set('Trưởng phòng ID', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none">
                <option value="">-- Chọn --</option>
                {leaders.map(u => <option key={u.ID} value={u.ID}>{getName(u)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Phó phòng</label>
              <select value={form['Phó phòng ID']} onChange={e => set('Phó phòng ID', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none">
                <option value="">-- Chọn --</option>
                {deputies.map(u => <option key={u.ID} value={u.ID}>{getName(u)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">P. Giám đốc phụ trách</label>
            <select value={form['PGĐ phụ trách ID']} onChange={e => set('PGĐ phụ trách ID', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none">
              <option value="">-- Không chọn --</option>
              {pgds.map(u => <option key={u.ID} value={u.ID}>{getName(u)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Thành viên</label>
            <div className="flex flex-wrap gap-2 p-2 bg-surface-container rounded-xl max-h-32 overflow-y-auto">
              {users.map(u => {
                const selected = memberIds.includes(String(u.ID))
                return (
                  <button type="button" key={u.ID} onClick={() => toggleMember(u.ID)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-high'}`}>
                    {getName(u)}
                  </button>
                )
              })}
            </div>
          </div>
          {otherDepts.length > 0 && (
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">
                Đơn vị thuộc sự quản lý
                <span className="text-on-surface-variant/70 font-normal ml-1">(phòng được phép xem công việc của phòng này)</span>
              </label>
              <div className="flex flex-wrap gap-2 p-2 bg-surface-container rounded-xl max-h-32 overflow-y-auto">
                {otherDepts.map(d => {
                  const selected = managedDeptIds.includes(String(d.ID))
                  return (
                    <button type="button" key={d.ID} onClick={() => toggleManagedDept(d.ID)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-high'}`}>
                      {d['Tên phòng ban']}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Ghi chú</label>
            <textarea value={form['Ghi chú']} onChange={e => set('Ghi chú', e.target.value)} rows={2} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-full">Hủy</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-accent text-white rounded-full hover:bg-accent-hover disabled:opacity-50 shadow-md3-1">
              {saving ? 'Đang lưu…' : mode === 'add' ? 'Tạo' : 'Cập nhật'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
