import { useState } from 'react'
import { groupUsersByDept } from '../../utils/groupUsers.js'

// Popup chọn "Người được xem" (phân quyền tài liệu, 008).
// Gom theo phòng ban + "Chọn tất cả" mỗi phòng; tìm kiếm; 2 chế độ nhanh loại trừ
// "Tất cả"/"Theo danh mục"; lưu tạm (draft) — chỉ ghi khi bấm "Chọn", "Hủy"/đóng thì bỏ.
export default function ViewerPickerModal({
  testId = 'vpm', users, phongBan, assignments,
  value, categoryViewerIds = [], catName = '', saving = false, onConfirm, onClose,
}) {
  const allUsers = users || []
  const allIds = allUsers.map(u => String(u.ID))
  const catIds = (categoryViewerIds || []).map(String).filter(id => allIds.includes(id))

  const [draft, setDraft] = useState(() => new Set((value || []).map(String)))
  const [search, setSearch] = useState('')

  function eq(set, arr) { return arr.length > 0 && set.size === arr.length && arr.every(id => set.has(id)) }
  const isAll = eq(draft, allIds)
  const isByCat = eq(draft, catIds)

  function setAll() { setDraft(isAll ? new Set() : new Set(allIds)) }
  function setByCat() { setDraft(isByCat ? new Set() : new Set(catIds)) }
  function toggle(id) {
    id = String(id)
    const next = new Set(draft)
    if (next.has(id)) next.delete(id); else next.add(id)
    setDraft(next)
  }
  function toggleGroup(gusers, allSel) {
    const next = new Set(draft)
    gusers.forEach(u => { const id = String(u.ID); if (allSel) next.delete(id); else next.add(id) })
    setDraft(next)
  }

  const q = search.trim().toLowerCase()
  let groups = groupUsersByDept(allUsers, phongBan, assignments)
  if (q) {
    groups = groups
      .map(g => ({ ...g, users: g.users.filter(u => ((u['Tên nhân viên'] || '') + ' ' + (u['Email'] || '')).toLowerCase().includes(q)) }))
      .filter(g => g.users.length > 0)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" data-testid={testId}>
      <div className="absolute inset-0 bg-black/40" onClick={() => { if (!saving) onClose() }} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-outline-variant/30 flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>lock</span>
          <h3 className="text-base font-semibold text-on-surface flex-1">Phân quyền xem</h3>
          <button type="button" data-testid={`${testId}-close`} onClick={onClose} disabled={saving}
            className="text-on-surface-variant hover:text-error transition-colors disabled:opacity-40 disabled:hover:text-on-surface-variant">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Chế độ nhanh */}
        <div className="px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1.5 border-b border-outline-variant/20 shrink-0">
          <label className="flex items-center gap-1.5 text-sm text-on-surface cursor-pointer select-none">
            <input type="checkbox" data-testid={`${testId}-all`} checked={isAll} onChange={setAll}
              className="w-4 h-4 rounded accent-primary" />
            Tất cả
          </label>
          <label className="flex items-center gap-1.5 text-sm text-on-surface cursor-pointer select-none">
            <input type="checkbox" data-testid={`${testId}-bycat`} checked={isByCat} onChange={setByCat}
              className="w-4 h-4 rounded accent-primary" />
            Theo danh mục{catName ? ` "${catName}"` : ''}
          </label>
        </div>

        {/* Tìm kiếm */}
        <div className="px-4 py-2 border-b border-outline-variant/20 shrink-0">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" style={{ fontSize: 16 }}>search</span>
            <input data-testid={`${testId}-search`} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm nhân viên..."
              className="w-full bg-surface-container-low rounded-lg pl-8 pr-3 py-1.5 text-sm border-none focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </div>
        </div>

        {/* Danh sách gom phòng ban */}
        <div className="overflow-y-auto flex-1">
          {groups.map((group, gi) => {
            const allSel = group.users.every(u => draft.has(String(u.ID)))
            return (
              <div key={group.name}>
                <div className="flex items-center justify-between px-4 py-1 bg-surface-container-low/60 border-b border-outline-variant/20">
                  <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">{group.name}</span>
                  <button type="button" data-testid={`${testId}-deptall-${gi}`} onClick={() => toggleGroup(group.users, allSel)}
                    className="text-[11px] font-medium text-primary hover:underline cursor-pointer">
                    {allSel ? 'Bỏ chọn' : 'Chọn tất cả'}
                  </button>
                </div>
                {group.users.map(u => {
                  const id = String(u.ID)
                  const sel = draft.has(id)
                  const name = u['Tên nhân viên'] || u['Tên đăng nhập'] || id
                  return (
                    <button key={id} type="button" data-testid={`${testId}-u-${id}`} onClick={() => toggle(id)}
                      className={`w-full text-left flex items-center gap-2 px-4 py-1.5 transition-colors cursor-pointer border-b border-outline-variant/10 last:border-b-0 ${sel ? 'bg-primary/8' : 'hover:bg-surface-container-low/50'}`}>
                      <input type="checkbox" checked={sel} readOnly className="w-4 h-4 rounded accent-primary pointer-events-none" />
                      <span className="text-sm text-on-surface truncate flex-1">{name}{u['Email'] ? <span className="text-on-surface-variant"> ({u['Email']})</span> : null}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
          {groups.length === 0 && <div className="px-4 py-6 text-center text-on-surface-variant text-sm">Không tìm thấy</div>}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-outline-variant/30 flex items-center gap-3 shrink-0">
          <span className="text-sm text-on-surface-variant flex-1">Đã chọn <b className="text-on-surface" data-testid={`${testId}-count`}>{draft.size}</b> người</span>
          <button type="button" data-testid={`${testId}-cancel`} onClick={onClose} disabled={saving}
            className="px-4 py-1.5 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50">Hủy</button>
          <button type="button" data-testid={`${testId}-confirm`} onClick={() => onConfirm([...draft])} disabled={saving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving ? 'Đang lưu...' : 'Chọn'}
          </button>
        </div>
      </div>
    </div>
  )
}
