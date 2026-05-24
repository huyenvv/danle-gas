import { useState } from 'react'
import { usePortalData } from '../context/PortalDataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import gasCall from '../gasClient.js'

function Icon({ name, size = 20, className = '' }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={{ fontSize: size }}>
      {name}
    </span>
  )
}

export default function PhongBanManager() {
  const { phongBan, users, sync } = usePortalData()
  const { addToast } = useToast()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [formData, setFormData] = useState({ name: '', truong: '', pho: [] })
  const [saving, setSaving] = useState(false)

  function getToken() { return localStorage.getItem('sso_access_token') }

  function getUserName(userId) {
    const u = (users || []).find(u => String(u.ID) === String(userId))
    return u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : ''
  }

  function getMemberCount(dept) {
    const name = dept['Tên phòng ban']
    return (users || []).filter(u => u['Phòng ban'] === name).length
  }

  function parsePho(val) {
    if (!val) return []
    try {
      const arr = typeof val === 'string' ? JSON.parse(val) : val
      return Array.isArray(arr) ? arr.map(String) : []
    } catch (_) { return [] }
  }

  function openAdd() {
    setEditId(null)
    setFormData({ name: '', truong: '', pho: [] })
    setShowForm(true)
  }

  function openEdit(dept) {
    setEditId(dept.ID)
    setFormData({
      name: dept['Tên phòng ban'] || '',
      truong: dept['Trưởng'] ? String(dept['Trưởng']) : '',
      pho: parsePho(dept['Phó']),
    })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.name.trim()) return
    setSaving(true)
    try {
      const data = {
        'Tên phòng ban': formData.name.trim(),
        'Trưởng': formData.truong || '',
        'Phó': formData.pho,
      }
      if (editId) {
        await gasCall('api_updatePhongBan', getToken(), editId, data)
        addToast('Cập nhật phòng ban thành công', 'success')
      } else {
        await gasCall('api_addPhongBan', getToken(), data)
        addToast('Thêm phòng ban thành công', 'success')
      }
      setShowForm(false)
      setEditId(null)
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(dept) {
    if (!await confirm(`Xóa phòng ban "${dept['Tên phòng ban']}"? Chức vụ của các thành viên sẽ bị xóa.`)) return
    try {
      await gasCall('api_deletePhongBan', getToken(), dept.ID)
      addToast('Đã xóa phòng ban', 'success')
      await sync(true)
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  function togglePho(userId) {
    setFormData(f => {
      const next = f.pho.includes(userId) ? f.pho.filter(id => id !== userId) : [...f.pho, userId]
      return { ...f, pho: next }
    })
  }

  // Filter users for Trưởng/Phó selection: show all active users
  const activeUsers = (users || []).filter(u => u['Trạng thái'] !== 'Locked')

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon name="apartment" size={22} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-on-surface-variant mb-0.5">Phòng ban</p>
            <p className="text-2xl font-bold text-primary">{phongBan.length}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <span className="text-sm text-on-surface-variant flex-1">{phongBan.length} phòng ban</span>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1">
          <Icon name="add" size={18} />
          Thêm phòng ban
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Tên phòng ban</th>
                <th className="px-4 py-3 text-center font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Thành viên</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Trưởng phòng</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Phó phòng</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {phongBan.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-on-surface-variant">Chưa có phòng ban</td></tr>
              )}
              {phongBan.map(dept => {
                const phoIds = parsePho(dept['Phó'])
                return (
                  <tr key={dept.ID} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon name="apartment" size={16} className="text-primary" />
                        </div>
                        <span className="font-medium text-on-surface">{dept['Tên phòng ban']}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                        <Icon name="group" size={12} />
                        {getMemberCount(dept)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {dept['Trưởng'] ? getUserName(dept['Trưởng']) || '—' : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {phoIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {phoIds.map(id => (
                            <span key={id} className="inline-block bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full">
                              {getUserName(id) || id}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-on-surface-variant">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(dept)} title="Sửa"
                          className="text-xs px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors font-medium">Sửa</button>
                        <button onClick={() => handleDelete(dept)} title="Xóa"
                          className="text-xs px-2.5 py-1 rounded-lg text-error hover:bg-error/10 transition-colors font-medium">Xóa</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.2)] w-full max-w-md flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/40">
              <div className="flex items-center gap-2">
                <Icon name={editId ? 'edit' : 'add'} size={20} className="text-primary" />
                <span className="font-semibold text-on-surface text-sm">{editId ? 'Sửa phòng ban' : 'Thêm phòng ban mới'}</span>
              </div>
              <button onClick={() => { setShowForm(false); setEditId(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors">
                <Icon name="close" size={20} className="text-on-surface-variant" />
              </button>
            </div>
            <div className="px-6 py-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">Tên phòng ban *</label>
                  <input type="text" value={formData.name} autoFocus
                    onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                    placeholder="vd: Phòng Kỹ thuật" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">Trưởng phòng</label>
                  <select value={formData.truong}
                    onChange={e => setFormData(f => ({ ...f, truong: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition">
                    <option value="">-- Chọn --</option>
                    {activeUsers.map(u => (
                      <option key={u.ID} value={String(u.ID)}>{u['Tên nhân viên'] || u['Tên đăng nhập']} ({u['Email']})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5">Phó phòng</label>
                  {formData.pho.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {formData.pho.map(id => {
                        const u = activeUsers.find(u => String(u.ID) === id)
                        return (
                          <span key={id} className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full">
                            {u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : id}
                            <button type="button" onClick={() => togglePho(id)}
                              className="hover:text-error transition-colors">
                              <Icon name="close" size={10} />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <select value=""
                    onChange={e => { if (e.target.value) togglePho(e.target.value) }}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition">
                    <option value="">+ Thêm phó phòng...</option>
                    {activeUsers
                      .filter(u => String(u.ID) !== formData.truong && !formData.pho.includes(String(u.ID)))
                      .map(u => (
                        <option key={u.ID} value={String(u.ID)}>{u['Tên nhân viên'] || u['Tên đăng nhập']} ({u['Email']})</option>
                      ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
                    className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant text-sm font-medium hover:bg-surface-container transition-colors">
                    Hủy
                  </button>
                  <button type="submit"
                    disabled={saving || !formData.name.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-md3-1">
                    {saving ? 'Đang lưu...' : (editId ? 'Cập nhật' : 'Thêm')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
