import { useEffect, useState } from 'react'

const DEFAULT_FORM = { 'Tên nhãn': '', 'Màu sắc': '#01458e' }

export default function LabelModal({ mode, data, onSave, onClose }) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && data) {
      setForm({
        'Tên nhãn': data['Tên nhãn'] || '',
        'Màu sắc': data['Màu sắc'] || '#01458e',
      })
      return
    }

    setForm(DEFAULT_FORM)
  }, [mode, data])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form['Tên nhãn'].trim()) return
    setSaving(true)
    await onSave(form, mode)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-md3-3 w-full max-w-md" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <h2 className="text-lg font-bold text-on-surface">{mode === 'add' ? 'Tạo Nhãn' : 'Chỉnh Sửa Nhãn'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Tên nhãn *</label>
            <input
              value={form['Tên nhãn']}
              onChange={(event) => setForm((prev) => ({ ...prev, 'Tên nhãn': event.target.value }))}
              required
              className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-2 block">Màu sắc</label>
            <div className="flex items-center gap-3 bg-surface-container rounded-xl px-3 py-2.5">
              <input
                type="color"
                value={form['Màu sắc']}
                onChange={(event) => setForm((prev) => ({ ...prev, 'Màu sắc': event.target.value }))}
                className="w-10 h-10 rounded-xl border-none cursor-pointer bg-transparent"
              />
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-lg shrink-0" style={{ background: form['Màu sắc'] }} />
                <span className="text-sm text-on-surface truncate">{form['Màu sắc']}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-full">
              Hủy
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-accent text-white rounded-full hover:bg-accent-hover disabled:opacity-50 shadow-md3-1">
              {saving ? 'Đang lưu…' : mode === 'add' ? 'Tạo' : 'Cập nhật'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}