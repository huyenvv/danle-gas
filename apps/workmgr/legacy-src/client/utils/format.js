export function formatMoney(val) {
  const n = Number(val) || 0
  return n.toLocaleString('vi-VN') + ' ₫'
}

export function formatDate(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN')
}

export function formatDateTime(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateShort(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.getDate() + '/' + (date.getMonth() + 1)
}

export function toInputDate(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.toISOString().substring(0, 10)
}

export function truncate(str, max = 50) {
  if (!str) return ''
  return str.length > max ? str.substring(0, max) + '…' : str
}

export function isOverdue(task) {
  if (!task || task['Trạng thái'] === 'Hoàn Thành') return false
  const d = new Date(task['Ngày hết hạn'])
  return !isNaN(d.getTime()) && d < new Date()
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return mins + ' phút trước'
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours + ' giờ trước'
  const days = Math.floor(hours / 24)
  if (days < 30) return days + ' ngày trước'
  return formatDate(dateStr)
}
