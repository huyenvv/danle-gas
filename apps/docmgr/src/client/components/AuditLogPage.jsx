import { useState, useEffect } from 'react'
import gasCall from '../gasClient.js'
import Icon from './common/Icon.jsx'
import { formatDate } from '../utils/format.js'

const ACTION_COLORS = {
  'Tạo':        'bg-emerald-100 text-emerald-800',
  'Sửa':        'bg-primary/10 text-primary',
  'Xóa':        'bg-error-container text-on-error-container',
  'Đăng nhập':  'bg-secondary/10 text-secondary',
  'Phân quyền': 'bg-amber-100 text-amber-800',
  'Xóa quyền':  'bg-orange-100 text-orange-800',
  'Workflow':   'bg-purple-100 text-purple-800',
  'Giao việc':  'bg-teal-100 text-teal-800',
}

const TYPE_COLORS = {
  'Hồ sơ':    'bg-primary/10 text-primary',
  'Danh mục': 'bg-secondary/10 text-secondary',
  'Người dùng': 'bg-amber-100 text-amber-800',
  'Nhóm':     'bg-teal-100 text-teal-800',
  'Dự án':    'bg-indigo-100 text-indigo-800',
  'Nhà cung cấp': 'bg-orange-100 text-orange-800',
}

const PAGE_SIZE = 20

export default function AuditLogPage({ token }) {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]     = useState('')
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [types, setTypes] = useState([])

  useEffect(() => { loadLogs({ reset: true }) }, [token, filterType, search])

  async function loadLogs({ reset = false } = {}) {
    const nextOffset = reset ? 0 : logs.length
    if (reset) {
      setLoading(true)
      setError('')
    } else {
      setLoadingMore(true)
    }
    try {
      const res = await gasCall('api_getAuditLogs', token, {
        offset: nextOffset,
        limit: PAGE_SIZE,
        type: filterType,
        keyword: search,
      })
      const incoming = res.data || []
      setLogs(prev => reset ? incoming : [...prev, ...incoming])
      setHasMore(!!res.hasMore)
      setTotal(Number(res.total || 0))
      setTypes(res.types || [])
    } catch (err) {
      setError(err.message)
    } finally {
      if (reset) {
        setLoading(false)
      } else {
        setLoadingMore(false)
      }
    }
  }

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
            onChange={e => { setSearch(e.target.value) }}
          />
        </div>
        <select
          className="min-w-0 bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
          value={filterType}
          onChange={e => { setFilterType(e.target.value) }}
        >
          <option value="">Tất cả loại</option>
          {types.map(t => <option key={t}>{t}</option>)}
        </select>
        <span className="text-sm text-on-surface-variant whitespace-nowrap">{total} bản ghi</span>
        <button onClick={() => loadLogs({ reset: true })}
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
              {!loading && logs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant">Không có bản ghi nào</td></tr>
              )}
              {!loading && logs.map((log, i) => (
                <tr key={i} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 text-on-surface-variant text-xs whitespace-nowrap">
                    {log['Thời gian'] ? formatDate(log['Thời gian']) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {log['Người dùng'] ? (
                      <div className="relative group inline-flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                          {log['Người dùng'].charAt(0).toUpperCase()}
                        </span>
                        <span className="text-xs font-medium text-on-surface">{log['Người dùng']}</span>
                        {log['Email'] && (
                          <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <div className="bg-on-surface text-surface text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                              <p className="font-medium">{log['Người dùng']}</p>
                              <p className="text-surface/70 text-[10px]">{log['Email']}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log['Hành động']] || 'bg-surface-container text-on-surface-variant'}`}>
                      {log['Hành động'] || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {log['Loại'] ? (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[log['Loại']] || 'bg-surface-container text-on-surface-variant'}`}>
                        {log['Loại']}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-on-surface text-xs max-w-[160px] truncate">{log['Đối tượng'] || '—'}</td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs max-w-[200px] truncate">{log['Chi tiết'] || '—'}</td>
                </tr>
              ))}
              {!loading && loadingMore && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-on-surface-variant">
                  <div className="flex items-center justify-center gap-2">
                    <Icon name="sync" size={18} className="animate-spin" />
                    Đang tải thêm...
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && logs.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/40 bg-surface-container-lowest flex flex-col items-center gap-2">
            <span className="text-on-surface-variant text-xs">
              Hiển thị {logs.length} / {total}
            </span>
            {hasMore && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => loadLogs()}
                className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs disabled:opacity-40 hover:bg-surface-container transition-colors"
              >
                {loadingMore ? 'Đang tải...' : 'Xem thêm'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
