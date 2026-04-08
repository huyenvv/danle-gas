import { useState, useEffect } from 'react'
import gasCall from '../../gasClient.js'
import { viMatch } from '../../utils/viSearch.js'
import { dataCache } from '../../utils/dataCache.js'
import FormModal from '../common/FormModal.jsx'
import { inputCls, labelCls, fieldCls } from '../common/formStyles.js'
import { useToast } from '../../context/ToastContext.jsx'

function emptyForm() {
  return { 'Tên dự án viết tắt': '', 'Tên dự án đầy đủ': '', 'Địa chỉ': '' }
}

export default function ProjectManager({ token, lookups, onUpdate }) {
  const [items, setItems] = useState(lookups.duAn || [])
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState(emptyForm())
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const { showToast } = useToast()

  useEffect(() => { setItems(lookups.duAn || []) }, [lookups.duAn])

  function openAdd() { setForm(emptyForm()); setError(''); setModal({ mode: 'create' }) }
  function openEdit(item) { setForm({ ...item }); setError(''); setModal({ mode: 'edit', item }) }
  function closeModal() { setModal(null); setError('') }

  async function handleSave() {
    if (!form['Tên dự án viết tắt']) { setError('Tên viết tắt là bắt buộc'); return }
    setSaving(true); setError('')
    try {
      if (modal.mode === 'edit') await gasCall('api_updateDuAn', token, modal.item.ID, form)
      else await gasCall('api_addDuAn', token, form)
      closeModal()
      showToast('Đã lưu dự án', 'success')
      dataCache.invalidate('lookups'); onUpdate()
    } catch (err) { setError(err.message); showToast(err.message, 'error') } finally { setSaving(false) }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Xóa dự án "${item['Tên dự án viết tắt']}"?`)) return
    try {
      await gasCall('api_deleteDuAn', token, item.ID)
      showToast('Đã xóa dự án', 'success')
      dataCache.invalidate('lookups'); onUpdate()
    } catch (err) { showToast(err.message, 'error') }
  }

  const filtered = search ? items.filter(i =>
    viMatch(i['Tên dự án viết tắt'], search) ||
    viMatch(i['Tên dự án đầy đủ'], search)
  ) : items

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <input
          className="bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Tìm dự án..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="text-sm text-on-surface-variant">{filtered.length} dự án</span>
        <button onClick={openAdd}
          className="ml-auto flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-700 transition-colors shadow-md3-1">
          + Thêm dự án
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Tên viết tắt</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Tên đầy đủ</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Địa chỉ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-on-surface-variant">Chưa có dự án</td></tr>
            )}
            {filtered.map(item => (
              <tr key={item.ID} className="hover:bg-surface-container-low transition-colors">
                <td className="px-4 py-3 font-medium text-on-surface">{item['Tên dự án viết tắt']}</td>
                <td className="px-4 py-3 text-on-surface-variant">{item['Tên dự án đầy đủ']}</td>
                <td className="px-4 py-3 text-on-surface-variant">{item['Địa chỉ'] || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(item)} className="text-xs px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors font-medium">Sửa</button>
                    <button onClick={() => handleDelete(item)} className="text-xs px-2.5 py-1 rounded-lg text-error hover:bg-error-container transition-colors font-medium">Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormModal open={!!modal} title={modal?.mode === 'create' ? 'Thêm dự án' : 'Sửa dự án'}
        icon={modal?.mode === 'create' ? 'add' : 'edit'} onClose={closeModal} onSave={handleSave}
        saving={saving} error={error} maxWidth="max-w-md">
        <div className="space-y-4">
          <div className={fieldCls}>
            <label className={labelCls}>Tên viết tắt *</label>
            <input className={inputCls} value={form['Tên dự án viết tắt']}
              onChange={e => setForm(f => ({ ...f, 'Tên dự án viết tắt': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Tên đầy đủ</label>
            <input className={inputCls} value={form['Tên dự án đầy đủ']}
              onChange={e => setForm(f => ({ ...f, 'Tên dự án đầy đủ': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Địa chỉ</label>
            <input className={inputCls} value={form['Địa chỉ']}
              onChange={e => setForm(f => ({ ...f, 'Địa chỉ': e.target.value }))} />
          </div>
        </div>
      </FormModal>
    </div>
  )
}
