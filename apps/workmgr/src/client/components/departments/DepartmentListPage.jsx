import { useState } from 'react'
import { mutate } from '../../utils/mutate.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useConfirm } from '../../context/ConfirmContext.jsx'
import DepartmentModal from './DepartmentModal.jsx'

export default function DepartmentListPage({ masterData, reloadMaster, token }) {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState({ open: false, mode: 'add', data: null })

  const depts = masterData.phongBan || []
  const loading = false

  const filtered = depts.filter(d => {
    if (!search) return true
    const q = search.toLowerCase()
    return (d['Tên phòng ban'] || '').toLowerCase().includes(q) || String(d.ID).includes(q)
  })

  const getUserName = (id) => {
    if (!id) return '—'
    const u = masterData.users.find(u => String(u.ID) === String(id))
    return u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : ''
  }

  const getMemberCount = (d) => {
    const m = (d['Thành viên'] || '').split(',').filter(s => s.trim())
    return m.length
  }

  const handleSave = async (data, mode) => {
    try {
      if (mode === 'add') await mutate('api_createDepartment', token, data)
      else await mutate('api_updateDepartment', token, data.ID, data)
      showToast(mode === 'add' ? 'Đã tạo phòng ban' : 'Đã cập nhật', 'success')
      setModal({ open: false })
      reloadMaster()
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleDelete = async (d) => {
    const ok = await confirm('Xóa phòng ban', `Bạn có chắc muốn xóa "${d['Tên phòng ban']}"?`)
    if (!ok) return
    try {
      await mutate('api_deleteDepartment', token, d.ID)
      showToast('Đã xóa', 'success')
      reloadMaster()
    } catch (e) { showToast(e.message, 'error') }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" style={{ fontSize: 18 }}>search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm…" className="w-full bg-surface-container-low border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <span className="text-xs text-on-surface-variant whitespace-nowrap">{filtered.length} phòng ban</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => reloadMaster()} title="Làm mới" className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container border border-outline-variant transition-colors">
            <span className="material-symbols-outlined text-base leading-none">refresh</span>
          </button>
          <button onClick={() => setModal({ open: true, mode: 'add', data: null })} className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1">
            <span className="material-symbols-outlined text-base">add</span>Tạo Phòng Ban
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Tên Phòng Ban</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Trưởng Phòng</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Phó Phòng</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">P. Giám Đốc</th>
                <th className="px-4 py-3 text-center font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Thành Viên</th>
                <th className="px-4 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/40">
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant">Chưa có phòng ban nào</td></tr>
                )}
                {filtered.map(d => (
                  <tr key={d.ID} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-medium text-on-surface">{d['Tên phòng ban']}</td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">{getUserName(d['Trưởng phòng ID'])}</td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">{getUserName(d['Phó phòng ID'])}</td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">{getUserName(d['PGĐ phụ trách ID'])}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{getMemberCount(d)} người</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setModal({ open: true, mode: 'edit', data: d })}
                          className="text-xs px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors font-medium">Sửa</button>
                        <button onClick={() => handleDelete(d)}
                          className="text-xs px-2.5 py-1 rounded-lg text-error hover:bg-error/10 transition-colors font-medium">Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        {depts.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/40 bg-surface-container-lowest">
            <span className="text-xs text-on-surface-variant">{filtered.length} / {depts.length} phòng ban</span>
          </div>
        )}
      </div>

      {modal.open && <DepartmentModal mode={modal.mode} data={modal.data} users={masterData.users} departments={masterData.phongBan} onSave={handleSave} onClose={() => setModal({ open: false })} />}
    </div>
  )
}
