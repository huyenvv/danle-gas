import { useState, useEffect } from 'react'

function toInputDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ScheduleModal({ mode, type: initialType, data, users, onSave, onClose }) {
  const [form, setForm] = useState({
    'Loại': initialType || 'Công tác',
    'Nội dung': '',
    'Thời gian bắt đầu': '',
    'Thời gian kết thúc': '',
    'Địa điểm': '',
    'Người chủ trì ID': '',
    'Thành phần': '',
    'Ghi chú': '',
    'Link họp': '',
  })
  const [allParticipants, setAllParticipants] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && data) {
      setForm({
        ...data,
        'Thời gian bắt đầu': toInputDateTime(data['Thời gian bắt đầu']),
        'Thời gian kết thúc': toInputDateTime(data['Thời gian kết thúc']),
      })
      setAllParticipants(String(data['Thành phần']).trim() === 'All')
    }
  }, [mode, data])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const isHop = form['Loại'] === 'Họp'

  const participantIds = allParticipants ? [] : (form['Thành phần'] || '').split(',').map(s => s.trim()).filter(s => s && s !== 'All')
  const toggleParticipant = (uid) => {
    const id = String(uid)
    const next = participantIds.includes(id) ? participantIds.filter(p => p !== id) : [...participantIds, id]
    set('Thành phần', next.join(','))
  }
  const toggleAll = (v) => {
    setAllParticipants(v)
    set('Thành phần', v ? 'All' : '')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form['Nội dung'].trim() || !form['Thời gian bắt đầu']) return
    setSaving(true)
    await onSave(form, mode)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-md3-3 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <h2 className="text-lg font-bold text-on-surface">
            {mode === 'add' ? `Đăng ký lịch ${form['Loại'].toLowerCase()}` : 'Cập nhật lịch'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container"><span className="material-symbols-outlined">close</span></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {mode === 'add' && (
            <div className="inline-flex bg-surface-container-low rounded-xl p-1">
              {['Công tác', 'Họp'].map(t => (
                <button key={t} type="button" onClick={() => set('Loại', t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${form['Loại'] === t ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Nội dung *</label>
            <textarea value={form['Nội dung']} onChange={e => set('Nội dung', e.target.value)} required rows={2}
              className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Thời gian từ *</label>
              <input type="datetime-local" value={form['Thời gian bắt đầu']} onChange={e => set('Thời gian bắt đầu', e.target.value)} required
                className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Đến</label>
              <input type="datetime-local" value={form['Thời gian kết thúc']} onChange={e => set('Thời gian kết thúc', e.target.value)}
                className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Địa điểm</label>
            <input value={form['Địa điểm']} onChange={e => set('Địa điểm', e.target.value)}
              className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Người chủ trì</label>
            <select value={form['Người chủ trì ID']} onChange={e => set('Người chủ trì ID', e.target.value)}
              className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none">
              <option value="">-- Chọn --</option>
              {users.map(u => <option key={u.ID} value={u.ID}>{u['Tên nhân viên'] || u['Tên đăng nhập']}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block flex items-center gap-2">
              Thành phần tham gia
              <span className="inline-flex items-center gap-1 ml-2">
                <input type="checkbox" checked={allParticipants} onChange={e => toggleAll(e.target.checked)} className="w-4 h-4 accent-primary" />
                <span className="font-normal">All</span>
              </span>
            </label>
            {!allParticipants && (
              <div className="flex flex-wrap gap-2 p-2 bg-surface-container rounded-xl max-h-32 overflow-y-auto">
                {users.map(u => {
                  const selected = participantIds.includes(String(u.ID))
                  return (
                    <button type="button" key={u.ID} onClick={() => toggleParticipant(u.ID)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-high'}`}>
                      {u['Tên nhân viên'] || u['Tên đăng nhập']}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {isHop && (
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Link họp online</label>
              <input value={form['Link họp']} onChange={e => set('Link họp', e.target.value)} placeholder="https://meet.google.com/…"
                className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-1 block">Ghi chú</label>
            <textarea value={form['Ghi chú']} onChange={e => set('Ghi chú', e.target.value)} rows={2}
              className="w-full px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          {isHop && (
            <p className="text-[11px] text-on-surface-variant/70 italic">
              📎 Đính kèm file: tính năng đang phát triển — sẽ lưu vào Drive/Tài liệu họp.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-full">Hủy</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-accent text-white rounded-full hover:bg-accent-hover disabled:opacity-50 shadow-md3-1">
              {saving ? 'Đang lưu…' : mode === 'add' ? 'Đăng ký' : 'Cập nhật'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
