import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import gasCall from '../gasClient.js'
import { dataCache, prefetchLookups } from '../utils/dataCache.js'
import { formatCurrency, formatDate, statusColor } from '../utils/format.js'
import DocumentModal from './DocumentModal.jsx'
import Sidebar from './Sidebar.jsx'
import StatsCards from './StatsCards.jsx'
import CategoryManager from './CategoryManager.jsx'
import UserManager from './UserManager.jsx'
import SettingsPage from './SettingsPage.jsx'
import ChangePasswordModal from './ChangePasswordModal.jsx'

const PAGE_SIZE = 20

export default function MainApp() {
  const { session, logout } = useAuth()

  const [page, setPage]            = useState('documents')
  const [docs, setDocs]            = useState([])
  const [stats, setStats]          = useState(null)
  const [lookups, setLookups]      = useState({ danhMuc: [], phongBan: [], duAn: [], nhaCungCap: [] })
  const [loading, setLoading]      = useState(true)
  const [error, setError]          = useState('')

  // Filters
  const [filters, setFilters]         = useState({})
  const [searchInput, setSearchInput] = useState('')

  // Modals
  const [docModal, setDocModal]       = useState(null)   // null | { mode: 'create'|'edit', doc? }
  const [changePwModal, setChangePwModal] = useState(false)

  const loadDocs = useCallback(async (filt = {}) => {
    setLoading(true)
    setError('')
    try {
      const [docsRes, statsRes] = await Promise.all([
        gasCall('api_getDocuments', session.token, filt),
        gasCall('api_getDocumentStats', session.token),
      ])
      setDocs(docsRes.data || [])
      setStats(statsRes)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    prefetchLookups(session.token).then(setLookups).catch(() => {})
    loadDocs()

    // Show change-password modal if required
    if (session.mustChangePass) setChangePwModal(true)
  }, [session])

  function handleSearch(e) {
    e.preventDefault()
    const newFilters = { ...filters, keyword: searchInput || undefined }
    setFilters(newFilters)
    loadDocs(newFilters)
  }

  function handleFilterChange(key, val) {
    const newFilters = { ...filters, [key]: val || undefined }
    setFilters(newFilters)
    loadDocs(newFilters)
  }

  async function handleDeleteDoc(id) {
    if (!window.confirm('Xóa hồ sơ này?')) return
    try {
      await gasCall('api_deleteDocument', session.token, id)
      loadDocs(filters)
    } catch (err) {
      alert('Lỗi: ' + err.message)
    }
  }

  function getCategoryName(id) {
    const cat = lookups.danhMuc.find(c => String(c.ID) === String(id))
    return cat ? cat['Tên danh mục'] : id
  }

  const isAdmin = session.role === 'admin'

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar page={page} onPage={setPage} isAdmin={isAdmin} onLogout={logout} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">
            {page === 'documents'   && 'Danh sách hồ sơ'}
            {page === 'categories'  && 'Quản lý danh mục'}
            {page === 'users'       && 'Quản lý người dùng'}
            {page === 'settings'    && 'Cài đặt hệ thống'}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{session.username}</span>
            <button
              onClick={() => setChangePwModal(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              Đổi mật khẩu
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {page === 'documents' && (
            <div className="space-y-5">
              {stats && <StatsCards stats={stats} />}

              {/* Toolbar */}
              <div className="flex flex-wrap gap-3 items-center">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tìm kiếm hồ sơ..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                  />
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                    Tìm
                  </button>
                </form>

                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={filters.danhMucId || ''}
                  onChange={e => handleFilterChange('danhMucId', e.target.value)}
                >
                  <option value="">Tất cả danh mục</option>
                  {lookups.danhMuc.map(c => (
                    <option key={c.ID} value={c.ID}>{c['Tên danh mục']}</option>
                  ))}
                </select>

                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={filters.trangThai || ''}
                  onChange={e => handleFilterChange('trangThai', e.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option>Hiệu lực</option>
                  <option>Hết hạn</option>
                  <option>Sắp hết hạn</option>
                  <option>Chờ duyệt</option>
                  <option>Đã thanh lý</option>
                </select>

                <button
                  onClick={() => setDocModal({ mode: 'create' })}
                  className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2"
                >
                  <span>+ Thêm hồ sơ</span>
                </button>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">{error}</div>
              )}

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Tên hồ sơ</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Danh mục</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Trạng thái</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Giá trị HĐ</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Giá trị TH</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Chênh lệch</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Ngày tạo</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loading && (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
                      )}
                      {!loading && docs.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Không có hồ sơ nào</td></tr>
                      )}
                      {docs.slice(0, PAGE_SIZE).map(doc => (
                        <tr key={doc.ID} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{doc['Tên hồ sơ']}</td>
                          <td className="px-4 py-3 text-gray-600">{getCategoryName(doc['Danh mục'])}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(doc['Trạng thái'])}`}>
                              {doc['Trạng thái']}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(doc['Giá trị HĐ'])}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(doc['Giá trị thực hiện'])}</td>
                          <td className={`px-4 py-3 text-right font-medium ${Number(doc['Chênh lệch']) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {formatCurrency(doc['Chênh lệch'])}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(doc['Ngày tạo'])}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setDocModal({ mode: 'edit', doc })}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                              >Sửa</button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteDoc(doc.ID)}
                                  className="text-red-500 hover:text-red-700 text-xs font-medium"
                                >Xóa</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {docs.length > PAGE_SIZE && (
                  <div className="px-4 py-3 text-sm text-gray-500 border-t border-gray-100">
                    Hiển thị {PAGE_SIZE} / {docs.length} hồ sơ
                  </div>
                )}
              </div>
            </div>
          )}

          {page === 'categories' && (
            <CategoryManager token={session.token} lookups={lookups} onUpdate={() => prefetchLookups(session.token).then(setLookups)} />
          )}

          {page === 'users' && isAdmin && (
            <UserManager token={session.token} />
          )}

          {page === 'settings' && isAdmin && (
            <SettingsPage token={session.token} />
          )}
        </main>
      </div>

      {docModal && (
        <DocumentModal
          mode={docModal.mode}
          doc={docModal.doc}
          lookups={lookups}
          token={session.token}
          onClose={() => setDocModal(null)}
          onSaved={() => { setDocModal(null); loadDocs(filters) }}
        />
      )}

      {changePwModal && (
        <ChangePasswordModal
          token={session.token}
          forced={session.mustChangePass}
          onClose={() => setChangePwModal(false)}
          onChanged={logout}
        />
      )}
    </div>
  )
}
