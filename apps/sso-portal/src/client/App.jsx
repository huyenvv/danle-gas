import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ConfirmProvider } from './context/ConfirmContext.jsx'
import LoginPage from './components/LoginPage.jsx'
import ChangePasswordModal from './components/ChangePasswordModal.jsx'
import Dashboard from './components/Dashboard.jsx'

function AppInner() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-primary animate-pulse">shield_person</span>
          <p className="mt-3 text-on-surface-variant text-sm">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!session) return <LoginPage />
  if (session.mustChangePass) return <ChangePasswordModal forced />

  return <Dashboard />
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
