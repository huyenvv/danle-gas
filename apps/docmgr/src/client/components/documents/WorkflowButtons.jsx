import Icon from '../common/Icon.jsx'
import { getAvailableActions } from '../../lib/workflowPermissions.js'

const COLOR_MAP = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  blue:    'bg-blue-600 text-white hover:bg-blue-700',
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-700',
  amber:   'bg-amber-500 text-white hover:bg-amber-600',
  red:     'bg-red-600 text-white hover:bg-red-700',
}

export default function WorkflowButtons({ doc, session, onAction, disabled, filter }) {
  let actions = getAvailableActions(doc, session)
  if (typeof filter === 'function') actions = actions.filter(filter)
  if (actions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {actions.map(a => (
        <button
          key={a.key}
          type="button"
          data-testid={`action-${a.key}`}
          disabled={disabled}
          onClick={() => onAction(a.key)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium transition-colors disabled:opacity-50 shadow-md3-1 ${COLOR_MAP[a.color] || COLOR_MAP.primary}`}
        >
          <Icon name={a.icon} size={18} />
          {a.label}
        </button>
      ))}
    </div>
  )
}
