import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import gasCall from '../gasClient.js'

const POPULAR_ICONS = [
  'description', 'folder', 'group', 'bar_chart', 'settings', 'dashboard',
  'inventory', 'task', 'calendar_month', 'mail', 'notifications', 'analytics',
  'account_balance', 'shopping_cart', 'receipt_long', 'assignment', 'work',
  'engineering', 'construction', 'local_shipping', 'storefront', 'payments',
  'timeline', 'monitoring', 'support_agent', 'school', 'medical_services',
  'apartment', 'factory', 'warehouse', 'agriculture', 'science',
  'apps', 'widgets', 'hub', 'cloud', 'security',
]

export default function AppManager({ apps, setApps }) {
  const { session } = useAuth()
  const { addToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [formData, setFormData] = useState({ 'Tên App': '', 'Webapp URL': '', 'Icon': 'apps', 'Mô tả': '' })
  const [saving, setSaving] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData['Tên App']?.trim()) return
    setSaving(true)
    try {
      if (editId) {
        await gasCall('api_updateApp', session.token, editId, formData)
        setApps(prev => prev.map(a => a.ID === editId ? { ...a, ...formData } : a))
        addToast('Cập nhật thành công', 'success')
      } else {
        const added = await gasCall('api_addApp', session.token, formData)
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
    try {
      await gasCall('api_deleteApp', session.token, id)
      setApps(prev => prev.filter(a => a.ID !== id))
      addToast('Đã xóa ứng dụng', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  async function handleToggleStatus(app) {
    const newStatus = app['Trạng thái'] === 'Active' ? 'Inactive' : 'Active'
    try {
      await gasCall('api_updateApp', session.token, app.ID, { 'Trạng thái': newStatus })
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

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-on-surface">Quản lý ứng dụng</h2>
        <button onClick={() => { closeForm(); setShowForm(true) }}
          className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-medium flex items-center gap-2 hover:bg-primary-700 transition">
          <span className="material-symbols-outlined text-lg">add</span>
          Thêm App
        </button>
      </div>

      {/* App list */}
      <div className="space-y-3">
        {apps.map(app => (
          <div key={app.ID}
            className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-xl text-primary">{app['Icon'] || 'apps'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-on-surface truncate">{app['Tên App']}</h3>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium
                  ${app['Trạng thái'] === 'Active' ? 'bg-green-50 text-green-700' : 'bg-surface-container text-on-surface-variant'}`}>
                  {app['Trạng thái']}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant truncate mt-0.5">{app['Webapp URL'] || 'Chưa có URL'}</p>
              {app['Mô tả'] && <p className="text-xs text-outline mt-0.5">{app['Mô tả']}</p>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => handleToggleStatus(app)} title={app['Trạng thái'] === 'Active' ? 'Tắt' : 'Bật'}
                className="p-1.5 rounded-lg hover:bg-surface-container transition">
                <span className="material-symbols-outlined text-lg text-on-surface-variant">
                  {app['Trạng thái'] === 'Active' ? 'toggle_on' : 'toggle_off'}
                </span>
              </button>
              <button onClick={() => startEdit(app)} title="Sửa"
                className="p-1.5 rounded-lg hover:bg-surface-container transition">
                <span className="material-symbols-outlined text-lg text-on-surface-variant">edit</span>
              </button>
              <button onClick={() => handleDelete(app.ID)} title="Xóa"
                className="p-1.5 rounded-lg hover:bg-error-container/40 transition">
                <span className="material-symbols-outlined text-lg text-error">delete</span>
              </button>
            </div>
          </div>
        ))}
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
                  <span className="material-symbols-outlined text-xl text-primary">{formData['Icon']}</span>
                  <span className="text-sm text-on-surface">{formData['Icon']}</span>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant ml-auto">
                    {showIconPicker ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {showIconPicker && (
                  <div className="mt-2 p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
                    {POPULAR_ICONS.map(icon => (
                      <button key={icon} type="button" onClick={() => { setFormData(f => ({ ...f, 'Icon': icon })); setShowIconPicker(false) }}
                        className={`p-2 rounded-lg flex items-center justify-center transition
                          ${formData['Icon'] === icon ? 'bg-primary/15 ring-2 ring-primary' : 'hover:bg-surface-container'}`}>
                        <span className="material-symbols-outlined text-lg text-on-surface">{icon}</span>
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
