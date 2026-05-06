import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import gasCall from '../../gasClient.js'
import Sidebar from './Sidebar.jsx'
import TopHeader from './TopHeader.jsx'
import DashboardPage from '../dashboard/DashboardPage.jsx'
import ProjectListPage from '../projects/ProjectListPage.jsx'
import KanbanPage from '../kanban/KanbanPage.jsx'
import TaskListPage from '../tasks/TaskListPage.jsx'
import TimelinePage from '../timeline/TimelinePage.jsx'
import ActivityPage from '../activities/ActivityPage.jsx'
import LabelManager from '../labels/LabelManager.jsx'
import UserManager from '../users/UserManager.jsx'

const SIDEBAR_STORAGE_KEY = 'workmgr_sidebar_collapsed'

export default function MainLayout() {
  const { session } = useAuth()
  const [currentView, setCurrentView] = useState('dashboard')
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true')
  const [masterData, setMasterData] = useState({ duAn: [], nhan: [], users: [] })
  const [loading, setLoading] = useState(true)

  const handleToggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const loadMasterData = useCallback(async () => {
    try {
      const data = await gasCall('api_getAllData', session.token)
      if (data) setMasterData(data)
    } catch (e) { console.error('loadMasterData:', e) }
    setLoading(false)
  }, [session?.token])

  useEffect(() => { loadMasterData() }, [loadMasterData])

  const renderView = () => {
    const props = { masterData, reloadMaster: loadMasterData, token: session.token }
    switch (currentView) {
      case 'dashboard': return <DashboardPage {...props} />
      case 'projects': return <ProjectListPage {...props} />
      case 'kanban': return <KanbanPage {...props} />
      case 'tasks': return <TaskListPage {...props} />
      case 'timeline': return <TimelinePage {...props} />
      case 'activities': return <ActivityPage {...props} />
      case 'labels': return <LabelManager {...props} />
      case 'users': return <UserManager {...props} />
      default: return <DashboardPage {...props} />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <span className="text-on-surface-variant text-sm">Đang tải dữ liệu…</span>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} collapsed={collapsed} onToggle={handleToggleSidebar} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopHeader
          username={session?.username}
          email={session?.email}
          role={session?.role}
          appName="Quản Lý Công Việc"
          onToggleSidebar={handleToggleSidebar}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-background">
          <div className="page-enter max-w-[1400px] mx-auto">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  )
}
