import { useState, useEffect, useMemo } from 'react'
import gasCall from '../../gasClient.js'
import { mutate } from '../../utils/mutate.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useConfirm } from '../../context/ConfirmContext.jsx'

const ROLE_OPTIONS = ['admin', 'Giám đốc', 'Trưởng phòng', 'Nhân viên']

const ROLE_BADGE = {
  'admin':         'bg-primary/10 text-primary',
  'Giám đốc':      'bg-violet-100 text-violet-700',
  'Trưởng phòng': 'bg-surface-container text-on-surface-variant',
  'Nhân viên':    'bg-surface-container text-on-surface-variant',
}

export default function UserManager({ token }) {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [role, setRole] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = () => {
    setLoading(true)
    gasCall('api_getUsers', token)
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [token])

  function openEdit(user) {
    setRole(user['Quyền'] || '')
    setModal(user)
  }

  function closeModal() { setModal(null) }

  const handleSave = async () => {
    if (!modal) return
    setSaving(true)
    try {
      await mutate('api_updateUser', token, modal.ID, { 'Quyền': role, 'Tên đăng nhập': modal['Tên đăng nhập'] })
      setUsers(prev => prev.map(u => String(u.ID) === String(modal.ID) ? { ...u, 'Quyền': role } : u))
      showToast(role ? 'Đã cập nhật quyền' : 'Đã thu hồi quyền', 'success')
      closeModal()
    } catch (e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const handleRemove = async (user) => {
    const ok = await confirm('Thu hồi quyền', `Thu hồi quyền của "${user['Tên nhân viên'] || user['Tên đăng nhập']}"?`)
    if (!ok) return
    try {
      await mutate('api_removeUserRole', token, user.ID)
      setUsers(prev => prev.map(u => String(u.ID) === String(user.ID) ? { ...u, 'Quyền': '' } : u))
      showToast('Đã thu hồi quyền', 'success')
    } catch (e) { showToast(e.message, 'error') }
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return (u['Tên nhân viên'] || '').toLowerCase().includes(q) ||
           (u['Tên đăng nhập'] || '').toLowerCase().includes(q) ||
           (u['Email'] || '').toLowerCase().includes(q)
  })

  const stats = useMemo(() => ({
    total: users.length,
    assigned: users.filter(u => u['Quyền']).length,
    unassigned: users.filter(u => !u['Quyền']).length,
  }), [users])

  const avatar = (name) => (name || '?')[0].toUpperCase()

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon="group" label="Tổng users (SSO)" value={stats.total} color="primary" />
        <StatCard icon="shield_person" label="Đã phân quyền" value={stats.assigned} color="green" />
        <StatCard icon="person_off" label="Chưa phân quyền" value={stats.unassigned} color="amber" />
      </div>

      {/* Info banner */}
      <div className="bg-primary/5 rounded-2xl p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-primary mt-0.5 shrink-0" style={{ fontSize: 20 }}>info</span>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Người dùng được quản lý từ <strong>SSO Portal</strong>. Tại đây bạn chỉ phân quyền truy cập cho ứng dụng này.
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" style={{ fontSize: 18 }}>search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên, email..."
            className="w-full bg-surface-container-low border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <span className="text-xs text-on-surface-variant whitespace-nowrap">{filtered.length} người dùng</span>
        <button onClick={reload} title="Làm mới" className="ml-auto w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container border border-outline-variant transition-colors">
          <span className="material-symbols-outlined text-base leading-none">refresh</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead><tr className="bg-surface-container-low border-b border-outline-variant">
            <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Người dùng</th>
            <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Quyền</th>
            <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Trạng thái (SSO)</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-outline-variant/40">
            {loading && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin inline-block mr-2" style={{ fontSize: 18 }}>sync</span>Đang tải...
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-on-surface-variant">Không tìm thấy người dùng</td></tr>
            )}
            {!loading && filtered.map(u => {
              const name = u['Tên nhân viên'] || u['Tên đăng nhập']
              return (
                <tr key={u.ID} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">{avatar(name)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-on-surface">{name}</p>
                        <p className="text-xs text-on-surface-variant">{u['Email'] || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u['Quyền'] ? (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u['Quyền']] || 'bg-surface-container text-on-surface-variant'}`}>{u['Quyền']}</span>
                    ) : (
                      <span className="text-xs text-on-surface-variant italic">Chưa phân quyền</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u['Trạng thái'] === 'Active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-error-container text-on-error-container'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u['Trạng thái'] === 'Active' ? 'bg-emerald-500' : 'bg-error'}`} />
                      {u['Trạng thái'] === 'Active' ? 'Hoạt động' : u['Trạng thái'] || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(u)}
                        className="text-xs px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors font-medium">
                        {u['Quyền'] ? 'Sửa quyền' : 'Phân quyền'}
                      </button>
                      {u['Quyền'] && (
                        <button onClick={() => handleRemove(u)}
                          className="text-xs px-2.5 py-1 rounded-lg text-error hover:bg-error/10 transition-colors font-medium">
                          Xóa quyền
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {users.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/40 bg-surface-container-lowest">
            <span className="text-xs text-on-surface-variant">{filtered.length} / {users.length} người dùng</span>
          </div>
        )}
      </div>

      {/* Edit role modal — same style as docmgr */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-md3-3 w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-primary-container" style={{ fontSize: 18 }}>shield_person</span>
              </div>
              <h2 className="text-base font-semibold text-on-surface flex-1">Phân quyền</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* User info */}
              <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-base font-semibold text-primary">{avatar(modal['Tên đăng nhập'])}</span>
                </div>
                <div>
                  <p className="font-medium text-on-surface text-sm">{modal['Tên nhân viên'] || modal['Tên đăng nhập']}</p>
                  <p className="text-xs text-on-surface-variant">{modal['Email'] || '—'}</p>
                </div>
              </div>

              {/* Role select */}
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">Quyền</label>
                <select value={role} onChange={e => setRole(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">— Chưa phân quyền —</option>
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant shrink-0">
              <button type="button" onClick={closeModal} disabled={saving}
                className="px-4 py-2 rounded-full border border-outline-variant text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50">
                Huỷ
              </button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="px-5 py-2 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1 disabled:opacity-50 flex items-center gap-2">
                {saving && <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    primary: { bg: 'bg-primary/10', icon: 'text-primary',     val: 'text-primary' },
    green:   { bg: 'bg-emerald-50', icon: 'text-emerald-600', val: 'text-emerald-700' },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',  val: 'text-amber-700' },
  }
  const c = colors[color] || colors.primary
  return (
    <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div>
        <p className="text-xs text-on-surface-variant mb-0.5">{label}</p>
        <p className={`text-2xl font-bold ${c.val}`}>{value}</p>
      </div>
    </div>
  )
}
