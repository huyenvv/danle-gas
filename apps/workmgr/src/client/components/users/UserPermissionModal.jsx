import { useState, useEffect } from 'react'

const ROLES = [
  { value: 'admin', label: 'Quản trị viên (Admin)', hint: 'Toàn quyền hệ thống' },
  { value: 'Giám đốc', label: 'Giám đốc', hint: 'Xem & thao tác tất cả phòng ban' },
  { value: 'Trưởng phòng', label: 'Trưởng phòng / Phó phòng', hint: 'Quản lý phòng được giao' },
  { value: 'Nhân viên', label: 'Nhân viên', hint: 'Thao tác trên việc được giao' },
  { value: 'Xem', label: 'Chỉ xem', hint: 'Không sửa được gì' },
]

export default function UserPermissionModal({ user, onSave, onClose }) {
  const [role, setRole] = useState(user?.['Quyền'] || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setRole(user?.['Quyền'] || '') }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await onSave({ 'Quyền': role, 'Tên đăng nhập': user['Tên đăng nhập'] })
    setSaving(false)
  }

  if (!user) return null
  const name = user['Tên nhân viên'] || user['Tên đăng nhập']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-md3-3 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <h2 className="text-lg font-bold text-on-surface">Phân quyền người dùng</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* User info (read-only) */}
          <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-2xl">
            <div className="w-11 h-11 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-base flex-shrink-0">
              {String(name)[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-on-surface truncate">{name}</div>
              <div className="text-xs text-on-surface-variant truncate">{user['Email'] || user['Tên đăng nhập']}</div>
            </div>
          </div>

          {/* Role select — radio cards */}
          <div>
            <label className="text-xs font-medium text-on-surface-variant mb-2 block">Vai trò</label>
            <div className="space-y-2">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${role === '' ? 'bg-error-container/40 border-error/40' : 'bg-surface-container-low border-outline-variant/40 hover:border-outline-variant'}`}>
                <input type="radio" name="role" value="" checked={role === ''} onChange={() => setRole('')} className="mt-0.5 accent-error" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-on-surface">Chưa cấp quyền</div>
                  <div className="text-xs text-on-surface-variant">Người dùng không truy cập được app</div>
                </div>
              </label>
              {ROLES.map(r => (
                <label key={r.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${role === r.value ? 'bg-primary-container/40 border-primary/40' : 'bg-surface-container-low border-outline-variant/40 hover:border-outline-variant'}`}>
                  <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="mt-0.5 accent-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-on-surface">{r.label}</div>
                    <div className="text-xs text-on-surface-variant">{r.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-full">
              Hủy
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-sm font-medium bg-accent text-white rounded-full hover:bg-accent-hover disabled:opacity-50 shadow-md3-1">
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
