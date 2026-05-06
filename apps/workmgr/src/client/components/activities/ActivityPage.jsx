import { useState, useEffect } from 'react'
import gasCall from '../../gasClient.js'
import { timeAgo } from '../../utils/format.js'

const TYPE_ICONS = { 'Tạo dự án': 'create_new_folder', 'Tạo công việc': 'add_task', 'Cập nhật dự án': 'edit', 'Cập nhật công việc': 'edit', 'Chuyển trạng thái': 'swap_horiz', 'Xóa dự án': 'delete', 'Xóa công việc': 'delete', 'Bình luận': 'chat' }
const TYPE_COLORS = { 'Tạo dự án': 'bg-green-100 text-green-700', 'Tạo công việc': 'bg-blue-100 text-blue-700', 'Xóa dự án': 'bg-red-100 text-red-700', 'Xóa công việc': 'bg-red-100 text-red-700' }

export default function ActivityPage({ token }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    gasCall('api_getTasks', token, {}).then(() => {})  // warm up
    gasCall('api_getDashboardStats', token)
      .then(stats => setActivities(stats?.recentActivities || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const filtered = activities.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return (a['Mô tả']||'').toLowerCase().includes(q) || (a['Loại']||'').toLowerCase().includes(q) || (a['Tên người dùng']||'').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-0 max-w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm…" className="w-full pl-10 pr-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>

      {loading ? <div className="text-center py-10 text-sm text-on-surface-variant">Đang tải…</div> : (
        <div className="bg-white rounded-2xl shadow-card divide-y divide-outline-variant/50">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant"><span className="material-symbols-outlined text-5xl mb-2 block opacity-30">history</span><p className="text-sm">Chưa có hoạt động</p></div>
          ) : filtered.map((a, i) => (
            <div key={i} className="flex items-start gap-3 p-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TYPE_COLORS[a['Loại']] || 'bg-surface-container text-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-lg">{TYPE_ICONS[a['Loại']] || 'history'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-on-surface"><span className="font-medium">{a['Tên người dùng']}</span> <span className="text-on-surface-variant">{a['Loại']}</span></div>
                <div className="text-xs text-on-surface-variant mt-0.5 truncate">{a['Mô tả']}</div>
              </div>
              <span className="text-[10px] text-on-surface-variant whitespace-nowrap">{timeAgo(a['Thời gian'])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
