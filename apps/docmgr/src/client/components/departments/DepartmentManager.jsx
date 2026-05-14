import { useState, useEffect } from 'react'
import gasCall from '../../gasClient.js'
import { viMatch } from '../../utils/viSearch.js'
import Icon from '../common/Icon.jsx'
import { dataCache } from '../../utils/dataCache.js'
import FormModal from '../common/FormModal.jsx'
import { inputCls, textareaCls, labelCls, fieldCls } from '../common/formStyles.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useConfirm } from '../../context/ConfirmContext.jsx'

export default function DepartmentManager({ token, lookups, onUpdate }) {
  const [items, setItems] = useState(lookups.phongBan || [])
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({ 'Tên phòng ban': '', 'Mô tả': '', 'Danh mục cho phép': '' })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const { showToast } = useToast()
  const confirm = useConfirm()

  useEffect(() => { setItems(lookups.phongBan || []) }, [lookups.phongBan])

  function openAdd() {
    setForm({ 'Tên phòng ban': '', 'Mô tả': '', 'Danh mục cho phép': '' })
    setError('')
    setModal({ mode: 'create' })
  }

  function openEdit(item) {
    setForm({ ...item, 'Danh mục cho phép': item['Danh mục cho phép'] || '' })
    setError('')
    setModal({ mode: 'edit', item })
  }

  function closeModal() { setModal(null); setError('') }

  async function handleSave() {
    if (!form['Tên phòng ban']) { setError('Tên phòng ban là bắt buộc'); return }
    setSaving(true); setError('')
    try {
      if (modal.mode === 'edit') await gasCall('api_updatePhongBan', token, modal.item.ID, form)
      else await gasCall('api_addPhongBan', token, form)
      closeModal()
      showToast('Đã lưu phòng ban', 'success')
      dataCache.invalidate('lookups')
      onUpdate()
    } catch (err) {
      setError(err.message)
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    if (!await confirm(`Xóa phòng ban "${item['Tên phòng ban']}"?`)) return
    try {
      await gasCall('api_deletePhongBan', token, item.ID)
      showToast('Đã xóa phòng ban', 'success')
      dataCache.invalidate('lookups')
      onUpdate()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const filtered = search ? items.filter(i => viMatch(i['Tên phòng ban'], search)) : items

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input
            className="w-full bg-surface-container-low border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Tìm phòng ban..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-on-surface-variant">{filtered.length} phòng ban</span>
        <div className="ml-auto">
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1">
            <Icon name="add" size={18} />
            Thêm phòng ban
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Tên phòng ban</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Mô tả</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Danh mục cho phép</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-on-surface-variant">Chưa có phòng ban</td></tr>
            )}
            {filtered.map(item => {
              let allowedCats = []
              try {
                const v = item['Danh mục cho phép']
                if (v && v.charAt(0) === '[') allowedCats = JSON.parse(v)
              } catch(_) {}
              const catNames = allowedCats.map(id => {
                const c = (lookups.danhMuc || []).find(c => String(c.ID) === String(id))
                return c ? c['Tên danh mục'] : id
              })
              return (
                <tr key={item.ID} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-medium text-on-surface">{item['Tên phòng ban']}</td>
                  <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell">{item['Mô tả'] || '—'}</td>
                  <td className="px-4 py-3">
                    {catNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {catNames.map(n => <span key={n} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{n}</span>)}
                      </div>
                    ) : <span className="text-on-surface-variant text-xs">Tất cả</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(item)} className="text-xs px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors font-medium">Sửa</button>
                      <button onClick={() => handleDelete(item)} className="text-xs px-2.5 py-1 rounded-lg text-error hover:bg-error-container transition-colors font-medium">Xóa</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <FormModal open={!!modal} title={modal?.mode === 'create' ? 'Thêm phòng ban' : 'Sửa phòng ban'}
        icon={modal?.mode === 'create' ? 'add' : 'edit'} onClose={closeModal} onSave={handleSave}
        saving={saving} error={error} maxWidth="max-w-md">
        <div className="space-y-4">
          <div className={fieldCls}>
            <label className={labelCls}>Tên phòng ban *</label>
            <input className={inputCls} value={form['Tên phòng ban']}
              onChange={e => setForm(f => ({ ...f, 'Tên phòng ban': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Mô tả</label>
            <textarea className={textareaCls + ' h-20'} value={form['Mô tả']}
              onChange={e => setForm(f => ({ ...f, 'Mô tả': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Danh mục cho phép <span className="font-normal text-on-surface-variant">(để trống = tất cả)</span></label>
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-surface-container-low rounded-xl min-h-[42px]">
              {(lookups.danhMuc || []).filter(c => !c['Danh mục cha']).map(cat => {
                let allowed = []
                try { const v = form['Danh mục cho phép']; if (v && v.charAt(0) === '[') allowed = JSON.parse(v) } catch(_) {}
                const active = allowed.map(String).includes(String(cat.ID))
                return (
                  <button key={cat.ID} type="button"
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${active ? 'bg-accent text-white' : 'bg-surface-container text-on-surface-variant hover:bg-primary/10'}`}
                    onClick={() => {
                      let cur = []
                      try { const v = form['Danh mục cho phép']; if (v && v.charAt(0) === '[') cur = JSON.parse(v) } catch(_) {}
                      cur = cur.map(String)
                      const sid = String(cat.ID)
                      const next = cur.includes(sid) ? cur.filter(x => x !== sid) : [...cur, sid]
                      setForm(f => ({ ...f, 'Danh mục cho phép': next.length ? JSON.stringify(next) : '' }))
                    }}>
                    {cat['Tên danh mục']}
                  </button>
                )
              })}
              {(lookups.danhMuc || []).filter(c => !c['Danh mục cha']).length === 0 && (
                <span className="text-xs text-on-surface-variant">Chưa có danh mục</span>
              )}
            </div>
          </div>
        </div>
      </FormModal>
    </div>
  )
}
