import { useState, useEffect, useMemo } from 'react'
import { toInputDate } from '../../utils/format.js'

function parseSubtasks(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export default function TaskModal({ mode, data, departments, users, labels, onSave, onClose }) {
  const [form, setForm] = useState({
    'Tiêu đề': '', 'Mô tả': '', 'Phòng ban ID': '', 'Người thực hiện ID': '', 'Người giao ID': '',
    'Trạng thái': 'Cần Làm', 'Mức độ ưu tiên': 'Trung Bình', 'Ngày bắt đầu': '', 'Ngày hết hạn': '',
    'Nhãn': '', 'Tiến độ': 0, 'Người phối hợp': '', 'Subtasks': '', 'Ghi chú': '',
  })
  const [subtasks, setSubtasks] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && data) {
      setForm({ ...data, 'Ngày bắt đầu': toInputDate(data['Ngày bắt đầu']), 'Ngày hết hạn': toInputDate(data['Ngày hết hạn']) })
      setSubtasks(parseSubtasks(data['Subtasks']))
    }
  }, [mode, data])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form['Tiêu đề'].trim() || !form['Phòng ban ID']) return
    setSaving(true)
    await onSave({ ...form, 'Subtasks': JSON.stringify(subtasks) }, mode)
    setSaving(false)
  }
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const toggleLabel = (name) => {
    const current = form['Nhãn'] ? form['Nhãn'].split(',').map(s => s.trim()).filter(Boolean) : []
    const next = current.includes(name) ? current.filter(l => l !== name) : [...current, name]
    set('Nhãn', next.join(','))
  }
  const selectedLabels = form['Nhãn'] ? form['Nhãn'].split(',').map(s => s.trim()).filter(Boolean) : []

  // Người phối hợp: chỉ chọn người trong cùng phòng (image 4.2 — "Chọn được người phối hợp trong cùng 1 phòng")
  const selectedDept = useMemo(() => {
    return departments.find(d => String(d.ID) === String(form['Phòng ban ID']))
  }, [departments, form['Phòng ban ID']])

  const sameDeptUserIds = useMemo(() => {
    if (!selectedDept) return new Set()
    const ids = new Set()
    const add = (v) => v && ids.add(String(v))
    add(selectedDept['Trưởng phòng ID'])
    add(selectedDept['Phó phòng ID'])
    add(selectedDept['PGĐ phụ trách ID'])
    String(selectedDept['Thành viên'] || '').split(',').forEach(s => add(s.trim()))
    return ids
  }, [selectedDept])

  const collaboratorIds = (form['Người phối hợp'] || '').split(',').map(s => s.trim()).filter(Boolean)
  const toggleCollaborator = (userId) => {
    const id = String(userId)
    const next = collaboratorIds.includes(id) ? collaboratorIds.filter(c => c !== id) : [...collaboratorIds, id]
    set('Người phối hợp', next.join(','))
  }
  const sameDeptUsers = users.filter(u => sameDeptUserIds.has(String(u.ID)) && String(u.ID) !== String(form['Người thực hiện ID']))

  const addSubtask = () => setSubtasks(prev => [...prev, { id: Date.now(), title: '', done: false }])
  const updateSubtask = (idx, patch) => setSubtasks(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  const removeSubtask = (idx) => setSubtasks(prev => prev.filter((_, i) => i !== idx))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-md3-3 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <h2 className="text-lg font-bold text-on-surface">{mode === 'add' ? 'Tạo Công Việc' : 'Chỉnh Sửa'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container"><span className="material-symbols-outlined">close</span></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Tiêu đề *</label>
            <input value={form['Tiêu đề']} onChange={e => set('Tiêu đề', e.target.value)} required className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Mô tả</label>
            <textarea value={form['Mô tả']} onChange={e => set('Mô tả', e.target.value)} rows={2} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none resize-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Phòng/ Ban/ NM *</label>
              <select value={form['Phòng ban ID']} onChange={e => set('Phòng ban ID', e.target.value)} required className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none">
                <option value="">-- Chọn --</option>
                {departments.map(d => <option key={d.ID} value={d.ID}>{d['Tên phòng ban']}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Người thực hiện</label>
              <select value={form['Người thực hiện ID']} onChange={e => set('Người thực hiện ID', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none">
                <option value="">-- Chọn --</option>
                {users.map(u => <option key={u.ID} value={u.ID}>{u['Tên nhân viên']||u['Tên đăng nhập']}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Trạng thái</label>
              <select value={form['Trạng thái']} onChange={e => set('Trạng thái', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none">
                {['Cần Làm','Đang Thực Hiện','Chờ Duyệt','Hoàn Thành'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Ưu tiên</label>
              <select value={form['Mức độ ưu tiên']} onChange={e => set('Mức độ ưu tiên', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none">
                {['Cao','Trung Bình','Thấp'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-on-surface-variant mb-1 block">Ngày bắt đầu</label><input type="date" value={form['Ngày bắt đầu']} onChange={e => set('Ngày bắt đầu', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" /></div>
            <div><label className="text-xs font-medium text-on-surface-variant mb-1 block">Ngày hết hạn</label><input type="date" value={form['Ngày hết hạn']} onChange={e => set('Ngày hết hạn', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" /></div>
          </div>

          {sameDeptUsers.length > 0 && (
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Người phối hợp <span className="font-normal opacity-70">(cùng phòng)</span></label>
              <div className="flex flex-wrap gap-2 p-2 bg-surface-container rounded-xl max-h-28 overflow-y-auto">
                {sameDeptUsers.map(u => {
                  const selected = collaboratorIds.includes(String(u.ID))
                  return (
                    <button type="button" key={u.ID} onClick={() => toggleCollaborator(u.ID)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-high'}`}>
                      {u['Tên nhân viên']||u['Tên đăng nhập']}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {labels.length > 0 && (
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-2 block">Nhãn</label>
              <div className="flex flex-wrap gap-1.5">
                {labels.map(l => (
                  <button key={l.ID} type="button" onClick={() => toggleLabel(l['Tên nhãn'])}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedLabels.includes(l['Tên nhãn']) ? 'text-white border-transparent' : 'bg-white border-outline-variant text-on-surface-variant hover:border-outline'}`}
                    style={selectedLabels.includes(l['Tên nhãn']) ? { background: l['Màu sắc'] } : {}}>
                    {l['Tên nhãn']}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Tiến độ: {form['Tiến độ']}%</label>
            <input type="range" min={0} max={100} value={form['Tiến độ']} onChange={e => set('Tiến độ', Number(e.target.value))} className="w-full accent-primary" />
          </div>

          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Công việc con</label>
            <div className="space-y-1.5">
              {subtasks.map((s, i) => (
                <div key={s.id || i} className="flex items-center gap-2 bg-surface-container rounded-xl px-2 py-1.5">
                  <input type="checkbox" checked={!!s.done} onChange={e => updateSubtask(i, { done: e.target.checked })} className="w-4 h-4 accent-primary" />
                  <input
                    value={s.title}
                    onChange={e => updateSubtask(i, { title: e.target.value })}
                    placeholder="Nhập công việc con…"
                    className={`flex-1 bg-transparent text-sm outline-none ${s.done ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}
                  />
                  <button type="button" onClick={() => removeSubtask(i)} className="text-on-surface-variant hover:text-error">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              ))}
              <button type="button" onClick={addSubtask} className="w-full px-3 py-2 border border-dashed border-outline-variant rounded-xl text-xs text-on-surface-variant hover:bg-surface-container-low transition-colors">
                + Thêm công việc con
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Ghi chú</label>
            <textarea value={form['Ghi chú']} onChange={e => set('Ghi chú', e.target.value)} rows={2} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none resize-none focus:ring-2 focus:ring-primary/30" />
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
