import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import gasCall from '../gasClient.js'

function viNormalize(str) {
  return (str == null ? '' : String(str))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
}

function Icon({ name, size = 20, className = '', filled = false }) {
  return (
    <span className={`material-symbols-outlined ${className}`}
      style={{ fontSize: size, fontVariationSettings: filled ? '"FILL" 1' : '"FILL" 0' }}>
      {name}
    </span>
  )
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    primary: { bg: 'bg-primary/10', icon: 'text-primary', val: 'text-primary' },
    green: { bg: 'bg-emerald-50', icon: 'text-emerald-600', val: 'text-emerald-700' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', val: 'text-amber-700' },
  }
  const c = colors[color] || colors.primary
  return (
    <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
        <Icon name={icon} size={22} className={c.icon} />
      </div>
      <div>
        <p className="text-xs text-on-surface-variant mb-0.5">{label}</p>
        <p className={`text-2xl font-bold ${c.val}`}>{value}</p>
      </div>
    </div>
  )
}

export default function UserManager() {
  const { session } = useAuth()
  const { addToast } = useToast()
  const confirm = useConfirm()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ 'Email': '', 'Tên nhân viên': '', 'Phòng ban': '' })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')

  const isOwner = session.isOwner === true

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    try {
      const data = await gasCall('api_getUsers', session.token)
      setUsers(data)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData['Email']?.trim()) return
    setSaving(true)
    try {
      if (editId) {
        await gasCall('api_updateUser', session.token, editId, formData)
        addToast('Cập nhật thành công', 'success')
      } else {
        await gasCall('api_addUser', session.token, formData)
        addToast('Thêm người dùng thành công. Mật khẩu mặc định: Admin@@123', 'success')
      }
      setShowForm(false)
      setEditId(null)
      setFormData({ 'Email': '', 'Tên nhân viên': '', 'Phòng ban': '' })
      await loadUsers()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleLock(userId, locked) {
    const action = locked ? 'mở khóa' : 'khóa'
    if (!await confirm(`Bạn có chắc muốn ${action} tài khoản này?`)) return
    try {
      if (locked) {
        await gasCall('api_unlockUser', session.token, userId)
        addToast('Đã mở khóa tài khoản', 'success')
      } else {
        await gasCall('api_lockUser', session.token, userId)
        addToast('Đã khóa tài khoản', 'success')
      }
      await loadUsers()
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  async function handleResetPassword(userId) {
    if (!await confirm('Reset mật khẩu về mặc định (Admin@@123)?')) return
    try {
      await gasCall('api_adminResetPassword', session.token, userId)
      addToast('Đã reset mật khẩu về mặc định', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  async function handleToggleAdmin(userId, currentQuyen) {
    const newQuyen = currentQuyen === 'Quản trị' ? '' : 'Quản trị'
    const action = newQuyen ? 'cấp quyền Quản trị cho' : 'thu hồi quyền Quản trị của'
    if (!await confirm(`${action} tài khoản này?`)) return
    try {
      await gasCall('api_updateUser', session.token, userId, { 'Quyền': newQuyen })
      addToast(newQuyen ? 'Đã cấp quyền Quản trị' : 'Đã thu hồi quyền Quản trị', 'success')
      await loadUsers()
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  function startEdit(user) {
    setEditId(user.ID)
    setFormData({ 'Email': user['Email'], 'Tên nhân viên': user['Tên nhân viên'] || '', 'Phòng ban': user['Phòng ban'] })
    setShowForm(true)
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const q = viNormalize(search)
    return viNormalize(u['Tên đăng nhập']).includes(q)
      || viNormalize(u['Email']).includes(q)
      || viNormalize(u['Tên nhân viên']).includes(q)
      || viNormalize(u['Phòng ban']).includes(q)
  })

  const activeCount = users.filter(u => u['Trạng thái'] !== 'Locked').length
  const lockedCount = users.filter(u => u['Trạng thái'] === 'Locked').length
  const avatar = (name) => (name || '?')[0].toUpperCase()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-on-surface-variant">
          <Icon name="sync" size={32} className="animate-spin" />
          <span className="text-sm">Đang tải...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="group" label="Tổng người dùng" value={users.length} color="primary" />
        <StatCard icon="check_circle" label="Đang hoạt động" value={activeCount} color="green" />
        <StatCard icon="lock" label="Đã khóa" value={lockedCount} color="amber" />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input
            className="w-full bg-surface-container-low border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Tìm kiếm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-on-surface-variant">{filtered.length} người dùng</span>
        <button onClick={() => { setEditId(null); setFormData({ 'Email': '', 'Tên nhân viên': '', 'Phòng ban': '' }); setShowForm(true) }}
          className="ml-auto flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1">
          <Icon name="person_add" size={18} />
          Thêm người dùng
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Người dùng</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Phòng ban</th>
                {isOwner && <th className="px-4 py-3 text-center font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Quản trị</th>}
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Trạng thái</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Đăng nhập cuối</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {filtered.length === 0 && (
                <tr><td colSpan={isOwner ? 6 : 5} className="px-4 py-10 text-center text-on-surface-variant">Không tìm thấy người dùng</td></tr>
              )}
              {filtered.map(u => (
                <tr key={u.ID} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">{avatar(u['Tên đăng nhập'])}</span>
                      </div>
                      <div>
                        <p className="font-medium text-on-surface">{u['Tên nhân viên'] || u['Tên đăng nhập']}</p>
                        <p className="text-xs text-on-surface-variant">{u['Email']}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{u['Phòng ban'] || '—'}</td>
                  {isOwner && (
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggleAdmin(u.ID, u['Quyền'])}
                        className="p-1.5 rounded-lg hover:bg-surface-container transition-colors"
                        title={u['Quyền'] === 'Quản trị' ? 'Thu hồi quyền' : 'Cấp quyền Quản trị'}>
                        <Icon name={u['Quyền'] === 'Quản trị' ? 'admin_panel_settings' : 'person'} size={20}
                          className={u['Quyền'] === 'Quản trị' ? 'text-primary' : 'text-on-surface-variant/40'} />
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u['Trạng thái'] === 'Locked'
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u['Trạng thái'] === 'Locked' ? 'bg-error' : 'bg-emerald-500'}`} />
                      {u['Trạng thái'] === 'Locked' ? 'Đã khóa' : 'Hoạt động'}
                    </span>
                    {(u['MustChangePass'] === 'TRUE' || u['MustChangePass'] === true) && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                        <Icon name="key" size={10} />
                        Đổi pass
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs">{u['Đăng nhập cuối'] || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => startEdit(u)} title="Sửa"
                        className="text-xs px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors font-medium">Sửa</button>
                      <button onClick={() => handleResetPassword(u.ID)} title="Reset mật khẩu"
                        className="text-xs px-2.5 py-1 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors font-medium">Reset</button>
                      <button onClick={() => handleLock(u.ID, u['Trạng thái'] === 'Locked')}
                        title={u['Trạng thái'] === 'Locked' ? 'Mở khóa' : 'Khóa'}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                          u['Trạng thái'] === 'Locked'
                            ? 'text-emerald-700 hover:bg-emerald-50'
                            : 'text-error hover:bg-error/10'
                        }`}>
                        {u['Trạng thái'] === 'Locked' ? 'Mở khóa' : 'Khóa'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/40 bg-surface-container-lowest">
            <span className="text-xs text-on-surface-variant">{filtered.length} / {users.length} người dùng</span>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.2)] w-full max-w-md flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/40">
              <div className="flex items-center gap-2">
                <Icon name={editId ? 'edit' : 'person_add'} size={20} className="text-primary" />
                <span className="font-semibold text-on-surface text-sm">{editId ? 'Sửa người dùng' : 'Thêm người dùng mới'}</span>
              </div>
              <button onClick={() => { setShowForm(false); setEditId(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors">
                <Icon name="close" size={20} className="text-on-surface-variant" />
              </button>
            </div>
            <div className="px-6 py-5">
              {!editId && (
                <div className="mb-4 p-3 rounded-xl bg-primary/5 text-xs text-on-surface-variant flex items-center gap-2">
                  <Icon name="info" size={16} className="text-primary shrink-0" />
                  Mật khẩu mặc định: <strong>Admin@@123</strong> — Bắt buộc đổi lần đầu đăng nhập.
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">Email *</label>
                  <input type="email" value={formData['Email']} autoFocus
                    onChange={e => setFormData(f => ({ ...f, 'Email': e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                    placeholder="vd: huyenvv@gmail.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">Tên nhân viên</label>
                  <input type="text" value={formData['Tên nhân viên']}
                    onChange={e => setFormData(f => ({ ...f, 'Tên nhân viên': e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                    placeholder="vd: Nguyễn Văn A" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">Phòng ban</label>
                  <input type="text" value={formData['Phòng ban']}
                    onChange={e => setFormData(f => ({ ...f, 'Phòng ban': e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                    placeholder="vd: Kỹ thuật" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
                    className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant text-sm font-medium hover:bg-surface-container transition-colors">
                    Hủy
                  </button>
                  <button type="submit"
                    disabled={saving || !formData['Email']?.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-md3-1">
                    {saving ? 'Đang lưu...' : (editId ? 'Cập nhật' : 'Thêm')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
