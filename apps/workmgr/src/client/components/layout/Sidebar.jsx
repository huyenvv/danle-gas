import { useAuth } from '../../context/AuthContext.jsx'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tổng Quan', icon: 'dashboard' },
  { id: 'projects', label: 'Dự Án', icon: 'folder_open' },
  { id: 'kanban', label: 'Kanban', icon: 'view_kanban' },
  { id: 'tasks', label: 'Công Việc', icon: 'task_alt' },
  { id: 'timeline', label: 'Timeline', icon: 'timeline', adminOnly: true },
  { id: 'activities', label: 'Hoạt Động', icon: 'history', adminOnly: true },
  { id: 'labels', label: 'Nhãn', icon: 'label', adminOnly: true },
  { id: 'users', label: 'Phân Quyền', icon: 'manage_accounts', adminOnly: true },
]

const ADMIN_ROLES = ['admin', 'Quản trị viên', 'Giám đốc']

export default function Sidebar({ currentView, onNavigate, collapsed, onToggle }) {
  const { session } = useAuth()
  const isAdmin = ADMIN_ROLES.includes(session?.role)
  const items = NAV_ITEMS.filter(i => !i.adminOnly || isAdmin)

  return (
    <aside className={`${collapsed ? 'w-[72px]' : 'w-64'} transition-all duration-300 ease-in-out bg-surface-container-low border-r border-outline-variant flex flex-col shrink-0 overflow-hidden`}>
      <div className={`flex items-center gap-3 h-14 border-b border-outline-variant shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-primary text-[18px] icon-filled">task_alt</span>
        </div>
        {!collapsed && (
          <span className="font-bold text-sm text-on-surface leading-tight truncate">
            Quản Lý <span className="text-primary">Công Việc</span>
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {items.map(item => {
          const active = currentView === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`sidebar-nav-item w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium ${collapsed ? 'justify-center px-2 gap-0' : 'px-3'} ${
                active
                  ? 'active bg-white text-primary shadow-md3-1'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className={`material-symbols-outlined text-xl ${active ? 'icon-filled text-primary' : 'text-on-surface-variant'}`}>{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
