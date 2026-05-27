import { useState } from 'react'
import { usePortalData } from '../context/PortalDataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import gasCall from '../gasClient.js'
import { groupUsersByDept } from '../utils/groupUsers.js'

const POPULAR_ICONS = [
  'description', 'folder', 'group', 'bar_chart', 'settings', 'dashboard',
  'inventory', 'task', 'calendar_month', 'mail', 'notifications', 'analytics',
  'account_balance', 'shopping_cart', 'receipt_long', 'assignment', 'work',
  'engineering', 'construction', 'local_shipping', 'storefront', 'payments',
  'timeline', 'monitoring', 'support_agent', 'school', 'medical_services',
  'apartment', 'factory', 'warehouse', 'agriculture', 'science',
  'apps', 'widgets', 'hub', 'cloud', 'security',
]

function Icon({ name, size = 20, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`} style={{ fontSize: size }}>{name}</span>
}

export default function AppManager() {
  const { apps, setApps, users, phongBan, assignments, sync } = usePortalData()
  const { addToast } = useToast()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [formData, setFormData] = useState({ 'Tên App': '', 'Webapp URL': '', 'Icon': 'apps', 'Mô tả': '' })
  const [saving, setSaving] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)

  // Visibility modal state
  const [visApp, setVisApp] = useState(null)
  const [visMode, setVisMode] = useState('all')
  const [visIds, setVisIds] = useState(() => new Set())
  const [visSaving, setVisSaving] = useState(false)

  function getToken() { return localStorage.getItem('sso_access_token') }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData['Tên App']?.trim()) return
    setSaving(true)
    try {
      if (editId) {
        await gasCall('api_updateApp', getToken(), editId, formData)
        setApps(prev => prev.map(a => a.ID === editId ? { ...a, ...formData } : a))
        addToast('Cập nhật thành công', 'success')
      } else {
        const added = await gasCall('api_addApp', getToken(), formData)
        setApps(prev => [...prev, added])
        addToast('Thêm ứng dụng thành công', 'success')
      }
      closeForm()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!await confirm('Bạn có chắc muốn xóa ứng dụng này?')) return
    try {
      await gasCall('api_deleteApp', getToken(), id)
      setApps(prev => prev.filter(a => a.ID !== id))
      addToast('Đã xóa ứng dụng', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  async function handleToggleStatus(app) {
    const newStatus = app['Trạng thái'] === 'Active' ? 'Inactive' : 'Active'
    try {
      await gasCall('api_updateApp', getToken(), app.ID, { 'Trạng thái': newStatus })
      setApps(prev => prev.map(a => a.ID === app.ID ? { ...a, 'Trạng thái': newStatus } : a))
      addToast(`App đã ${newStatus === 'Active' ? 'bật' : 'tắt'}`, 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  function startEdit(app) {
    setEditId(app.ID)
    setFormData({ 'Tên App': app['Tên App'], 'Webapp URL': app['Webapp URL'], 'Icon': app['Icon'] || 'apps', 'Mô tả': app['Mô tả'] })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setFormData({ 'Tên App': '', 'Webapp URL': '', 'Icon': 'apps', 'Mô tả': '' })
    setShowIconPicker(false)
  }

  // ── Visibility modal ──

  function openVisibility(app) {
    const qx = app['Quyền xem']
    if (qx) {
      try {
        const arr = JSON.parse(qx)
        if (Array.isArray(arr) && arr.length > 0) {
          setVisMode('custom')
          setVisIds(new Set(arr.map(String)))
          setVisApp(app)
          return
        }
      } catch (_) {}
    }
    setVisMode('all')
    setVisIds(new Set())
    setVisApp(app)
  }

  function closeVisibility() {
    setVisApp(null)
    setVisIds(new Set())
  }

  async function saveVisibility() {
    if (!visApp) return
    setVisSaving(true)
    try {
      const quyenXem = visMode === 'all' ? '' : JSON.stringify([...visIds])
      await gasCall('api_updateApp', getToken(), visApp.ID, { 'Quyền xem': quyenXem })
      addToast('Đã cập nhật quyền xem', 'success')
      closeVisibility()
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setVisSaving(false)
    }
  }

  function toggleUser(uid) {
    const id = String(uid)
    setVisIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleDept(deptUsers) {
    const ids = deptUsers.map(u => String(u.ID))
    setVisIds(prev => {
      const next = new Set(prev)
      const allSelected = ids.every(id => next.has(id))
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  function groupByDept() {
    const allUsers = (users || []).filter(u => u['Trạng thái'] !== 'Locked')
    return groupUsersByDept(allUsers, phongBan, assignments)
  }



  function getVisLabel(app) {
    const qx = app['Quyền xem']
    if (!qx) return null
    try {
      const arr = JSON.parse(qx)
      if (Array.isArray(arr) && arr.length > 0) return arr.length
    } catch (_) {}
    return null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-on-surface">Quản lý ứng dụng</h2>
        <button onClick={() => { closeForm(); setShowForm(true) }}
          className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium flex items-center gap-2 hover:bg-accent-hover transition">
          <Icon name="add" size={18} />
          Thêm App
        </button>
      </div>

      {/* App list */}
      <div className="space-y-3">
        {apps.map(app => {
          const visCount = getVisLabel(app)
          return (
            <div key={app.ID}
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon name={app['Icon'] || 'apps'} size={22} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-on-surface truncate">{app['Tên App']}</h3>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium
                    ${app['Trạng thái'] === 'Active' ? 'bg-green-50 text-green-700' : 'bg-surface-container text-on-surface-variant'}`}>
                    {app['Trạng thái']}
                  </span>
                  {visCount !== null && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700">
                      {visCount} người xem
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant truncate mt-0.5">{app['Webapp URL'] || 'Chưa có URL'}</p>
                {app['Mô tả'] && <p className="text-xs text-outline mt-0.5">{app['Mô tả']}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openVisibility(app)} title="Phân quyền xem"
                  className="p-1.5 rounded-lg hover:bg-surface-container transition">
                  <Icon name="visibility" size={20} className={visCount !== null ? 'text-amber-600' : 'text-on-surface-variant'} />
                </button>
                <button onClick={() => handleToggleStatus(app)} title={app['Trạng thái'] === 'Active' ? 'Tắt' : 'Bật'}
                  className="p-1.5 rounded-lg hover:bg-surface-container transition">
                  <Icon name={app['Trạng thái'] === 'Active' ? 'toggle_on' : 'toggle_off'} size={20} className={app['Trạng thái'] === 'Active' ? 'text-green-600' : 'text-on-surface-variant'} />
                </button>
                <button onClick={() => startEdit(app)} title="Sửa"
                  className="p-1.5 rounded-lg hover:bg-surface-container transition">
                  <Icon name="edit" size={20} className="text-on-surface-variant" />
                </button>
                <button onClick={() => handleDelete(app.ID)} title="Xóa"
                  className="p-1.5 rounded-lg hover:bg-error-container/40 transition">
                  <Icon name="delete" size={20} className="text-error" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-3xl shadow-md3-3 w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-on-surface mb-4">
              {editId ? 'Sửa ứng dụng' : 'Thêm ứng dụng mới'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Tên ứng dụng *</label>
                <input type="text" value={formData['Tên App']}
                  onChange={e => setFormData(f => ({ ...f, 'Tên App': e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                  placeholder="vd: Quản lý Tài liệu" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Webapp URL</label>
                <input type="url" value={formData['Webapp URL']}
                  onChange={e => setFormData(f => ({ ...f, 'Webapp URL': e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                  placeholder="https://script.google.com/macros/s/.../exec" />
              </div>

              {/* Icon picker */}
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Icon</label>
                <button type="button" onClick={() => setShowIconPicker(v => !v)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-outline-variant hover:bg-surface-container transition w-full text-left">
                  <Icon name={formData['Icon']} size={22} className="text-primary" />
                  <span className="text-sm text-on-surface">{formData['Icon']}</span>
                  <Icon name={showIconPicker ? 'expand_less' : 'expand_more'} size={16} className="text-on-surface-variant ml-auto" />
                </button>
                {showIconPicker && (
                  <div className="mt-2 p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
                    {POPULAR_ICONS.map(icon => (
                      <button key={icon} type="button" onClick={() => { setFormData(f => ({ ...f, 'Icon': icon })); setShowIconPicker(false) }}
                        className={`p-2 rounded-lg flex items-center justify-center transition
                          ${formData['Icon'] === icon ? 'bg-primary/15 ring-2 ring-primary' : 'hover:bg-surface-container'}`}>
                        <Icon name={icon} size={20} className="text-on-surface" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Mô tả</label>
                <textarea value={formData['Mô tả']}
                  onChange={e => setFormData(f => ({ ...f, 'Mô tả': e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary transition resize-none"
                  rows={2} placeholder="Mô tả ngắn gọn về ứng dụng" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeForm}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant text-sm font-medium hover:bg-surface-container transition">
                  Hủy
                </button>
                <button type="submit" disabled={saving || !formData['Tên App']?.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition">
                  {saving ? 'Đang lưu...' : (editId ? 'Cập nhật' : 'Thêm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visibility Modal */}
      {visApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.2)] w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon name="visibility" size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-on-surface text-sm">Phân quyền xem</h2>
                  <p className="text-xs text-on-surface-variant">{visApp['Tên App']}</p>
                </div>
              </div>
              <button onClick={closeVisibility}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors">
                <Icon name="close" size={20} className="text-on-surface-variant" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* Mode toggle */}
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                  ${visMode === 'all' ? 'border-primary bg-primary/5' : 'border-outline-variant/40 hover:bg-surface-container-low'}`}>
                  <input type="radio" name="visMode" checked={visMode === 'all'}
                    onChange={() => setVisMode('all')}
                    className="accent-primary" />
                  <div>
                    <p className="text-sm font-medium text-on-surface">Tất cả người dùng</p>
                    <p className="text-xs text-on-surface-variant">Mọi người đều nhìn thấy ứng dụng này</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                  ${visMode === 'custom' ? 'border-primary bg-primary/5' : 'border-outline-variant/40 hover:bg-surface-container-low'}`}>
                  <input type="radio" name="visMode" checked={visMode === 'custom'}
                    onChange={() => setVisMode('custom')}
                    className="accent-primary" />
                  <div>
                    <p className="text-sm font-medium text-on-surface">Chỉ người dùng được chọn</p>
                    <p className="text-xs text-on-surface-variant">Chỉ những người được chọn mới thấy</p>
                  </div>
                </label>
              </div>

              {/* User list grouped by department */}
              {visMode === 'custom' && (
                <div className="space-y-1 border border-outline-variant/40 rounded-xl overflow-hidden">
                  {groupByDept().map(group => {
                    const deptIds = group.users.map(u => String(u.ID))
                    const selectedCount = deptIds.filter(id => visIds.has(id)).length
                    const allSelected = deptIds.length > 0 && selectedCount === deptIds.length
                    const someSelected = selectedCount > 0 && !allSelected
                    return (
                      <div key={group.name}>
                        {/* Department header */}
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-container-low border-b border-outline-variant/30">
                          <input type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected }}
                            onChange={() => toggleDept(group.users)}
                            className="rounded border-outline-variant accent-primary" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">{group.name}</span>
                          </div>
                          <span className="text-[10px] font-medium text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full">
                            {selectedCount}/{deptIds.length}
                          </span>
                        </div>
                        {/* Users in this department */}
                        {group.users.map(u => {
                          const uid = String(u.ID)
                          const checked = visIds.has(uid)
                          return (
                            <label key={u.ID}
                              className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors border-b border-outline-variant/20 last:border-b-0
                                ${checked ? 'bg-primary/5' : 'hover:bg-surface-container-low/50'}`}>
                              <input type="checkbox"
                                checked={checked}
                                onChange={() => toggleUser(u.ID)}
                                className="rounded border-outline-variant accent-primary" />
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-primary">{(u['Tên nhân viên'] || u['Tên đăng nhập'] || '?')[0].toUpperCase()}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-on-surface truncate">{u['Tên nhân viên'] || u['Tên đăng nhập']}</p>
                                <p className="text-[11px] text-on-surface-variant truncate">{u['Email']}</p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}

              {visMode === 'custom' && (
                <p className="text-xs text-on-surface-variant text-center">
                  Đã chọn {visIds.size} người dùng
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-outline-variant/40 flex justify-end gap-3 shrink-0">
              <button onClick={closeVisibility} disabled={visSaving}
                className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant text-sm font-medium hover:bg-surface-container transition-colors">
                Hủy
              </button>
              <button onClick={saveVisibility}
                disabled={visSaving || (visMode === 'custom' && visIds.size === 0)}
                className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-md3-1">
                {visSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
