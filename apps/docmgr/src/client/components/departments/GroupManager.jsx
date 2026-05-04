import { useState, useEffect } from 'react'
import gasCall from '../../gasClient.js'
import { viMatch } from '../../utils/viSearch.js'
import Icon from '../common/Icon.jsx'
import { dataCache } from '../../utils/dataCache.js'
import FormModal from '../common/FormModal.jsx'
import { inputCls, textareaCls, labelCls, fieldCls } from '../common/formStyles.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useConfirm } from '../../context/ConfirmContext.jsx'

export default function GroupManager({ token, lookups, onUpdate }) {
  const [items, setItems] = useState(lookups.nhom || [])
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({ 'Tên nhóm': '', 'Mô tả': '', 'Thành viên': '' })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const { showToast } = useToast()
  const confirm = useConfirm()

  useEffect(() => { setItems(lookups.nhom || []) }, [lookups.nhom])

  function parseMembers(val) {
    if (!val) return []
    try { return typeof val === 'string' && val.charAt(0) === '[' ? JSON.parse(val) : [] } catch(_) { return [] }
  }

  function openAdd() {
    setForm({ 'Tên nhóm': '', 'Mô tả': '', 'Thành viên': '' })
    setError('')
    setModal({ mode: 'create' })
  }

  function openEdit(item) {
    setForm({ ...item })
    setError('')
    setModal({ mode: 'edit', item })
  }

  function closeModal() { setModal(null); setError('') }

  async function handleSave() {
    if (!form['Tên nhóm']) { setError('Tên nhóm là bắt buộc'); return }
    setSaving(true); setError('')
    try {
      if (modal.mode === 'edit') await gasCall('api_updateNhom', token, modal.item.ID, form)
      else await gasCall('api_addNhom', token, form)
      closeModal()
      showToast('Đã lưu nhóm', 'success')
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
    if (!await confirm(`Xóa nhóm "${item['Tên nhóm']}"?`)) return
    try {
      await gasCall('api_deleteNhom', token, item.ID)
      showToast('Đã xóa nhóm', 'success')
      dataCache.invalidate('lookups')
      onUpdate()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  function toggleMember(userId) {
    const current = parseMembers(form['Thành viên'])
    const sid = String(userId)
    const next = current.map(String).includes(sid)
      ? current.filter(x => String(x) !== sid)
      : [...current, sid]
    setForm(f => ({ ...f, 'Thành viên': next.length ? JSON.stringify(next) : '' }))
  }

  const filtered = search ? items.filter(i => viMatch(i['Tên nhóm'], search)) : items

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input
            className="w-full bg-surface-container-low border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Tìm nhóm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-on-surface-variant">{filtered.length} nhóm</span>
        <div className="ml-auto">
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-700 transition-colors shadow-md3-1">
            <Icon name="add" size={18} />
            Thêm nhóm
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Tên nhóm</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Mô tả</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Thành viên</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-on-surface-variant">Chưa có nhóm</td></tr>
            )}
            {filtered.map(item => {
              const members = parseMembers(item['Thành viên'])
              const memberUsers = members.map(id => (lookups.users || []).find(u => String(u.ID) === String(id))).filter(Boolean)
              return (
                <tr key={item.ID} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-medium text-on-surface">{item['Tên nhóm']}</td>
                  <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell">{item['Mô tả'] || '—'}</td>
                  <td className="px-4 py-3">
                    {memberUsers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {memberUsers.map(u => {
                          const name = u['Tên nhân viên'] || u['Tên đăng nhập']
                          const email = u['Email'] || ''
                          return (
                            <div key={u.ID} className="relative group">
                              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{name}</span>
                              {email && (
                                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                  <div className="bg-on-surface text-surface text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                                    <p className="font-medium">{name}</p>
                                    <p className="text-surface/70 text-[10px]">{email}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : <span className="text-on-surface-variant text-xs">Chưa có</span>}
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

      <FormModal open={!!modal} title={modal?.mode === 'create' ? 'Thêm nhóm' : 'Sửa nhóm'}
        icon={modal?.mode === 'create' ? 'add' : 'edit'} onClose={closeModal} onSave={handleSave}
        saving={saving} error={error} maxWidth="max-w-md">
        <div className="space-y-4">
          <div className={fieldCls}>
            <label className={labelCls}>Tên nhóm *</label>
            <input className={inputCls} value={form['Tên nhóm']}
              onChange={e => setForm(f => ({ ...f, 'Tên nhóm': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Mô tả</label>
            <textarea className={textareaCls + ' h-20'} value={form['Mô tả']}
              onChange={e => setForm(f => ({ ...f, 'Mô tả': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Thành viên</label>
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-surface-container-low rounded-xl min-h-[42px]">
              {(lookups.users || []).map(u => {
                const members = parseMembers(form['Thành viên']).map(String)
                const active = members.includes(String(u.ID))
                const name = u['Tên nhân viên'] || u['Tên đăng nhập']
                const label = u['Email'] ? `${name} (${u['Email']})` : name
                return (
                  <button key={u.ID} type="button"
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-primary/10'}`}
                    onClick={() => toggleMember(u.ID)}>
                    {label}
                  </button>
                )
              })}
              {(lookups.users || []).length === 0 && (
                <span className="text-xs text-on-surface-variant">Chưa có người dùng</span>
              )}
            </div>
          </div>
        </div>
      </FormModal>
    </div>
  )
}
