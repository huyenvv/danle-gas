import { useState, useEffect, useMemo } from 'react'
import gasCall from '../../gasClient.js'
import { formatDateShort } from '../../utils/format.js'

const COLORS = ['#01458e', '#e87a1e', '#43a047', '#7c3aed', '#e53935', '#00acc1', '#3d5a80']

export default function TimelinePage({ masterData, token }) {
  const [tasks, setTasks] = useState([])
  const [deptFilter, setDeptFilter] = useState('')
  const [today] = useState(() => new Date())
  const [month, setMonth] = useState(() => today.getMonth())
  const [year, setYear] = useState(() => today.getFullYear())

  useEffect(() => {
    const from = new Date(year, month, 1)
    const to = new Date(year, month + 1, 0)
    const iso = (d) => d.toISOString().slice(0, 10)
    gasCall('api_getTasks', token, { departmentId: deptFilter, dateFrom: iso(from), dateTo: iso(to) })
      .then(data => setTasks(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [token, deptFilter, month, year])

  const { days, items, todayLeft, cellWidth } = useMemo(() => {
    const startDate = new Date(year, month, 1)
    const numDays = new Date(year, month + 1, 0).getDate()
    const cw = 40
    const days = []
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startDate); d.setDate(startDate.getDate() + i); days.push(d)
    }

    const items = tasks.filter(t => t['Ngày bắt đầu'] && t['Ngày hết hạn']).map((t, i) => {
      const s = new Date(t['Ngày bắt đầu']), e = new Date(t['Ngày hết hạn'])
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return null
      const diffStart = (s - startDate) / 86400000, diffEnd = (e - startDate) / 86400000
      const left = Math.max(0, diffStart) * cw
      const width = Math.max((Math.min(diffEnd, numDays) - Math.max(diffStart, 0)) * cw, cw)
      if (left > numDays * cw || diffEnd < 0) return null
      return { ...t, barLeft: left, barWidth: width, color: COLORS[i % COLORS.length] }
    }).filter(Boolean)

    const todayDiff = (new Date(today.getFullYear(), today.getMonth(), today.getDate()) - startDate) / 86400000
    const todayLeft = todayDiff >= 0 && todayDiff <= numDays ? todayDiff * cw : -1

    return { days, items, todayLeft, cellWidth: cw }
  }, [tasks, month, year, today])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) } else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) } else setMonth(month + 1)
  }
  const goToday = () => { setMonth(today.getMonth()); setYear(today.getFullYear()) }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20 text-on-surface">
          <option value="">Tất cả phòng/ ban/ NM</option>
          {masterData.phongBan.map(d => <option key={d.ID} value={d.ID}>{d['Tên phòng ban']}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant" title="Tháng trước">
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>
          <strong className="min-w-[140px] text-center text-sm font-semibold text-on-surface">
            Tháng {month + 1} / {year}
          </strong>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant" title="Tháng sau">
            <span className="material-symbols-outlined text-xl">chevron_right</span>
          </button>
          <button onClick={goToday} className="inline-flex items-center gap-1 ml-2 px-3 py-2 bg-surface-container-low rounded-xl text-sm hover:bg-surface-container text-on-surface">
            <span className="material-symbols-outlined text-base">today</span> Hôm Nay
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
        <div style={{ minWidth: days.length * cellWidth + 200 + 'px' }} className="relative">
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
          {todayLeft >= 0 && <div className="absolute top-0 bottom-0 w-px bg-error z-20" style={{ left: 200 + todayLeft }} />}
        </div>
      </div>
    </div>
  )
}
