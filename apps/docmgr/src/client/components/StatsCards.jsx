import { formatCurrency } from '../utils/format.js'

export default function StatsCards({ stats }) {
  if (!stats) return null
  const cards = [
    { label: 'Tổng hồ sơ',       value: stats.total.toLocaleString('vi-VN'),     color: 'bg-blue-500' },
    { label: 'Tổng giá trị HĐ',  value: formatCurrency(stats.totalValue),        color: 'bg-indigo-500' },
    { label: 'Đã thực hiện',      value: formatCurrency(stats.totalExecuted),     color: 'bg-green-500' },
    { label: 'Chênh lệch',        value: formatCurrency(stats.totalDiff),         color: stats.totalDiff >= 0 ? 'bg-emerald-500' : 'bg-red-500' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
          <div className={`w-12 h-12 ${card.color} rounded-xl`} />
          <div>
            <p className="text-xs text-gray-500 font-medium">{card.label}</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
