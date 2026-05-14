import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import gasCall from '../../gasClient.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useCachedFetch } from '../../hooks/useCachedFetch.js'
import { cache } from '../../utils/cache.js'
import { Batcher } from '../../utils/batcher.js'
import { mutate } from '../../utils/mutate.js'
import { formatDate, isOverdue } from '../../utils/format.js'
import { canMoveTaskStatus } from '../../utils/permissions.js'

const COLUMNS = [
  { status: 'Cần Làm', label: 'CẦN LÀM', icon: 'radio_button_unchecked', color: '#01458e' },
  { status: 'Đang Thực Hiện', label: 'ĐANG LÀM', icon: 'sync', color: '#fb8c00' },
  { status: 'Chờ Duyệt', label: 'CHỜ DUYỆT', icon: 'rate_review', color: '#7c3aed' },
  { status: 'Hoàn Thành', label: 'HOÀN THÀNH', icon: 'check_circle', color: '#43a047' },
]
const PRIORITY_DOT = { 'Cao': 'bg-red-500', 'Trung Bình': 'bg-amber-500', 'Thấp': 'bg-green-500' }

function getCurrentQuarterRange() {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3)
  const start = new Date(now.getFullYear(), q * 3, 1)
  const end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999)
  return { start, end }
}

export default function KanbanPage({ masterData, token }) {
  const { showToast } = useToast()
  const { session } = useAuth()
  const [deptFilter, setDeptFilter] = useState('')
  const [memberFilter, setMemberFilter] = useState('')
  const [includeArchive, setIncludeArchive] = useState(false)
  const dragRef = useRef(null)

  const cacheKey = `kanban:${deptFilter}|${includeArchive ? 'a' : ''}`
  const { data, loading, refresh, setData } = useCachedFetch(
    cacheKey,
    () => gasCall('api_getTasks', token, { departmentId: deptFilter, includeArchive }),
    { ttl: 30_000, refreshInterval: 45_000 }
  )
  const tasks = Array.isArray(data) ? data : []
  const setTasks = useCallback((updater) => {
    setData(prev => {
      const next = typeof updater === 'function' ? updater(Array.isArray(prev) ? prev : []) : updater
      cache.set(cacheKey, next, 30_000)
      return next
    })
  }, [setData, cacheKey])
  const load = refresh

  const deptById = useMemo(() => {
    const m = {}
    ;(masterData.phongBan || []).forEach(d => { m[String(d.ID)] = d })
    return m
  }, [masterData.phongBan])

  const quarter = useMemo(() => getCurrentQuarterRange(), [])

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (memberFilter && String(t['Người thực hiện ID']) !== String(memberFilter)) return false
      // When archive isn't loaded, also filter completed to current quarter for cleanliness.
      if (!includeArchive && t['Trạng thái'] === 'Hoàn Thành') {
        const cd = t['Ngày hoàn thành'] ? new Date(t['Ngày hoàn thành']) : null
        if (!cd || isNaN(cd.getTime())) return true // missing date — show
        if (cd < quarter.start || cd > quarter.end) return false
      }
      return true
    })
  }, [tasks, memberFilter, includeArchive, quarter])

  const getColumnTasks = (status) => filteredTasks.filter(t => t['Trạng thái'] === status)

  const getUserName = (id) => {
    const u = masterData.users.find(u => String(u.ID) === String(id))
    return u ? (u['Tên nhân viên'] || u['Tên đăng nhập'] || '?') : ''
  }

  const canDragTo = (task, toStatus) => {
    const dept = deptById[String(task['Phòng ban ID'])]
    return canMoveTaskStatus(session, dept, task, task['Trạng thái'], toStatus)
  }

  // Batch rapid drag-drops into a single API call. 400ms window keeps it
  // responsive while still aggregating bursts.
  const statusBatcherRef = useRef(null)
  if (!statusBatcherRef.current) {
    statusBatcherRef.current = new Batcher(async (items) => {
      try {
        const results = await mutate('api_batchUpdateTaskStatus', token, items)
        const failed = (results || []).filter(r => !r.ok)
        if (failed.length) showToast('Một số chuyển trạng thái thất bại', 'error')
      } catch (err) {
        showToast('Lỗi đồng bộ: ' + err.message, 'error')
        // refetch to resync state
        refresh()
      }
    }, { delay: 400, maxSize: 20 })
  }
  useEffect(() => () => statusBatcherRef.current?.dispose(), [])

  const onDragStart = (e, task) => { dragRef.current = task; e.dataTransfer.effectAllowed = 'move' }
  const onDragOver = (e) => e.preventDefault()
  const onDrop = (e, newStatus) => {
    e.preventDefault()
    const task = dragRef.current
    if (!task || task['Trạng thái'] === newStatus) return
    if (!canDragTo(task, newStatus)) {
      showToast('Bạn không có quyền chuyển trạng thái này', 'error')
      dragRef.current = null
      return
    }
    setTasks(prev => prev.map(t => String(t.ID) === String(task.ID) ? { ...t, 'Trạng thái': newStatus } : t))
    statusBatcherRef.current.add({ id: task.ID, status: newStatus, deptId: task['Phòng ban ID'] })
    dragRef.current = null
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20 text-on-surface">
          <option value="">Tất cả phòng/ ban/ NM</option>
          {masterData.phongBan.map(d => <option key={d.ID} value={d.ID}>{d['Tên phòng ban']}</option>)}
        </select>
        <select value={memberFilter} onChange={e => setMemberFilter(e.target.value)} className="px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20 text-on-surface">
          <option value="">Tất cả thành viên</option>
          {masterData.users.map(u => <option key={u.ID} value={u.ID}>{u['Tên nhân viên'] || u['Tên đăng nhập']}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
          <input type="checkbox" checked={includeArchive} onChange={e => setIncludeArchive(e.target.checked)} className="w-4 h-4 accent-primary" />
          Bao gồm lưu trữ (Hoàn Thành &gt; 3 tháng)
        </label>
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
                  {colTasks.map(t => {
                    const dept = deptById[String(t['Phòng ban ID'])]
                    const canDrag = COLUMNS.some(c => c.status !== t['Trạng thái'] && canMoveTaskStatus(session, dept, t, t['Trạng thái'], c.status))
                    return (
                      <div key={t.ID} draggable={canDrag} onDragStart={e => onDragStart(e, t)}
                        className={`bg-white rounded-xl p-3 shadow-md3-1 ${canDrag ? 'cursor-grab active:cursor-grabbing hover:shadow-md3-2' : 'cursor-default opacity-80'} transition-shadow ${isOverdue(t) ? 'border-l-3 border-error' : ''}`}>
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
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
