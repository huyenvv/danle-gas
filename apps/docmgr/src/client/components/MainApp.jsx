import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import gasCall from '../gasClient.js'
import { dataCache, prefetchLookups, refreshLookups, startPolling, stopPolling } from '../utils/dataCache.js'
import { viMatch } from '../utils/viSearch.js'
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
import GroupManager from './departments/GroupManager.jsx'
import SupplierManager from './suppliers/SupplierManager.jsx'
import ProjectManager from './projects/ProjectManager.jsx'
import DocumentPreview from './documents/DocumentPreview.jsx'
import AuditLogPage from './AuditLogPage.jsx'
import TopHeader from './layout/TopHeader.jsx'
import Icon from './common/Icon.jsx'

const PAGE_SIZE = 20

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

  // Filters
  const [filters, setFilters]         = useState({})
  const [searchInput, setSearchInput] = useState('')

  // Modals
  const [docModal, setDocModal]       = useState(null)   // null | { mode: 'create'|'edit', doc? }
  const [previewDoc, setPreviewDoc]   = useState(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Collapsed category groups
  const [collapsed, setCollapsed]     = useState({})

  // Read/unread tracking
  const [readDocIds, setReadDocIds]   = useState(new Set())
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

  const loadDocs = useCallback(async ({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setError('') }
    try {
      const [docsRes, statsRes] = await Promise.all([
        gasCall('api_getDocuments', session.token, {}),
        gasCall('api_getDocumentStats', session.token),
      ])
      setAllDocs((docsRes && docsRes.data) ? docsRes.data : [])
      setStats(statsRes || {})
    } catch (err) {
      if (!silent) setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [session])

  useEffect(() => {
    prefetchLookups(session.token).then(setLookups).catch(() => {})
    loadDocs()
    gasCall('api_getReadDocIds', session.token).then(r => setReadDocIds(new Set((r.readIds || []).map(String)))).catch(() => {})
    gasCall('api_getConfig', session.token, 'COMPANY_NAME').then(r => { if (r && r.value) setCompanyName(r.value) }).catch(() => {})

    // Background polling via dataCache (60s interval)
    startPolling(session.token)

    // Subscribe to polling updates
    const unsubDocs = dataCache.subscribe('docs', data => {
      if (data) setAllDocs(data)
    })
    const unsubLookups = dataCache.subscribe('lookups', data => {
      if (data) setLookups(data)
    })

    return () => {
      stopPolling()
      unsubDocs()
      unsubLookups()
    }
  }, [session])

  function handleFilterChange(key, val) {
    setFilters(f => ({ ...f, [key]: val || undefined }))
    setCurrentPage(1)
  }

  async function handleDeleteDoc(id) {
    if (!await confirm('Xóa hồ sơ này?')) return
    setGlobalLoading(true)
    try {
      await gasCall('api_deleteDocument', session.token, id)
      showToast('Đã xóa hồ sơ', 'success')
      loadDocs()
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error')
    } finally {
      setGlobalLoading(false)
    }
  }

  const docs = useMemo(() => {
    let result = [...allDocs]
    if (searchInput) {
      result = result.filter(d =>
        viMatch(d['Tên hồ sơ'], searchInput) ||
        viMatch(d['Số hồ sơ'], searchInput) ||
        viMatch(d['Mô tả'], searchInput) ||
        viMatch(d['Dự án (Phòng ban)'], searchInput) ||
        viMatch(d['Nhà cung cấp (Nơi ban hành)'], searchInput) ||
        viMatch(d['Ghi chú'], searchInput) ||
        viMatch(d['Phụ trách'], searchInput)
      )
    }
    if (filters.danhMucId) result = result.filter(d => String(d['Danh mục']) === String(filters.danhMucId))
    if (filters.tinhTrang) result = result.filter(d => d['Tình trạng'] === filters.tinhTrang)
    if (filters.duAn) result = result.filter(d => d['Dự án (Phòng ban)'] === filters.duAn)
    if (filters.nhaCungCap) result = result.filter(d => d['Nhà cung cấp (Nơi ban hành)'] === filters.nhaCungCap)
    if (filters.phuTrach) result = result.filter(d => parseAssignees(d['Phụ trách']).includes(String(filters.phuTrach)))
    if (filters.readStatus === 'unread') result = result.filter(d => !readDocIds.has(String(d.ID)))
    if (filters.readStatus === 'read')   result = result.filter(d => readDocIds.has(String(d.ID)))
    return result
  }, [allDocs, searchInput, filters, readDocIds])

  // Bell count = unread docs from full unfiltered list (no search/filter applied)
  const unreadCount = useMemo(
    () => allDocs.filter(d => !readDocIds.has(String(d.ID))).length,
    [allDocs, readDocIds]
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
      await gasCall('api_markMultipleAsRead', session.token, ids)
      setReadDocIds(prev => new Set([...prev, ...ids.map(String)]))
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

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <Sidebar
        page={page}
        onPage={setPage}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        onCreateDoc={canCreate ? () => { setPage('documents'); setDocModal({ mode: 'create' }) } : undefined}
        collapsed={sidebarCollapsed}
        role={session.role}
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
                <div className="relative flex-1 min-w-0 max-w-64">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" style={{ fontSize: 18 }}>search</span>
                  <input
                    className="bg-surface-container-low border-none rounded-xl pl-9 pr-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Tìm kiếm hồ sơ..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                  />
                </div>

                {/* hidden — kept for bell-click programmatic filter */}
                <select className="hidden" value={filters.danhMucId || ''} onChange={e => handleFilterChange('danhMucId', e.target.value)}>
                  <option value="">Tất cả danh mục</option>
                  {lookups.danhMuc.map(c => <option key={c.ID} value={c.ID}>{c['Tên danh mục']}</option>)}
                </select>

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
                  <option>Chờ duyệt</option>
                  <option>Chờ xử lý</option>
                  <option>Đang xử lý</option>
                  <option>Hoàn thành</option>
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
                  {(lookups.users || []).map(u => (
                    <option key={u.ID} value={u['Tên đăng nhập']}>{u['Tên nhân viên'] || u['Tên đăng nhập']}</option>
                  ))}
                </select>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={async () => {
                      dataCache.invalidate('docs')
                      dataCache.invalidate('lookups')
                      await Promise.all([loadDocs(), refreshLookups(session.token).then(setLookups)])
                    }}
                    title="Làm mới dữ liệu"
                    className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container border border-outline-variant transition-colors"
                  >
                    <span className="material-symbols-outlined text-base leading-none">refresh</span>
                  </button>
                  {canCreate && (
                    <button
                      onClick={() => setDocModal({ mode: 'create' })}
                      className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-700 transition-colors shadow-md3-1"
                    >
                      <span className="material-symbols-outlined text-base leading-none">add</span>
                      <span>Thêm hồ sơ</span>
                    </button>
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
                currentPage={currentPage}
                collapsed={collapsed}
                danhMuc={lookups.danhMuc}
                readDocIds={readDocIds}
                selectedIds={selectedIds}
                role={session.role}
                onToggleCat={catId => setCollapsed(c => ({ ...c, [catId]: !c[catId] }))}
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
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
              />

              {/* Floating batch mark-read bar */}
              {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-on-surface text-surface px-5 py-3 rounded-2xl shadow-md3-3 animate-toast-in">
                  <span className="text-sm font-medium">Đã chọn {selectedIds.size} hồ sơ</span>
                  <button
                    onClick={handleBatchMarkRead}
                    className="flex items-center gap-1.5 bg-primary text-on-primary px-3 py-1.5 rounded-full text-sm font-medium hover:bg-primary-700 transition-colors"
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
            <CategoryManager token={session.token} lookups={lookups} onUpdate={() => refreshLookups(session.token).then(setLookups)} />
          )}

          {page === 'groups' && isAdmin && (
            <GroupManager token={session.token} lookups={lookups} onUpdate={() => refreshLookups(session.token).then(setLookups)} />
          )}

          {page === 'suppliers' && (
            <SupplierManager token={session.token} lookups={lookups} onUpdate={() => refreshLookups(session.token).then(setLookups)} />
          )}

          {page === 'projects' && (
            <ProjectManager token={session.token} lookups={lookups} onUpdate={() => refreshLookups(session.token).then(setLookups)} />
          )}

          {isAdmin && (
            <div className={page === 'users' ? '' : 'hidden'}>
              <UserManager token={session.token} lookups={lookups} session={session} />
            </div>
          )}

          {isSuperAdmin && (
            <div className={page === 'settings' ? '' : 'hidden'}>
              <SettingsPage token={session.token} onCompanyNameChange={setCompanyName} />
            </div>
          )}

          {page === 'auditlogs' && isAdmin && (
            <AuditLogPage token={session.token} />
          )}
          </div>
        </main>
      </div>

      {docModal && (
        <DocumentModal
          mode={docModal.mode}
          doc={docModal.doc}
          lookups={lookups}
          token={session.token}
          session={session}
          docs={docs}
          onClose={() => {
            const nextPreviewDoc = docModal.returnToPreview ? docModal.doc : null
            setDocModal(null)
            if (nextPreviewDoc) setPreviewDoc(nextPreviewDoc)
          }}
          onSaved={newDoc => {
            setDocModal(null)
            const doc = newDoc && newDoc.data ? newDoc.data : null
            if (doc) {
              // Show new doc immediately, then silently refresh for authoritative data
              setAllDocs(prev => [doc, ...prev.filter(d => String(d.ID) !== String(doc.ID))])
              loadDocs({ silent: true })
            } else {
              loadDocs()
            }
          }}
        />
      )}

      {previewDoc && (
        <DocumentPreview
          doc={previewDoc}
          lookups={lookups}
          isAdmin={isAdmin}
          canDelete={isSuperAdmin}
          token={session.token}
          session={session}
          onClose={() => {
            setReadDocIds(prev => new Set([...prev, String(previewDoc.ID)]))
            setPreviewDoc(null)
          }}
          onEdit={() => {
            const currentDoc = previewDoc
            setPreviewDoc(null)
            setDocModal({ mode: 'edit', doc: currentDoc, returnToPreview: true })
          }}
          onDelete={() => { setPreviewDoc(null); handleDeleteDoc(previewDoc.ID) }}
          onDocUpdated={loadDocs}
        />
      )}

      {globalLoading && <LoadingOverlay />}
    </div>
  )
}

// ── Grouped document table (by category tree) with pagination ──────────────
function DocumentTable({ docs, loading, isAdmin, canDelete, usersMap, currentPage, collapsed, danhMuc, readDocIds, selectedIds, role, onToggleCat, onToggleSelect, onToggleAll, onPreview, onEdit, onDelete, pageSize, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(docs.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paged = docs.slice((page - 1) * pageSize, page * pageSize)

  // Build docs-by-category map for PAGED docs (used for rendering rows)
  const docsMap = {}
  paged.forEach(doc => {
    const key = String(doc['Danh mục'] || '')
    if (!docsMap[key]) docsMap[key] = []
    docsMap[key].push(doc)
  })

  // Build docs-by-category map for ALL docs (used for category header counts)
  const allDocsMap = {}
  docs.forEach(doc => {
    const key = String(doc['Danh mục'] || '')
    if (!allDocsMap[key]) allDocsMap[key] = []
    allDocsMap[key].push(doc)
  })

  // Root categories (no parent)
  const roots = (danhMuc || []).filter(c => !c['Danh mục cha'])

  // Count across ALL docs so category headers are always visible (even if their docs are on other pages)
  function subtreeDocCount(catId) {
    const direct = (allDocsMap[String(catId)] || []).length
    const children = (danhMuc || []).filter(c => String(c['Danh mục cha']) === String(catId))
    return direct + children.reduce((s, c) => s + subtreeDocCount(c.ID), 0)
  }

  // Uncategorized docs (category ID not in danhMuc)
  const validIds = new Set((danhMuc || []).map(c => String(c.ID)))
  const uncategorized = paged.filter(d => !validIds.has(String(d['Danh mục'] || '')))
  const uncategorizedTotal = docs.filter(d => !validIds.has(String(d['Danh mục'] || ''))).length

  const COL = 11

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-3 py-3 w-10">
                <input type="checkbox"
                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                  checked={paged.length > 0 && paged.every(d => selectedIds.has(String(d.ID)))}
                  onChange={() => onToggleAll(paged.map(d => d.ID))}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide w-64 min-w-[16rem]">Tên hồ sơ</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Số hồ sơ</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Dự án (PB)</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">NCC (NBH)</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Phụ trách</th>
              <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Tình trạng</th>
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
            {!loading && roots.map(cat => (
              <CatGroup key={cat.ID} cat={cat} depth={0}
                danhMuc={danhMuc} docsMap={docsMap} collapsed={collapsed} readDocIds={readDocIds}
                selectedIds={selectedIds} onToggleCat={onToggleCat} onToggleSelect={onToggleSelect}
                isAdmin={isAdmin} canDelete={canDelete} usersMap={usersMap} onPreview={onPreview} onEdit={onEdit} onDelete={onDelete}
                role={role} subtreeDocCount={subtreeDocCount}
              />
            ))}
            {!loading && uncategorizedTotal > 0 && (
              <Fragment key="__uncat__">
                <tr className="bg-surface-container/50 cursor-pointer hover:bg-surface-container transition-colors"
                    onClick={() => onToggleCat('__uncat__')}>
                  <td colSpan={COL} className="px-4 py-2 font-semibold text-on-surface-variant text-xs">
                    <span className="mr-2">{collapsed['__uncat__'] ? '▶' : '▼'}</span>
                    (Chưa phân danh mục) <span className="font-normal ml-1">({uncategorizedTotal} hồ sơ)</span>
                  </td>
                </tr>
                {!collapsed['__uncat__'] && uncategorized.map(doc => (
                  <DocRow key={doc.ID} doc={doc} depth={0} readDocIds={readDocIds} selectedIds={selectedIds}
                    onToggleSelect={onToggleSelect} isAdmin={isAdmin} canDelete={canDelete} usersMap={usersMap} onPreview={onPreview} onEdit={onEdit} onDelete={onDelete} role={role} />
                ))}
              </Fragment>
            )}
          </tbody>
        </table>
      </div>
      {docs.length > 0 && (
        <div className="px-4 py-3 border-t border-outline-variant/40 flex items-center justify-between text-sm bg-surface-container-lowest">
          <span className="text-on-surface-variant">
            Hiển thị {Math.min((page - 1) * pageSize + 1, docs.length)}-{Math.min(page * pageSize, docs.length)} / {docs.length} hồ sơ
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
                className="px-3 py-1.5 border border-outline-variant rounded-lg text-sm disabled:opacity-40 hover:bg-surface-container transition-colors">← Trước</button>
              <span className="px-2 py-1 text-on-surface-variant">Trang {page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
                className="px-3 py-1.5 border border-outline-variant rounded-lg text-sm disabled:opacity-40 hover:bg-surface-container transition-colors">Sau →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CatGroup({ cat, depth, danhMuc, docsMap, collapsed, readDocIds, selectedIds, onToggleCat, onToggleSelect, isAdmin, canDelete, usersMap, onPreview, onEdit, onDelete, role, subtreeDocCount }) {
  const total = subtreeDocCount(cat.ID)
  if (total === 0) return null
  const isCollapsed = collapsed[cat.ID]
  const children = danhMuc.filter(c => String(c['Danh mục cha']) === String(cat.ID))
  const directDocs = docsMap[String(cat.ID)] || []
  const indent = depth * 16

  return (
    <Fragment>
      <tr className="bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
          onClick={() => onToggleCat(cat.ID)}>
        <td className="px-3 py-2 w-10" onClick={e => e.stopPropagation()}></td>
        <td colSpan={8} className="px-4 py-2 font-semibold text-primary text-xs" style={{ paddingLeft: indent + 16 }}>
          <span className="mr-2">{isCollapsed ? '▶' : '▼'}</span>
          {cat['Tên danh mục']} <span className="font-normal text-primary/70 ml-1">({total} hồ sơ)</span>
        </td>
        <td colSpan={2}></td>
      </tr>
      {!isCollapsed && children.map(child => (
        <CatGroup key={child.ID} cat={child} depth={depth + 1}
          danhMuc={danhMuc} docsMap={docsMap} collapsed={collapsed} readDocIds={readDocIds}
          selectedIds={selectedIds} onToggleCat={onToggleCat} onToggleSelect={onToggleSelect}
          isAdmin={isAdmin} canDelete={canDelete} usersMap={usersMap} onPreview={onPreview} onEdit={onEdit} onDelete={onDelete}
          role={role} subtreeDocCount={subtreeDocCount}
        />
      ))}
      {!isCollapsed && directDocs.map(doc => (
        <DocRow key={doc.ID} doc={doc} depth={depth + 1} readDocIds={readDocIds} selectedIds={selectedIds}
          onToggleSelect={onToggleSelect} isAdmin={isAdmin} canDelete={canDelete} usersMap={usersMap} onPreview={onPreview} onEdit={onEdit} onDelete={onDelete} role={role} />
        ))}
    </Fragment>
  )
}

function DocRow({ doc, depth, readDocIds, selectedIds, onToggleSelect, isAdmin, canDelete, usersMap, onPreview, onEdit, onDelete, role }) {
  const isRead = readDocIds.has(String(doc.ID))
  const isSelected = selectedIds.has(String(doc.ID))
  const indent = depth * 16 + 16
  const { showToast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const menuBtnRef = useRef(null)
  const canEditDoc = role === 'Giám đốc'
    ? doc['Tình trạng'] === 'Chờ duyệt'
    : role === 'admin' || role === 'Quản trị viên'

  const fileInfos = (() => {
    const raw = doc['File ID']
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

  return (
    <tr
      className={`hover:bg-surface-container-low transition-colors cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`}
      onClick={() => onPreview(doc)}
    >
      <td className="px-3 py-3 w-10" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(doc.ID)}
          className="w-4 h-4 rounded accent-primary cursor-pointer" />
      </td>
      <td className="px-4 py-3 w-64 min-w-[16rem] max-w-sm" style={{ paddingLeft: indent }}>
        <span className={`${isRead ? 'text-on-surface-variant' : 'font-semibold text-on-surface'}`}>
          {!isRead && <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2 align-middle" />}
          {doc['Tên hồ sơ']}
        </span>
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
      <td className="hidden">{formatCurrency(doc['Giá trị HĐ'])}</td>
      <td className="px-4 py-3 text-on-surface-variant max-w-xs truncate text-xs"
        title={[doc['Mô tả'], doc['Ghi chú']].filter(Boolean).join(' · ') || ''}>
        {[doc['Mô tả'], doc['Ghi chú']].filter(Boolean).join(' · ') || '—'}
      </td>
      <td className="px-4 py-3 text-on-surface-variant">{formatDate(doc['Ngày ban hành'])}</td>
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
