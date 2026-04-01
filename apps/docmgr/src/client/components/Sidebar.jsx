export default function Sidebar({ page, onPage, isAdmin, onLogout }) {
  const items = [
    { id: 'documents',  label: 'Hồ sơ',         icon: '📄' },
    { id: 'categories', label: 'Danh mục',       icon: '🗂️' },
    ...(isAdmin ? [{ id: 'users',    label: 'Người dùng', icon: '👥' }] : []),
    ...(isAdmin ? [{ id: 'settings', label: 'Cài đặt',    icon: '⚙️' }] : []),
  ]

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-gray-700">
        <span className="font-bold text-base leading-tight">Quản Lý<br/>Tài Liệu</span>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-3">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              page === item.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-700">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <span>🚪</span>
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  )
}
