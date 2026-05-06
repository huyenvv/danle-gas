import { useState, useEffect, useCallback } from 'react'
import gasCall from '../../gasClient.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useConfirm } from '../../context/ConfirmContext.jsx'
import { formatMoney, formatDate, toInputDate } from '../../utils/format.js'
import ProjectModal from './ProjectModal.jsx'

const STATUS_COLORS = { 'Lên Kế Hoạch': 'bg-blue-100 text-blue-700', 'Đang Thực Hiện': 'bg-amber-100 text-amber-700', 'Hoàn Thành': 'bg-green-100 text-green-700', 'Tạm Dừng': 'bg-orange-100 text-orange-700', 'Đã Hủy': 'bg-red-100 text-red-700' }
const PRIORITY_COLORS = { 'Cao': 'bg-red-100 text-red-700', 'Trung Bình': 'bg-amber-100 text-amber-700', 'Thấp': 'bg-green-100 text-green-700' }

export default function ProjectListPage({ masterData, reloadMaster, token }) {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal] = useState({ open: false, mode: 'add', data: null })

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const data = await gasCall('api_getProjects', token, { status: statusFilter })
      setProjects(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [token, statusFilter])

  useEffect(() => { loadProjects() }, [loadProjects])

  const filtered = projects.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (p['Tên dự án']||'').toLowerCase().includes(q) || String(p.ID).includes(q)
  })

  const getUserName = (id) => {
    const u = masterData.users.find(u => String(u.ID) === String(id))
    return u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : ''
  }

  const handleSave = async (data, mode) => {
    try {
      if (mode === 'add') await gasCall('api_createProject', token, data)
      else await gasCall('api_updateProject', token, data.ID, data)
      showToast(mode === 'add' ? 'Đã tạo dự án' : 'Đã cập nhật', 'success')
      setModal({ open: false })
      loadProjects()
      reloadMaster()
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleDelete = async (p) => {
    const ok = await confirm('Xóa dự án', `Bạn có chắc muốn xóa "${p['Tên dự án']}"?`)
    if (!ok) return
    try {
      await gasCall('api_deleteProject', token, p.ID)
      showToast('Đã xóa', 'success')
      loadProjects()
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
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="min-w-0 px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20 text-on-surface">
          <option value="">Tất cả trạng thái</option>
          {['Lên Kế Hoạch','Đang Thực Hiện','Hoàn Thành','Tạm Dừng','Đã Hủy'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setModal({ open: true, mode: 'add', data: null })} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary-700 transition-colors shadow-md3-1">
            <span className="material-symbols-outlined text-base">add</span>Tạo Dự Án
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? <div className="text-center py-10 text-sm text-on-surface-variant">Đang tải…</div> : filtered.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl mb-2 block opacity-30">folder_off</span>
          <p className="text-sm">Chưa có dự án nào</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-surface-container-low text-on-surface-variant text-xs">
                <th className="px-4 py-3 text-left font-medium">Tên Dự Án</th>
                <th className="px-4 py-3 text-left font-medium">Trạng Thái</th>
                <th className="px-4 py-3 text-left font-medium">Ưu Tiên</th>
                <th className="px-4 py-3 text-right font-medium">Ngân Sách</th>
                <th className="px-4 py-3 text-left font-medium">Leader</th>
                <th className="px-4 py-3 text-center font-medium">Tiến Độ</th>
                <th className="px-4 py-3 text-center font-medium w-20"></th>
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/50">
                {filtered.map(p => (
                  <tr key={p.ID} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-on-surface">{p['Tên dự án']}</td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[p['Trạng thái']] || ''}`}>{p['Trạng thái']}</span></td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[p['Mức độ ưu tiên']] || ''}`}>{p['Mức độ ưu tiên']}</span></td>
                    <td className="px-4 py-3 text-right text-on-surface-variant">{formatMoney(p['Ngân sách'])}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{getUserName(p['Leader ID'])}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-surface-variant rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{width:(Number(p['Tiến độ'])||0)+'%'}}/></div>
                        <span className="text-xs text-on-surface-variant">{p['Tiến độ']||0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => setModal({ open: true, mode: 'edit', data: p })} className="p-1.5 rounded-lg hover:bg-surface-container transition-colors text-on-surface-variant"><span className="material-symbols-outlined text-base">edit</span></button>
                        <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-error-container transition-colors text-on-surface-variant hover:text-error"><span className="material-symbols-outlined text-base">delete</span></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal.open && <ProjectModal mode={modal.mode} data={modal.data} users={masterData.users} onSave={handleSave} onClose={() => setModal({ open: false })} />}
    </div>
  )
}
