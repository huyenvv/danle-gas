import { useState, useEffect, useMemo } from 'react'
import gasCall from '../../gasClient.js'
import TaskDetailModal from '../tasks/TaskDetailModal.jsx'

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function dateKey(d) {
  return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()
}

export default function CalendarPage({ masterData, token }) {
  const [today] = useState(() => new Date())
  const [month, setMonth] = useState(() => today.getMonth())
  const [year, setYear] = useState(() => today.getFullYear())
  const [deptFilter, setDeptFilter] = useState('')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setLoading(true)
    // Pre-month and post-month edges may host events visible in the grid; pull
    // ~6 weeks around the focused month so we don't lose those.
    const from = new Date(year, month, 1); from.setDate(from.getDate() - 7)
    const to = new Date(year, month + 1, 0); to.setDate(to.getDate() + 7)
    const iso = (d) => d.toISOString().slice(0, 10)
    gasCall('api_getTasks', token, { departmentId: deptFilter, dateFrom: iso(from), dateTo: iso(to) })
      .then(data => setTasks(Array.isArray(data) ? data : []))
      .catch(e => { console.error('Calendar load:', e); setTasks([]) })
      .finally(() => setLoading(false))
  }, [token, deptFilter, month, year])

  const cells = useMemo(() => {
    const todayK = dateKey(today)
    const first = new Date(year, month, 1)
    const startDay = first.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prevDays = new Date(year, month, 0).getDate()

    const eventsByKey = {}
    tasks.forEach(t => {
      if (t['Ngày bắt đầu']) {
        const s = new Date(t['Ngày bắt đầu'])
        if (!isNaN(s.getTime())) {
          const k = dateKey(s)
          ;(eventsByKey[k] = eventsByKey[k] || []).push({ title: t['Tiêu đề'], type: 'task', task: t })
        }
      }
      if (t['Ngày hết hạn'] && t['Trạng thái'] !== 'Hoàn Thành') {
        const e = new Date(t['Ngày hết hạn'])
        if (!isNaN(e.getTime())) {
          const k = dateKey(e)
          ;(eventsByKey[k] = eventsByKey[k] || []).push({ title: t['Tiêu đề'], type: 'deadline', task: t })
        }
      }
    })

    const arr = []
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevDays - i)
      arr.push({ date: d, day: d.getDate(), isOtherMonth: true, isToday: false, events: [] })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d)
      const k = dateKey(dt)
      arr.push({ date: dt, day: d, isOtherMonth: false, isToday: k === todayK, events: eventsByKey[k] || [] })
    }
    const remaining = (7 - (arr.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      arr.push({ date: d, day: d.getDate(), isOtherMonth: true, isToday: false, events: [] })
    }
    return arr
  }, [tasks, month, year, today])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }
  const goToday = () => {
    setMonth(today.getMonth())
    setYear(today.getFullYear())
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="min-w-0 px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
        >
          <option value="">Tất cả phòng ban</option>
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

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-outline-variant">
          {DAY_LABELS.map(day => (
            <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-on-surface-variant border-r border-outline-variant last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => (
            <div
              key={idx}
              className={`min-h-[100px] p-1.5 border-r border-b border-outline-variant ${
                (idx + 1) % 7 === 0 ? 'border-r-0' : ''
              } ${cell.isOtherMonth ? 'bg-surface-container-low/40' : 'bg-white'} ${
                cell.isToday ? 'bg-primary-50' : ''
              }`}
            >
              <div className={`text-xs font-semibold mb-1 ${
                cell.isOtherMonth ? 'text-on-surface-variant/50' : cell.isToday ? 'text-primary' : 'text-on-surface'
              }`}>
                {cell.day}
              </div>
              {cell.events.slice(0, 3).map((evt, ei) => (
                <button
                  key={ei}
                  onClick={() => setSelected(evt.task)}
                  title={(evt.type === 'deadline' ? '⏰ ' : '') + evt.title}
                  className={`block w-full text-left truncate text-[10px] leading-tight px-1.5 py-1 mb-0.5 rounded font-medium ${
                    evt.type === 'deadline'
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  {evt.type === 'deadline' ? '⏰ ' : ''}{evt.title}
                </button>
              ))}
              {cell.events.length > 3 && (
                <div className="text-[10px] text-on-surface-variant/70 px-1.5">
                  +{cell.events.length - 3} khác
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-center text-on-surface-variant text-sm">Đang tải…</div>
      )}

      {selected && (
        <TaskDetailModal
          task={selected}
          token={token}
          users={masterData.users}
          labels={masterData.nhan}
          departments={masterData.phongBan}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
