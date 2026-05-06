import { useState, useEffect } from 'react'
import { toInputDate } from '../../utils/format.js'

export default function ProjectModal({ mode, data, users, onSave, onClose }) {
  const [form, setForm] = useState({
    'Tên dự án': '', 'Mô tả': '', 'Trạng thái': 'Lên Kế Hoạch', 'Mức độ ưu tiên': 'Trung Bình',
    'Ngân sách': '', 'Chi phí thực tế': '', 'Ngày bắt đầu': '', 'Ngày kết thúc': '',
    'Leader ID': '', 'Thành viên': '', 'Tiến độ': 0, 'Ghi chú': '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && data) {
      setForm({
        ...data,
        'Ngày bắt đầu': toInputDate(data['Ngày bắt đầu']),
        'Ngày kết thúc': toInputDate(data['Ngày kết thúc']),
        'Ngân sách': data['Ngân sách'] || '',
        'Chi phí thực tế': data['Chi phí thực tế'] || '',
      })
    }
  }, [mode, data])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form['Tên dự án'].trim()) return
    setSaving(true)
    await onSave(form, mode)
    setSaving(false)
  }

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  const leaders = users.filter(u => ['admin','Quản trị viên','Giám đốc','Trưởng phòng'].includes(u['Quyền']))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-md3-3 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <h2 className="text-lg font-bold text-on-surface">{mode === 'add' ? 'Tạo Dự Án Mới' : 'Chỉnh Sửa Dự Án'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container"><span className="material-symbols-outlined">close</span></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Tên dự án *</label>
            <input value={form['Tên dự án']} onChange={e => set('Tên dự án', e.target.value)} required className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Mô tả</label>
            <textarea value={form['Mô tả']} onChange={e => set('Mô tả', e.target.value)} rows={2} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Trạng thái</label>
              <select value={form['Trạng thái']} onChange={e => set('Trạng thái', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none">
                {['Lên Kế Hoạch','Đang Thực Hiện','Hoàn Thành','Tạm Dừng','Đã Hủy'].map(s => <option key={s}>{s}</option>)}
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
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Ngân sách (₫)</label>
              <input type="number" value={form['Ngân sách']} onChange={e => set('Ngân sách', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Chi phí thực tế</label>
              <input type="number" value={form['Chi phí thực tế']} onChange={e => set('Chi phí thực tế', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Ngày bắt đầu</label>
              <input type="date" value={form['Ngày bắt đầu']} onChange={e => set('Ngày bắt đầu', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Ngày kết thúc</label>
              <input type="date" value={form['Ngày kết thúc']} onChange={e => set('Ngày kết thúc', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Leader</label>
            <select value={form['Leader ID']} onChange={e => set('Leader ID', e.target.value)} className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none">
              <option value="">-- Chọn --</option>
              {leaders.map(u => <option key={u.ID} value={u.ID}>{u['Tên nhân viên'] || u['Tên đăng nhập']}</option>)}
            </select>
          </div>
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
