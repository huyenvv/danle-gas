import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ConfirmProvider } from './context/ConfirmContext.jsx'
import MainApp from './components/MainApp.jsx'

function AppInner() {
  const { session, loading, accessDenied, accessError } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-container-low gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-on-primary text-2xl" style={{ fontVariationSettings: '"FILL" 1' }}>description</span>
        </div>
        <span className="text-on-surface-variant text-sm">Đang khởi tạo…</span>
      </div>
    )
  }

  if (accessDenied) {
    const isExpired = /hết hạn|đăng xuất/i.test(accessError)
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low p-4">
        <div className="bg-white rounded-3xl shadow-card p-10 max-w-md w-full text-center space-y-4">
          <div className={`w-16 h-16 rounded-2xl ${isExpired ? 'bg-secondary-container' : 'bg-error-container'} flex items-center justify-center mx-auto`}>
            <span className={`material-symbols-outlined ${isExpired ? 'text-on-secondary-container' : 'text-error'} text-3xl`}>
              {isExpired ? 'schedule' : 'lock'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-on-surface">
            {isExpired ? 'Phiên đăng nhập đã hết hạn' : 'Không có quyền truy cập'}
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">{accessError}</p>
          {isExpired && (
            <>
              <button
                onClick={() => { try { window.top.location.reload() } catch(_) { /* cross-origin blocked by GAS iframe */ } }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-full text-sm font-medium hover:opacity-90 transition"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
                Đăng nhập lại
              </button>
              <p className="text-xs text-on-surface-variant">
                Nếu không tự tải lại, hãy quay lại ứng dụng chính và mở lại, hoặc refresh trình duyệt.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  return session ? <MainApp /> : null
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AppInner />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
