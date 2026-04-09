import { useState, useEffect } from 'react'
import gasCall from '../gasClient.js'
import { viMatch } from '../utils/viSearch.js'
import Icon from './common/Icon.jsx'
import FormModal from './common/FormModal.jsx'
import { inputCls, selectCls, textareaCls, labelCls, fieldCls } from './common/formStyles.js'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'

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

function buildParentSelectOptions(cats, excludedIds) {
  const opts = []
  function walk(parentId, depth) {
    cats
      .filter(c => String(c['Danh mục cha'] || '') === String(parentId || '') && !excludedIds.has(String(c.ID)))
      .forEach(c => {
        const prefix = '\u00A0'.repeat(depth * 4) + (depth > 0 ? '— ' : '')
        opts.push({ id: c.ID, label: prefix + c['Tên danh mục'] })
        walk(c.ID, depth + 1)
      })
  }
  walk('', 0)
  return opts
}

export default function CategoryManager({ token, lookups, onUpdate }) {
  const [cats, setCats]   = useState(lookups.danhMuc || [])
  const [modal, setModal] = useState(null) // null | { mode: 'create' | 'edit', cat? }
  const [form, setForm]   = useState({ 'Tên danh mục': '', 'Icon': 'description', 'Mô tả': '', 'Danh mục cha': '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const { showToast } = useToast()
  const confirm = useConfirm()

  useEffect(() => { setCats(lookups.danhMuc || []) }, [lookups.danhMuc])

  function openAdd() {
    setForm({ 'Tên danh mục': '', 'Icon': 'description', 'Mô tả': '', 'Danh mục cha': '' })
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

  // Fixed parentOptions: exclude self + all descendants
  const excludedIds = modal?.cat ? getDescendantIds(cats, modal.cat.ID) : new Set()
  const parentSelectOpts = buildParentSelectOptions(cats, excludedIds)

  const roots = cats.filter(c => !c['Danh mục cha'])
  const childrenList = cats.filter(c => !!c['Danh mục cha'])

  function renderTree(parentId, depth) {
    return cats
      .filter(c => String(c['Danh mục cha'] || '') === String(parentId || ''))
      .flatMap(cat => [
        <CatRow key={cat.ID} cat={cat} cats={cats} indent={depth} onEdit={openEdit} onDelete={handleDelete} />,
        ...renderTree(cat.ID, depth + 1)
      ])
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
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-700 transition-colors shadow-md3-1">
            <Icon name="add" size={18} />
            Thêm danh mục
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Danh mục</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Mô tả</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {cats.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-10 text-center text-on-surface-variant">Chưa có danh mục</td></tr>
            )}
            {filtered
              ? filtered.map(cat => <CatRow key={cat.ID} cat={cat} cats={cats} indent={0} onEdit={openEdit} onDelete={handleDelete} />)
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
            <label className={labelCls}>Danh mục cha</label>
            <select className={selectCls} value={form['Danh mục cha'] || ''}
              onChange={e => setForm(f => ({ ...f, 'Danh mục cha': e.target.value }))}>
              <option value="">— Không có (danh mục gốc) —</option>
              {parentSelectOpts.map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
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
                      ? 'bg-primary text-on-primary shadow-md3-1'
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
        </div>
      </FormModal>
    </div>
  )
}

function CatRow({ cat, cats, indent, orphan, onEdit, onDelete }) {
  const childCount = cats.filter(c => String(c['Danh mục cha']) === String(cat.ID)).length
  const isChild = indent > 0
  return (
    <tr className={`hover:bg-surface-container-low transition-colors ${isChild ? 'bg-surface-container-lowest/50' : ''}`}>
      <td className="px-4 py-3" style={{ paddingLeft: indent * 24 + 16 }}>
        <div className="flex items-center gap-2">
          <div className={`rounded-lg flex items-center justify-center shrink-0 ${isChild ? 'w-6 h-6' : 'w-8 h-8'} ${orphan ? 'bg-amber-100' : isChild ? 'bg-secondary/10' : 'bg-primary/10'}`}>
            <Icon name={cat.Icon || 'folder_open'} size={isChild ? 14 : 18} className={orphan ? 'text-amber-600' : isChild ? 'text-secondary' : 'text-primary'} />
          </div>
          <span className={`${isChild ? 'text-on-surface' : 'font-semibold text-on-surface'}`}>{cat['Tên danh mục']}</span>
          {!isChild && childCount > 0 && (
            <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{childCount}</span>
          )}
          {orphan && <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Orphaned</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-on-surface-variant text-xs">{cat['Mô tả'] || '—'}</td>
      <td className="px-4 py-3">
        <div className="flex gap-1 justify-end">
          <button onClick={() => onEdit(cat)} className="text-xs px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors font-medium">Sửa</button>
          <button onClick={() => onDelete(cat)} className="text-xs px-2.5 py-1 rounded-lg text-error hover:bg-error-container transition-colors font-medium">Xóa</button>
        </div>
      </td>
    </tr>
  )
}
