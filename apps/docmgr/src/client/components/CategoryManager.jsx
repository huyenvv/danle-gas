import { useState, useEffect } from 'react'
import gasCall from '../gasClient.js'

export default function CategoryManager({ token, lookups, onUpdate }) {
  const [cats, setCats]           = useState(lookups.danhMuc || [])
  const [editing, setEditing]     = useState(null)   // null | category object
  const [adding, setAdding]       = useState(false)
  const [form, setForm]           = useState({ 'Tên danh mục': '', 'Icon': '', 'Màu sắc': '#3b82f6', 'Mô tả': '' })
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => { setCats(lookups.danhMuc || []) }, [lookups.danhMuc])

  function startAdd() {
    setForm({ 'Tên danh mục': '', 'Icon': '', 'Màu sắc': '#3b82f6', 'Mô tả': '' })
    setEditing(null)
    setAdding(true)
    setError('')
  }

  function startEdit(cat) {
    setForm({ ...cat })
    setEditing(cat)
    setAdding(false)
    setError('')
  }

  async function handleSave() {
    if (!form['Tên danh mục']) { setError('Tên danh mục là bắt buộc'); return }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await gasCall('api_updateCategory', token, editing.ID, form)
      } else {
        await gasCall('api_addCategory', token, form)
      }
      setEditing(null)
      setAdding(false)
      onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cat) {
    if (!window.confirm(`Xóa danh mục "${cat['Tên danh mục']}"?`)) return
    try {
      await gasCall('api_deleteCategory', token, cat.ID)
      onUpdate()
    } catch (err) {
      alert('Lỗi: ' + err.message)
    }
  }

  const showForm = adding || editing !== null

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">{cats.length} danh mục</span>
        <button onClick={startAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + Thêm danh mục
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3 border border-blue-100">
          <h4 className="font-medium text-sm">{editing ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Tên danh mục *</label>
              <input className={cls} value={form['Tên danh mục']} onChange={e => setForm(f => ({ ...f, 'Tên danh mục': e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Icon (emoji)</label>
              <input className={cls} value={form['Icon']} onChange={e => setForm(f => ({ ...f, 'Icon': e.target.value }))} placeholder="📄" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Màu sắc</label>
              <input type="color" className="h-9 w-full border border-gray-300 rounded-lg" value={form['Màu sắc']} onChange={e => setForm(f => ({ ...f, 'Màu sắc': e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Mô tả</label>
              <input className={cls} value={form['Mô tả']} onChange={e => setForm(f => ({ ...f, 'Mô tả': e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setEditing(null) }} className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm">Hủy</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-60">
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Icon</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Tên danh mục</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Màu</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Mô tả</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cats.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Chưa có danh mục</td></tr>
            )}
            {cats.map(cat => (
              <tr key={cat.ID} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xl">{cat.Icon}</td>
                <td className="px-4 py-3 font-medium">{cat['Tên danh mục']}</td>
                <td className="px-4 py-3">
                  <span className="inline-block w-5 h-5 rounded-full border border-gray-200" style={{ background: cat['Màu sắc'] }} />
                </td>
                <td className="px-4 py-3 text-gray-500">{cat['Mô tả']}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => startEdit(cat)} className="text-blue-600 hover:text-blue-800 text-xs">Sửa</button>
                    <button onClick={() => handleDelete(cat)} className="text-red-500 hover:text-red-700 text-xs">Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const cls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-0.5'
