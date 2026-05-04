export default function StatsCards({ stats }) {
  if (!stats) return null

  const statusCards = [
    { label: 'Chờ duyệt',  icon: 'pending',     bg: 'bg-amber-50',    val_color: 'text-amber-700' },
    { label: 'Chờ xử lý',  icon: 'schedule',    bg: 'bg-primary/10',  val_color: 'text-primary' },
    { label: 'Đang xử lý', icon: 'sync',        bg: 'bg-blue-50',     val_color: 'text-blue-700' },
    { label: 'Hoàn thành',  icon: 'task_alt',    bg: 'bg-emerald-50',  val_color: 'text-emerald-700' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statusCards.map(card => (
        <div key={card.label} className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-4">
          <div className={`w-11 h-11 ${card.bg} rounded-xl flex items-center justify-center shrink-0`}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
              {card.icon}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-on-surface-variant font-medium">{card.label}</p>
            <p className={`text-base font-bold mt-0.5 truncate ${card.val_color}`}>{stats.byStatus?.[card.label] || 0}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

