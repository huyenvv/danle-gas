import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext.jsx'
import gasCall from '../gasClient.js'
import { dataCache, prefetchLookups, refreshLookups, startPolling, stopPolling } from '../utils/dataCache.js'
import { formatCurrency, formatDate, statusColor } from '../utils/format.js'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import DocumentModal from './DocumentModal.jsx'
import Sidebar from './Sidebar.jsx'
import StatsCards from './StatsCards.jsx'
import CategoryManager from './CategoryManager.jsx'
import UserManager from './UserManager.jsx'
import SettingsPage from './SettingsPage.jsx'
import LoadingOverlay from './common/LoadingOverlay.jsx'
import { groupUsersByDept } from '../utils/groupUsers.js'
import GroupManager from './departments/GroupManager.jsx'
import SupplierManager from './suppliers/SupplierManager.jsx'
import ProjectManager from './projects/ProjectManager.jsx'
import DocumentPreview from './documents/DocumentPreview.jsx'
import AuditLogPage from './AuditLogPage.jsx'
import ImportManager from './ImportManager.jsx'
import CreateMenu from './CreateMenu.jsx'
import TopHeader from './layout/TopHeader.jsx'
import { getDeadlineStatus } from '../utils/deadlineStatus.js'
import Icon from './common/Icon.jsx'
import PublishHistory from './documents/PublishHistory.jsx'

const ROOT_FOLDER_BATCH_SIZE = 25

function parseAssignees(value) {
  if (!value) return []
  if (typeof value === 'string' && value.charAt(0) === '[') {
    try {
      return JSON.parse(value).map(String)
    } catch (_) {}
  }
  return [String(value)]
}

export default function MainApp() {
  const { session, logout } = useAuth()
  const { showToast } = useToast()
  const confirm = useConfirm()

  const [page, setPage]            = useState('documents')
  const [allDocs, setAllDocs]      = useState([])
  const [stats, setStats]          = useState(null)
  const [lookups, setLookups]      = useState({ danhMuc: [], nhom: [], duAn: [], nhaCungCap: [] })
  const [loading, setLoading]      = useState(true)
  const [globalLoading, setGlobalLoading] = useState(false)
  const [error, setError]          = useState('')
  const [hasNewUnread, setHasNewUnread] = useState(false)
  const prevUnreadRef = useRef(0)
  const [companyName, setCompanyName] = useState('')
  const [initialConfigs, setInitialConfigs] = useState(null)

  // Filters
  const [filters, setFilters]         = useState({})
  const [searchInput, setSearchInput] = useState('')   // controlled input value
  const [searchKeyword, setSearchKeyword] = useState('') // committed server keyword
  const searchKeywordRef = useRef('')

  // Modals
  const [docModal, setDocModal]       = useState(null)   // null | { mode: 'create'|'edit', doc? }
  const [previewDoc, setPreviewDoc]   = useState(null)

  // Per-root load-more state
  const [rootDisplayCounts, setRootDisplayCounts] = useState({})

  // Collapsed category groups
  const [collapsed, setCollapsed]     = useState({})

  // Unread tracking (DA_DOC stores unread records)
  const [unreadDocIds, setUnreadDocIds] = useState(new Set())
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Sidebar collapse — persisted to localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  )

  function toggleSidebar() {
    setSidebarCollapsed(c => {
      const next = !c
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  const failCountRef = useRef(0)

  const loadDocs = useCallback(async ({ silent = false, keyword = '' } = {}) => {
    if (!silent) { setLoading(true); setError('') }
    try {
      const filters = keyword ? { keyword } : {}
      const [docsRes, statsRes] = await Promise.all([
        gasCall('api_getDocuments', localStorage.getItem('docmgr_access_token'), filters),
        gasCall('api_getDocumentStats', localStorage.getItem('docmgr_access_token')),
      ])
      const nextDocs = (docsRes && docsRes.data) ? docsRes.data : []
      setAllDocs(nextDocs)
      if (!keyword) dataCache.set('docs', nextDocs) // only cache unfiltered results
      setStats(statsRes || {})
      failCountRef.current = 0
    } catch (err) {
      failCountRef.current++
      if (!silent) {
        setError(err.message)
      } else if (failCountRef.current >= 3) {
        showToast('Lỗi tải dữ liệu liên tục. Thử tải lại trang.', 'error')
        failCountRef.current = 0
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [session])

  const upsertDocInCache = useCallback((nextDoc) => {
    if (!nextDoc) return
    setAllDocs(prev => {
      const existingIdx = prev.findIndex(d => String(d.ID) === String(nextDoc.ID))
      const next = existingIdx === -1
        ? [nextDoc, ...prev]
        : prev.map(d => String(d.ID) === String(nextDoc.ID) ? nextDoc : d)
      dataCache.set('docs', next)
      return next
    })
    setPreviewDoc(prev => (prev && String(prev.ID) === String(nextDoc.ID) ? nextDoc : prev))
  }, [])

  const removeDocFromCache = useCallback((docId) => {
    if (!docId) return
    setAllDocs(prev => {
      const next = prev.filter(d => String(d.ID) !== String(docId))
      dataCache.set('docs', next)
      return next
    })
  }, [])

  useEffect(() => {
    // Use server-injected initial data if available (no round trip)
    const injected = window.__INITIAL_DATA__
    if (injected) {
      window.__INITIAL_DATA__ = null
      if (injected.lookups) { setLookups(injected.lookups); dataCache.set('lookups', injected.lookups) }
      const nextDocs = injected.docs || []
      setAllDocs(nextDocs); dataCache.set('docs', nextDocs)
      if (injected.stats) setStats(injected.stats)
      if (injected.unreadIds) setUnreadDocIds(new Set(injected.unreadIds.map(String)))
      if (injected.companyName) setCompanyName(injected.companyName)
      if (injected.configs) setInitialConfigs(injected.configs)
      failCountRef.current = 0
      setLoading(false)
    } else {
      // Fallback: fetch via API (returning user with localStorage token)
      gasCall('api_getInitialData', localStorage.getItem('docmgr_access_token')).then(r => {
        if (r.lookups) { setLookups(r.lookups); dataCache.set('lookups', r.lookups) }
        const nextDocs = r.docs || []
        setAllDocs(nextDocs); dataCache.set('docs', nextDocs)
        if (r.stats) setStats(r.stats)
        if (r.unreadIds) setUnreadDocIds(new Set(r.unreadIds.map(String)))
        if (r.companyName) setCompanyName(r.companyName)
        if (r.configs) setInitialConfigs(r.configs)
        failCountRef.current = 0
        setLoading(false)
      }).catch(() => {
        // Fallback: try individual calls if combined API fails
        prefetchLookups(localStorage.getItem('docmgr_access_token')).then(setLookups).catch(() => {})
        loadDocs()
        gasCall('api_getUnreadDocIds', localStorage.getItem('docmgr_access_token')).then(r2 => setUnreadDocIds(new Set((r2.unreadIds || []).map(String)))).catch(() => {})
      })
    }

    // Background polling via dataCache (60s interval)
    startPolling(localStorage.getItem('docmgr_access_token'))

    // Subscribe to polling updates
    const unsubDocs = dataCache.subscribe('docs', data => {
      // Don't overwrite server-search results with polling data
      if (data && !searchKeywordRef.current) setAllDocs(data)
    })
    const unsubLookups = dataCache.subscribe('lookups', data => {
      if (data) setLookups(data)
    })
    const unsubUnread = dataCache.subscribe('unreadIds', data => {
      if (data) setUnreadDocIds(new Set(data.map(String)))
    })

    return () => {
      stopPolling()
      unsubDocs()
      unsubLookups()
      unsubUnread()
    }
  }, [session])

  function handleFilterChange(key, val) {
    setFilters(f => ({ ...f, [key]: val || undefined }))
  }

  async function handleDeleteDoc(id) {
    if (!await confirm('Xóa hồ sơ này?')) return false
    setGlobalLoading(true)
    try {
      await gasCall('api_deleteDocument', localStorage.getItem('docmgr_access_token'), id)
      removeDocFromCache(id)
      showToast('Đã xóa hồ sơ', 'success')
      return true
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error')
      return false
    } finally {
      setGlobalLoading(false)
    }
  }

  const docs = useMemo(() => {
    let result = [...allDocs]
    // Search is server-side (triggered on Enter) — no client-side text filter here
    if (filters.danhMucId) result = result.filter(d => String(d['Danh mục']) === String(filters.danhMucId))
    if (filters.tinhTrang) result = result.filter(d => d['Tình trạng'] === filters.tinhTrang)
    if (filters.duAn) result = result.filter(d => d['Dự án (Phòng ban)'] === filters.duAn)
    if (filters.nhaCungCap) result = result.filter(d => d['Nhà cung cấp (Nơi ban hành)'] === filters.nhaCungCap)
    if (filters.phuTrach) result = result.filter(d => parseAssignees(d['Phụ trách']).includes(String(filters.phuTrach)))
    if (filters.readStatus === 'unread') result = result.filter(d => unreadDocIds.has(String(d.ID)))
    if (filters.readStatus === 'read')   result = result.filter(d => !unreadDocIds.has(String(d.ID)))
    if (filters.deadlineStatus) {
      result = result.filter(d => {
        if (d['Tình trạng'] === 'Hoàn thành') return false
        const dl = getDeadlineStatus(d['Ngày kết thúc'])
        if (!dl) return false
        if (filters.deadlineStatus === 'quaHan') return dl.level === 'overdue'
        if (filters.deadlineStatus === 'conHan1Tuan') return dl.level === 'urgent' || dl.level === 'warning'
        if (filters.deadlineStatus === 'conHan') return dl.daysLeft >= 0
        return true
      })
    }
    if (filters.myWork) {
      const me = session.username
      const meId = String(session.userId)
      const role = session.role
      if (role === 'Giám đốc') {
        result = result.filter(d => d['Tình trạng'] === 'Chờ duyệt')
      } else if (role === 'Văn thư') {
        result = result.filter(d => d['Người tạo'] === me)
      } else {
        // Nhân viên / Trưởng phòng: Phụ trách hoặc Phối hợp
        result = result.filter(d => {
          const pt = parseAssignees(d['Phụ trách'])
          const ph = parseAssignees(d['Người phối hợp'])
          return pt.includes(meId) || pt.includes(me) || ph.includes(meId) || ph.includes(me)
        })
      }
    }
    return result
  }, [allDocs, filters, unreadDocIds])

  // Bell count = unread docs (DA_DOC has record = unread)
  const unreadCount = useMemo(
    () => unreadDocIds.size,
    [unreadDocIds]
  )

  // Detect newly arrived unread docs for bell animation
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) setHasNewUnread(true)
    prevUnreadRef.current = unreadCount
  }, [unreadCount])

  async function handleBatchMarkRead() {
    if (selectedIds.size === 0) return
    setGlobalLoading(true)
    try {
      const ids = [...selectedIds]
      await gasCall('api_markMultipleAsRead', localStorage.getItem('docmgr_access_token'), ids)
      setUnreadDocIds(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(String(id)))
        return next
      })
      setSelectedIds(new Set())
    } catch (err) {
      alert('Lỗi: ' + err.message)
    } finally {
      setGlobalLoading(false)
    }
  }

  const isAdmin = session.role === 'admin' || session.role === 'Giám đốc' || session.role === 'Quản trị viên'
  const isSuperAdmin = session.role === 'admin' || session.role === 'Quản trị viên'
  // Map username → { name, email } for avatar labels + tooltips
  const usersMap = useMemo(() => {
    const map = {}
    ;(lookups.users || []).forEach(u => {
      map[u['Tên đăng nhập']] = { name: u['Tên nhân viên'] || u['Tên đăng nhập'], email: u['Email'] || '' }
    })
    return map
  }, [lookups.users])
  const canCreate = session.canCreate || session.role === 'admin' || session.role === 'Quản trị viên' || session.role === 'Văn thư'
  const canImport = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư'].includes(session.role) || session.canImport

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <Sidebar
        page={page}
        onPage={setPage}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        onCreateDoc={canCreate ? () => { setPage('documents'); setDocModal({ mode: 'create' }) } : undefined}
        onImport={canImport ? () => setPage('import') : undefined}
        collapsed={sidebarCollapsed}
        role={session.role}
        canCreateSubCat={session.canCreateSubCat}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopHeader
          username={session.username}
          email={session.email}
          role={session.role}
          onToggleSidebar={() => toggleSidebar()}
          onBellClick={() => { setHasNewUnread(false); setPage('documents'); setFilters(f => ({ ...f, readStatus: 'unread' })) }}
          unreadCount={unreadCount}
          hasNewUnread={hasNewUnread}
          companyName={companyName}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-background">
          <div className="page-enter">
          {page === 'documents' && (
            <div className="space-y-5">
              {/* {stats && <StatsCards stats={stats} />} */}

              {/* Toolbar */}
              <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-[2] min-w-[10rem]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" style={{ fontSize: 18 }}>search</span>
                  <input
                    className={`bg-surface-container-low border-none rounded-xl pl-9 pr-8 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/20 ${searchKeyword ? 'ring-2 ring-primary/30' : ''}`}
                    placeholder="Tìm kiếm hồ sơ… (Enter)"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const kw = searchInput.trim()
                        setSearchKeyword(kw); searchKeywordRef.current = kw
                        loadDocs({ keyword: kw })
                      }
                    }}
                  />
                  {searchKeyword && (
                    <button
                      type="button"
                      onClick={() => { setSearchInput(''); setSearchKeyword(''); searchKeywordRef.current = ''; loadDocs() }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  )}
                </div>

                {/* hidden — kept for bell-click programmatic filter */}
                <select className="hidden" value={filters.danhMucId || ''} onChange={e => handleFilterChange('danhMucId', e.target.value)}>
                  <option value="">Tất cả danh mục</option>
                  {lookups.danhMuc.map(c => <option key={c.ID} value={c.ID}>{c['Tên danh mục']}</option>)}
                </select>

                {session.role !== 'admin' && session.role !== 'Quản trị viên' && (
                <button
                  onClick={() => {
                    if (filters.myWork) {
                      setFilters({ myWork: false })
                    } else {
                      setFilters({ myWork: true })
                      if (searchKeyword) { setSearchInput(''); setSearchKeyword(''); searchKeywordRef.current = ''; loadDocs() }
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    filters.myWork
                      ? 'bg-accent text-white shadow-md3-1'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-accent/10 hover:text-accent'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>assignment_ind</span>
                  Công việc của tôi
                </button>
                )}

                <select
                  className="min-w-0 bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                  value={filters.readStatus || ''}
                  onChange={e => handleFilterChange('readStatus', e.target.value)}
                >
                  <option value="">Tất cả</option>
                  <option value="unread">Chưa đọc</option>
                  <option value="read">Đã đọc</option>
                </select>

                <select
                  className="min-w-0 bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                  value={filters.tinhTrang || ''}
                  onChange={e => handleFilterChange('tinhTrang', e.target.value)}
                >
                  <option value="">Tất cả tình trạng</option>
                  <option>Nháp</option>
                  <option>Chờ duyệt</option>
                  <option>Chờ xử lý</option>
                  <option>Đang xử lý</option>
                  <option>Chờ xác nhận HT</option>
                  <option>Hoàn thành</option>
                  <option>Từ chối</option>
                  <option>Từ chối kết quả</option>
                </select>

                <select
                  className="min-w-0 bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                  value={filters.deadlineStatus || ''}
                  onChange={e => handleFilterChange('deadlineStatus', e.target.value)}
                >
                  <option value="">Tất cả hạn</option>
                  <option value="conHan">Còn hạn</option>
                  <option value="conHan1Tuan">Còn hạn 1 tuần</option>
                  <option value="quaHan">Quá hạn</option>
                </select>

                <select
                  className="min-w-0 bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                  value={filters.duAn || ''}
                  onChange={e => handleFilterChange('duAn', e.target.value)}
                >
                  <option value="">Tất cả dự án</option>
                  {(lookups.duAn || []).map(p => (
                    <option key={p.ID} value={p['Tên dự án viết tắt']}>{p['Tên dự án viết tắt']}</option>
                  ))}
                </select>

                <select
                  className="min-w-0 bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                  value={filters.nhaCungCap || ''}
                  onChange={e => handleFilterChange('nhaCungCap', e.target.value)}
                >
                  <option value="">Tất cả NCC</option>
                  {(lookups.nhaCungCap || []).map(p => (
                    <option key={p.ID} value={p['Tên NCC viết tắt']}>{p['Tên NCC viết tắt']}</option>
                  ))}
                </select>

                <select
                  className="min-w-0 bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                  value={filters.phuTrach || ''}
                  onChange={e => handleFilterChange('phuTrach', e.target.value)}
                >
                  <option value="">Tất cả phụ trách</option>
                  {groupUsersByDept(lookups.users, lookups.phongBan, lookups.assignments).map(g => (
                    <optgroup key={g.name} label={g.name}>
                      {g.users.map(u => (
                        <option key={u.ID} value={u['Tên đăng nhập']}>{u['Tên nhân viên'] || u['Tên đăng nhập']}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={async () => {
                      dataCache.invalidate('docs')
                      dataCache.invalidate('lookups')
                      await Promise.all([loadDocs(), refreshLookups(localStorage.getItem('docmgr_access_token')).then(setLookups)])
                    }}
                    title="Làm mới dữ liệu"
                    className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container border border-outline-variant transition-colors"
                  >
                    <span className="material-symbols-outlined text-base leading-none">refresh</span>
                  </button>
                  {(canCreate || canImport) && (
                    <CreateMenu
                      label="Thêm hồ sơ"
                      compact
                      onCreate={canCreate ? () => setDocModal({ mode: 'create' }) : undefined}
                      onImport={canImport ? () => setPage('import') : undefined}
                    />
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">{error}</div>
              )}

              {/* Grouped Table */}
              <DocumentTable
                docs={docs}
                loading={loading}
                isAdmin={isAdmin}
                canDelete={isSuperAdmin}
                usersMap={usersMap}
                users={lookups.users}
                collapsed={collapsed}
                danhMuc={lookups.danhMuc}
                unreadDocIds={unreadDocIds}
                selectedIds={selectedIds}
                rootDisplayCounts={rootDisplayCounts}
                role={session.role}
                username={session.username}
                userId={session.userId}
                onToggleCat={catId => setCollapsed(c => ({ ...c, [catId]: !c[catId] }))}
                onLoadMoreRoot={rootKey => setRootDisplayCounts(prev => ({
                  ...prev,
                  [rootKey]: (prev[rootKey] || ROOT_FOLDER_BATCH_SIZE) + ROOT_FOLDER_BATCH_SIZE,
                }))}
                onToggleSelect={id => setSelectedIds(prev => {
                  const next = new Set(prev)
                  if (next.has(String(id))) next.delete(String(id)); else next.add(String(id))
                  return next
                })}
                onToggleAll={ids => setSelectedIds(prev => {
                  if (ids.every(id => prev.has(String(id)))) {
                    const next = new Set(prev); ids.forEach(id => next.delete(String(id))); return next
                  }
                  return new Set([...prev, ...ids.map(String)])
                })}
                onPreview={setPreviewDoc}
                onEdit={doc => setDocModal({ mode: 'edit', doc })}
                onDelete={handleDeleteDoc}
              />

              {/* Floating batch mark-read bar */}
              {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-on-surface text-surface px-5 py-3 rounded-2xl shadow-md3-3 animate-toast-in">
                  <span className="text-sm font-medium">Đã chọn {selectedIds.size} hồ sơ</span>
                  <button
                    onClick={handleBatchMarkRead}
                    className="flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-accent-hover transition-colors"
                  >
                    <span className="material-symbols-outlined text-base leading-none">mark_email_read</span>
                    Đánh dấu đã đọc
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} className="text-surface/70 hover:text-surface transition-colors">
                    <span className="material-symbols-outlined text-base leading-none">close</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {page === 'categories' && (
            <CategoryManager token={localStorage.getItem('docmgr_access_token')} lookups={lookups} onUpdate={() => refreshLookups(localStorage.getItem('docmgr_access_token')).then(setLookups)} session={session} />
          )}

          {page === 'groups' && isAdmin && (
            <GroupManager token={localStorage.getItem('docmgr_access_token')} lookups={lookups} onUpdate={() => refreshLookups(localStorage.getItem('docmgr_access_token')).then(setLookups)} />
          )}

          {page === 'suppliers' && (
            <SupplierManager token={localStorage.getItem('docmgr_access_token')} lookups={lookups} onUpdate={() => refreshLookups(localStorage.getItem('docmgr_access_token')).then(setLookups)} />
          )}

          {page === 'projects' && (
            <ProjectManager token={localStorage.getItem('docmgr_access_token')} lookups={lookups} onUpdate={() => refreshLookups(localStorage.getItem('docmgr_access_token')).then(setLookups)} />
          )}

          {isAdmin && (
            <div className={page === 'users' ? '' : 'hidden'}>
              <UserManager token={localStorage.getItem('docmgr_access_token')} lookups={lookups} session={session} />
            </div>
          )}

          {isSuperAdmin && (
            <div className={page === 'settings' ? '' : 'hidden'}>
              <SettingsPage token={localStorage.getItem('docmgr_access_token')} onCompanyNameChange={setCompanyName} initialConfigs={initialConfigs} />
            </div>
          )}

          {page === 'auditlogs' && isAdmin && (
            <AuditLogPage token={localStorage.getItem('docmgr_access_token')} />
          )}

          {page === 'import' && canImport && (
            <ImportManager
              token={localStorage.getItem('docmgr_access_token')}
              lookups={lookups}
              onImported={() => refreshLookups(localStorage.getItem('docmgr_access_token')).then(setLookups)}
            />
          )}
          </div>
        </main>
      </div>

      {docModal && (
        <DocumentModal
          mode={docModal.mode}
          doc={docModal.doc}
          lookups={lookups}
          token={localStorage.getItem('docmgr_access_token')}
          session={session}
          docs={docs}
          onClose={() => {
            const nextPreviewDoc = docModal.returnToPreview ? docModal.doc : null
            setDocModal(null)
            if (nextPreviewDoc) setPreviewDoc(nextPreviewDoc)
          }}
          onSaved={newDoc => {
            const shouldReturnToPreview = !!docModal.returnToPreview
            setDocModal(null)
            const doc = newDoc ? (newDoc.data || newDoc) : null
            if (doc) {
              upsertDocInCache(doc)
              if (shouldReturnToPreview) setPreviewDoc(doc)
            }
          }}
          onDeleted={id => removeDocFromCache(id)}
        />
      )}

      {previewDoc && (
        <DocumentPreview
          doc={previewDoc}
          lookups={lookups}
          isAdmin={isAdmin}
          canDelete={isSuperAdmin}
          token={localStorage.getItem('docmgr_access_token')}
          session={session}
          onClose={() => {
            setUnreadDocIds(prev => { const next = new Set(prev); next.delete(String(previewDoc.ID)); return next })
            setPreviewDoc(null)
          }}
          onEdit={() => {
            const currentDoc = previewDoc
            setPreviewDoc(null)
            setDocModal({ mode: 'edit', doc: currentDoc, returnToPreview: true })
          }}
          onDelete={async () => {
            const deleted = await handleDeleteDoc(previewDoc.ID)
            if (deleted) setPreviewDoc(null)
          }}
          onDocUpdated={upsertDocInCache}
        />
      )}

      {globalLoading && <LoadingOverlay />}
    </div>
  )
}

// ── Grouped document table (by category tree) with per-root load more ──────
function DocumentTable({ docs, loading, isAdmin, canDelete, usersMap, users, collapsed, danhMuc, unreadDocIds, selectedIds, rootDisplayCounts, role, username, userId, onToggleCat, onLoadMoreRoot, onToggleSelect, onToggleAll, onPreview, onEdit, onDelete }) {
  // Build docs-by-category map for ALL filtered docs (filters stay offline)
  const docsMap = {}
  docs.forEach(doc => {
    const key = String(doc['Danh mục'] || '')
    if (!docsMap[key]) docsMap[key] = []
    docsMap[key].push(doc)
  })

  // Root categories (no parent)
  const roots = (danhMuc || []).filter(c => !c['Danh mục cha'])

  // Count across ALL docs so category headers are always visible (even if their docs are on other pages)
  function subtreeDocCount(catId) {
    const direct = (docsMap[String(catId)] || []).length
    const children = (danhMuc || []).filter(c => String(c['Danh mục cha']) === String(catId))
    return direct + children.reduce((s, c) => s + subtreeDocCount(c.ID), 0)
  }

  function gatherSubtreeDocs(catId) {
    const children = (danhMuc || []).filter(c => String(c['Danh mục cha']) === String(catId))
    var result = []
    children.forEach(child => {
      result = result.concat(gatherSubtreeDocs(child.ID))
    })
    return result.concat(docsMap[String(catId)] || [])
  }

  // Uncategorized docs (category ID not in danhMuc)
  const validIds = new Set((danhMuc || []).map(c => String(c.ID)))
  const uncategorized = docs.filter(d => !validIds.has(String(d['Danh mục'] || '')))
  const uncategorizedTotal = docs.filter(d => !validIds.has(String(d['Danh mục'] || ''))).length

  const rootVisibleIdsMap = {}
  const rootVisibleIndexMap = {}
  roots.forEach(root => {
    const rootKey = String(root.ID)
    const limit = rootDisplayCounts[rootKey] || ROOT_FOLDER_BATCH_SIZE
    const visibleDocs = gatherSubtreeDocs(root.ID).slice(0, limit)
    rootVisibleIdsMap[rootKey] = new Set(visibleDocs.map(doc => String(doc.ID)))
    rootVisibleIndexMap[rootKey] = visibleDocs.reduce((acc, doc, index) => {
      acc[String(doc.ID)] = index + 1
      return acc
    }, {})
  })
  const uncategorizedLimit = rootDisplayCounts['__uncat__'] || ROOT_FOLDER_BATCH_SIZE
  const uncategorizedVisible = uncategorized.slice(0, uncategorizedLimit)
  const uncategorizedIndexMap = uncategorizedVisible.reduce((acc, doc, index) => {
    acc[String(doc.ID)] = index + 1
    return acc
  }, {})
  const visibleDocIds = roots.flatMap(root => Array.from(rootVisibleIdsMap[String(root.ID)] || []))
    .concat(uncategorizedVisible.map(doc => String(doc.ID)))
  const visibleDocIdSet = new Set(visibleDocIds)

  function visibleSubtreeDocCount(catId, rootId) {
    const rootVisibleIds = rootVisibleIdsMap[String(rootId)] || new Set()
    const direct = (docsMap[String(catId)] || []).filter(doc => rootVisibleIds.has(String(doc.ID))).length
    const children = (danhMuc || []).filter(c => String(c['Danh mục cha']) === String(catId))
    return direct + children.reduce((s, c) => s + visibleSubtreeDocCount(c.ID, rootId), 0)
  }

  const COL = 12

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-3 py-3 w-16">
                <div className="flex items-center gap-2">
                  <input type="checkbox"
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                    checked={visibleDocIds.length > 0 && visibleDocIds.every(id => selectedIds.has(String(id)))}
                    onChange={() => onToggleAll(visibleDocIds)}
                  />
                  <span className="font-semibold text-on-surface-variant text-xs uppercase tracking-wide">#</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide w-64 min-w-[16rem]">Tên hồ sơ</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Số hồ sơ</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Dự án (Nơi nhận)</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">NCC (Nơi gửi)</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Phụ trách</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Tình trạng</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Phát hành</th>
              <th className="hidden">Giá trị HĐ</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Ghi chú</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Ngày BH</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {loading && (
              <tr><td colSpan={COL} className="px-4 py-10 text-center text-on-surface-variant">Đang tải...</td></tr>
            )}
            {!loading && docs.length === 0 && (
              <tr><td colSpan={COL} className="px-4 py-10 text-center text-on-surface-variant">Không có hồ sơ nào</td></tr>
            )}
            {!loading && roots.map(cat => {
              const rootKey = String(cat.ID)
              const total = subtreeDocCount(cat.ID)
              const visibleCount = visibleSubtreeDocCount(cat.ID, cat.ID)
              return (
                <Fragment key={cat.ID}>
                  <CatGroup cat={cat} depth={0} rootId={cat.ID}
                    danhMuc={danhMuc} docsMap={docsMap} collapsed={collapsed} unreadDocIds={unreadDocIds}
                    visibleDocIds={rootVisibleIdsMap[rootKey] || new Set()}
                    indexMap={rootVisibleIndexMap[rootKey] || {}}
                    selectedIds={selectedIds} onToggleCat={onToggleCat} onToggleSelect={onToggleSelect}
                    isAdmin={isAdmin} canDelete={canDelete} usersMap={usersMap} users={users} onPreview={onPreview} onEdit={onEdit} onDelete={onDelete}
                    role={role} username={username} userId={userId} subtreeDocCount={subtreeDocCount} visibleSubtreeDocCount={visibleSubtreeDocCount}
                  />
                  {visibleCount < total && (
                    <tr>
                      <td colSpan={COL} className="px-4 py-3 text-center bg-surface-container-lowest">
                        <button
                          type="button"
                          onClick={() => onLoadMoreRoot(rootKey)}
                          className="px-3 py-1.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-container transition-colors"
                        >
                          Xem thêm ({Math.min(ROOT_FOLDER_BATCH_SIZE, total - visibleCount)} / {total - visibleCount})
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!loading && uncategorizedTotal > 0 && (
              <Fragment key="__uncat__">
                <tr className="bg-surface-container/50 cursor-pointer hover:bg-surface-container transition-colors"
                    onClick={() => onToggleCat('__uncat__')}>
                  <td colSpan={COL} className="px-4 py-2 font-semibold text-on-surface-variant text-xs">
                    <span className="mr-2">{collapsed['__uncat__'] ? '▶' : '▼'}</span>
                    (Chưa phân danh mục) <span className="font-normal ml-1">({uncategorizedTotal} hồ sơ)</span>
                  </td>
                </tr>
                {!collapsed['__uncat__'] && uncategorizedVisible.map(doc => (
                  <DocRow key={doc.ID} doc={doc} depth={0} unreadDocIds={unreadDocIds} selectedIds={selectedIds}
                    rowIndex={uncategorizedIndexMap[String(doc.ID)]}
                    onToggleSelect={onToggleSelect} isAdmin={isAdmin} canDelete={canDelete} usersMap={usersMap} users={users} onPreview={onPreview} onEdit={onEdit} onDelete={onDelete} role={role} username={username} userId={userId} />
                ))}
                {!collapsed['__uncat__'] && uncategorizedVisible.length < uncategorizedTotal && (
                  <tr>
                    <td colSpan={COL} className="px-4 py-3 text-center bg-surface-container-lowest">
                      <button
                        type="button"
                        onClick={() => onLoadMoreRoot('__uncat__')}
                        className="px-3 py-1.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-container transition-colors"
                      >
                        Xem thêm ({Math.min(ROOT_FOLDER_BATCH_SIZE, uncategorizedTotal - uncategorizedVisible.length)} / {uncategorizedTotal - uncategorizedVisible.length})
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            )}
          </tbody>
        </table>
      </div>
      {docs.length > 0 && (
        <div className="px-4 py-3 border-t border-outline-variant/40 flex items-center justify-between text-sm bg-surface-container-lowest">
          <span className="text-on-surface-variant">
            Hiển thị {visibleDocIdSet.size} / {docs.length} hồ sơ
          </span>
          <span className="text-on-surface-variant text-xs">Mỗi thư mục gốc hiển thị {ROOT_FOLDER_BATCH_SIZE} hồ sơ mỗi lần tải thêm</span>
        </div>
      )}
    </div>
  )
}

function CatGroup({ cat, depth, rootId, danhMuc, docsMap, collapsed, unreadDocIds, selectedIds, visibleDocIds, indexMap, onToggleCat, onToggleSelect, isAdmin, canDelete, usersMap, users, onPreview, onEdit, onDelete, role, username, userId, subtreeDocCount, visibleSubtreeDocCount }) {
  const total = subtreeDocCount(cat.ID)
  const visibleTotal = visibleSubtreeDocCount(cat.ID, rootId)
  if (depth > 0 && visibleTotal === 0) return null
  if (total === 0) return null
  const isCollapsed = collapsed[cat.ID]
  const children = danhMuc.filter(c => String(c['Danh mục cha']) === String(cat.ID))
  const directDocs = (docsMap[String(cat.ID)] || []).filter(doc => visibleDocIds.has(String(doc.ID)))
  const indent = depth * 16

  return (
    <Fragment>
      <tr className="bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
          onClick={() => onToggleCat(cat.ID)}>
        <td className="px-3 py-2 w-16" onClick={e => e.stopPropagation()}></td>
        <td colSpan={9} className="px-4 py-2 font-semibold text-primary text-xs" style={{ paddingLeft: indent + 16 }}>
          <span className="mr-2">{isCollapsed ? '▶' : '▼'}</span>
          {cat['Tên danh mục']} <span className="font-normal text-primary/70 ml-1">({total} hồ sơ)</span>
        </td>
        <td colSpan={2}></td>
      </tr>
      {!isCollapsed && children.map(child => (
        <CatGroup key={child.ID} cat={child} depth={depth + 1} rootId={rootId}
          danhMuc={danhMuc} docsMap={docsMap} collapsed={collapsed} unreadDocIds={unreadDocIds}
          visibleDocIds={visibleDocIds}
          indexMap={indexMap}
          selectedIds={selectedIds} onToggleCat={onToggleCat} onToggleSelect={onToggleSelect}
          isAdmin={isAdmin} canDelete={canDelete} usersMap={usersMap} users={users} onPreview={onPreview} onEdit={onEdit} onDelete={onDelete}
          role={role} username={username} userId={userId} subtreeDocCount={subtreeDocCount} visibleSubtreeDocCount={visibleSubtreeDocCount}
        />
      ))}
      {!isCollapsed && directDocs.map(doc => (
        <DocRow key={doc.ID} doc={doc} depth={depth + 1} unreadDocIds={unreadDocIds} selectedIds={selectedIds}
          rowIndex={indexMap[String(doc.ID)]}
          onToggleSelect={onToggleSelect} isAdmin={isAdmin} canDelete={canDelete} usersMap={usersMap} users={users} onPreview={onPreview} onEdit={onEdit} onDelete={onDelete} role={role} username={username} userId={userId} />
        ))}
    </Fragment>
  )
}

function DocRow({ doc, depth, rowIndex, unreadDocIds, selectedIds, onToggleSelect, isAdmin, canDelete, usersMap, users, onPreview, onEdit, onDelete, role, username, userId }) {
  const isRead = !unreadDocIds.has(String(doc.ID))
  const isSelected = selectedIds.has(String(doc.ID))
  const indent = depth * 16 + 16
  const { showToast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const menuBtnRef = useRef(null)
  const [showHistory, setShowHistory] = useState(false)

  const publishHistory = (() => {
    const raw = doc['Lịch sử phát hành']
    if (!raw) return []
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch (_) { return [] }
  })()
  const isVanThuOwnerRejected = role === 'Văn thư' && doc['Tình trạng'] === 'Từ chối' && doc['Người tạo'] === username
  const _ptList = (() => { try { const v = doc['Phụ trách']; return (typeof v === 'string' && v.charAt(0) === '[') ? JSON.parse(v).map(String) : (v ? [String(v)] : []) } catch(_) { return [] } })()
  const isPhuTrachRejectedResult = doc['Tình trạng'] === 'Từ chối kết quả' && (_ptList.includes(String(userId)) || _ptList.includes(username))
  const isOwnDraft = doc['Tình trạng'] === 'Nháp' && doc['Người tạo'] === username
  const canEditDoc = isOwnDraft
    || (role === 'Giám đốc' ? doc['Tình trạng'] === 'Chờ duyệt' : false)
    || role === 'admin' || role === 'Quản trị viên' || isVanThuOwnerRejected

  const fileInfos = (() => {
    const raw = doc['Tệp đính kèm']
    if (!raw) return []
    try {
      return typeof raw === 'string' && raw.charAt(0) === '[' ? JSON.parse(raw) : [{ fileId: raw }]
    } catch(_) { return [{ fileId: raw }] }
  })()
  const hasMenuItems = canEditDoc || fileInfos.length > 0 || canDelete

  function openMenu(e) {
    e.stopPropagation()
    if (!hasMenuItems) return
    if (menuBtnRef.current) {
      const r = menuBtnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setMenuOpen(v => !v)
  }

  const dl = doc['Tình trạng'] !== 'Hoàn thành' ? getDeadlineStatus(doc['Ngày kết thúc']) : null
  const isKhan = (doc['Khẩn'] === 'TRUE' || doc['Khẩn'] === true) && doc['Tình trạng'] !== 'Hoàn thành'
  const rowBg = dl && dl.level === 'overdue' ? 'bg-red-100'
    : isKhan ? 'bg-orange-100'
    : dl && dl.level === 'urgent' ? 'bg-yellow-50'
    : dl && dl.level === 'warning' ? 'bg-green-50'
    : isSelected ? 'bg-primary/5' : ''

  return (
    <tr
      className={`hover:bg-surface-container-low transition-colors cursor-pointer ${rowBg}`}
      onClick={() => isOwnDraft ? onEdit(doc) : onPreview(doc)}
    >
      <td className="px-3 py-3 w-16" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(doc.ID)}
            className="w-4 h-4 rounded accent-primary cursor-pointer" />
          <span className="text-xs text-on-surface-variant">{rowIndex || '—'}</span>
        </div>
      </td>
      <td className="px-4 py-3 w-64 min-w-[16rem] max-w-sm" style={{ paddingLeft: indent }}>
        {(() => {
          const isKhan = (doc['Khẩn'] === 'TRUE' || doc['Khẩn'] === true) && doc['Tình trạng'] !== 'Hoàn thành'
          const nameCls = isKhan && !isRead ? 'font-semibold text-on-surface'
            : isKhan && isRead ? 'text-on-surface-variant'
            : isRead ? 'text-on-surface-variant'
            : 'font-semibold text-on-surface'
          return (
            <span className={nameCls}>
              {!isRead && !isKhan && <span className="inline-block w-2 h-2 rounded-full bg-accent mr-2 align-middle" />}
              {isKhan && !isRead && <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2 align-middle" />}
              {isKhan && <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-semibold bg-red-100 text-red-700 border border-red-300 mr-1.5 align-middle"><span className="material-symbols-outlined" style={{ fontSize: 12 }}>rocket_launch</span>Khẩn</span>}
              {doc['Tên hồ sơ'] || <span className="italic text-on-surface-variant">(Chưa có tên)</span>}
            </span>
          )
        })()}
      </td>
      <td className="px-4 py-3 text-on-surface-variant text-xs">{doc['Số hồ sơ'] || '—'}</td>
      <td className="px-4 py-3 text-on-surface-variant max-w-[100px] truncate">{doc['Dự án (Phòng ban)'] || '—'}</td>
      <td className="px-4 py-3 text-on-surface-variant max-w-[120px] truncate">{doc['Nhà cung cấp (Nơi ban hành)'] || '—'}</td>
      <td className="px-4 py-3 max-w-[120px]">
        {(() => {
          let assignees = []
          const pt = doc['Phụ trách']
          if (pt) {
            try { assignees = (typeof pt === 'string' && pt.charAt(0) === '[') ? JSON.parse(pt) : [pt] } catch(_) { assignees = [String(pt)] }
          }
          if (!assignees.length) return <span className="text-on-surface-variant">—</span>
          return (
            <div className="flex -space-x-1.5">
              {assignees.slice(0, 3).map((a, i) => {
                const info = (usersMap && usersMap[String(a)]) || { name: String(a), email: '' }
                const tooltip = info.name + (info.email ? '\n' + info.email : '')
                return (
                  <div key={i} className="relative group">
                    <span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-semibold border border-surface shrink-0 cursor-default">
                      {info.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <div className="bg-on-surface text-surface text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                        <p className="font-medium">{info.name}</p>
                        {info.email && <p className="text-surface/70 text-[10px]">{info.email}</p>}
                      </div>
                    </div>
                  </div>
                )
              })}
              {assignees.length > 3 && (
                <span className="w-6 h-6 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center text-[10px] font-semibold border border-surface shrink-0">+{assignees.length - 3}</span>
              )}
            </div>
          )
        })()}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(doc['Tình trạng'])}`}>
          {doc['Tình trạng']}
        </span>
      </td>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        {publishHistory.length > 0 ? (
          <button onClick={() => setShowHistory(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-tertiary-container text-on-tertiary-container hover:bg-tertiary-container/80 transition-colors">
            {publishHistory.length} lần
          </button>
        ) : (
          <span className="text-on-surface-variant/50">—</span>
        )}
        {showHistory && createPortal(
          <PublishHistory history={publishHistory} users={users || []} onClose={() => setShowHistory(false)} />,
          document.body
        )}
      </td>
      <td className="hidden">{formatCurrency(doc['Giá trị HĐ'])}</td>
      <td className="px-4 py-3 text-on-surface-variant max-w-xs truncate text-xs"
        title={doc['Ghi chú'] || ''}>
        {doc['Ghi chú'] || '—'}
      </td>
      <td className="px-4 py-3 text-on-surface-variant">
        <div>{formatDate(doc['Ngày ban hành'])}</div>
        {dl && dl.label && (
          <div className={`text-[10px] mt-0.5 font-medium ${{ overdue: 'text-red-700', urgent: 'text-yellow-800', warning: 'text-green-700' }[dl.level] || 'text-on-surface-variant'}`}>
            {dl.label}
          </div>
        )}
      </td>
      <td className="px-4 py-3 w-10" onClick={e => e.stopPropagation()}>
        {hasMenuItems && (
        <button ref={menuBtnRef} onClick={openMenu}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors">
          <Icon name="more_vert" size={18} />
        </button>
        )}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setMenuOpen(false)} />
            <div className="fixed bg-surface border border-outline-variant rounded-xl shadow-lg z-[101] py-1 min-w-[180px]"
              style={{ top: menuPos.top, right: menuPos.right }}>
              {/* Edit — hidden for Văn thư */}
              {canEditDoc && (
                <button onClick={() => { setMenuOpen(false); onEdit(doc) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors">
                  <Icon name="edit" size={16} className="text-primary shrink-0" />
                  Chỉnh sửa
                </button>
              )}
              {/* Files */}
              {fileInfos.length > 0 && (
                <>
                  <div className="h-px bg-outline-variant/40 my-1" />
                  {fileInfos.map((fi, i) => (
                    <a key={i}
                      href={'https://drive.google.com/file/d/' + encodeURIComponent(fi.fileId) + '/view?usp=sharing'}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors"
                      onClick={() => setMenuOpen(false)}>
                      <Icon name="download" size={16} className="text-on-surface-variant shrink-0" />
                      <span className="truncate">{fileInfos.length > 1 ? (fi.fileName || `File ${i + 1}`) : 'Tải về'}</span>
                    </a>
                  ))}
                  <button onClick={() => {
                    setMenuOpen(false)
                    const url = 'https://drive.google.com/file/d/' + encodeURIComponent(fileInfos[0].fileId) + '/view?usp=sharing'
                    navigator.clipboard.writeText(url).then(() => showToast('Đã sao chép link chia sẻ', 'success')).catch(() => window.prompt('Sao chép link:', url))
                  }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors">
                    <Icon name="share" size={16} className="text-on-surface-variant shrink-0" />
                    Sao chép link
                  </button>
                </>
              )}
              {/* Delete */}
              {canDelete && (
                <>
                  <div className="h-px bg-outline-variant/40 my-1" />
                  <button onClick={() => { setMenuOpen(false); onDelete(doc.ID) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error-container/30 transition-colors">
                    <Icon name="delete" size={16} className="shrink-0" />
                    Xóa hồ sơ
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </td>
    </tr>
  )
}
