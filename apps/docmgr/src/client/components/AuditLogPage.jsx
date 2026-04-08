import { useState, useEffect } from 'react'
import gasCall from '../gasClient.js'
import { viMatch } from '../utils/viSearch.js'
import Icon from './common/Icon.jsx'
import { formatDate } from '../utils/format.js'

const ACTION_COLORS = {
  'Tạo':       'bg-emerald-100 text-emerald-800',
  'Sửa':       'bg-primary/10 text-primary',
  'Xóa':       'bg-error-container text-on-error-container',
  'Đăng nhập': 'bg-secondary/10 text-secondary',
}

const PAGE_SIZE = 20

export default function AuditLogPage({ token }) {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => { loadLogs() }, [])

  async function loadLogs() {
    setLoading(true)
    setError('')
    try {
      const res = await gasCall('api_getAuditLogs', token, {})
      setLogs(res.logs || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = logs.filter(l => {
    if (filterType && l['Loại'] !== filterType) return false
    if (search) {
      return viMatch(l['Người dùng'], search) ||
             viMatch(l['Loại'], search) ||
             viMatch(l['Đối tượng'], search) ||
             viMatch(l['Chi tiết'], search)
    }
    return true
  })
  const types = [...new Set(logs.map(l => l['Loại']).filter(Boolean))]
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input
            className="w-full bg-surface-container-low border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Tìm kiếm..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
          />
        </div>
        <select
          className="min-w-0 bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setCurrentPage(1) }}
        >
          <option value="">Tất cả loại</option>
          {types.map(t => <option key={t}>{t}</option>)}
        </select>
        <span className="text-sm text-on-surface-variant whitespace-nowrap">{filtered.length} bản ghi</span>
        <button onClick={loadLogs}
          className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
          title="Làm mới">
          <Icon name="refresh" size={20} />
        </button>
      </div>

      {error && (
        <div className="bg-error-container text-on-error-container rounded-2xl p-4 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Thời gian</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Người dùng</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Hành động</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Loại</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Đối tượng</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant">
                  <div className="flex items-center justify-center gap-2">
                    <Icon name="sync" size={18} className="animate-spin" />
                    Đang tải...
                  </div>
                </td></tr>
              )}
              {!loading && paged.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant">Không có bản ghi nào</td></tr>
              )}
              {!loading && paged.map((log, i) => (
                <tr key={i} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 text-on-surface-variant text-xs whitespace-nowrap">
                    {log['Thời gian'] ? formatDate(log['Thời gian']) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-on-surface text-xs">{log['Người dùng'] || '—'}</p>
                      <p className="text-xs text-on-surface-variant">{log['Email'] || ''}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log['Hành động']] || 'bg-surface-container text-on-surface-variant'}`}>
                      {log['Hành động'] || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs">{log['Loại'] || '—'}</td>
                  <td className="px-4 py-3 text-on-surface text-xs max-w-[160px] truncate">{log['Đối tượng'] || '—'}</td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs max-w-[200px] truncate">{log['Chi tiết'] || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/40 flex items-center justify-between bg-surface-container-lowest">
            <span className="text-on-surface-variant text-xs">
              Hiển thị {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setCurrentPage(page - 1)}
                  className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs disabled:opacity-40 hover:bg-surface-container transition-colors">← Trước</button>
                <span className="px-2 py-1 text-on-surface-variant text-xs">Trang {page}/{totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setCurrentPage(page + 1)}
                  className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs disabled:opacity-40 hover:bg-surface-container transition-colors">Sau →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
