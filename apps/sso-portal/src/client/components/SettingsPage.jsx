import { useState, useEffect } from 'react'
import { usePortalData } from '../context/PortalDataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import gasCall from '../gasClient.js'

export default function SettingsPage() {
  const { mailConfig, sync } = usePortalData()
  const { addToast } = useToast()
  const [config, setConfig] = useState(mailConfig)

  // Sync local state when context updates (e.g. after portalSync completes)
  useEffect(() => { setConfig(mailConfig) }, [mailConfig])
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const accessToken = localStorage.getItem('sso_access_token')
    try {
      await gasCall('api_saveMailConfig', accessToken, config)
      await sync(true)
      addToast('Đã lưu cấu hình', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function updateConfig(key, value) {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold text-on-surface mb-5">Cài đặt</h2>

      {/* Email config */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl text-primary">mail</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-on-surface">Gửi email thông báo</h3>
            <p className="text-xs text-on-surface-variant">Cấu hình gửi email khi tạo user mới hoặc reset mật khẩu</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-on-surface">Bật gửi email</label>
            <button
              onClick={() => updateConfig('MAIL_ENABLED', config.MAIL_ENABLED === 'TRUE' ? 'FALSE' : 'TRUE')}
              className={`w-11 h-6 rounded-full transition-colors relative
                ${config.MAIL_ENABLED === 'TRUE' ? 'bg-accent' : 'bg-outline-variant'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform
                ${config.MAIL_ENABLED === 'TRUE' ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {config.MAIL_ENABLED === 'TRUE' && (
            <>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Email người gửi (Gmail alias)</label>
                <input type="email" value={config.MAIL_SENDER_EMAIL || ''}
                  onChange={e => updateConfig('MAIL_SENDER_EMAIL', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                  placeholder="vd: noreply@company.com" />
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Tên hiển thị người gửi</label>
                <input type="text" value={config.MAIL_SENDER_NAME || ''}
                  onChange={e => updateConfig('MAIL_SENDER_NAME', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                  placeholder="vd: Hệ thống quản lý" />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 text-xs text-amber-800 flex items-start gap-2">
                <span className="material-symbols-outlined text-sm mt-0.5">info</span>
                <div className="space-y-1">
                  <p>Để gửi từ email khác (không phải tài khoản deploy script), bạn cần thêm email đó làm <strong>alias</strong> trong Gmail: <strong>Settings → Accounts and Import → Send mail as → Add another email address</strong>.</p>
                  <p>Sau khi xác minh alias xong, nhập email alias vào ô "Email người gửi" ở trên. GAS sẽ tự xác thực qua OAuth — không cần mật khẩu hay token riêng.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Tiêu đề email (tạo user mới)</label>
                <input type="text" value={config.MAIL_SUBJECT_NEW_USER || ''}
                  onChange={e => updateConfig('MAIL_SUBJECT_NEW_USER', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                  placeholder="Tài khoản mới đã được tạo" />
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  Nội dung email
                  <span className="text-outline ml-1">(dùng {'{username}'} và {'{password}'} làm biến)</span>
                </label>
                <textarea value={config.MAIL_BODY_NEW_USER || ''}
                  onChange={e => updateConfig('MAIL_BODY_NEW_USER', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary transition resize-none font-mono"
                  rows={5}
                  placeholder={'Xin chào {username},\n\nTài khoản của bạn đã được tạo.\nTên đăng nhập: {username}\nMật khẩu mặc định: {password}\n\nVui lòng đổi mật khẩu ngay lần đăng nhập đầu tiên.'} />
              </div>
            </>
          )}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition flex items-center gap-2">
        <span className="material-symbols-outlined text-lg">save</span>
        {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
      </button>
    </div>
  )
}
