import { useState } from 'react'
import gasCall from '../gasClient.js'

export default function SettingsPage({ token }) {
  const [rootFolder, setRootFolder] = useState('')
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    try {
      await gasCall('api_setConfig', token, 'ROOT_FOLDER_ID', rootFolder)
      setMsg('Đã lưu cài đặt thành công')
    } catch (err) {
      setMsg('Lỗi: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg">
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <h3 className="font-semibold text-gray-800">Cài đặt hệ thống</h3>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Drive Root Folder ID</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={rootFolder}
              onChange={e => setRootFolder(e.target.value)}
              placeholder="1ABC...xyz"
            />
            <p className="text-xs text-gray-400 mt-1">ID của thư mục gốc trên Google Drive để lưu file đính kèm</p>
          </div>

          {msg && (
            <div className={`text-sm px-4 py-3 rounded-lg ${msg.startsWith('Lỗi') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {msg}
            </div>
          )}

          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Đang lưu…' : 'Lưu cài đặt'}
          </button>
        </form>
      </div>
    </div>
  )
}
