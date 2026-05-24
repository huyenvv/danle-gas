import { useState } from 'react'

export default function PublishHistory({ history, users, onClose }) {
  const [activeTab, setActiveTab] = useState(0)

  if (!history || !history.length) return null

  const entry = history[activeTab]

  function getUserName(id) {
    const u = (users || []).find(u => String(u.ID) === String(id))
    return u ? (u['Tên nhân viên'] || u['Tên đăng nhập']) : String(id)
  }

  function getUserEmail(id) {
    const u = (users || []).find(u => String(u.ID) === String(id))
    return u?.['Email'] || ''
  }

  function formatDate(iso) {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch (_) { return iso }
  }

  function RecipientList({ label, items }) {
    if (!items || !items.length) return null
    return (
      <div>
        <p className="text-xs font-medium text-on-surface-variant mb-1.5">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {items.map((r, i) => {
            const name = r.name || getUserName(r.id || r)
            const email = r.email || getUserEmail(r.id || r)
            return (
              <div key={i} className="relative group inline-block">
                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                  <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  {name}
                </span>
                {email && (
                  <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <div className="bg-on-surface text-surface text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">{email}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[70vh] overflow-hidden flex flex-col shadow-[0_12px_40px_rgba(0,83,219,0.12)]">

        {/* Header */}
        <div className="bg-surface-container-low px-6 py-4 flex items-center gap-3 border-b border-outline-variant shrink-0">
          <div className="w-9 h-9 rounded-xl bg-amber-600/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-amber-600" style={{ fontSize: 20 }}>history</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-on-surface text-base">Lịch sử phát hành</h3>
            <p className="text-xs text-on-surface-variant">{history.length} lần phát hành</p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Tabs */}
        {history.length > 1 && (
          <div className="flex border-b border-outline-variant/60 px-4 overflow-x-auto shrink-0">
            {history.map((h, i) => (
              <button key={i} type="button" onClick={() => setActiveTab(i)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === i
                    ? 'border-amber-600 text-amber-600'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
                }`}>
                Lần {h.lan || i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-on-surface-variant">Ngày phát hành</p>
              <p className="text-sm text-on-surface font-medium">{formatDate(entry.ngay)}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Người gửi</p>
              <p className="text-sm text-on-surface font-medium">{entry.nguoiGui || '—'}</p>
            </div>
          </div>
          <RecipientList label="Người nhận (TO)" items={entry.to} />
          <RecipientList label="CC" items={entry.cc} />
        </div>

        {/* Footer */}
        <div className="bg-surface-container-low border-t border-outline-variant px-6 py-3 flex justify-end shrink-0">
          <button type="button" onClick={onClose}
            className="px-5 py-2 border border-outline-variant rounded-full text-sm text-on-surface hover:bg-surface-container transition-colors font-medium">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
