import Icon from '../common/Icon.jsx'

/**
 * Reusable page header with title, subtitle and optional action button.
 *
 * Props:
 *   icon       — Material Symbol name (e.g. "description")
 *   title      — Page title string
 *   subtitle   — Optional subtitle / description
 *   action     — Optional { label, icon, onClick } for primary CTA
 */
export default function PageHeader({ icon, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon name={icon} size={22} className="text-primary" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold text-on-surface leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-on-surface-variant mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1 shrink-0"
        >
          {action.icon && <Icon name={action.icon} size={18} />}
          {action.label}
        </button>
      )}
    </div>
  )
}
