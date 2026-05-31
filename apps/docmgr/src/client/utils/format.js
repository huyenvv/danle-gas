export function formatCurrency(amount) {
  if (!amount && amount !== 0) return '—'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)
}

function _parseDateParts(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return {
    dd:   String(d.getDate()).padStart(2, '0'),
    mm:   String(d.getMonth() + 1).padStart(2, '0'),
    yyyy: d.getFullYear(),
    HH:   String(d.getHours()).padStart(2, '0'),
    MM:   String(d.getMinutes()).padStart(2, '0'),
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const p = _parseDateParts(dateStr)
    return p ? `${p.dd}/${p.mm}/${p.yyyy}` : dateStr
  } catch { return dateStr }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  try {
    const p = _parseDateParts(dateStr)
    return p ? `${p.dd}/${p.mm}/${p.yyyy} ${p.HH}:${p.MM}` : dateStr
  } catch { return dateStr }
}

export function statusColor(status) {
  const map = {
    'Nháp':           'bg-gray-100 text-gray-600 border border-dashed border-gray-400',
    'Chờ duyệt':     'bg-amber-100 text-amber-800',
    'Chờ xử lý':     'bg-violet-100 text-violet-800',
    'Đang xử lý':    'bg-blue-100 text-blue-800',
    'Hoàn thành':     'bg-emerald-100 text-emerald-800',
    'Từ chối':            'bg-red-100 text-red-800',
    'Chờ xác nhận HT':   'bg-teal-100 text-teal-800',
    'Từ chối kết quả':    'bg-rose-100 text-rose-800',
  }
  return map[status] || 'bg-surface-container text-on-surface-variant'
}

const STATUS_TOOLTIPS = {
  'Chờ xác nhận HT': 'Chờ xác nhận hoàn thành',
}
export function statusTooltip(status) {
  return STATUS_TOOLTIPS[status] || ''
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
