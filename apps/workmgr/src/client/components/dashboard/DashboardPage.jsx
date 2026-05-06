import { useState, useEffect } from 'react'
import gasCall from '../../gasClient.js'
import { formatMoney, timeAgo } from '../../utils/format.js'

const STAT_CARDS = [
  { key: 'totalProjects', label: 'Dự Án', icon: 'folder_open', color: 'bg-primary' },
  { key: 'totalTasks', label: 'Công Việc', icon: 'task_alt', color: 'bg-secondary' },
  { key: 'totalCompleted', label: 'Hoàn Thành', icon: 'check_circle', color: 'bg-green-600' },
  { key: 'totalOverdue', label: 'Quá Hạn', icon: 'warning', color: 'bg-error' },
]

export default function DashboardPage({ token }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    gasCall('api_getDashboardStats', token)
      .then(data => setStats(data))
      .catch(e => console.error('Dashboard:', e))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <div className="text-center py-20 text-on-surface-variant text-sm">Đang tải tổng quan…</div>

  if (!stats) return <div className="text-center py-20 text-on-surface-variant">Không có dữ liệu</div>

  const budgetPct = stats.totalBudget ? Math.round(stats.totalActualCost / stats.totalBudget * 100) : 0

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(c => (
          <div key={c.key} className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${c.color} flex items-center justify-center`}>
              <span className="material-symbols-outlined text-white text-2xl icon-filled">{c.icon}</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-on-surface">{stats[c.key] ?? 0}</div>
              <div className="text-xs text-on-surface-variant">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Budget Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="text-xs text-on-surface-variant mb-1">Tổng Ngân Sách</div>
          <div className="text-lg font-bold text-primary">{formatMoney(stats.totalBudget)}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="text-xs text-on-surface-variant mb-1">Chi Phí Thực Tế</div>
          <div className="text-lg font-bold text-on-surface">{formatMoney(stats.totalActualCost)}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="text-xs text-on-surface-variant mb-1">Sử Dụng Ngân Sách</div>
          <div className="text-lg font-bold" style={{ color: budgetPct > 90 ? '#ba1a1a' : budgetPct > 70 ? '#fb8c00' : '#43a047' }}>{budgetPct}%</div>
          <div className="mt-2 h-2 bg-surface-variant rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: Math.min(budgetPct, 100) + '%', background: budgetPct > 90 ? '#ba1a1a' : budgetPct > 70 ? '#fb8c00' : '#43a047' }} />
          </div>
        </div>
      </div>

      {/* Charts Row - Task Status + Priority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Trạng Thái Công Việc</h3>
          <div className="space-y-3">
            {[
              { label: 'Cần Làm', value: stats.taskStats.todo, color: '#1e88e5' },
              { label: 'Đang Thực Hiện', value: stats.taskStats.inProgress, color: '#fb8c00' },
              { label: 'Đang Xem Xét', value: stats.taskStats.review, color: '#7c3aed' },
              { label: 'Hoàn Thành', value: stats.taskStats.completed, color: '#43a047' },
            ].map(s => {
              const pct = stats.totalTasks ? Math.round(s.value / stats.totalTasks * 100) : 0
              return (
                <div key={s.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-on-surface-variant">{s.label}</span>
                    <span className="font-medium text-on-surface">{s.value} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-surface-variant rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: pct + '%', background: s.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Mức Độ Ưu Tiên</h3>
          <div className="flex items-end gap-4 h-32">
            {[
              { label: 'Cao', value: stats.priorityStats.high, color: '#e53935' },
              { label: 'TB', value: stats.priorityStats.medium, color: '#fb8c00' },
              { label: 'Thấp', value: stats.priorityStats.low, color: '#43a047' },
            ].map(p => {
              const max = Math.max(stats.priorityStats.high, stats.priorityStats.medium, stats.priorityStats.low, 1)
              const h = Math.max((p.value / max) * 100, 8)
              return (
                <div key={p.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-on-surface">{p.value}</span>
                  <div className="w-full rounded-t-lg transition-all" style={{ height: h + '%', background: p.color }} />
                  <span className="text-[10px] text-on-surface-variant">{p.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Project Progress */}
      {stats.projectProgress?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Tiến Độ Dự Án</h3>
          <div className="space-y-3">
            {stats.projectProgress.map(p => (
              <div key={p.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-on-surface font-medium">{p.name}</span>
                  <span className="text-on-surface-variant">{p.progress}%</span>
                </div>
                <div className="h-2 bg-surface-variant rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: p.progress + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activities */}
      {stats.recentActivities?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Hoạt Động Gần Đây</h3>
          <div className="space-y-3">
            {stats.recentActivities.map((a, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-primary text-base">
                    {a['Loại']?.includes('Tạo') ? 'add_circle' : a['Loại']?.includes('Xóa') ? 'delete' : 'edit'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-on-surface"><span className="font-medium">{a['Tên người dùng']}</span> — {a['Loại']}</div>
                  <div className="text-xs text-on-surface-variant truncate">{a['Mô tả']}</div>
                </div>
                <span className="text-[10px] text-on-surface-variant whitespace-nowrap">{timeAgo(a['Thời gian'])}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
