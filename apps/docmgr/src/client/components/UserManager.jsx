import { useState, useEffect } from 'react'
import gasCall from '../gasClient.js'
import { viMatch } from '../utils/viSearch.js'
import Icon from './common/Icon.jsx'
import FormModal from './common/FormModal.jsx'
import { selectCls, labelCls, fieldCls } from './common/formStyles.js'
import { useToast } from '../context/ToastContext.jsx'

const ROLE_OPTIONS = ['admin', 'Giám đốc', 'Phó GĐ', 'Trưởng phòng', 'Phó phòng', 'Nhân viên', 'Văn thư']
const DIRECTOR_BLOCKED_ROLES = ['admin', 'Giám đốc']

const ROLE_BADGE = {
  'admin':          'bg-primary/10 text-primary',
  'Giám đốc':      'bg-violet-100 text-violet-700',
  'Phó GĐ':       'bg-violet-50 text-violet-600',
  'Trưởng phòng':  'bg-surface-container text-on-surface-variant',
  'Phó phòng':     'bg-surface-container text-on-surface-variant',
  'Nhân viên':     'bg-surface-container text-on-surface-variant',
  'Văn thư':      'bg-cyan-100 text-cyan-700',
  'Quản trị viên': 'bg-primary/10 text-primary',
  'Xem':            'bg-surface-container text-on-surface-variant',
}

const MODULES = [
  { key: 'hoSo',       label: 'Hồ sơ' },
  { key: 'danhMuc',    label: 'Danh mục' },
  { key: 'nhom',       label: 'Nhóm' },
  { key: 'nhaCungCap', label: 'Nhà cung cấp' },
  { key: 'duAn',       label: 'Dự án' },
  { key: 'user',       label: 'Người dùng' },
  { key: 'caiDat',     label: 'Cài đặt' },
]
const OPS = [
  { key: 'c', label: 'Thêm' },
  { key: 'r', label: 'Xem'  },
  { key: 'u', label: 'Sửa'  },
  { key: 'd', label: 'Xóa'  },
]

function defaultPerms() {
  return Object.fromEntries(MODULES.map(m => [m.key, { c: false, r: true, u: false, d: false }]))
}
function fullPerms() {
  return Object.fromEntries(MODULES.map(m => [m.key, { c: true, r: true, u: true, d: true }]))
}
function parsePermissions(raw, role) {
  if (role === 'Quản trị viên' || role === 'admin' || role === 'Giám đốc') return fullPerms()
  try { const p = typeof raw === 'string' ? JSON.parse(raw) : raw; if (p && p.hoSo) return p } catch (_) { /* */ }
  if (role === 'Văn thư') return Object.fromEntries(MODULES.map(m => [m.key, { c: m.key === 'hoSo', r: true, u: m.key === 'hoSo', d: false }]))
  return defaultPerms()
}

export default function UserManager({ token, session }) {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [modal, setModal]     = useState(null) // null | { user }
  const [role, setRole]       = useState('Nhân viên')
  const [perms, setPerms]     = useState(defaultPerms())
  const [canCreateDoc, setCanCreateDoc] = useState(false)
  const [canCreateSubCat, setCanCreateSubCat] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const { showToast } = useToast()

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const res = await gasCall('api_getUsers', token)
      setUsers(res || [])
      if (silent) setError('')
    } catch (err) {
      if (silent) showToast('Không thể làm mới danh sách người dùng', 'error')
      else setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openEdit(user) {
    const currentRole = user['Quyền'] || 'Nhân viên'
    setRole(currentRole)
    setPerms(parsePermissions(user['Phân quyền chi tiết'], currentRole))
    setCanCreateDoc(user['Được tạo hồ sơ'] === 'TRUE' || user['Được tạo hồ sơ'] === true)
    setCanCreateSubCat(user['Được tạo danh mục con'] === 'TRUE' || user['Được tạo danh mục con'] === true)
    setFormError('')
    setModal({ user })
  }

  function closeModal() { setModal(null); setFormError('') }

  function handleRoleChange(newRole) {
    setRole(newRole)
    if (newRole === 'admin' || newRole === 'Giám đốc' || newRole === 'Quản trị viên') setPerms(fullPerms())
    else if (newRole === 'Văn thư') setPerms(Object.fromEntries(MODULES.map(m => [m.key, { c: m.key === 'hoSo', r: true, u: m.key === 'hoSo', d: false }])))
    else setPerms(defaultPerms())
  }

  function togglePerm(mod, op) {
    if (role === 'admin' || role === 'Giám đốc' || role === 'Quản trị viên') return
    setPerms(p => ({ ...p, [mod]: { ...p[mod], [op]: !p[mod][op] } }))
  }

  async function handleSave() {
    if (!role) { setFormError('Vui lòng chọn quyền'); return }
    setSaving(true); setFormError('')
    const isFullAdmin = role === 'admin' || role === 'Giám đốc' || role === 'Quản trị viên'
    const finalPerms = isFullAdmin ? fullPerms() : perms
    try {
      await gasCall('api_updateUser', token, modal.user.ID, {
        'Tên đăng nhập': modal.user['Tên đăng nhập'],
        'Quyền': role,
        'Được tạo hồ sơ': canCreateDoc,
        'Được tạo danh mục con': canCreateSubCat,
      })
      closeModal()
      showToast('Đã lưu phân quyền', 'success')
      load(true)
    } catch (err) {
      setFormError(err.message)
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveRole(user) {
    try {
      await gasCall('api_removeUserRole', token, user.ID)
      showToast('Đã xóa quyền', 'success')
      load(true)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const assignedUsers = users.filter(u => u['Quyền'])
  const unassignedUsers = users.filter(u => !u['Quyền'])

  const filtered = users.filter(u => {
    if (!search) return true
    return viMatch(u['Tên đăng nhập'], search) || viMatch(u['Email'], search)
  })

  const avatar = (name) => (name || '?')[0].toUpperCase()
  const isAdmin = role === 'admin' || role === 'Giám đốc' || role === 'Quản trị viên'
  const availableRoleOptions = session?.role === 'Giám đốc'
    ? ROLE_OPTIONS.filter(r => DIRECTOR_BLOCKED_ROLES.indexOf(r) === -1)
    : ROLE_OPTIONS

  function canManage(user) {
    if (session?.role !== 'Giám đốc') return true
    if (String(user.ID) === String(session.userId)) return false
    if (DIRECTOR_BLOCKED_ROLES.indexOf(user['Quyền']) !== -1) return false
    return true
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3 text-on-surface-variant">
        <Icon name="sync" size={32} className="animate-spin" />
        <span className="text-sm">Đang tải...</span>
      </div>
    </div>
  )

  if (error) return (
    <div className="bg-error-container text-on-error-container rounded-2xl p-6 text-sm">{error}</div>
  )

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon="group" label="Tổng users (SSO)" value={users.length} color="primary" />
        <StatCard icon="shield_person" label="Đã phân quyền" value={assignedUsers.length} color="green" />
        <StatCard icon="person_off" label="Chưa phân quyền" value={unassignedUsers.length} color="amber" />
      </div>

      {/* Info banner */}
      <div className="bg-primary/5 rounded-2xl p-4 flex items-start gap-3">
        <Icon name="info" size={20} className="text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Người dùng được quản lý từ <strong>SSO Portal</strong>. Tại đây bạn chỉ phân quyền truy cập cho ứng dụng này.
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input
            className="w-full bg-surface-container-low border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Tìm theo tên, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Người dùng</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Quyền</th>
              <th className="px-4 py-3 text-center font-semibold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Tạo hồ sơ</th>
              <th className="px-4 py-3 text-center font-semibold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Tạo danh mục con</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Trạng thái (SSO)</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant">Không tìm thấy người dùng</td></tr>
            )}
            {filtered.map(user => (
              <tr key={user.ID} className="hover:bg-surface-container-low transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-primary">{avatar(user['Tên đăng nhập'])}</span>
                    </div>
                    <div>
                      <p className="font-medium text-on-surface">{user['Tên đăng nhập']}</p>
                      <p className="text-xs text-on-surface-variant">{user['Email'] || '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {user['Quyền'] ? (
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[user['Quyền']] || ROLE_BADGE['Xem']}`}>
                      {user['Quyền']}
                    </span>
                  ) : (
                    <span className="text-xs text-on-surface-variant italic">Chưa phân quyền</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  {(() => {
                    const r = user['Quyền']
                    const isFullRole = r === 'admin' || r === 'Giám đốc' || r === 'Quản trị viên' || r === 'Văn thư'
                    const canCreate = isFullRole || user['Được tạo hồ sơ'] === 'TRUE' || user['Được tạo hồ sơ'] === true
                    return canCreate ? (
                      <Icon name="check_circle" size={18} className="text-emerald-600 inline-block" />
                    ) : (
                      <Icon name="cancel" size={18} className="text-on-surface-variant/40 inline-block" />
                    )
                  })()}
                </td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  {(() => {
                    const r = user['Quyền']
                    const isFullRole = r === 'admin' || r === 'Giám đốc' || r === 'Quản trị viên'
                    const canSubCat = isFullRole || user['Được tạo danh mục con'] === 'TRUE' || user['Được tạo danh mục con'] === true
                    return canSubCat ? (
                      <Icon name="check_circle" size={18} className="text-emerald-600 inline-block" />
                    ) : (
                      <Icon name="cancel" size={18} className="text-on-surface-variant/40 inline-block" />
                    )
                  })()}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user['Trạng thái'] === 'Active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-error-container text-on-error-container'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${user['Trạng thái'] === 'Active' ? 'bg-emerald-500' : 'bg-error'}`} />
                    {user['Trạng thái'] === 'Active' ? 'Hoạt động' : user['Trạng thái'] || '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    {canManage(user) ? (
                      <>
                        <button onClick={() => openEdit(user)}
                          className="text-xs px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors font-medium">
                          {user['Quyền'] ? 'Sửa quyền' : 'Phân quyền'}
                        </button>
                        {user['Quyền'] && (
                          <button onClick={() => handleRemoveRole(user)}
                            className="text-xs px-2.5 py-1 rounded-lg text-error hover:bg-error/10 transition-colors font-medium">
                            Xóa quyền
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-on-surface-variant italic px-2">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/40 bg-surface-container-lowest">
            <span className="text-xs text-on-surface-variant">{filtered.length} / {users.length} người dùng</span>
          </div>
        )}
      </div>

      {/* Edit role modal */}
      <FormModal
        open={!!modal}
        title="Phân quyền"
        icon="shield_person"
        onClose={closeModal}
        onSave={handleSave}
        saving={saving}
        error={formError}
        maxWidth="max-w-2xl"
      >
        {modal && (
          <>
            {/* User info (read-only) */}
            <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-base font-semibold text-primary">{avatar(modal.user['Tên đăng nhập'])}</span>
              </div>
              <div>
                <p className="font-medium text-on-surface text-sm">{modal.user['Tên đăng nhập']}</p>
                <p className="text-xs text-on-surface-variant">{modal.user['Email'] || '—'}</p>
              </div>
            </div>

            <div className={fieldCls}>
              <label className={labelCls}>Quyền</label>
              <select className={selectCls} value={role} onChange={e => handleRoleChange(e.target.value)}>
                {availableRoleOptions.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>

            {/* Được tạo hồ sơ / danh mục con — only for Nhân viên & Trưởng phòng */}
            {(role === 'Nhân viên' || role === 'Trưởng phòng') && (
              <>
                <div className="flex items-center gap-3 mt-3 bg-surface-container-low rounded-xl px-4 py-3">
                  <input type="checkbox" id="canCreateDoc" checked={canCreateDoc}
                    onChange={e => setCanCreateDoc(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer" />
                  <label htmlFor="canCreateDoc" className="text-sm text-on-surface cursor-pointer select-none">
                    Được tạo hồ sơ
                  </label>
                  <span className="text-xs text-on-surface-variant ml-auto">Cho phép tạo hồ sơ mới</span>
                </div>
                <div className="flex items-center gap-3 mt-3 bg-surface-container-low rounded-xl px-4 py-3">
                  <input type="checkbox" id="canCreateSubCat" checked={canCreateSubCat}
                    onChange={e => setCanCreateSubCat(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer" />
                  <label htmlFor="canCreateSubCat" className="text-sm text-on-surface cursor-pointer select-none">
                    Được tạo danh mục con
                  </label>
                  <span className="text-xs text-on-surface-variant ml-auto">Cho phép tạo danh mục con</span>
                </div>
              </>
            )}

            {/* Permission matrix — hidden, hardcoded per role for now */}
            {/* <div className="mt-5">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2 flex items-center gap-1">
                <Icon name="shield" size={14} />
                Phân quyền chi tiết
                {isAdmin && <span className="ml-2 text-primary">(Toàn quyền)</span>}
              </p>
              <div className="overflow-x-auto rounded-xl border border-outline-variant">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="px-3 py-2 text-left text-on-surface-variant font-medium">Chức năng</th>
                      {OPS.map(op => (
                        <th key={op.key} className="px-3 py-2 text-center text-on-surface-variant font-medium w-16">{op.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {MODULES.map(mod => (
                      <tr key={mod.key} className="hover:bg-surface-container-lowest">
                        <td className="px-3 py-2 font-medium text-on-surface">{mod.label}</td>
                        {OPS.map(op => (
                          <td key={op.key} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={isAdmin ? true : !!(perms[mod.key]?.[op.key])}
                              disabled={isAdmin}
                              onChange={() => togglePerm(mod.key, op.key)}
                              className="w-4 h-4 rounded accent-primary cursor-pointer disabled:cursor-default disabled:opacity-60"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div> */}
          </>
        )}
      </FormModal>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    primary: { bg: 'bg-primary/10', icon: 'text-primary',   val: 'text-primary'   },
    green:   { bg: 'bg-emerald-50', icon: 'text-emerald-600', val: 'text-emerald-700' },
    red:     { bg: 'bg-error-container', icon: 'text-error', val: 'text-error'     },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600', val: 'text-amber-700'  },
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
