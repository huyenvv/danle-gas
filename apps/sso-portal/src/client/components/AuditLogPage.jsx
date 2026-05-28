import { useState, useEffect } from 'react'
import gasCall from '../gasClient.js'

const ACTION_COLORS = {
  'Đăng nhập':              'text-emerald-700',
  'Đăng nhập thất bại':     'text-error',
  'Đăng xuất':              'text-on-surface-variant',
  'Đổi mật khẩu':           'text-primary',
  'Reset mật khẩu':         'text-amber-700',
  'Reset mật khẩu hàng loạt': 'text-amber-700',
  'Khóa tài khoản':         'text-error',
  'Mở khóa':                'text-emerald-700',
  'Thêm':                   'text-emerald-700',
  'Sửa':                    'text-primary',
  'Xóa':                    'text-error',
  'Cài đặt email':          'text-secondary',
}

const TYPE_COLORS = {
  'Xác thực':    'bg-emerald-100 text-emerald-800',
  'Người dùng':  'bg-amber-100 text-amber-800',
  'Ứng dụng':    'bg-primary/10 text-primary',
  'Phòng ban':   'bg-teal-100 text-teal-800',
  'Bộ máy':      'bg-violet-100 text-violet-800',
  'Hệ thống':    'bg-surface-container text-on-surface-variant',
}

const PAGE_SIZE = 20

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d)) return iso
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
  } catch { return iso }
}

function formatDetail(val) {
  if (!val) return null
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val
    return JSON.stringify(parsed, null, 2)
  } catch { return String(val) }
}

function parseDiff(val) {
  if (!val) return null
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const keys = Object.keys(parsed)
    if (keys.length === 0) return null
    if (keys.every(k => parsed[k] && typeof parsed[k] === 'object' && 'old' in parsed[k] && 'new' in parsed[k])) return parsed
    return null
  } catch { return null }
}

function DiffTable({ diff }) {
  const keys = Object.keys(diff)
  return (
    <table className="w-full text-sm border border-outline-variant/40 rounded-xl overflow-hidden">
      <thead>
        <tr className="bg-surface-container-low">
          <th className="px-3 py-2 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Trường</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-red-700 uppercase tracking-wide">Giá trị cũ</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wide">Giá trị mới</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-outline-variant/30">
        {keys.map(k => (
          <tr key={k}>
            <td className="px-3 py-2 text-xs font-medium text-on-surface-variant whitespace-nowrap">{k}</td>
            <td className="px-3 py-2 text-xs bg-red-50 text-red-800 break-all">{diff[k].old || <span className="text-on-surface-variant italic">trống</span>}</td>
            <td className="px-3 py-2 text-xs bg-emerald-50 text-emerald-800 break-all">{diff[k].new || <span className="text-on-surface-variant italic">trống</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function parseDeviceInfo(val) {
  if (!val) return null
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.browser || parsed.ip || parsed.os) return parsed
    return null
  } catch { return null }
}

const DEVICE_LABELS = { ip: 'IP', browser: 'Trình duyệt', os: 'Hệ điều hành', screen: 'Màn hình', tz: 'Múi giờ', device: 'Thiết bị', reason: 'Lý do' }

function DeviceInfoCard({ info }) {
  const keys = Object.keys(info).filter(k => info[k])
  if (keys.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-2">
      {keys.map(k => (
        <div key={k} className="bg-surface-container-low rounded-lg px-3 py-2">
          <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">{DEVICE_LABELS[k] || k}</span>
          <p className="text-xs text-on-surface mt-0.5 font-medium">{info[k]}</p>
        </div>
      ))}
    </div>
  )
}

export default function AuditLogPage() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]     = useState('')
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const [searchCommitted, setSearchCommitted] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [types, setTypes] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => { loadLogs({ reset: true }) }, [searchCommitted])

  async function loadLogs({ reset = false } = {}) {
    const token = localStorage.getItem('sso_access_token')
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
        keyword: searchCommitted,
      })
      const incoming = res.data || []
      setLogs(prev => reset ? incoming : [...prev, ...incoming])
      setHasMore(!!res.hasMore)
      setTotal(Number(res.total || 0))
      setTypes(res.types || [])
    } catch (err) {
      setError(err.message)
    } finally {
      if (reset) setLoading(false)
      else setLoadingMore(false)
    }
  }

  const filtered = filterType ? logs.filter(l => l['Loại'] === filterType) : logs

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-lg">search</span>
          <input
            className="w-full bg-surface-container-low border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Tìm kiếm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setSearchCommitted(search) }}
          />
        </div>
        <select
          className="min-w-0 bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">Tất cả loại</option>
          {types.map(t => <option key={t}>{t}</option>)}
        </select>
        <span className="text-sm text-on-surface-variant whitespace-nowrap">{filtered.length} bản ghi</span>
        <button onClick={() => loadLogs({ reset: true })}
          className="ml-auto w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container border border-outline-variant transition-colors"
          title="Làm mới">
          <span className="material-symbols-outlined text-base">refresh</span>
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
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Nội dung</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {loading && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-on-surface-variant">
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                    Đang tải...
                  </div>
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-on-surface-variant">Không có bản ghi nào</td></tr>
              )}
              {!loading && filtered.map((log, i) => (
                <tr key={i} onClick={() => setSelected(log)}
                  className="hover:bg-surface-container-low transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-on-surface-variant text-xs whitespace-nowrap">
                    {formatDateTime(log['Thời gian'])}
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
                    <span className="text-xs">
                      <span className={`font-semibold ${ACTION_COLORS[log['Hành động']] || 'text-on-surface-variant'}`}>
                        {log['Hành động'] || '—'}
                      </span>
                      {log['Loại'] && (
                        <span className="text-on-surface-variant"> {log['Loại'].toLowerCase()}</span>
                      )}
                      {log['Đối tượng'] && (
                        <span className="text-on-surface font-medium"> "{log['Đối tượng']}"</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs max-w-[200px] truncate">{(() => {
                    const di = parseDeviceInfo(log['Chi tiết'])
                    if (di) return [di.browser, di.os, di.ip].filter(Boolean).join(' · ') || '—'
                    const df = parseDiff(log['Chi tiết'])
                    if (df) return Object.keys(df).join(', ')
                    return log['Chi tiết'] || '—'
                  })()}</td>
                </tr>
              ))}
              {!loading && loadingMore && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-on-surface-variant">
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                    Đang tải thêm...
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/40 bg-surface-container-lowest flex flex-col items-center gap-2">
            <span className="text-on-surface-variant text-xs">
              Hiển thị {filtered.length}{filterType ? ` (lọc từ ${logs.length})` : ''} / {total}
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

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.2)] w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/40">
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-primary text-xl">history</span>
                <span className={`font-semibold ${ACTION_COLORS[selected['Hành động']] || 'text-on-surface'}`}>{selected['Hành động']}</span>
                {selected['Loại'] && (
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[selected['Loại']] || 'bg-surface-container text-on-surface-variant'}`}>{selected['Loại']}</span>
                )}
                {selected['Đối tượng'] && (
                  <span className="font-medium text-on-surface">"{selected['Đối tượng']}"</span>
                )}
              </div>
              <button onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Thời gian</span>
                  <p className="text-sm text-on-surface mt-0.5">{formatDateTime(selected['Thời gian'])}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Người dùng</span>
                  <p className="text-sm text-on-surface mt-0.5">{selected['Người dùng'] || '—'}{selected['Email'] ? ` (${selected['Email']})` : ''}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Hành động</span>
                  <p className="mt-0.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[selected['Hành động']] || 'bg-surface-container text-on-surface-variant'}`}>
                      {selected['Hành động'] || '—'}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Loại</span>
                  <p className="mt-0.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[selected['Loại']] || 'bg-surface-container text-on-surface-variant'}`}>
                      {selected['Loại'] || '—'}
                    </span>
                  </p>
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Đối tượng</span>
                <p className="text-sm text-on-surface mt-0.5">{selected['Đối tượng'] || '—'}</p>
              </div>
              {selected['Chi tiết'] && (
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-on-surface-variant font-semibold">Chi tiết</span>
                  {(() => {
                    const diff = parseDiff(selected['Chi tiết'])
                    if (diff) return <div className="mt-1"><DiffTable diff={diff} /></div>
                    const devInfo = parseDeviceInfo(selected['Chi tiết'])
                    if (devInfo) return <div className="mt-1"><DeviceInfoCard info={devInfo} /></div>
                    return (
                      <pre className="mt-1 bg-surface-container-low rounded-xl p-4 text-xs text-on-surface-variant whitespace-pre-wrap break-words font-mono leading-relaxed max-h-[60vh] overflow-y-auto">
                        {formatDetail(selected['Chi tiết'])}
                      </pre>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
