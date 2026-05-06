import { useState, useEffect } from 'react'
import { toInputDate } from '../../utils/format.js'

export default function TaskModal({ mode, data, projects, users, labels, onSave, onClose }) {
  const [form, setForm] = useState({
    'Tiêu đề': '', 'Mô tả': '', 'Dự án ID': '', 'Người thực hiện ID': '', 'Người giao ID': '',
    'Trạng thái': 'Cần Làm', 'Mức độ ưu tiên': 'Trung Bình', 'Ngày bắt đầu': '', 'Ngày hết hạn': '',
    'Chi phí ước tính': '', 'Chi phí thực tế': '', 'Nhãn': '', 'Tiến độ': 0, 'Ghi chú': '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && data) {
      setForm({ ...data, 'Ngày bắt đầu': toInputDate(data['Ngày bắt đầu']), 'Ngày hết hạn': toInputDate(data['Ngày hết hạn']) })
    }
  }, [mode, data])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form['Tiêu đề'].trim() || !form['Dự án ID']) return
    setSaving(true); await onSave(form, mode); setSaving(false)
  }
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const toggleLabel = (name) => {
    const current = form['Nhãn'] ? form['Nhãn'].split(',').map(s => s.trim()).filter(Boolean) : []
    const next = current.includes(name) ? current.filter(l => l !== name) : [...current, name]
    set('Nhãn', next.join(','))
  }
  const selectedLabels = form['Nhãn'] ? form['Nhãn'].split(',').map(s => s.trim()).filter(Boolean) : []

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
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Dự án *</label>
              <select value={form['Dự án ID']} onChange={e => set('Dự án ID', e.target.value)} required className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none">
                <option value="">-- Chọn --</option>
                {projects.map(p => <option key={p.ID} value={p.ID}>{p['Tên dự án']}</option>)}
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
                {['Cần Làm','Đang Thực Hiện','Đang Xem Xét','Hoàn Thành'].map(s => <option key={s}>{s}</option>)}
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
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-full">Hủy</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-primary text-on-primary rounded-full hover:bg-primary-700 disabled:opacity-50 shadow-md3-1">
              {saving ? 'Đang lưu…' : mode === 'add' ? 'Tạo' : 'Cập nhật'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
