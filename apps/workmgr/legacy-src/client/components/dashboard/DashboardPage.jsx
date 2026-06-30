import { useState, useEffect, useRef, useMemo } from 'react'
import gasCall from '../../gasClient.js'
import { useCachedFetch } from '../../hooks/useCachedFetch.js'
import { formatDate } from '../../utils/format.js'

const STAT_CARDS = [
  { key: 'totalDepartments', label: 'Tổng số bộ phận', icon: 'apartment', color: 'bg-primary' },
  { key: 'totalTasks', label: 'Tổng công việc', icon: 'task_alt', color: 'bg-secondary' },
  { key: 'totalMembers', label: 'Thành viên', icon: 'group', color: 'bg-green-600' },
  { key: 'totalOverdue', label: 'Quá hạn', icon: 'warning', color: 'bg-error' },
]

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' },
  { value: 'year', label: 'Năm này' },
]

function buildYScale(rawMax) {
  const r = Math.max(rawMax, 1)
  let step
  if (r <= 4) step = 1
  else if (r <= 8) step = 2
  else if (r <= 20) step = 5
  else if (r <= 50) step = 10
  else step = Math.ceil(r / 50) * 10
  const max = Math.ceil(r / step) * step
  const ticks = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  return { max, ticks }
}

function PriorityBarChart({ priorityStats }) {
  const wrapRef = useRef(null)
  const [W, setW] = useState(320)

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(es => {
      const w = Math.round(es[0].contentRect.width)
      if (w > 0) setW(w)
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const bars = [
    { label: 'Cao', value: priorityStats.high, color: '#e53935' },
    { label: 'TB', value: priorityStats.medium, color: '#fb8c00' },
    { label: 'Thấp', value: priorityStats.low, color: '#43a047' },
  ]
  const rawMax = Math.max(...bars.map(b => b.value))
  const yScale = buildYScale(rawMax)
  const H = 180
  const pad = { left: 32, right: 12, top: 16, bottom: 28 }
  const chartW = Math.max(W - pad.left - pad.right, 1)
  const chartH = H - pad.top - pad.bottom
  const barW = Math.min(chartW / bars.length * 0.55, 60)

  return (
    <div ref={wrapRef} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block">
        {yScale.ticks.map(t => {
          const y = pad.top + chartH * (1 - t / yScale.max)
          return (
            <g key={t}>
              <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">{t}</text>
            </g>
          )
        })}
        {bars.map((b, i) => {
          const cx = pad.left + chartW * (i + 0.5) / bars.length
          const h = (b.value / yScale.max) * chartH
          const y = pad.top + chartH - h
          return (
            <g key={b.label}>
              {h > 0 && <rect x={cx - barW / 2} y={y} width={barW} height={h} fill={b.color} rx="4" />}
              <text x={cx} y={y - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1f2937">{b.value}</text>
              <text x={cx} y={H - pad.bottom + 16} textAnchor="middle" fontSize="11" fill="#6b7280">{b.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function TaskStatusDoughnut({ taskStats, total }) {
  const segments = [
    { label: 'Cần Làm', value: taskStats.todo, color: '#01458e' },
    { label: 'Đang Thực Hiện', value: taskStats.inProgress, color: '#e87a1e' },
    { label: 'Chờ Duyệt', value: taskStats.review, color: '#7c3aed' },
    { label: 'Hoàn Thành', value: taskStats.completed, color: '#43a047' },
  ]
  const sum = segments.reduce((a, s) => a + s.value, 0)
  const r = 70
  const c = 2 * Math.PI * r
  let acc = 0
  const arcs = segments.map(s => {
    const len = sum ? (s.value / sum) * c : 0
    const offset = sum ? (acc / sum) * c : 0
    acc += s.value
    return { ...s, len, offset }
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      <div className="relative w-36 h-36 sm:w-40 sm:h-40 lg:w-44 lg:h-44 flex-shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <g transform="rotate(-90 100 100)">
            {sum === 0 && (
              <circle r={r} cx="100" cy="100" fill="transparent" stroke="#e5e7eb" strokeWidth="28" />
            )}
            {sum > 0 && arcs.map(a => (
              <circle
                key={a.label}
                r={r}
                cx="100"
                cy="100"
                fill="transparent"
                stroke={a.color}
                strokeWidth="28"
                strokeDasharray={`${a.len} ${c - a.len}`}
                strokeDashoffset={-a.offset}
              />
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-on-surface">{total ?? 0}</div>
          <div className="text-[10px] text-on-surface-variant">Tổng</div>
        </div>
      </div>
      <div className="flex-1 w-full space-y-2 min-w-0">
        {arcs.map(s => {
          const pct = sum ? Math.round(s.value / sum * 100) : 0
          return (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
              <span className="text-on-surface-variant flex-1 truncate">{s.label}</span>
              <span className="font-medium text-on-surface whitespace-nowrap">{s.value} ({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeptDistributionChart({ data }) {
  const wrapRef = useRef(null)
  const [W, setW] = useState(640)

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(es => {
      const w = Math.round(es[0].contentRect.width)
      if (w > 0) setW(w)
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const segs = [
    { key: 'todo', label: 'Cần Làm', color: '#01458e' },
    { key: 'inProgress', label: 'Đang TH', color: '#e87a1e' },
    { key: 'completed', label: 'Xong', color: '#43a047' },
  ]
  const items = data.slice(0, 12)
  const totals = items.map(d => d.todo + d.inProgress + d.completed)
  const yScale = buildYScale(Math.max(...totals, 1))
  const H = 260
  const pad = { left: 36, right: 12, top: 28, bottom: 56 }
  const chartW = Math.max(W - pad.left - pad.right, 1)
  const chartH = H - pad.top - pad.bottom
  const slot = items.length ? chartW / items.length : 0
  const barW = Math.min(slot * 0.6, 60)

  return (
    <div ref={wrapRef} className="w-full">
      <div className="flex justify-center gap-4 mb-2">
        {segs.map(s => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs">
            <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-on-surface-variant">{s.label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block">
        {yScale.ticks.map(t => {
          const y = pad.top + chartH * (1 - t / yScale.max)
          return (
            <g key={t}>
              <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">{t}</text>
            </g>
          )
        })}
        {items.map((d, i) => {
          const cx = pad.left + slot * (i + 0.5)
          const x = cx - barW / 2
          let yAcc = pad.top + chartH
          return (
            <g key={d.id}>
              {segs.map(s => {
                const v = d[s.key] || 0
                const h = (v / yScale.max) * chartH
                yAcc -= h
                return h > 0 ? <rect key={s.key} x={x} y={yAcc} width={barW} height={h} fill={s.color} /> : null
              })}
              <text x={cx} y={H - pad.bottom + 14} textAnchor="middle" fontSize="10" fill="#6b7280"
                transform={`rotate(-25 ${cx} ${H - pad.bottom + 14})`}>
                {d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function TaskRow({ task, deptName, userName, accent }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-outline-variant/40 last:border-b-0">
      <div className={`w-8 h-8 rounded-lg ${accent.bg} ${accent.text} flex items-center justify-center flex-shrink-0`}>
        <span className="material-symbols-outlined text-base">{accent.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-on-surface truncate">{task['Tiêu đề']}</div>
        <div className="text-xs text-on-surface-variant truncate">{userName || 'Chưa giao'} · {deptName}</div>
        <div className="text-xs text-on-surface-variant/70">Hạn: {formatDate(task['Ngày hết hạn'])}</div>
      </div>
    </div>
  )
}

export default function DashboardPage({ token, masterData }) {
  const [period, setPeriod] = useState('all')
  const [deptFilter, setDeptFilter] = useState('')
  const [overdueDeptId, setOverdueDeptId] = useState('')
  const [overdueMonth, setOverdueMonth] = useState('')
  const [upcomingDeptId, setUpcomingDeptId] = useState('')
  const [upcomingDays, setUpcomingDays] = useState(7)

  const filters = { period, departmentId: deptFilter, overdueDeptId, overdueMonth, upcomingDeptId, upcomingDays }
  const cacheKey = `dashboard:${period}|${deptFilter}|${overdueDeptId}|${overdueMonth}|${upcomingDeptId}|${upcomingDays}`
  const { data: stats, loading } = useCachedFetch(
    cacheKey,
    () => gasCall('api_getDashboardStats', token, filters),
    { ttl: 45_000, refreshInterval: 60_000 } // serve up to 45s stale, refresh every minute
  )

  const getUserName = (id) => {
    const u = masterData?.users?.find(u => String(u.ID) === String(id))
    return u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : ''
  }
  const getDeptName = (id) => {
    const d = masterData?.phongBan?.find(d => String(d.ID) === String(id))
    return d ? d['Tên phòng ban'] : ''
  }

  const monthOptions = useMemo(() => {
    const arr = []
    const now = new Date()
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      arr.push({ value: key, label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}` })
    }
    return arr
  }, [])

  if (loading && !stats) return <div className="text-center py-20 text-on-surface-variant text-sm">Đang tải tổng quan…</div>
  if (!stats) return <div className="text-center py-20 text-on-surface-variant">Không có dữ liệu</div>

  return (
    <div className="space-y-6">
      {/* Top filter */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <div className="inline-flex bg-surface-container-low rounded-xl p-1">
          {PERIOD_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setPeriod(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === o.value ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Tất cả phòng ban</option>
          {(masterData?.phongBan || []).map(d => <option key={d.ID} value={d.ID}>{d['Tên phòng ban']}</option>)}
        </select>
      </div>

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

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Trạng Thái Công Việc</h3>
          <TaskStatusDoughnut taskStats={stats.taskStats} total={stats.totalTasks} />
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Mức Độ Ưu Tiên</h3>
          <PriorityBarChart priorityStats={stats.priorityStats} />
        </div>
      </div>

      {/* Phân Bổ theo Phòng/Ban — only when backend returns data (admin/PGĐ) */}
      {stats.deptDistribution && stats.deptDistribution.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-2">Phân Bổ Công Việc theo Phòng/ Ban</h3>
          <DeptDistributionChart data={stats.deptDistribution} />
        </div>
      )}

      {/* Overdue + Upcoming */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-outline-variant flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-error flex items-center gap-1.5 flex-1 min-w-0">
              <span className="material-symbols-outlined text-base">schedule</span>Công Việc Quá Hạn
            </h3>
            <select
              value={overdueDeptId}
              onChange={e => setOverdueDeptId(e.target.value)}
              className="px-2 py-1 bg-surface-container-low rounded-lg text-xs border-none outline-none"
            >
              <option value="">Tất cả phòng</option>
              {(masterData?.phongBan || []).map(d => <option key={d.ID} value={d.ID}>{d['Tên phòng ban']}</option>)}
            </select>
            <select
              value={overdueMonth}
              onChange={e => setOverdueMonth(e.target.value)}
              className="px-2 py-1 bg-surface-container-low rounded-lg text-xs border-none outline-none"
            >
              <option value="">Mọi tháng</option>
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {stats.overdueTasks.length === 0 ? (
              <div className="text-center py-8 text-on-surface-variant text-sm">
                <span className="material-symbols-outlined text-3xl text-green-600 block mb-1">check_circle</span>
                Không có công việc quá hạn
              </div>
            ) : stats.overdueTasks.map(t => (
              <TaskRow
                key={t.ID}
                task={t}
                deptName={getDeptName(t._deptId)}
                userName={getUserName(t['Người thực hiện ID'])}
                accent={{ bg: 'bg-error-container', text: 'text-error', icon: 'error' }}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-outline-variant flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-amber-600 flex items-center gap-1.5 flex-1 min-w-0">
              <span className="material-symbols-outlined text-base">upcoming</span>Sắp Đến Hạn
            </h3>
            <select
              value={upcomingDeptId}
              onChange={e => setUpcomingDeptId(e.target.value)}
              className="px-2 py-1 bg-surface-container-low rounded-lg text-xs border-none outline-none"
            >
              <option value="">Tất cả phòng</option>
              {(masterData?.phongBan || []).map(d => <option key={d.ID} value={d.ID}>{d['Tên phòng ban']}</option>)}
            </select>
            <input
              type="number"
              min="1"
              max="90"
              value={upcomingDays}
              onChange={e => setUpcomingDays(Number(e.target.value) || 7)}
              className="w-14 px-2 py-1 bg-surface-container-low rounded-lg text-xs border-none outline-none"
              title="Số ngày"
            />
            <span className="text-xs text-on-surface-variant">ngày</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {stats.upcomingTasks.length === 0 ? (
              <div className="text-center py-8 text-on-surface-variant text-sm">
                <span className="material-symbols-outlined text-3xl block mb-1">event_available</span>
                Không có công việc sắp đến hạn
              </div>
            ) : stats.upcomingTasks.map(t => (
              <TaskRow
                key={t.ID}
                task={t}
                deptName={getDeptName(t._deptId)}
                userName={getUserName(t['Người thực hiện ID'])}
                accent={{ bg: 'bg-amber-100', text: 'text-amber-600', icon: 'schedule' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
