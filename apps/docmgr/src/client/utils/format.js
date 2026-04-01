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
    'Hiệu lực':      'bg-green-100 text-green-800',
    'Hết hạn':       'bg-red-100 text-red-800',
    'Sắp hết hạn':   'bg-yellow-100 text-yellow-800',
    'Chờ duyệt':     'bg-blue-100 text-blue-800',
    'Đã thanh lý':   'bg-gray-100 text-gray-600',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
