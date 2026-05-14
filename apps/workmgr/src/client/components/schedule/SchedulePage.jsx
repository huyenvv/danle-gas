import { useState, useEffect, useCallback, useMemo } from 'react'
import gasCall from '../../gasClient.js'
import { mutate } from '../../utils/mutate.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useConfirm } from '../../context/ConfirmContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { isAdminRole } from '../../utils/permissions.js'
import ScheduleModal from './ScheduleModal.jsx'

const TABS = [
  { value: 'approved', label: 'Đã duyệt', statuses: ['Đã duyệt'] },
  { value: 'pending', label: 'Chưa duyệt', statuses: ['Chờ TP', 'Chờ GĐ', 'Từ chối'] },
]

const STATUS_BADGE = {
  'Chờ TP': 'bg-amber-100 text-amber-700',
  'Chờ GĐ': 'bg-blue-100 text-blue-700',
  'Đã duyệt': 'bg-green-100 text-green-700',
  'Từ chối': 'bg-red-100 text-red-700',
}

const TYPE_BADGE = {
  'Công tác': 'bg-purple-100 text-purple-700',
  'Họp': 'bg-cyan-100 text-cyan-700',
}

function fmtRange(startStr, endStr) {
  const s = startStr ? new Date(startStr) : null
  const e = endStr ? new Date(endStr) : null
  if (!s || isNaN(s.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (!e || isNaN(e.getTime())) return fmt(s)
  return `${fmt(s)} → ${fmt(e)}`
}

function todayStr() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}
function weekFromTodayStr() {
  const d = new Date(); d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

export default function SchedulePage({ masterData, token }) {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('approved')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(weekFromTodayStr())
  const [modal, setModal] = useState({ open: false, mode: 'add', type: 'Công tác', data: null })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await gasCall('api_getSchedules', token, { type: typeFilter, dateFrom, dateTo })
      setItems(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [token, typeFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const getUserName = (id) => {
    const u = masterData.users.find(u => String(u.ID) === String(id))
    return u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : ''
  }

  const isAdmin = isAdminRole(session?.role)
  const deptOfUser = useMemo(() => {
    const uid = String(session?.userId)
    return (masterData.phongBan || []).find(d =>
      String(d['Trưởng phòng ID']) === uid || String(d['Phó phòng ID']) === uid
    )
  }, [masterData.phongBan, session])
  const isLeader = !!deptOfUser

  const filtered = items.filter(s => TABS.find(t => t.value === tab).statuses.includes(s['Trạng thái']))

  const canApprove = (s) => {
    if (s['Trạng thái'] === 'Chờ TP') {
      if (isAdmin) return true
      if (!deptOfUser) return false
      return String(deptOfUser.ID) === String(s['Phòng ban ID'])
    }
    if (s['Trạng thái'] === 'Chờ GĐ') return isAdmin
    return false
  }
  const canEdit = (s) => {
    if (isAdmin) return true
    if (s['Trạng thái'] === 'Đã duyệt') return false
    return String(s['Người đăng ký ID']) === String(session?.userId)
  }

  const handleSave = async (data, mode) => {
    try {
      if (mode === 'add') await mutate('api_createSchedule', token, data)
      else await mutate('api_updateSchedule', token, data.ID, data)
      showToast(mode === 'add' ? 'Đã đăng ký lịch' : 'Đã cập nhật', 'success')
      setModal({ open: false })
      load()
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleApprove = async (s) => {
    try { await mutate('api_approveSchedule', token, s.ID); showToast('Đã phê duyệt', 'success'); load() }
    catch (e) { showToast(e.message, 'error') }
  }
  const handleReject = async (s) => {
    const reason = prompt('Lý do từ chối:', '')
    if (reason === null) return
    try { await mutate('api_rejectSchedule', token, s.ID, reason); showToast('Đã từ chối', 'success'); load() }
    catch (e) { showToast(e.message, 'error') }
  }
  const handleDelete = async (s) => {
    const ok = await confirm('Xóa lịch', `Bạn có chắc muốn xóa "${s['Nội dung']}"?`)
    if (!ok) return
    try { await mutate('api_deleteSchedule', token, s.ID); showToast('Đã xóa', 'success'); load() }
    catch (e) { showToast(e.message, 'error') }
  }

  const participantNames = (s) => {
    const raw = String(s['Thành phần'] || '').trim()
    if (raw === 'All') return 'Toàn bộ nhân viên'
    return raw.split(',').map(id => getUserName(id.trim())).filter(Boolean).join(', ')
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <div className="inline-flex bg-surface-container-low rounded-xl p-1">
          {TABS.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.value ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-surface-container-low rounded-xl text-sm border-none outline-none">
          <option value="">Tất cả loại</option>
          <option value="Công tác">Công tác</option>
          <option value="Họp">Họp</option>
        </select>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <span>Từ</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1.5 bg-surface-container-low rounded-lg text-sm border-none outline-none" />
          <span>đến</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-2 py-1.5 bg-surface-container-low rounded-lg text-sm border-none outline-none" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setModal({ open: true, mode: 'add', type: 'Công tác', data: null })}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-container-low text-on-surface rounded-full text-sm font-medium hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-base">add</span>Lịch công tác
          </button>
          <button onClick={() => setModal({ open: true, mode: 'add', type: 'Họp', data: null })}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1">
            <span className="material-symbols-outlined text-base">groups</span>Lịch họp
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-on-surface-variant">Đang tải…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl mb-2 block opacity-30">event_busy</span>
          <p className="text-sm">Không có lịch trong khoảng này</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.ID} className="bg-white rounded-2xl shadow-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${TYPE_BADGE[s['Loại']] || ''}`}>{s['Loại']}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE[s['Trạng thái']] || ''}`}>{s['Trạng thái']}</span>
                    <span className="text-xs text-on-surface-variant">{fmtRange(s['Thời gian bắt đầu'], s['Thời gian kết thúc'])}</span>
                  </div>
                  <div className="text-sm font-semibold text-on-surface mb-1 whitespace-pre-wrap">{s['Nội dung']}</div>
                  <div className="text-xs text-on-surface-variant space-y-0.5">
                    {s['Người chủ trì ID'] && <div><span className="font-medium">Chủ trì:</span> {getUserName(s['Người chủ trì ID'])}</div>}
                    {s['Thành phần'] && <div><span className="font-medium">Thành phần:</span> {participantNames(s)}</div>}
                    {s['Địa điểm'] && <div><span className="font-medium">Địa điểm:</span> {s['Địa điểm']}</div>}
                    {s['Link họp'] && <div><span className="font-medium">Link:</span> <a href={s['Link họp']} target="_blank" rel="noreferrer" className="text-primary hover:underline">{s['Link họp']}</a></div>}
                    {s['Ghi chú'] && <div className="text-on-surface-variant/80 italic">{s['Ghi chú']}</div>}
                    {s['Trạng thái'] === 'Từ chối' && s['Lý do từ chối'] && (
                      <div className="text-error"><span className="font-medium">Lý do từ chối:</span> {s['Lý do từ chối']}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canApprove(s) && (
                    <>
                      <button onClick={() => handleApprove(s)} title="Phê duyệt"
                        className="p-2 rounded-lg hover:bg-green-50 text-green-600">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                      </button>
                      <button onClick={() => handleReject(s)} title="Từ chối"
                        className="p-2 rounded-lg hover:bg-red-50 text-error">
                        <span className="material-symbols-outlined text-base">cancel</span>
                      </button>
                    </>
                  )}
                  {canEdit(s) && (
                    <>
                      <button onClick={() => setModal({ open: true, mode: 'edit', type: s['Loại'], data: s })}
                        className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant">
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button onClick={() => handleDelete(s)}
                        className="p-2 rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error">
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <ScheduleModal
          mode={modal.mode}
          type={modal.type}
          data={modal.data}
          users={masterData.users}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
