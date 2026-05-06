export function formatCurrency(amount) {
  if (!amount && amount !== 0) return '—'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export function statusColor(status) {
  const map = {
    'Chờ duyệt':     'bg-amber-100 text-amber-800',
    'Chờ xử lý':     'bg-violet-100 text-violet-800',
    'Đang xử lý':    'bg-blue-100 text-blue-800',
    'Hoàn thành':     'bg-emerald-100 text-emerald-800',
  }
  return map[status] || 'bg-surface-container text-on-surface-variant'
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
