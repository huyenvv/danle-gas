import { useState, useEffect } from 'react'
import gasCall from '../../gasClient.js'
import { useToast } from '../../context/ToastContext.jsx'

const ROLES = ['admin', 'Giám đốc', 'Trưởng phòng', 'Nhân viên', 'Xem']

export default function UserManager({ token }) {
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    setLoading(true)
    gasCall('api_getUsers', token)
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [token])

  const handleRoleChange = async (user, newRole) => {
    setSaving(user.ID)
    try {
      await gasCall('api_updateUser', token, user.ID, { 'Quyền': newRole, 'Tên đăng nhập': user['Tên đăng nhập'] })
      setUsers(prev => prev.map(u => String(u.ID) === String(user.ID) ? { ...u, 'Quyền': newRole } : u))
      showToast('Đã cập nhật quyền', 'success')
    } catch (e) { showToast(e.message, 'error') }
    setSaving(null)
  }

  const handleRemove = async (user) => {
    setSaving(user.ID)
    try {
      await gasCall('api_removeUserRole', token, user.ID)
      setUsers(prev => prev.map(u => String(u.ID) === String(user.ID) ? { ...u, 'Quyền': '' } : u))
      showToast('Đã xóa quyền', 'success')
    } catch (e) { showToast(e.message, 'error') }
    setSaving(null)
  }

  return (
    <div className="space-y-4">
      {loading ? <div className="text-center py-10 text-sm text-on-surface-variant">Đang tải…</div> : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-container-low text-on-surface-variant text-xs">
              <th className="px-4 py-3 text-left font-medium">Tên đăng nhập</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Quyền</th>
              <th className="px-4 py-3 text-center font-medium w-16"></th>
            </tr></thead>
            <tbody className="divide-y divide-outline-variant/50">
              {users.map(u => (
                <tr key={u.ID} className="hover:bg-surface-container-low/50">
                  <td className="px-4 py-3 font-medium text-on-surface">{u['Tên nhân viên'] || u['Tên đăng nhập']}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{u['Email']}</td>
                  <td className="px-4 py-3">
                    <select value={u['Quyền'] || ''} onChange={e => handleRoleChange(u, e.target.value)} disabled={saving === u.ID}
                      className="px-2 py-1.5 bg-surface-container rounded-lg text-xs border-none outline-none disabled:opacity-50">
                      <option value="">-- Chưa cấp --</option>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u['Quyền'] && (
                      <button onClick={() => handleRemove(u)} disabled={saving === u.ID} className="p-1 rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error disabled:opacity-50">
                        <span className="material-symbols-outlined text-base">person_remove</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
