/**
 * Calculate deadline status from Ngày kết thúc.
 * Returns null if no date, or { level, daysLeft, label }.
 *
 * level: 'overdue' | 'urgent' (0–3 days) | 'warning' (4–7 days) | 'normal' (>7 days)
 */
export function getDeadlineStatus(ngayKetThuc) {
  if (!ngayKetThuc) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let target
  const s = String(ngayKetThuc).trim()

  // dd/mm/yyyy
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    target = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
  } else {
    // ISO or YYYY-MM-DD
    const d = new Date(s)
    if (isNaN(d.getTime())) return null
    target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24))

  let level, label
  if (diff < 0) {
    level = 'overdue'
    label = `quá hạn ${Math.abs(diff)} ngày`
  } else if (diff === 0) {
    level = 'urgent'
    label = 'hết hạn hôm nay'
  } else if (diff <= 3) {
    level = 'urgent'
    label = `còn ${diff} ngày`
  } else if (diff <= 7) {
    level = 'warning'
    label = `còn ${diff} ngày`
  } else {
    level = 'normal'
    label = ''
  }

  return { level, daysLeft: diff, label }
}
