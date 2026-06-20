import { useState, useEffect } from 'react'
import gasCall from '../gasClient.js'
import { viMatch } from '../utils/viSearch.js'
import Icon from './common/Icon.jsx'
import FormModal from './common/FormModal.jsx'
import CategoryPickerDropdown from './common/CategoryPickerDropdown.jsx'
import { inputCls, textareaCls, labelCls, fieldCls } from './common/formStyles.js'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'

const CAT_EXPANDED_KEY = 'docmgr_cat_expanded'

const ICON_OPTIONS = [
  'description', 'contract', 'bar_chart', 'engineering', 'inventory_2',
  'folder_open', 'folder_special', 'work', 'business_center', 'receipt_long',
  'policy', 'gavel', 'handshake', 'diversity_3', 'account_balance',
  'local_shipping', 'construction', 'architecture', 'settings', 'hub',
]

function getDescendantIds(cats, rootId) {
  const ids = new Set()
  const queue = [String(rootId)]
  while (queue.length) {
    const cur = queue.shift()
    ids.add(cur)
    cats.filter(c => String(c['Danh mục cha']) === cur).forEach(c => queue.push(String(c.ID)))
  }
  return ids
}

function parseJsonArray(val) {
  if (!val) return []
  try { return typeof val === 'string' && val.charAt(0) === '[' ? JSON.parse(val).map(String) : [] } catch(_) { return [] }
}

export default function CategoryManager({ token, lookups, onUpdate, session }) {
  const [cats, setCats]   = useState(lookups.danhMuc || [])
  const [modal, setModal] = useState(null) // null | { mode: 'create' | 'edit', cat? }
  const [form, setForm]   = useState({ 'Tên danh mục': '', 'Icon': 'description', 'Mô tả': '', 'Danh mục cha': '', 'Người được xem': '', 'Nhóm được xem': '', 'Nơi lưu hồ sơ cứng': '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(() => {
    // persisted locally; empty = collapse all by default
    try {
      const raw = localStorage.getItem(CAT_EXPANDED_KEY)
      return new Set(raw ? JSON.parse(raw) : [])
    } catch (_) {
      return new Set()
    }
  })
  const { showToast } = useToast()
  const confirm = useConfirm()

  const role = session?.role || ''
  const isAdminRole = role === 'admin' || role === 'Quản trị viên' || role === 'Giám đốc'
  const canAddRootCat = isAdminRole || session?.canCreateRootCat
  const canAddSubCat = isAdminRole || session?.canCreateSubCat || canAddRootCat

  useEffect(() => { setCats(lookups.danhMuc || []) }, [lookups.danhMuc])

  function openAdd() {
    setForm({ 'Tên danh mục': '', 'Icon': 'description', 'Mô tả': '', 'Danh mục cha': '', 'Người được xem': '', 'Nhóm được xem': '', 'Nơi lưu hồ sơ cứng': '' })
    setError('')
    setModal({ mode: 'create' })
  }

  function openEdit(cat) {
    setForm({ ...cat })
    setError('')
    setModal({ mode: 'edit', cat })
  }

  function closeModal() { setModal(null); setError('') }

  async function handleSave() {
    if (!form['Tên danh mục']) { setError('Tên danh mục là bắt buộc'); return }
    if (!isAdminRole && !canAddRootCat && modal.mode === 'create' && !form['Danh mục cha']) { setError('Bạn chỉ được tạo danh mục con'); return }
    if (modal.cat && String(form['Danh mục cha']) === String(modal.cat.ID)) {
      setError('Danh mục không thể là cha của chính nó'); return
    }
    setSaving(true); setError('')
    try {
      if (modal.mode === 'edit') {
        await gasCall('api_updateCategory', token, modal.cat.ID, form)
      } else {
        await gasCall('api_addCategory', token, form)
      }
      closeModal()
      showToast('Đã lưu danh mục', 'success')
      onUpdate()
    } catch (err) {
      setError(err.message)
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cat) {
    if (!await confirm(`Xóa danh mục "${cat['Tên danh mục']}"?`)) return
    try {
      await gasCall('api_deleteCategory', token, cat.ID)
      showToast('Đã xóa danh mục', 'success')
      onUpdate()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // Parent picker: exclude self + all descendants
  const excludedIds = modal?.cat ? getDescendantIds(cats, modal.cat.ID) : new Set()

  const roots = cats.filter(c => !c['Danh mục cha'])
  const childrenList = cats.filter(c => !!c['Danh mục cha'])

  function openAddSub(parentCat) {
    setForm({ 'Tên danh mục': '', 'Icon': 'description', 'Mô tả': '', 'Danh mục cha': String(parentCat.ID), 'Người được xem': '', 'Nhóm được xem': '', 'Nơi lưu hồ sơ cứng': '' })
    setError('')
    setModal({ mode: 'create' })
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      const k = String(id)
      next.has(k) ? next.delete(k) : next.add(k)
      try { localStorage.setItem(CAT_EXPANDED_KEY, JSON.stringify([...next])) } catch (_) {}
      return next
    })
  }

  function renderTree(parentId, depth) {
    return cats
      .filter(c => String(c['Danh mục cha'] || '') === String(parentId || ''))
      .flatMap(cat => {
        const isOpen = expanded.has(String(cat.ID))
        return [
          <CatRow key={cat.ID} cat={cat} cats={cats} indent={depth} onEdit={openEdit} onDelete={handleDelete} canAddSubCat={canAddSubCat} isAdminRole={isAdminRole} onAddSub={openAddSub} lookups={lookups} isOpen={isOpen} onToggle={toggleExpand} />,
          ...(isOpen ? renderTree(cat.ID, depth + 1) : [])
        ]
      })
  }

  const filtered = search
    ? cats.filter(c => viMatch(c['Tên danh mục'], search) || viMatch(c['Mô tả'], search))
    : null // null = show tree; array = flat search results

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input
            className="w-full bg-surface-container-low border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Tìm danh mục..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-on-surface-variant">{cats.length} danh mục</span>
        <div className="ml-auto">
          {canAddRootCat && (
            <button onClick={openAdd}
              className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1">
              <Icon name="add" size={18} />
              Thêm danh mục
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Danh mục</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Mô tả</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Phân quyền</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {cats.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-on-surface-variant">Chưa có danh mục</td></tr>
            )}
            {filtered
              ? filtered.map(cat => <CatRow key={cat.ID} cat={cat} cats={cats} indent={0} onEdit={openEdit} onDelete={handleDelete} canAddSubCat={canAddSubCat} isAdminRole={isAdminRole} onAddSub={openAddSub} lookups={lookups} />)
              : renderTree('', 0)
            }
          </tbody>
        </table>
      </div>

      {/* FormModal */}
      <FormModal
        open={!!modal}
        title={modal?.mode === 'create' ? 'Thêm danh mục' : 'Sửa danh mục'}
        icon={modal?.mode === 'create' ? 'add' : 'edit'}
        onClose={closeModal}
        onSave={handleSave}
        saving={saving}
        error={error}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className={fieldCls}>
            <label className={labelCls}>Tên danh mục *</label>
            <input className={inputCls} value={form['Tên danh mục']}
              onChange={e => setForm(f => ({ ...f, 'Tên danh mục': e.target.value }))} placeholder="Nhập tên danh mục..." />
          </div>

          <div className={fieldCls}>
            <label className={labelCls}>Danh mục cha {!isAdminRole && '*'}</label>
            <CategoryPickerDropdown
              testId="parent-cat-picker"
              categories={cats}
              excludeIds={excludedIds}
              value={form['Danh mục cha'] || ''}
              onChange={id => setForm(f => ({ ...f, 'Danh mục cha': id }))}
              rootOption={isAdminRole ? '— Không có (danh mục gốc) —' : '-- Chọn danh mục cha --'}
            />
          </div>

          <div className={fieldCls}>
            <label className={labelCls}>
              Icon — <span className="font-medium text-primary">{form['Icon'] || '(chưa chọn)'}</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(icon => (
                <button key={icon} type="button" title={icon}
                  onClick={() => setForm(f => ({ ...f, 'Icon': icon }))}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    form['Icon'] === icon
                      ? 'bg-accent text-white shadow-md3-1'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  <Icon name={icon} size={18} />
                </button>
              ))}
            </div>
          </div>

          <div className={fieldCls}>
            <label className={labelCls}>Mô tả</label>
            <textarea className={textareaCls + ' h-20'} value={form['Mô tả'] || ''}
              onChange={e => setForm(f => ({ ...f, 'Mô tả': e.target.value }))} placeholder="Ghi chú thêm..." />
          </div>

          <div className={fieldCls}>
            <label className={labelCls}>Nơi lưu hồ sơ cứng</label>
            <input className={inputCls} value={form['Nơi lưu hồ sơ cứng'] || ''}
              onChange={e => setForm(f => ({ ...f, 'Nơi lưu hồ sơ cứng': e.target.value }))} placeholder="VD: Tủ A, Kệ 3..." />
          </div>

          {/* Người được xem — admin only */}
          {isAdminRole && <div className={fieldCls}>
            <label className={labelCls}>Người được xem <span className="font-normal text-on-surface-variant">(trống = chưa phân quyền)</span></label>
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-surface-container-low rounded-xl min-h-[42px]">
              {(lookups.ssoUsers || []).map(u => {
                const current = parseJsonArray(form['Người được xem'])
                const active = current.includes(String(u.ID))
                const name = u['Tên nhân viên'] || u['Tên đăng nhập']
                const label = u['Email'] ? `${name} (${u['Email']})` : name
                return (
                  <button key={u.ID} type="button"
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${active ? 'bg-accent text-white' : 'bg-surface-container text-on-surface-variant hover:bg-primary/10'}`}
                    onClick={() => {
                      const next = active ? current.filter(x => x !== String(u.ID)) : [...current, String(u.ID)]
                      setForm(f => ({ ...f, 'Người được xem': next.length ? JSON.stringify(next) : '' }))
                    }}>
                    {label}
                  </button>
                )
              })}
              {(lookups.ssoUsers || []).length === 0 && <span className="text-xs text-on-surface-variant">Chưa có người dùng</span>}
            </div>
          </div>}

          {/* Nhóm được xem — admin only */}
          {isAdminRole && <div className={fieldCls}>
            <label className={labelCls}>Nhóm được xem <span className="font-normal text-on-surface-variant">(trống = chưa phân quyền)</span></label>
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-surface-container-low rounded-xl min-h-[42px]">
              {(lookups.nhom || []).map(g => {
                const current = parseJsonArray(form['Nhóm được xem'])
                const active = current.includes(String(g.ID))
                return (
                  <button key={g.ID} type="button"
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${active ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant hover:bg-secondary/10'}`}
                    onClick={() => {
                      const next = active ? current.filter(x => x !== String(g.ID)) : [...current, String(g.ID)]
                      setForm(f => ({ ...f, 'Nhóm được xem': next.length ? JSON.stringify(next) : '' }))
                    }}>
                    {g['Tên nhóm']}
                  </button>
                )
              })}
              {(lookups.nhom || []).length === 0 && <span className="text-xs text-on-surface-variant">Chưa có nhóm</span>}
            </div>
          </div>}
        </div>
      </FormModal>
    </div>
  )
}

const PERM_MAX_CHIPS = 3

function CatRow({ cat, cats, indent, orphan, onEdit, onDelete, canAddSubCat, isAdminRole, onAddSub, lookups, isOpen, onToggle }) {
  const childCount = cats.filter(c => String(c['Danh mục cha']) === String(cat.ID)).length
  const isChild = indent > 0
  const isTree = typeof onToggle === 'function' // tree mode (vs flat search results)

  const userIds = parseJsonArray(cat['Người được xem'])
  const groupIds = parseJsonArray(cat['Nhóm được xem'])
  const chips = []
  groupIds.forEach(gid => {
    const g = (lookups.nhom || []).find(x => String(x.ID) === gid)
    chips.push({ label: g ? g['Tên nhóm'] : gid, type: 'group' })
  })
  userIds.forEach(uid => {
    const u = (lookups.ssoUsers || []).find(x => String(x.ID) === uid)
    chips.push({ label: u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : uid, type: 'user' })
  })
  const overflow = chips.length > PERM_MAX_CHIPS ? chips.length - PERM_MAX_CHIPS : 0
  const visible = overflow ? chips.slice(0, PERM_MAX_CHIPS) : chips

  return (
    <tr className={`hover:bg-surface-container-low transition-colors ${isChild ? 'bg-surface-container-lowest/50' : ''}`}>
      <td className="px-4 py-3" style={{ paddingLeft: indent * 24 + 16 }}>
        <div className="flex items-center gap-2">
          {isTree && (childCount > 0
            ? <button onClick={() => onToggle(cat.ID)} aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
                className="w-5 h-5 shrink-0 flex items-center justify-center rounded text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors">
                <Icon name={isOpen ? 'expand_more' : 'chevron_right'} size={18} />
              </button>
            : <span className="w-5 shrink-0" />)}
          <div className={`rounded-lg flex items-center justify-center shrink-0 ${isChild ? 'w-6 h-6' : 'w-8 h-8'} ${orphan ? 'bg-amber-100' : isChild ? 'bg-secondary/10' : 'bg-primary/10'}`}>
            <Icon name={cat.Icon || 'folder_open'} size={isChild ? 14 : 18} className={orphan ? 'text-amber-600' : isChild ? 'text-secondary' : 'text-primary'} />
          </div>
          <span className={`${isChild ? 'text-on-surface' : 'font-semibold text-on-surface'}`}>{cat['Tên danh mục']}</span>
          {childCount > 0 && (
            <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{childCount}</span>
          )}
          {orphan && <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Orphaned</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-on-surface-variant text-xs">{cat['Mô tả'] || '—'}</td>
      <td className="px-4 py-3">
        {isChild
          ? <span className="text-xs text-on-surface-variant italic">Kế thừa</span>
          : chips.length === 0
            ? <span className="text-xs text-on-surface-variant italic">Chưa phân quyền</span>
            : <div className="flex flex-wrap gap-1" title={chips.map(c => c.label).join(', ')}>
                {visible.map((c, i) => (
                  <span key={i} className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.type === 'group' ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent'}`}>
                    {c.type === 'group' && <Icon name="group" size={12} className="inline-block mr-0.5 -mt-px" />}
                    {c.type === 'user' && <Icon name="person" size={12} className="inline-block mr-0.5 -mt-px" />}
                    {c.label}
                  </span>
                ))}
                {overflow > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-container text-on-surface-variant">+{overflow}</span>}
              </div>
        }
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1 justify-end">
          {canAddSubCat && (
            <button onClick={() => onAddSub(cat)} className="text-xs px-2.5 py-1 rounded-lg text-secondary hover:bg-secondary/10 transition-colors font-medium">+ Con</button>
          )}
          {isAdminRole && (
            <>
              <button onClick={() => onEdit(cat)} className="text-xs px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors font-medium">Sửa</button>
              <button onClick={() => onDelete(cat)} className="text-xs px-2.5 py-1 rounded-lg text-error hover:bg-error-container transition-colors font-medium">Xóa</button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
