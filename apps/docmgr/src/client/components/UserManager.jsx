import { useState, useEffect } from 'react'
import gasCall from '../gasClient.js'

export default function UserManager({ token }) {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await gasCall('api_getAllData', token)
      // Users are in the central sheet — fetch via dedicated route
      // For now, reuse getAllData; in prod, add api_getUsers
      setUsers([])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleLock(user) {
    try {
      await gasCall('api_lockUser', token, user.ID)
      load()
    } catch (err) { alert(err.message) }
  }

  async function handleUnlock(user) {
    try {
      await gasCall('api_unlockUser', token, user.ID)
      load()
    } catch (err) { alert(err.message) }
  }

  async function handleResetPw(user) {
    const pw = window.prompt(`Mật khẩu mới cho "${user['Tên đăng nhập']}" (tối thiểu 6 ký tự):`)
    if (!pw) return
    try {
      await gasCall('api_adminResetPassword', token, user.ID, pw)
      alert('Đặt lại mật khẩu thành công')
    } catch (err) { alert(err.message) }
  }

  if (loading) return <div className="py-10 text-center text-gray-400">Đang tải...</div>
  if (error)   return <div className="py-10 text-center text-red-500">{error}</div>

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 text-sm text-gray-500">
        Quản lý người dùng được thực hiện trực tiếp trên Central Sheet.<br/>
        Chọn người dùng bên dưới để khóa / mở khóa / đặt lại mật khẩu.
      </div>

      {users.length === 0 && (
        <div className="px-6 py-10 text-center text-gray-400">
          Danh sách người dùng chỉ khả dụng qua Central Sheet.<br/>
          Vui lòng thêm người dùng vào sheet <code>_Người Dùng</code> và cấp quyền trong <code>_Phân Quyền</code>.
        </div>
      )}
    </div>
  )
}
