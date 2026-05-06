import { useState, useEffect, useMemo } from 'react'
import gasCall from '../../gasClient.js'
import { formatDateShort } from '../../utils/format.js'

const COLORS = ['#0053db', '#fb8c00', '#43a047', '#7c3aed', '#e53935', '#00acc1', '#546e7a']

export default function TimelinePage({ masterData, token }) {
  const [tasks, setTasks] = useState([])
  const [projectFilter, setProjectFilter] = useState('')
  const [view, setView] = useState('month')
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    gasCall('api_getTasks', token, { projectId: projectFilter })
      .then(data => setTasks(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [token, projectFilter])

  const { days, items, todayLeft, cellWidth } = useMemo(() => {
    const now = new Date()
    let startDate, numDays, cw
    if (view === 'week') {
      startDate = new Date(now); startDate.setDate(now.getDate() - now.getDay() + offset * 7); numDays = 7; cw = 100
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth() + offset, 1); numDays = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate(); cw = 40
    }
    const days = []
    for (let i = 0; i < numDays; i++) { const d = new Date(startDate); d.setDate(startDate.getDate() + i); days.push(d) }

    const items = tasks.filter(t => t['Ngày bắt đầu'] && t['Ngày hết hạn']).map((t, i) => {
      const s = new Date(t['Ngày bắt đầu']), e = new Date(t['Ngày hết hạn'])
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return null
      const diffStart = (s - startDate) / 86400000, diffEnd = (e - startDate) / 86400000
      const left = Math.max(0, diffStart) * cw, width = Math.max((Math.min(diffEnd, numDays) - Math.max(diffStart, 0)) * cw, cw)
      if (left > numDays * cw || diffEnd < 0) return null
      return { ...t, barLeft: left, barWidth: width, color: COLORS[i % COLORS.length] }
    }).filter(Boolean)

    const todayDiff = (new Date(now.getFullYear(), now.getMonth(), now.getDate()) - startDate) / 86400000
    const todayLeft = todayDiff >= 0 && todayDiff <= numDays ? todayDiff * cw : -1

    return { days, items, todayLeft, cellWidth: cw }
  }, [tasks, view, offset])

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="min-w-0 px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20 text-on-surface">
            <option value="">Tất cả dự án</option>
            {masterData.duAn.map(p => <option key={p.ID} value={p.ID}>{p['Tên dự án']}</option>)}
          </select>
          <div className="flex bg-surface-container-low rounded-xl overflow-hidden">
            <button onClick={() => setView('week')} className={`px-3 py-2 text-xs font-medium ${view==='week'?'bg-primary text-on-primary':'text-on-surface-variant'}`}>Tuần</button>
            <button onClick={() => setView('month')} className={`px-3 py-2 text-xs font-medium ${view==='month'?'bg-primary text-on-primary':'text-on-surface-variant'}`}>Tháng</button>
          </div>
          <button onClick={() => setOffset(o => o - 1)} className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container"><span className="material-symbols-outlined text-base">chevron_left</span></button>
          <button onClick={() => setOffset(0)} className="px-3 py-2 text-xs font-medium bg-surface-container-low rounded-xl hover:bg-surface-container text-on-surface">Hôm nay</button>
          <button onClick={() => setOffset(o => o + 1)} className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container"><span className="material-symbols-outlined text-base">chevron_right</span></button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
        <div style={{ minWidth: days.length * cellWidth + 200 + 'px' }} className="relative">
          {/* Header */}
          <div className="flex border-b border-outline-variant sticky top-0 bg-white z-10">
            <div className="w-[200px] shrink-0 px-4 py-3 text-xs font-medium text-on-surface-variant">Công việc</div>
            <div className="flex">
              {days.map((d, i) => (
                <div key={i} style={{ width: cellWidth }} className={`text-center py-3 text-[10px] font-medium border-l border-outline-variant/30 ${d.getDay()===0||d.getDay()===6?'bg-surface-container-low text-on-surface-variant':'text-on-surface-variant'}`}>
                  {formatDateShort(d)}
                </div>
              ))}
            </div>
          </div>
          {/* Rows */}
          {items.length === 0 ? (
            <div className="text-center py-10 text-sm text-on-surface-variant">Không có dữ liệu timeline</div>
          ) : items.map(t => (
            <div key={t.ID} className="flex border-b border-outline-variant/30 items-center h-10 relative">
              <div className="w-[200px] shrink-0 px-4 text-xs text-on-surface truncate font-medium">{t['Tiêu đề']}</div>
              <div className="relative flex-1 h-full">
                <div className="absolute top-2 h-6 rounded-md text-[10px] text-white font-medium flex items-center px-2 truncate shadow-sm"
                  style={{ left: t.barLeft, width: t.barWidth, background: t.color }}>
                  {t['Tiêu đề']}
                </div>
              </div>
            </div>
          ))}
          {/* Today line */}
          {todayLeft >= 0 && <div className="absolute top-0 bottom-0 w-px bg-error z-20" style={{ left: 200 + todayLeft }} />}
        </div>
      </div>
    </div>
  )
}
