import { useState, useEffect, useCallback, useMemo } from 'react'
import gasCall from '../../gasClient.js'
import { timeAgo } from '../../utils/format.js'

const TYPE_ICONS = {
  'Tạo phòng ban': 'apartment', 'Tạo công việc': 'add_task',
  'Cập nhật phòng ban': 'edit', 'Cập nhật công việc': 'edit',
  'Cập nhật tiến độ': 'trending_up',
  'Chuyển trạng thái': 'swap_horiz',
  'Xóa phòng ban': 'delete', 'Xóa công việc': 'delete',
  'Bình luận': 'chat',
  'Đăng ký lịch Công tác': 'event', 'Đăng ký lịch Họp': 'groups',
  'Phê duyệt lịch → Chờ GĐ': 'verified', 'Phê duyệt lịch → Đã duyệt': 'check_circle',
  'Từ chối lịch': 'cancel',
}
const TYPE_COLORS = {
  'Tạo phòng ban': 'bg-green-100 text-green-700',
  'Tạo công việc': 'bg-blue-100 text-blue-700',
  'Xóa phòng ban': 'bg-red-100 text-red-700',
  'Xóa công việc': 'bg-red-100 text-red-700',
  'Từ chối lịch': 'bg-red-100 text-red-700',
  'Phê duyệt lịch → Đã duyệt': 'bg-green-100 text-green-700',
}

const PAGE_SIZE = 50

export default function ActivityPage({ token }) {
  const [resp, setResp] = useState({ data: [], total: 0, hasMore: false, types: [] })
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => { setPage(0) }, [searchKeyword, typeFilter, userFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await gasCall('api_getActivities', token, {
        keyword: searchKeyword, type: typeFilter, user: userFilter,
        limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      })
      setResp(data || { data: [], total: 0, hasMore: false, types: [] })
    } catch (e) { console.error(e); setResp({ data: [], total: 0, hasMore: false, types: [] }) }
    setLoading(false)
  }, [token, searchKeyword, typeFilter, userFilter, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil(resp.total / PAGE_SIZE))
  const types = useMemo(() => resp.types || [], [resp.types])
  const users = useMemo(() => resp.users || [], [resp.users])

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-0 max-w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" style={{ fontSize: 18 }}>search</span>
          <input
            className={`w-full pl-10 pr-8 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20 ${searchKeyword ? 'ring-2 ring-primary/30' : ''}`}
            placeholder="Tìm kiếm… (Enter)"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setSearchKeyword(searchInput.trim()) }}
          />
          {searchKeyword && (
            <button type="button" onClick={() => { setSearchInput(''); setSearchKeyword('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          )}
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Tất cả loại</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Tất cả người dùng</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <span className="text-xs text-on-surface-variant">{resp.total} nhật ký</span>
        <button onClick={load} title="Làm mới" className="ml-auto w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container border border-outline-variant transition-colors">
          <span className="material-symbols-outlined text-base leading-none">refresh</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Thời gian</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Người dùng</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Loại</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Mô tả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {loading && resp.data.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-on-surface-variant">Đang tải…</td></tr>
              )}
              {!loading && resp.data.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-on-surface-variant">Chưa có nhật ký</td></tr>
              )}
              {resp.data.map((a, i) => (
                <tr key={a.ID || i} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 text-on-surface-variant text-xs whitespace-nowrap">{timeAgo(a['Thời gian'])}</td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                        {(a['Tên người dùng'] || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className="text-xs font-medium text-on-surface">{a['Tên người dùng']}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[a['Loại']] || 'bg-surface-container text-on-surface-variant'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{TYPE_ICONS[a['Loại']] || 'history'}</span>
                      {a['Loại']}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs max-w-[300px] truncate">{a['Mô tả'] || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {resp.total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant/40 bg-surface-container-lowest text-xs text-on-surface-variant">
            <span>Trang {page + 1} / {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-surface-container disabled:opacity-30">
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={!resp.hasMore}
                className="p-1.5 rounded-lg hover:bg-surface-container disabled:opacity-30">
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
