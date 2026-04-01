import { useState } from 'react'
import gasCall from '../gasClient.js'

export default function ChangePasswordModal({ token, forced, onClose, onChanged }) {
  const [oldPw, setOldPw]   = useState('')
  const [newPw, setNewPw]   = useState('')
  const [confPw, setConfPw] = useState('')
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (newPw.length < 6) { setError('Mật khẩu mới phải có ít nhất 6 ký tự'); return }
    if (newPw !== confPw)  { setError('Xác nhận mật khẩu không khớp'); return }
    setSaving(true)
    setError('')
    try {
      await gasCall('api_changePassword', token, oldPw, newPw)
      onChanged()   // Force re-login
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <h3 className="font-semibold text-gray-900 mb-1">Đổi mật khẩu</h3>
        {forced && <p className="text-sm text-amber-600 mb-4">Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng.</p>}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Mật khẩu hiện tại</label>
            <input type="password" className={cls} value={oldPw} onChange={e => setOldPw(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Mật khẩu mới</label>
            <input type="password" className={cls} value={newPw} onChange={e => setNewPw(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Xác nhận mật khẩu mới</label>
            <input type="password" className={cls} value={confPw} onChange={e => setConfPw(e.target.value)} />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            {!forced && (
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Hủy</button>
            )}
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-60">
              {saving ? 'Đang lưu…' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const cls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-0.5'
