import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import gasCall from '../gasClient.js'

export default function UserManager() {
  const { session } = useAuth()
  const { addToast } = useToast()
  const confirm = useConfirm()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ 'Email': '', 'Phòng ban': '' })
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
      setFormData({ 'Email': '', 'Phòng ban': '' })
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
    setFormData({ 'Email': user['Email'], 'Phòng ban': user['Phòng ban'] })
    setShowForm(true)
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return (u['Tên đăng nhập'] || '').toLowerCase().includes(q)
      || (u['Email'] || '').toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-4xl text-primary animate-pulse">group</span>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-on-surface">Người dùng</h2>
          <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">{users.length}</span>
        </div>
        <button onClick={() => { setEditId(null); setFormData({ 'Email': '', 'Phòng ban': '' }); setShowForm(true) }}
          className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-medium flex items-center gap-2 hover:bg-primary-700 transition">
          <span className="material-symbols-outlined text-lg">person_add</span>
          Thêm
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-outline">search</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
            placeholder="Tìm kiếm..." />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container">
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant">Tên đăng nhập</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant">Phòng ban</th>
                {isOwner && <th className="text-center px-4 py-3 text-xs font-semibold text-on-surface-variant">Quản trị</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant">Trạng thái</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant">Đăng nhập cuối</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.ID} className="border-t border-outline-variant/20 hover:bg-surface-container-low/50 transition">
                  <td className="px-4 py-3 font-medium text-on-surface">{u['Tên đăng nhập']}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{u['Email']}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{u['Phòng ban']}</td>
                  {isOwner && (
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggleAdmin(u.ID, u['Quyền'])}
                        className="p-1 rounded-lg hover:bg-surface-container transition"
                        title={u['Quyền'] === 'Quản trị' ? 'Thu hồi quyền' : 'Cấp quyền Quản trị'}>
                        <span className={`material-symbols-outlined text-lg ${u['Quyền'] === 'Quản trị' ? 'text-primary' : 'text-outline-variant'}`}>
                          {u['Quyền'] === 'Quản trị' ? 'admin_panel_settings' : 'person'}
                        </span>
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                      ${u['Trạng thái'] === 'Locked' ? 'bg-error-container text-on-error-container' : 'bg-green-50 text-green-700'}`}>
                      <span className="material-symbols-outlined text-xs">{u['Trạng thái'] === 'Locked' ? 'lock' : 'check_circle'}</span>
                      {u['Trạng thái'] || 'Active'}
                    </span>
                    {(u['MustChangePass'] === 'TRUE' || u['MustChangePass'] === true) && (
                      <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-tertiary-container text-on-tertiary-container">
                        <span className="material-symbols-outlined text-[10px]">key</span>
                        Đổi pass
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs">{u['Đăng nhập cuối'] || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => startEdit(u)} title="Sửa"
                        className="p-1.5 rounded-lg hover:bg-surface-container transition">
                        <span className="material-symbols-outlined text-lg text-on-surface-variant">edit</span>
                      </button>
                      <button onClick={() => handleResetPassword(u.ID)} title="Reset mật khẩu"
                        className="p-1.5 rounded-lg hover:bg-surface-container transition">
                        <span className="material-symbols-outlined text-lg text-on-surface-variant">lock_reset</span>
                      </button>
                      <button onClick={() => handleLock(u.ID, u['Trạng thái'] === 'Locked')}
                        title={u['Trạng thái'] === 'Locked' ? 'Mở khóa' : 'Khóa'}
                        className="p-1.5 rounded-lg hover:bg-surface-container transition">
                        <span className="material-symbols-outlined text-lg text-on-surface-variant">
                          {u['Trạng thái'] === 'Locked' ? 'lock_open' : 'block'}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-md3-3 w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-on-surface mb-4">
              {editId ? 'Sửa người dùng' : 'Thêm người dùng mới'}
            </h3>
            {!editId && (
              <div className="mb-4 p-3 rounded-xl bg-primary/5 text-xs text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary">info</span>
                Mật khẩu mặc định: <strong>Admin@@123</strong> — Bắt buộc đổi lần đầu đăng nhập.
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Email *</label>
                <input type="email" value={formData['Email']} autoFocus
                  onChange={e => setFormData(f => ({ ...f, 'Email': e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                  placeholder="vd: huyenvv@gmail.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Phòng ban</label>
                <input type="text" value={formData['Phòng ban']}
                  onChange={e => setFormData(f => ({ ...f, 'Phòng ban': e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                  placeholder="vd: Kỹ thuật" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant text-sm font-medium hover:bg-surface-container transition">
                  Hủy
                </button>
                <button type="submit"
                  disabled={saving || !formData['Email']?.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition">
                  {saving ? 'Đang lưu...' : (editId ? 'Cập nhật' : 'Thêm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
