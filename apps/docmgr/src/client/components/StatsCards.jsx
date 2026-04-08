import { formatCurrency } from '../utils/format.js'

const CARD_STYLES = [
  { icon: 'folder_copy',    bg: 'bg-primary/10',   icon_color: 'text-primary',      val_color: 'text-primary'      },
  { icon: 'payments',       bg: 'bg-secondary/10', icon_color: 'text-secondary',    val_color: 'text-secondary'    },
  { icon: 'task_alt',       bg: 'bg-emerald-50',   icon_color: 'text-emerald-600',  val_color: 'text-emerald-700'  },
  { icon: 'trending_up',    bg: 'bg-amber-50',     icon_color: 'text-amber-600',    val_color: 'text-amber-700'    },
]

export default function StatsCards({ stats }) {
  if (!stats) return null
  const isDiffPositive = stats.totalDiff >= 0
  const cards = [
    { label: 'Tổng hồ sơ',       value: stats.total.toLocaleString('vi-VN') },
    { label: 'Tổng giá trị HĐ',  value: formatCurrency(stats.totalValue) },
    { label: 'Đã thực hiện',      value: formatCurrency(stats.totalExecuted) },
    { label: 'Chênh lệch',        value: formatCurrency(stats.totalDiff),
      overrideStyle: !isDiffPositive ? { bg: 'bg-error-container', icon_color: 'text-error', val_color: 'text-error', icon: 'trending_down' } : null },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const s = card.overrideStyle || CARD_STYLES[i]
        return (
          <div key={card.label} className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-4">
            <div className={`w-11 h-11 ${s.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                {s.icon}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-on-surface-variant font-medium">{card.label}</p>
              <p className={`text-base font-bold mt-0.5 truncate ${s.val_color}`}>{card.value}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

