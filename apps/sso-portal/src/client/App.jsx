import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ConfirmProvider } from './context/ConfirmContext.jsx'
import { PortalDataProvider } from './context/PortalDataContext.jsx'
import LoginPage from './components/LoginPage.jsx'
import ChangePasswordModal from './components/ChangePasswordModal.jsx'
import Dashboard from './components/Dashboard.jsx'

function AppInner() {
  const { session, loading, sessionExpired, acknowledgeExpiry } = useAuth()

  let content
  if (loading) {
    content = (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-primary animate-pulse">shield_person</span>
          <p className="mt-3 text-on-surface-variant text-sm">Đang tải...</p>
        </div>
      </div>
    )
  } else if (!session) {
    content = <LoginPage />
  } else if (session.mustChangePass) {
    content = <ChangePasswordModal forced />
  } else {
    content = <PortalDataProvider><Dashboard /></PortalDataProvider>
  }

  return (
    <>
      {content}
      {sessionExpired && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
          <div className="bg-surface rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-sm p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-secondary-container" style={{ fontSize: 20 }}>schedule</span>
              </div>
              <div className="pt-1">
                <p className="font-semibold text-on-surface text-sm">Phiên đăng nhập đã hết hạn</p>
                <p className="text-sm text-on-surface-variant mt-1">Vui lòng đăng nhập lại để tiếp tục sử dụng.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={acknowledgeExpiry}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors">
                Đăng nhập lại
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
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
