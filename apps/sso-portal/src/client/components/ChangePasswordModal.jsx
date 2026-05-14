import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import gasCall from '../gasClient.js'

const RULES = [
  { key: 'length', label: 'Tối thiểu 8 ký tự', test: p => p.length >= 8 },
  { key: 'upper',  label: 'Có chữ hoa (A-Z)', test: p => /[A-Z]/.test(p) },
  { key: 'lower',  label: 'Có chữ thường (a-z)', test: p => /[a-z]/.test(p) },
  { key: 'digit',  label: 'Có số (0-9)', test: p => /[0-9]/.test(p) },
  { key: 'special', label: 'Có ký tự đặc biệt (!@#$%^&*...)', test: p => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
]

export default function ChangePasswordModal({ forced = false, onClose }) {
  const { session, updateSession, logout } = useAuth()
  const { addToast } = useToast()
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const allValid = RULES.every(r => r.test(newPass))
  const passwordsMatch = newPass === confirmPass && confirmPass.length > 0
  const canSubmit = oldPass && allValid && passwordsMatch && !loading

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      await gasCall('api_changePassword', session.token, oldPass, newPass)
      updateSession({ mustChangePass: false })
      addToast('Đổi mật khẩu thành công', 'success')
      if (onClose) onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest rounded-3xl shadow-md3-3 w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl text-tertiary">key</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-on-surface">Đổi mật khẩu</h2>
            {forced && <p className="text-xs text-on-surface-variant">Bạn cần đổi mật khẩu trước khi tiếp tục</p>}
          </div>
          {!forced && onClose && (
            <button onClick={onClose} disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors shrink-0 disabled:opacity-50">
              <span className="material-symbols-outlined text-xl text-on-surface-variant">close</span>
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Mật khẩu cũ</label>
            <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary transition disabled:opacity-60 disabled:cursor-not-allowed"
              autoFocus autoComplete="current-password" disabled={loading} />
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Mật khẩu mới</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary transition disabled:opacity-60 disabled:cursor-not-allowed"
              autoComplete="new-password" disabled={loading} />
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Xác nhận mật khẩu mới</label>
            <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary transition disabled:opacity-60 disabled:cursor-not-allowed"
              autoComplete="new-password" disabled={loading} />
            {confirmPass && !passwordsMatch && (
              <p className="text-xs text-error mt-1">Mật khẩu xác nhận không khớp</p>
            )}
          </div>

          {/* Policy checklist */}
          <div className="bg-surface-container rounded-xl p-3">
            <p className="text-xs font-medium text-on-surface-variant mb-2">Yêu cầu mật khẩu:</p>
            <div className="space-y-1">
              {RULES.map(r => {
                const pass = r.test(newPass)
                return (
                  <div key={r.key} className={`flex items-center gap-2 text-xs ${pass ? 'text-green-600' : 'text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-sm">{pass ? 'check_circle' : 'radio_button_unchecked'}</span>
                    {r.label}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            {!forced && (
              <button type="button" onClick={onClose} disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant text-sm font-medium hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed transition">
                Hủy
              </button>
            )}
            {forced && (
              <button type="button" onClick={logout} disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant text-sm font-medium hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed transition">
                Đăng xuất
              </button>
            )}
            <button type="submit" disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-lg">key</span>
              )}
              {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
