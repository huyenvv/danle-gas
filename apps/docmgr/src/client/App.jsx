import { HashRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import LoginPage from './components/LoginPage.jsx'
import MainApp from './components/MainApp.jsx'

function AppInner() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Đang khởi tạo…</div>
      </div>
    )
  }

  return session ? <MainApp /> : <LoginPage />
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </HashRouter>
  )
}
