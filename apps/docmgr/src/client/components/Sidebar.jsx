import Icon from './common/Icon.jsx'
import CreateMenu from './CreateMenu.jsx'

const NAV_ITEMS = [
  { key: 'documents',   icon: 'description',   label: 'Hồ sơ',         admin: false, superAdmin: false },
  { key: 'categories',  icon: 'folder_open',   label: 'Danh mục',      admin: false, superAdmin: false, hiddenRoles: ['Văn thư'] },
  { key: 'groups',      icon: 'groups',        label: 'Nhóm',          admin: true,  superAdmin: false },
  { key: 'suppliers',   icon: 'send',           label: 'NCC / Nơi gửi',   admin: false, superAdmin: false },
  { key: 'projects',    icon: 'apartment',      label: 'Dự án / Nơi nhận', admin: false, superAdmin: false },
  { key: 'users',       icon: 'group',         label: 'Người dùng',    admin: true,  superAdmin: false },
  { key: 'auditlogs',   icon: 'history',       label: 'Nhật ký',       admin: true,  superAdmin: false },
  { key: 'settings',    icon: 'settings',      label: 'Cài đặt',       admin: false, superAdmin: true  },
]

export default function Sidebar({ page, onPage, isAdmin, isSuperAdmin, onCreateDoc, onImport, collapsed, role, canCreateSubCat, canCreateRootCat }) {
  const limitedDocOnlyRoles = ['Nhân viên', 'Trưởng phòng']
  const canSeeCategories = canCreateSubCat || canCreateRootCat
  const visibleItems = NAV_ITEMS.filter(item => {
    if (limitedDocOnlyRoles.includes(role)) {
      if (item.key === 'documents') return true
      if (item.key === 'categories' && canSeeCategories) return true
      return false
    }
    // Role bị ẩn "Danh mục" (vd Văn thư) vẫn thấy khi được cấp quyền tạo danh mục con/cha
    if (item.key === 'categories' && item.hiddenRoles && item.hiddenRoles.includes(role)) {
      return canSeeCategories
    }
    return (!item.admin || isAdmin) && (!item.superAdmin || isSuperAdmin) && (!item.hiddenRoles || !item.hiddenRoles.includes(role))
  })

  return (
    <aside
      className={`${collapsed ? 'w-[72px]' : 'w-64'} transition-all duration-300 ease-in-out bg-surface-container-low border-r border-outline-variant flex flex-col shrink-0 overflow-hidden`}
    >
      {/* Brand */}
      <div className={`flex items-center gap-3 h-14 border-b border-outline-variant shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-500 flex items-center justify-center shrink-0">
          <Icon name="description" size={18} className="text-on-primary" />
        </div>
        {!collapsed && (
          <span className="font-bold text-sm text-on-surface leading-tight truncate">
            Quản Lý <span className="text-primary">Tài Liệu</span>
          </span>
        )}
      </div>

      {/* "Tạo hồ sơ mới" CTA — split button with import dropdown */}
      {(onCreateDoc || onImport) && (
        <div className={`pt-4 pb-2 shrink-0 ${collapsed ? 'px-2' : 'px-3'}`}>
          <CreateMenu onCreate={onCreateDoc} onImport={onImport} collapsed={collapsed} />
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

