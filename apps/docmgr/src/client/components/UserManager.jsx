import { useState, useEffect, Fragment } from 'react'
import gasCall from '../gasClient.js'
import { viMatch } from '../utils/viSearch.js'
import Icon from './common/Icon.jsx'
import FormModal from './common/FormModal.jsx'
import { inputCls, selectCls, labelCls, fieldCls } from './common/formStyles.js'
import { useToast } from '../context/ToastContext.jsx'

const ROLE_OPTIONS = ['admin', 'Giám đốc', 'Trưởng phòng', 'Nhân viên', 'Văn thư']

const ROLE_BADGE = {
  'admin':          'bg-primary/10 text-primary',
  'Giám đốc':      'bg-violet-100 text-violet-700',
  'Trưởng phòng':  'bg-amber-100 text-amber-700',
  'Nhân viên':     'bg-surface-container text-on-surface-variant',
  'Văn thư':      'bg-cyan-100 text-cyan-700',
  // legacy
  'Quản trị viên': 'bg-primary/10 text-primary',
  'Biên tập viên': 'bg-secondary/10 text-secondary',
  'Xem':            'bg-surface-container text-on-surface-variant',
}

const MODULES = [
  { key: 'hoSo',       label: 'Hồ sơ' },
  { key: 'danhMuc',    label: 'Danh mục' },
  { key: 'phongBan',   label: 'Phòng ban' },
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
  if (role === 'Biên tập viên' || role === 'Văn thư' || role === 'Trưởng phòng') return Object.fromEntries(MODULES.map(m => [m.key, { c: m.key === 'hoSo', r: true, u: m.key === 'hoSo', d: false }]))
  return defaultPerms()
}

const EMPTY_FORM = { 'Tên đăng nhập': '', 'Email': '', 'Quyền': 'Nhân viên' }

export default function UserManager({ token, lookups = {} }) {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [modal, setModal]     = useState(null) // null | { mode: 'create' | 'edit', user?: {} }
  const [form, setForm]       = useState(EMPTY_FORM)
  const [perms, setPerms]     = useState(defaultPerms())
  const [allowedCategories, setAllowedCategories] = useState([])
  const [selectedDepts, setSelectedDepts] = useState([]) // Nhân viên / Trưởng phòng dept assignment
  const [formError, setFormError] = useState('')
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const { showToast } = useToast()

  async function load() {
    setLoading(true)
    try {
      const res = await gasCall('api_getUsers', token)
      setUsers(res || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setPerms(defaultPerms())
    setAllowedCategories([])
    setSelectedDepts([])
    setFormError('')
    setModal({ mode: 'create' })
  }

  function openEdit(user) {
    setForm({
      'Tên đăng nhập': user['Tên đăng nhập'] || '',
      'Email':         user['Email'] || '',
      'Quyền':         user['Quyền'] || 'Nhân viên',
    })
    const parsed = parsePermissions(user['Phân quyền chi tiết'], user['Quyền'])
    setPerms(parsed)
    setAllowedCategories(Array.isArray(parsed.allowedCategories) ? parsed.allowedCategories.map(String) : [])
    // Parse Phòng ban for this user
    let depts = []
    try {
      const pb = user['Phòng ban']
      if (pb && pb.charAt(0) === '[') depts = JSON.parse(pb)
      else if (pb) depts = [pb]
    } catch(_) {}
    setSelectedDepts(depts)
    setFormError('')
    setModal({ mode: 'edit', user })
  }

  function closeModal() { setModal(null); setFormError('') }

  function handleRoleChange(role) {
    setForm(f => ({ ...f, 'Quyền': role }))
    setAllowedCategories([])
    if (role === 'admin' || role === 'Giám đốc' || role === 'Quản trị viên') setPerms(fullPerms())
    else if (role === 'Văn thư' || role === 'Trưởng phòng' || role === 'Biên tập viên') setPerms(Object.fromEntries(MODULES.map(m => [m.key, { c: m.key === 'hoSo', r: true, u: m.key === 'hoSo', d: false }])))
    else setPerms(defaultPerms())
  }

  function toggleCategory(id) {
    setAllowedCategories(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function togglePerm(mod, op) {
    if (form['Quyền'] === 'Quản trị viên') return
    setPerms(p => ({ ...p, [mod]: { ...p[mod], [op]: !p[mod][op] } }))
  }

  async function handleSave() {
    if (!form['Tên đăng nhập']) { setFormError('Tên đăng nhập là bắt buộc'); return }
    if (!form['Email']) { setFormError('Email là bắt buộc'); return }
    setSaving(true); setFormError('')
    const isFullAdmin = form['Quyền'] === 'admin' || form['Quyền'] === 'Giám đốc' || form['Quyền'] === 'Quản trị viên'
    const finalPerms = isFullAdmin ? fullPerms() : perms
    const payload = { ...form, permissions: { ...finalPerms, allowedCategories }, 'Phòng ban': selectedDepts }
    try {
      if (modal.mode === 'create') {
        await gasCall('api_addUser', token, payload)
      } else {
        await gasCall('api_updateUser', token, modal.user.ID, payload)
      }
      closeModal()
      showToast('Đã lưu người dùng', 'success')
      load()
    } catch (err) {
      setFormError(err.message)
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleLock(user) {
    try { await gasCall('api_lockUser', token, user.ID); load(); showToast('Đã khóa tài khoản', 'success') }
    catch (err) { showToast(err.message, 'error') }
  }

  async function handleUnlock(user) {
    try { await gasCall('api_unlockUser', token, user.ID); load(); showToast('Đã mở khóa tài khoản', 'success') }
    catch (err) { showToast(err.message, 'error') }
  }

  const totalUsers  = users.length
  const activeUsers = users.filter(u => u['Trạng thái'] === 'Active').length
  const lockedUsers = users.filter(u => u['Trạng thái'] !== 'Active').length

  const filtered = users.filter(u => {
    if (!search) return true
    return viMatch(u['Tên đăng nhập'], search) || viMatch(u['Email'], search)
  })

  const avatar = (name) => (name || '?')[0].toUpperCase()
  const isFullAdmin = form['Quyền'] === 'admin' || form['Quyền'] === 'Giám đốc' || form['Quyền'] === 'Quản trị viên'
  const isAdmin = isFullAdmin // kept for backwards compat in template
  const showDeptPicker = form['Quyền'] === 'Trưởng phòng' || form['Quyền'] === 'Nhân viên'

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="group" label="Tổng users" value={totalUsers} color="primary" />
        <StatCard icon="check_circle" label="Đang hoạt động" value={activeUsers} color="green" />
        <StatCard icon="lock" label="Bị khóa" value={lockedUsers} color="red" />
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
        <div className="ml-auto">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-700 transition-colors shadow-md3-1"
          >
            <Icon name="person_add" size={18} />
            Thêm người dùng
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Người dùng</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Quyền</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Phòng ban</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Trạng thái</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Đăng nhập cuối</th>
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
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[user['Quyền']] || ROLE_BADGE['Xem']}`}>
                    {user['Quyền'] || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {(() => {
                    let depts = []
                    try {
                      const pb = user['Phòng ban']
                      if (pb && pb.charAt(0) === '[') depts = JSON.parse(pb)
                      else if (pb) depts = [pb]
                    } catch(_) {}
                    return depts.length > 0
                      ? <div className="flex flex-wrap gap-1">{depts.map(d => <span key={d} className="px-1.5 py-0.5 bg-surface-container rounded text-xs text-on-surface-variant">{d}</span>)}</div>
                      : <span className="text-on-surface-variant text-xs">—</span>
                  })()}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user['Trạng thái'] === 'Active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-error-container text-on-error-container'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${user['Trạng thái'] === 'Active' ? 'bg-emerald-500' : 'bg-error'}`} />
                    {user['Trạng thái'] === 'Active' ? 'Hoạt động' : 'Bị khóa'}
                  </span>
                </td>
                <td className="px-4 py-3 text-on-surface-variant text-xs hidden lg:table-cell">{user['Đăng nhập cuối'] || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(user)}
                      className="text-xs px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors font-medium">Sửa</button>
                    {user['Trạng thái'] === 'Active' ? (
                      <button onClick={() => handleLock(user)}
                        className="text-xs px-2.5 py-1 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors font-medium">Khóa</button>
                    ) : (
                      <button onClick={() => handleUnlock(user)}
                        className="text-xs px-2.5 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors font-medium">Mở khóa</button>
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

      {/* Add / Edit modal */}
      <FormModal
        open={!!modal}
        title={modal?.mode === 'create' ? 'Thêm người dùng' : 'Sửa người dùng'}
        icon={modal?.mode === 'create' ? 'person_add' : 'manage_accounts'}
        onClose={closeModal}
        onSave={handleSave}
        saving={saving}
        error={formError}
        maxWidth="max-w-2xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className={fieldCls}>
            <label className={labelCls}>Tên đăng nhập *</label>
            <input className={inputCls} value={form['Tên đăng nhập']}
              onChange={e => setForm(f => ({ ...f, 'Tên đăng nhập': e.target.value }))} />
          </div>
          <div className={fieldCls}>
            <label className={labelCls}>Email *</label>
            <input type="email" className={inputCls} value={form['Email']}
              onChange={e => setForm(f => ({ ...f, 'Email': e.target.value }))} />
          </div>
          <div className={fieldCls + ' col-span-2'}>
            <label className={labelCls}>Quyền</label>
            <select className={selectCls} value={form['Quyền']} onChange={e => handleRoleChange(e.target.value)}>
              {ROLE_OPTIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>

          {/* Phòng ban multi-select — visible for Trưởng phòng / Nhân viên */}
          {showDeptPicker && (
            <div className={fieldCls + ' col-span-2'}>
              <label className={labelCls}>Phòng ban</label>
              <div className="flex flex-wrap gap-2 p-2.5 bg-surface-container-low rounded-xl min-h-[40px]">
                {(lookups.phongBan || []).map(pb => {
                  const name = pb['Tên phòng ban']
                  const selected = selectedDepts.includes(name)
                  return (
                    <button key={pb.ID} type="button"
                      onClick={() => setSelectedDepts(prev => selected ? prev.filter(d => d !== name) : [...prev, name])}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-primary/10'}`}
                    >
                      {name}
                      {selected && <Icon name="close" size={12} />}
                    </button>
                  )
                })}
                {(lookups.phongBan || []).length === 0 && (
                  <span className="text-xs text-on-surface-variant">Chưa có phòng ban</span>
                )}
              </div>
              {selectedDepts.length > 0 && (
                <p className="text-xs text-on-surface-variant mt-1">Đã chọn: {selectedDepts.join(', ')}</p>
              )}
            </div>
          )}
        </div>

        {/* Permission matrix */}
        <div className="mt-5">
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
                  <Fragment key={mod.key}>
                    <tr className="hover:bg-surface-container-lowest">
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
                    {mod.key === 'danhMuc' && !isAdmin && (lookups.danhMuc || []).filter(c => !c['Danh mục cha']).length > 0 && (
                      <tr className="bg-surface-container-lowest/60">
                        <td colSpan={5} className="px-3 py-2 pl-8">
                          <div className="flex flex-wrap gap-3 items-center">
                            <span className="text-xs text-on-surface-variant">Phạm vi:</span>
                            {(lookups.danhMuc || []).filter(c => !c['Danh mục cha']).map(cat => (
                              <label key={cat.ID} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={allowedCategories.includes(String(cat.ID))}
                                  onChange={() => toggleCategory(String(cat.ID))}
                                  className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                                />
                                <span>{cat['Tên danh mục']}</span>
                              </label>
                            ))}
                            {allowedCategories.length === 0 && (
                              <span className="text-xs text-on-surface-variant italic">(tất cả)</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
