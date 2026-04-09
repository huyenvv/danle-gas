import { useState, useEffect } from 'react'
import gasCall from '../../gasClient.js'
import { viMatch } from '../../utils/viSearch.js'
import { dataCache } from '../../utils/dataCache.js'
import FormModal from '../common/FormModal.jsx'
import { inputCls, labelCls, fieldCls } from '../common/formStyles.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useConfirm } from '../../context/ConfirmContext.jsx'

const PAGE_SIZE = 10

function emptyForm() {
  return {
    'Tên NCC viết tắt': '', 'Tên NCC đầy đủ': '', 'Địa chỉ': '',
    'Mã số thuế': '', 'Điện thoại': '', 'Người đại diện': '',
    'Số tài khoản': '', 'Tên ngân hàng': '', 'Lĩnh vực kinh doanh': '',
  }
}

export default function SupplierManager({ token, lookups, onUpdate }) {
  const [items, setItems] = useState(lookups.nhaCungCap || [])
  const [modal, setModal]   = useState(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [form, setForm]     = useState(emptyForm())
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const confirm = useConfirm()

  useEffect(() => { setItems(lookups.nhaCungCap || []) }, [lookups.nhaCungCap])

  function openAdd() { setForm(emptyForm()); setError(''); setModal({ mode: 'create' }) }
  function openEdit(item) { setForm({ ...item }); setError(''); setModal({ mode: 'edit', item }) }
  function closeModal() { setModal(null); setError('') }

  async function handleSave() {
    if (!form['Tên NCC viết tắt']) { setError('Tên viết tắt là bắt buộc'); return }
    setSaving(true); setError('')
    try {
      if (modal.mode === 'edit') await gasCall('api_updateNhaCungCap', token, modal.item.ID, form)
      else await gasCall('api_addNhaCungCap', token, form)
      closeModal()
      showToast('Đã lưu nhà cung cấp', 'success')
      dataCache.invalidate('lookups'); onUpdate()
    } catch (err) { setError(err.message); showToast(err.message, 'error') } finally { setSaving(false) }
  }

  async function handleDelete(item) {
    if (!await confirm(`Xóa NCC "${item['Tên NCC viết tắt']}"?`)) return
    try {
      await gasCall('api_deleteNhaCungCap', token, item.ID)
      showToast('Đã xóa nhà cung cấp', 'success')
      dataCache.invalidate('lookups'); onUpdate()
    } catch (err) { showToast(err.message, 'error') }
  }

  const filtered = items.filter(i => {
    if (!search) return true
    return viMatch(i['Tên NCC viết tắt'], search) ||
           viMatch(i['Tên NCC đầy đủ'], search) ||
           viMatch(i['Lĩnh vực kinh doanh'], search)
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <input
          className="bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Tìm nhà cung cấp..."
          value={search}
          onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
        />
        <span className="text-sm text-on-surface-variant">{filtered.length} NCC</span>
        <button onClick={openAdd}
          className="ml-auto flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-700 transition-colors shadow-md3-1">
          + Thêm NCC
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Tên viết tắt</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Tên đầy đủ</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">MST</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">ĐT</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Lĩnh vực</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {paged.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant">Chưa có nhà cung cấp</td></tr>
              )}
              {paged.map(item => (
                <tr key={item.ID} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-medium text-on-surface">{item['Tên NCC viết tắt']}</td>
                  <td className="px-4 py-3 text-on-surface-variant max-w-xs truncate">{item['Tên NCC đầy đủ']}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{item['Mã số thuế'] || '—'}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{item['Điện thoại'] || '—'}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{item['Lĩnh vực kinh doanh'] || '—'}</td>
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
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-outline-variant/40 flex items-center justify-between text-sm bg-surface-container-lowest">
            <span className="text-on-surface-variant">Trang {page} / {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setCurrentPage(p => p - 1)}
                className="px-3 py-1.5 border border-outline-variant rounded-lg text-sm disabled:opacity-40 hover:bg-surface-container transition-colors">← Trước</button>
              <button disabled={page >= totalPages} onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1.5 border border-outline-variant rounded-lg text-sm disabled:opacity-40 hover:bg-surface-container transition-colors">Sau →</button>
            </div>
          </div>
        )}
      </div>

      <FormModal open={!!modal} title={modal?.mode === 'create' ? 'Thêm NCC' : 'Sửa NCC'}
        icon={modal?.mode === 'create' ? 'add' : 'edit'} onClose={closeModal} onSave={handleSave}
        saving={saving} error={error} maxWidth="max-w-2xl">
        <div className="grid grid-cols-3 gap-4">
          <div className={fieldCls}>
            <label className={labelCls}>Tên viết tắt *</label>
            <input className={inputCls} value={form['Tên NCC viết tắt']}
              onChange={e => setForm(f => ({ ...f, 'Tên NCC viết tắt': e.target.value }))} />
          </div>
          <div className={fieldCls + ' col-span-2'}>
            <label className={labelCls}>Tên đầy đủ</label>
            <input className={inputCls} value={form['Tên NCC đầy đủ']}
              onChange={e => setForm(f => ({ ...f, 'Tên NCC đầy đủ': e.target.value }))} />
          </div>
          <div className={fieldCls + ' col-span-2'}>
            <label className={labelCls}>Địa chỉ</label>
            <input className={inputCls} value={form['Địa chỉ']}
              onChange={e => setForm(f => ({ ...f, 'Địa chỉ': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Mã số thuế</label>
            <input className={inputCls} value={form['Mã số thuế']}
              onChange={e => setForm(f => ({ ...f, 'Mã số thuế': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Điện thoại</label>
            <input className={inputCls} value={form['Điện thoại']}
              onChange={e => setForm(f => ({ ...f, 'Điện thoại': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Người đại diện</label>
            <input className={inputCls} value={form['Người đại diện']}
              onChange={e => setForm(f => ({ ...f, 'Người đại diện': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Số tài khoản</label>
            <input className={inputCls} value={form['Số tài khoản']}
              onChange={e => setForm(f => ({ ...f, 'Số tài khoản': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Tên ngân hàng</label>
            <input className={inputCls} value={form['Tên ngân hàng']}
              onChange={e => setForm(f => ({ ...f, 'Tên ngân hàng': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Lĩnh vực kinh doanh</label>
            <input className={inputCls} value={form['Lĩnh vực kinh doanh']}
              onChange={e => setForm(f => ({ ...f, 'Lĩnh vực kinh doanh': e.target.value }))} />
          </div>
        </div>
      </FormModal>
    </div>
  )
}
