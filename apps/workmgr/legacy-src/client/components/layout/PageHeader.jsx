export default function PageHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 22 }}>{icon}</span>
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold text-on-surface leading-tight">{title}</h2>
        {subtitle && <p className="text-sm text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
