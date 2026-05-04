import Icon from './common/Icon.jsx'

const NAV_ITEMS = [
  { key: 'documents',   icon: 'description',   label: 'Hồ sơ',         admin: false, superAdmin: false },
  { key: 'categories',  icon: 'folder_open',   label: 'Danh mục',      admin: false, superAdmin: false, hiddenRoles: ['Văn thư'] },
  { key: 'groups',      icon: 'groups',        label: 'Nhóm',          admin: true,  superAdmin: false },
  { key: 'suppliers',   icon: 'inventory_2',   label: 'Nhà cung cấp',  admin: false, superAdmin: false },
  { key: 'projects',    icon: 'account_tree',  label: 'Dự án',         admin: false, superAdmin: false },
  { key: 'users',       icon: 'group',         label: 'Người dùng',    admin: true,  superAdmin: false },
  { key: 'auditlogs',   icon: 'history',       label: 'Nhật ký',       admin: true,  superAdmin: false },
  { key: 'settings',    icon: 'settings',      label: 'Cài đặt',       admin: false, superAdmin: true  },
]

export default function Sidebar({ page, onPage, isAdmin, isSuperAdmin, onCreateDoc, collapsed, role }) {
  const limitedDocOnlyRoles = ['Nhân viên', 'Trưởng phòng']
  const visibleItems = NAV_ITEMS.filter(item => {
    if (limitedDocOnlyRoles.includes(role)) return item.key === 'documents'
    return (!item.admin || isAdmin) && (!item.superAdmin || isSuperAdmin) && (!item.hiddenRoles || !item.hiddenRoles.includes(role))
  })

  return (
    <aside
      className={`${collapsed ? 'w-[72px]' : 'w-64'} transition-all duration-300 ease-in-out bg-surface-container-low border-r border-outline-variant flex flex-col shrink-0 overflow-hidden`}
    >
      {/* Brand */}
      <div className={`flex items-center gap-3 h-14 border-b border-outline-variant shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Icon name="folder_special" size={18} className="text-on-primary" />
        </div>
        {!collapsed && (
          <span className="font-bold text-sm text-on-surface leading-tight truncate">
            Quản Lý <span className="text-primary">Tài Liệu</span>
          </span>
        )}
      </div>

      {/* "Tạo hồ sơ mới" CTA — only shown when user has create permission */}
      {onCreateDoc && (
        <div className={`pt-4 pb-2 shrink-0 ${collapsed ? 'px-2' : 'px-3'}`}>
          <button
            onClick={onCreateDoc}
            title="Tạo hồ sơ mới"
            className={`w-full flex items-center gap-2 bg-primary text-on-primary rounded-full py-2.5 font-medium text-sm hover:bg-primary-700 transition-colors shadow-md3-2 ${collapsed ? 'justify-center px-0' : 'px-4'}`}
          >
            <Icon name="add" size={18} />
            {!collapsed && <span>Tạo hồ sơ mới</span>}
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {visibleItems.map(item => {
          const isActive = page === item.key
          return (
            <button
              key={item.key}
              onClick={() => onPage(item.key)}
              title={collapsed ? item.label : undefined}
              className={`sidebar-nav-item w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium ${collapsed ? 'justify-center px-2 gap-0' : 'px-3'} ${
                isActive
                  ? 'active bg-white text-primary shadow-md3-1'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <Icon name={item.icon} size={20} filled={isActive} className={isActive ? 'text-primary' : 'text-on-surface-variant'} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

