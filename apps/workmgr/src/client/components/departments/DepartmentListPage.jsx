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
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-0 max-w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm…" className="w-full pl-10 pr-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setModal({ open: true, mode: 'add', data: null })} className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1">
            <span className="material-symbols-outlined text-base">add</span>Tạo Phòng Ban
          </button>
        </div>
      </div>

      {loading ? <div className="text-center py-10 text-sm text-on-surface-variant">Đang tải…</div> : filtered.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl mb-2 block opacity-30">apartment</span>
          <p className="text-sm">Chưa có phòng ban nào</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-surface-container-low text-on-surface-variant text-xs">
                <th className="px-4 py-3 text-left font-medium">Tên Phòng Ban</th>
                <th className="px-4 py-3 text-left font-medium">Trưởng Phòng</th>
                <th className="px-4 py-3 text-left font-medium">Phó Phòng</th>
                <th className="px-4 py-3 text-left font-medium">P. Giám Đốc</th>
                <th className="px-4 py-3 text-center font-medium">Thành Viên</th>
                <th className="px-4 py-3 text-center font-medium w-20"></th>
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/50">
                {filtered.map(d => (
                  <tr key={d.ID} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-on-surface">{d['Tên phòng ban']}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{getUserName(d['Trưởng phòng ID'])}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{getUserName(d['Phó phòng ID'])}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{getUserName(d['PGĐ phụ trách ID'])}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{getMemberCount(d)} người</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => setModal({ open: true, mode: 'edit', data: d })} className="p-1.5 rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant"><span className="material-symbols-outlined text-base">edit</span></button>
                        <button onClick={() => handleDelete(d)} className="p-1.5 rounded-lg hover:bg-error-container transition-colors text-on-surface-variant hover:text-error"><span className="material-symbols-outlined text-base">delete</span></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal.open && <DepartmentModal mode={modal.mode} data={modal.data} users={masterData.users} departments={masterData.phongBan} onSave={handleSave} onClose={() => setModal({ open: false })} />}
    </div>
  )
}
