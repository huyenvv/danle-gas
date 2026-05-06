import { useState, useEffect, useCallback, useRef } from 'react'
import gasCall from '../../gasClient.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, isOverdue } from '../../utils/format.js'

const COLUMNS = [
  { status: 'Cần Làm', label: 'CẦN LÀM', icon: 'radio_button_unchecked', color: '#1e88e5' },
  { status: 'Đang Thực Hiện', label: 'ĐANG LÀM', icon: 'sync', color: '#fb8c00' },
  { status: 'Đang Xem Xét', label: 'XEM XÉT', icon: 'rate_review', color: '#7c3aed' },
  { status: 'Hoàn Thành', label: 'HOÀN THÀNH', icon: 'check_circle', color: '#43a047' },
]
const PRIORITY_DOT = { 'Cao': 'bg-red-500', 'Trung Bình': 'bg-amber-500', 'Thấp': 'bg-green-500' }

export default function KanbanPage({ masterData, token }) {
  const { showToast } = useToast()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [projectFilter, setProjectFilter] = useState('')
  const dragRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await gasCall('api_getTasks', token, { projectId: projectFilter })
      setTasks(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [token, projectFilter])

  useEffect(() => { load() }, [load])

  const getColumnTasks = (status) => tasks.filter(t => t['Trạng thái'] === status)

  const getUserName = (id) => {
    const u = masterData.users.find(u => String(u.ID) === String(id))
    return u ? (u['Tên nhân viên'] || u['Tên đăng nhập'] || '?') : ''
  }

  const onDragStart = (e, task) => { dragRef.current = task; e.dataTransfer.effectAllowed = 'move' }
  const onDragOver = (e) => e.preventDefault()
  const onDrop = async (e, newStatus) => {
    e.preventDefault()
    const task = dragRef.current
    if (!task || task['Trạng thái'] === newStatus) return
    const oldStatus = task['Trạng thái']
    setTasks(prev => prev.map(t => String(t.ID) === String(task.ID) ? { ...t, 'Trạng thái': newStatus } : t))
    try {
      await gasCall('api_updateTaskStatus', token, task.ID, newStatus)
      showToast('Đã chuyển → ' + newStatus, 'success')
    } catch (e) {
      setTasks(prev => prev.map(t => String(t.ID) === String(task.ID) ? { ...t, 'Trạng thái': oldStatus } : t))
      showToast('Lỗi: ' + e.message, 'error')
    }
    dragRef.current = null
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="min-w-0 px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20 text-on-surface">
          <option value="">Tất cả dự án</option>
          {masterData.duAn.map(p => <option key={p.ID} value={p.ID}>{p['Tên dự án']}</option>)}
        </select>
      </div>

      {loading ? <div className="text-center py-10 text-sm text-on-surface-variant">Đang tải…</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colTasks = getColumnTasks(col.status)
            return (
              <div key={col.status} className="bg-surface-container-low rounded-2xl p-3 min-h-[300px]"
                onDragOver={onDragOver} onDrop={e => onDrop(e, col.status)}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="material-symbols-outlined text-lg" style={{ color: col.color }}>{col.icon}</span>
                  <span className="text-xs font-bold text-on-surface-variant tracking-wide">{col.label}</span>
                  <span className="ml-auto text-xs font-medium bg-surface-container rounded-full px-2 py-0.5 text-on-surface-variant">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map(t => (
                    <div key={t.ID} draggable onDragStart={e => onDragStart(e, t)}
                      className={`bg-white rounded-xl p-3 shadow-md3-1 cursor-grab active:cursor-grabbing hover:shadow-md3-2 transition-shadow ${isOverdue(t) ? 'border-l-3 border-error' : ''}`}>
                      <div className="flex items-start gap-2 mb-1.5">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[t['Mức độ ưu tiên']] || 'bg-gray-400'}`} />
                        <span className="text-sm font-medium text-on-surface leading-snug">{t['Tiêu đề']}</span>
                      </div>
                      {t['Nhãn'] && (
                        <div className="flex flex-wrap gap-1 mb-2 ml-4">
                          {String(t['Nhãn']).split(',').filter(Boolean).map(l => {
                            const label = masterData.nhan.find(n => n['Tên nhãn'] === l.trim())
                            return <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ background: label?.['Màu sắc'] || '#737686' }}>{l.trim()}</span>
                          })}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-on-surface-variant ml-4">
                        <span>{t['Ngày hết hạn'] ? formatDate(t['Ngày hết hạn']) : ''}</span>
                        <span className="font-medium">{getUserName(t['Người thực hiện ID'])}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
