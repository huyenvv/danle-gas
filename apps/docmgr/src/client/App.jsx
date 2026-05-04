import { HashRouter } from 'react-router-dom'
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
          <span className="material-symbols-outlined text-on-primary text-2xl" style={{ fontVariationSettings: '"FILL" 1' }}>folder_special</span>
        </div>
        <span className="text-on-surface-variant text-sm">Đang khởi tạo…</span>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low p-4">
        <div className="bg-white rounded-3xl shadow-card p-10 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-error-container flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-error text-3xl">lock</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface">Không có quyền truy cập</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">{accessError}</p>
          <p className="text-xs text-on-surface-variant">Nếu quản trị viên vừa cấp quyền cho bạn, hãy tải lại trang để cập nhật.</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary-700 transition-colors shadow-md3-1"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            Tải lại trang
          </button>
        </div>
      </div>
    )
  }

  return session ? <MainApp /> : null
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppInner />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  )
}
