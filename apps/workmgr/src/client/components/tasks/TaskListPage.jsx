import { useState, useEffect, useCallback, useMemo } from 'react'
import gasCall from '../../gasClient.js'
import { mutate } from '../../utils/mutate.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useConfirm } from '../../context/ConfirmContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatDate, isOverdue } from '../../utils/format.js'
import { canManageDeptTasks, isAdminRole } from '../../utils/permissions.js'
import TaskModal from './TaskModal.jsx'
import TaskDetailModal from './TaskDetailModal.jsx'

const STATUS_COLORS = { 'Cần Làm': 'bg-blue-100 text-blue-700', 'Đang Thực Hiện': 'bg-amber-100 text-amber-700', 'Chờ Duyệt': 'bg-purple-100 text-purple-700', 'Hoàn Thành': 'bg-green-100 text-green-700' }
const PRIORITY_COLORS = { 'Cao': 'bg-red-100 text-red-700', 'Trung Bình': 'bg-amber-100 text-amber-700', 'Thấp': 'bg-green-100 text-green-700' }

export default function TaskListPage({ masterData, reloadMaster, token }) {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { session } = useAuth()
  const PAGE_SIZE = 25
  const [tasks, setTasks] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [includeArchive, setIncludeArchive] = useState(false)
  const [modal, setModal] = useState({ open: false, mode: 'add', data: null })
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(id)
  }, [search])

  // Reset to first page when filters change
  useEffect(() => { setPage(0) }, [debouncedSearch, deptFilter, statusFilter, includeArchive])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const data = await gasCall('api_getTasks', token, {
        departmentId: deptFilter, status: statusFilter, includeArchive, search: debouncedSearch,
        limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      })
      if (data && Array.isArray(data.rows)) {
        setTasks(data.rows)
        setTotal(data.total || 0)
      } else {
        setTasks(Array.isArray(data) ? data : [])
        setTotal(Array.isArray(data) ? data.length : 0)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [token, deptFilter, statusFilter, includeArchive, debouncedSearch, page])

  useEffect(() => { loadTasks() }, [loadTasks])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = tasks

  const getUserName = (id) => { const u = masterData.users.find(u => String(u.ID) === String(id)); return u ? (u['Tên nhân viên']||u['Tên đăng nhập']) : '' }
  const getDeptName = (id) => { const d = masterData.phongBan.find(d => String(d.ID) === String(id)); return d ? d['Tên phòng ban'] : '' }

  const deptById = useMemo(() => {
    const m = {}
    ;(masterData.phongBan || []).forEach(d => { m[String(d.ID)] = d })
    return m
  }, [masterData.phongBan])

  const canManageInAnyDept = useMemo(() => {
    if (isAdminRole(session?.role)) return true
    return (masterData.phongBan || []).some(d => canManageDeptTasks(session, d))
  }, [session, masterData.phongBan])

  const handleSave = async (data, mode) => {
    try {
      if (mode === 'add') await mutate('api_createTask', token, data)
      else await mutate('api_updateTask', token, data.ID, data)
      showToast(mode === 'add' ? 'Đã tạo công việc' : 'Đã cập nhật', 'success')
      setModal({ open: false })
      loadTasks()
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleDelete = async (t) => {
    const ok = await confirm('Xóa công việc', `Bạn có chắc muốn xóa "${t['Tiêu đề']}"?`)
    if (!ok) return
    try { await mutate('api_deleteTask', token, t.ID, t['Phòng ban ID']); showToast('Đã xóa', 'success'); loadTasks() }
    catch (e) { showToast(e.message, 'error') }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-0 max-w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm…" className="w-full pl-10 pr-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="min-w-0 px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20 text-on-surface">
          <option value="">Tất cả phòng ban</option>
          {masterData.phongBan.map(d => <option key={d.ID} value={d.ID}>{d['Tên phòng ban']}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="min-w-0 px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20 text-on-surface">
          <option value="">Tất cả trạng thái</option>
          {['Cần Làm','Đang Thực Hiện','Chờ Duyệt','Hoàn Thành'].map(s => <option key={s}>{s}</option>)}
        </select>
        <label className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant cursor-pointer">
          <input type="checkbox" checked={includeArchive} onChange={e => setIncludeArchive(e.target.checked)} className="w-4 h-4 accent-primary" />
          Bao gồm lưu trữ
        </label>
        <div className="ml-auto flex items-center gap-2">
          {canManageInAnyDept && (
            <button onClick={() => setModal({ open: true, mode: 'add', data: null })} className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1">
              <span className="material-symbols-outlined text-base">add</span>Tạo Công Việc
            </button>
          )}
        </div>
      </div>

      {loading ? <div className="text-center py-10 text-sm text-on-surface-variant">Đang tải…</div> : filtered.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl mb-2 block opacity-30">assignment</span>
          <p className="text-sm">Chưa có công việc nào</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-surface-container-low text-on-surface-variant text-xs">
                <th className="px-4 py-3 text-left font-medium">Tiêu Đề</th>
                <th className="px-4 py-3 text-left font-medium">Phòng/ Ban/ NM</th>
                <th className="px-4 py-3 text-left font-medium">Người TH</th>
                <th className="px-4 py-3 text-left font-medium">Trạng Thái</th>
                <th className="px-4 py-3 text-left font-medium">Ưu Tiên</th>
                <th className="px-4 py-3 text-left font-medium">Hạn</th>
                <th className="px-4 py-3 text-center font-medium w-20"></th>
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/50">
                {filtered.map(t => {
                  const dept = deptById[String(t['Phòng ban ID'])]
                  const canManage = canManageDeptTasks(session, dept)
                  return (
                  <tr key={t.ID} className={`hover:bg-surface-container-low/50 transition-colors ${isOverdue(t) ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => setDetail(t)} className="font-medium text-on-surface hover:text-primary transition-colors text-left">{t['Tiêu đề']}</button>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{getDeptName(t['Phòng ban ID'])}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{getUserName(t['Người thực hiện ID'])}</td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[t['Trạng thái']]||''}`}>{t['Trạng thái']}</span></td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[t['Mức độ ưu tiên']]||''}`}>{t['Mức độ ưu tiên']}</span></td>
                    <td className={`px-4 py-3 text-sm ${isOverdue(t) ? 'text-error font-medium' : 'text-on-surface-variant'}`}>{formatDate(t['Ngày hết hạn'])}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        {canManage ? (
                          <>
                            <button onClick={() => setModal({ open: true, mode: 'edit', data: t })} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"><span className="material-symbols-outlined text-base">edit</span></button>
                            <button onClick={() => handleDelete(t)} className="p-1.5 rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error"><span className="material-symbols-outlined text-base">delete</span></button>
                          </>
                        ) : (
                          <span className="text-xs text-on-surface-variant/50">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant text-xs text-on-surface-variant">
              <span>Hiển thị {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-1.5 rounded-lg hover:bg-surface-container disabled:opacity-30">
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                <span className="px-2 font-medium">Trang {page + 1} / {totalPages}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page + 1 >= totalPages}
                  className="p-1.5 rounded-lg hover:bg-surface-container disabled:opacity-30">
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal.open && <TaskModal mode={modal.mode} data={modal.data} departments={masterData.phongBan} users={masterData.users} labels={masterData.nhan} onSave={handleSave} onClose={() => setModal({ open: false })} />}
      {detail && <TaskDetailModal task={detail} token={token} users={masterData.users} labels={masterData.nhan} departments={masterData.phongBan} onClose={() => setDetail(null)} />}
    </div>
  )
}
