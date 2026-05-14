import { useEffect, useState, useRef } from 'react'
import gasCall from '../../gasClient.js'
import { formatCurrency, formatDate, statusColor } from '../../utils/format.js'
import Icon from '../common/Icon.jsx'
import { useConfirm } from '../../context/ConfirmContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

function parseFileInfos(fileIdCol) {
  if (!fileIdCol) return []
  if (typeof fileIdCol === 'string' && fileIdCol.charAt(0) === '[') {
    try { return JSON.parse(fileIdCol) } catch (e) { /* fall through */ }
  }
  if (typeof fileIdCol === 'string' && fileIdCol) {
    return [{ fileId: fileIdCol, fileName: fileIdCol, mimeType: '', size: 0 }]
  }
  return []
}

function parseAssignees(v) {
  if (!v) return []
  if (typeof v === 'string' && v.charAt(0) === '[') { try { return JSON.parse(v) } catch(_) {} }
  return [String(v)]
}

function formatFileSize(size) {
  var value = Number(size || 0)
  if (!value) return '—'
  if (value < 1024) return value + ' B'
  if (value < 1024 * 1024) return (value / 1024).toFixed(1).replace(/\.0$/, '') + ' KB'
  if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(1).replace(/\.0$/, '') + ' MB'
  return (value / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, '') + ' GB'
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  try {
    var d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    var date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    var time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    return time + ' ' + date
  } catch (_) {
    return dateStr
  }
}

export default function DocumentPreview({ doc: initialDoc, lookups, isAdmin, canDelete, token, session, onClose, onEdit, onDelete, onDocUpdated }) {
  const confirm = useConfirm()
  const { showToast } = useToast()
  const NOTE_PREVIEW_LIMIT = 200
  const [doc, setDoc] = useState(initialDoc)
  const fileInfos = parseFileInfos(doc['File ID'])
  const [slideIdx, setSlideIdx] = useState(0)
  const [comments, setComments] = useState([])
  const [commentLoading, setCommentLoading] = useState(false)
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)
  const commentsEndRef = useRef(null)
  const [transitioning, setTransitioning] = useState(false)
  const [transitionLabel, setTransitionLabel] = useState('')
  const [giaoViecForm, setGiaoViecForm] = useState(null) // null | { phuTrach, phoiHop[] }

  const currentFile = fileInfos[slideIdx] || null
  const previewUrl = currentFile
    ? `https://drive.google.com/file/d/${encodeURIComponent(currentFile.fileId)}/preview`
    : null
  const downloadUrl = currentFile
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(currentFile.fileId)}`
    : null

  useEffect(() => {
    if (!token || !doc['ID']) return

    let cancelled = false
    setComments([])
    setCommentLoading(true)

    gasCall('api_markAsRead', token, doc['ID']).catch(() => {})
    gasCall('api_getComments', token, doc['ID'])
      .then(r => {
        if (!cancelled) setComments(r.data || [])
      })
      .catch(() => {
        if (!cancelled) setComments([])
      })
      .finally(() => {
        if (!cancelled) setCommentLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, doc['ID']])

  useEffect(() => {
    setNoteExpanded(false)
  }, [doc['ID']])

  async function handleAddComment(e) {
    e.preventDefault()
    var content = commentInput.trim()
    if (!content) return
    var optimisticId = 'tmp-' + Date.now()
    var optimisticComment = {
      ID: optimisticId,
      DocID: doc['ID'],
      UserID: session?.userId,
      'Tên người dùng': session?.username || 'Bạn',
      'Nội dung': content,
      'Thời gian': new Date().toISOString(),
      _pending: true,
    }
    setComments(prev => [...prev, optimisticComment])
    setCommentInput('')
    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const r = await gasCall('api_addComment', token, doc['ID'], content)
      setComments(prev => prev.map(c => c.ID === optimisticId ? r.data : c))
    } catch(err) {
      setComments(prev => prev.filter(c => c.ID !== optimisticId))
      setCommentInput(prev => prev || content)
      showToast(err.message || 'Không thể gửi bình luận', 'error')
    }
  }

  function getCategoryName(id) {
    const cat = (lookups.danhMuc || []).find(c => String(c.ID) === String(id))
    return cat ? cat['Tên danh mục'] : id || '—'
  }

  function getCategoryIcon(id) {
    const cat = (lookups.danhMuc || []).find(c => String(c.ID) === String(id))
    return cat ? (cat.Icon || 'folder_open') : 'folder_open'
  }

  function handleDownload() {
    if (!currentFile) return
    window.open('https://drive.google.com/file/d/' + encodeURIComponent(currentFile.fileId) + '/view?usp=sharing', '_blank')
  }

  function handleShare() {
    if (!currentFile) return
    const shareUrl = `https://drive.google.com/file/d/${encodeURIComponent(currentFile.fileId)}/view?usp=sharing`
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('Đã sao chép link chia sẻ!', 'success')
    }).catch(() => {
      window.prompt('Sao chép link:', shareUrl)
    })
  }

  // ── Workflow helpers ──
  const status = doc['Tình trạng'] || ''
  const role = session?.role || ''
  const isPhuTrach = (() => {
    const list = parseAssignees(doc['Phụ trách'])
    return list.includes(String(session?.userId)) || list.includes(session?.username)
  })()
  const isPhoiHop = (() => {
    const list = parseAssignees(doc['Người phối hợp'])
    return list.includes(String(session?.userId)) || list.includes(session?.username)
  })()
  const COMMENT_ROLES = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  const canComment = COMMENT_ROLES.includes(role) || isPhuTrach || isPhoiHop
  const isFullAdmin = role === 'admin' || role === 'Quản trị viên'
  const canEditDoc = role === 'Giám đốc'
    ? status === 'Chờ duyệt'
    : isFullAdmin

  function getAvailableActions() {
    const actions = []
    if (isFullAdmin) {
      // Admin sees all possible transitions for current status
      if (!status || status === 'Chờ duyệt') actions.push({ key: 'giaoViec', label: 'Giao việc', icon: 'assignment_ind', color: 'primary' })
      if (status === 'Chờ xử lý') {
        actions.push({ key: 'thuHoi', label: 'Thu hồi', icon: 'undo', color: 'amber' })
        actions.push({ key: 'nhanViec', label: 'Nhận việc', icon: 'check_circle', color: 'blue' })
      }
      if (status === 'Đang xử lý') actions.push({ key: 'hoanThanh', label: 'Hoàn thành', icon: 'task_alt', color: 'emerald' })
      return actions
    }
    if (role === 'Giám đốc') {
      if (status === 'Chờ duyệt') actions.push({ key: 'giaoViec', label: 'Giao việc', icon: 'assignment_ind', color: 'primary' })
      if (status === 'Chờ xử lý') actions.push({ key: 'thuHoi', label: 'Thu hồi', icon: 'undo', color: 'amber' })
    }
    if (isPhuTrach && role !== 'Giám đốc') {
      if (status === 'Chờ xử lý') actions.push({ key: 'nhanViec', label: 'Nhận việc', icon: 'check_circle', color: 'blue' })
      if (status === 'Đang xử lý') actions.push({ key: 'hoanThanh', label: 'Hoàn thành', icon: 'task_alt', color: 'emerald' })
    }
    return actions
  }

  async function handleTransition(action, data) {
    if (transitioning) return
    const actionLabel = action === 'giaoViec'
      ? 'Giao việc'
      : action === 'thuHoi'
        ? 'Thu hồi'
        : action === 'nhanViec'
          ? 'Nhận việc'
          : action === 'hoanThanh'
            ? 'Hoàn thành'
            : action
    if (!await confirm(`Xác nhận: ${actionLabel}?`)) return
    setTransitionLabel(actionLabel)
    setTransitioning(true)
    try {
      const res = await gasCall('api_transitionDocument', token, doc.ID, action, data)
      setDoc(prev => ({ ...prev, ...res.data }))
      showToast('Đã chuyển trạng thái', 'success')
      setGiaoViecForm(null)
      if (onDocUpdated) onDocUpdated(res.data)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setTransitioning(false)
      setTransitionLabel('')
    }
  }

  function openGiaoViec(mode) {
    if (mode === 'nhanViec') {
      // Phụ trách nhận việc: chọn phối hợp rồi chuyển trạng thái
      setGiaoViecForm({ phoiHop: parseAssignees(doc['Người phối hợp']), mode: 'nhanViec' })
    } else {
      // Giám đốc/Admin giao việc
      setGiaoViecForm({ phuTrach: '', phoiHop: parseAssignees(doc['Người phối hợp']), mode: 'giaoViec' })
    }
  }

  async function submitGiaoViec() {
    if (giaoViecForm.mode === 'nhanViec') {
      // Nhận việc + cập nhật phối hợp
      await handleTransition('nhanViec', {
        'Người phối hợp': giaoViecForm.phoiHop,
      })
      return
    }
    if (!giaoViecForm.phuTrach) { showToast('Phải chọn người phụ trách', 'error'); return }
    await handleTransition('giaoViec', {
      'Phụ trách': giaoViecForm.phuTrach,
      'Người phối hợp': giaoViecForm.phoiHop,
    })
  }

  const availableActions = getAvailableActions()
  const primaryGiaoViecAction = role === 'Giám đốc' && status === 'Chờ duyệt'
    ? availableActions.find(a => a.key === 'giaoViec')
    : null
  const workflowActions = primaryGiaoViecAction
    ? availableActions.filter(a => a.key !== primaryGiaoViecAction.key)
    : availableActions
  const hasSidebarActions = canEditDoc || !!primaryGiaoViecAction || canDelete || workflowActions.length > 0 || !!giaoViecForm
  const noteText = String(doc['Ghi chú'] || '')
  const noteOverflow = noteText.length > NOTE_PREVIEW_LIMIT
  const notePreview = noteOverflow && !noteExpanded
    ? noteText.slice(0, NOTE_PREVIEW_LIMIT).trimEnd() + '...'
    : noteText

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.2)] w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {transitioning && (
          <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon name="progress_activity" size={22} className="text-primary animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-on-surface">Đang {transitionLabel ? transitionLabel.toLowerCase() : 'cập nhật trạng thái'}</p>
              <p className="text-xs text-on-surface-variant">Vui lòng chờ trong giây lát…</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-surface-container-low px-6 py-4 flex items-center gap-4 border-b border-outline-variant shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon name={getCategoryIcon(doc['Danh mục'])} size={22} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-on-surface text-base truncate">{doc['Tên hồ sơ']}</h3>
            <p className="text-xs text-on-surface-variant">{doc['Số hồ sơ'] ? `Số hồ sơ: ${doc['Số hồ sơ']}` : 'Chưa có số hồ sơ'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleDownload} disabled={!currentFile || transitioning}
              className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40"
              title="Tải về">
              <Icon name="download" size={18} />
            </button>
            <button onClick={handleShare} disabled={!currentFile || transitioning}
              className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-secondary/10 hover:text-secondary transition-colors disabled:opacity-40"
              title="Chia sẻ">
              <Icon name="share" size={18} />
            </button>
          </div>
          <button onClick={onClose} disabled={transitioning}
            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors shrink-0 disabled:opacity-40">
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Body: split */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: File preview */}
          <div className="flex-1 bg-surface-container-lowest overflow-hidden relative flex flex-col">
            {previewUrl ? (
              <>
                {fileInfos.length > 1 && (
                  <>
                    <button
                      onClick={() => setSlideIdx(i => Math.max(0, i - 1))}
                      disabled={slideIdx === 0}
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 disabled:opacity-0 transition-all shadow-md"
                    >
                      <Icon name="chevron_left" size={24} />
                    </button>
                    <button
                      onClick={() => setSlideIdx(i => Math.min(fileInfos.length - 1, i + 1))}
                      disabled={slideIdx === fileInfos.length - 1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 disabled:opacity-0 transition-all shadow-md"
                    >
                      <Icon name="chevron_right" size={24} />
                    </button>
                  </>
                )}
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  className="w-full flex-1 border-0"
                  title="File preview"
                  sandbox="allow-scripts allow-same-origin"
                />
                {fileInfos.length > 1 && (
                  <div className="flex items-center justify-center gap-2 py-2 bg-surface-container-low border-t border-outline-variant shrink-0">
                    {fileInfos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSlideIdx(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${i === slideIdx ? 'bg-primary' : 'bg-outline-variant'}`}
                      />
                    ))}
                    <span className="text-xs text-on-surface-variant ml-1">
                      {slideIdx + 1} / {fileInfos.length}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full flex-1 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                <Icon name="description" size={48} className="opacity-30" />
                <p className="text-sm">Không có file đính kèm</p>
              </div>
            )}
          </div>

          {/* Right: Sidebar */}
          <div className="w-96 border-l border-outline-variant overflow-y-auto flex flex-col shrink-0">

            {/* Actions */}
            {hasSidebarActions && (
            <div className="p-4 border-b border-outline-variant space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {canEditDoc && (
                <button onClick={onEdit} disabled={transitioning}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-surface-container-low text-on-surface hover:bg-primary/10 hover:text-primary transition-colors text-sm font-medium disabled:opacity-40">
                  <Icon name="edit" size={18} />
                  Chỉnh sửa
                </button>
                )}
                {primaryGiaoViecAction && (
                <button onClick={openGiaoViec} disabled={transitioning}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-hover transition-colors text-sm font-medium disabled:opacity-50 shadow-md3-1">
                  <Icon name={primaryGiaoViecAction.icon} size={18} />
                  {primaryGiaoViecAction.label}
                </button>
                )}
                {canDelete ? (
                  <button onClick={onDelete} disabled={transitioning}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-error-container text-on-error-container hover:opacity-80 transition-opacity text-sm font-medium disabled:opacity-40">
                    <Icon name="delete" size={18} />
                    Xóa
                  </button>
                ) : (canEditDoc || primaryGiaoViecAction) ? <div /> : null}
              </div>

              {/* Workflow action buttons */}
              {workflowActions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {workflowActions.map(a => {
                    const colorMap = {
                      primary: 'bg-accent text-white hover:bg-accent-hover',
                      blue: 'bg-blue-600 text-white hover:bg-blue-700',
                      emerald: 'bg-emerald-600 text-white hover:bg-emerald-700',
                      amber: 'bg-amber-500 text-white hover:bg-amber-600',
                    }
                    return (
                      <button key={a.key} disabled={transitioning}
                        onClick={() => (a.key === 'giaoViec' || (a.key === 'nhanViec' && isPhuTrach)) ? openGiaoViec(a.key) : handleTransition(a.key)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium transition-colors disabled:opacity-50 shadow-md3-1 ${colorMap[a.color] || colorMap.primary}`}>
                        <Icon name={a.icon} size={18} />
                        {a.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Giao việc inline form */}
              {giaoViecForm && (() => {
                const isNhanViec = giaoViecForm.mode === 'nhanViec'
                const accent = isNhanViec ? 'blue-600' : 'primary'
                return (
                <div className={`${isNhanViec ? 'bg-blue-50 border-blue-200' : 'bg-primary/5 border-primary/20'} border rounded-2xl p-4 space-y-3 mt-2`}>
                  <p className={`text-xs font-semibold ${isNhanViec ? 'text-blue-600' : 'text-primary'} uppercase tracking-wide`}>
                    {isNhanViec ? 'Nhận việc — chọn người phối hợp' : 'Giao việc'}
                  </p>
                  {!isNhanViec && (
                  <div>
                    <label className="text-xs text-on-surface-variant mb-1 block">Người phụ trách *</label>
                    <select className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={giaoViecForm.phuTrach}
                      onChange={e => setGiaoViecForm(f => ({ ...f, phuTrach: e.target.value }))}>
                      <option value="">-- Chọn --</option>
                      {(lookups.users || []).map(u => (
                        <option key={u.ID} value={u['Tên đăng nhập']}>{u['Tên nhân viên'] || u['Tên đăng nhập']}</option>
                      ))}
                    </select>
                  </div>
                  )}
                  <div>
                    <label className="text-xs text-on-surface-variant mb-1 block">Người phối hợp</label>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {giaoViecForm.phoiHop.map(a => {
                        const dn = (lookups.users || []).find(u => u['Tên đăng nhập'] === a)?.['Tên nhân viên'] || a
                        return (
                          <span key={a} className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full">
                            {dn}
                            <button type="button" onClick={() => setGiaoViecForm(f => ({ ...f, phoiHop: f.phoiHop.filter(x => x !== a) }))}
                              className="hover:text-error"><Icon name="close" size={10} /></button>
                          </span>
                        )
                      })}
                    </div>
                    <select className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value=""
                      onChange={e => {
                        const v = e.target.value
                        if (v && !giaoViecForm.phoiHop.includes(v) && v !== giaoViecForm.phuTrach) {
                          setGiaoViecForm(f => ({ ...f, phoiHop: [...f.phoiHop, v] }))
                        }
                      }}>
                      <option value="">+ Thêm...</option>
                      {(lookups.users || []).filter(u => !giaoViecForm.phoiHop.includes(u['Tên đăng nhập']) && u['Tên đăng nhập'] !== giaoViecForm.phuTrach)
                        .map(u => <option key={u.ID} value={u['Tên đăng nhập']}>{u['Tên nhân viên'] || u['Tên đăng nhập']}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setGiaoViecForm(null)}
                      className="px-3 py-1.5 text-xs border border-outline-variant rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">Hủy</button>
                    <button onClick={submitGiaoViec} disabled={transitioning}
                      className={`px-4 py-1.5 text-xs ${isNhanViec ? 'bg-blue-600' : 'bg-primary'} text-white rounded-full disabled:opacity-50 hover:opacity-90 transition-opacity shadow-md3-1`}>
                      {transitioning ? 'Đang xử lý…' : isNhanViec ? 'Xác nhận nhận việc' : 'Xác nhận giao việc'}
                    </button>
                  </div>
                </div>
                )
              })()}
            </div>
            )}

            {/* Classification */}
            <div className="p-4 border-b border-outline-variant">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-on-surface-variant mb-1">Danh mục</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon name={getCategoryIcon(doc['Danh mục'])} size={14} className="text-primary" />
                    </div>
                    <span className="text-sm text-on-surface font-medium truncate">{getCategoryName(doc['Danh mục'])}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant mb-1">Tình trạng</p>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(doc['Tình trạng'])}`}>
                    {doc['Tình trạng'] || '—'}
                  </span>
                </div>
                <InfoRow icon="schedule" label="Ngày cập nhật" value={formatDate(doc['Ngày cập nhật'])} />
                <InfoRow icon="attach_file" label="Nơi lưu hồ sơ cứng" value={doc['Nơi lưu hồ sơ cứng']} />
              </div>
            </div>

            {/* Ownership */}
            <div className="p-4 border-b border-outline-variant">
              <div className="grid grid-cols-2 gap-3">
                <InfoRow icon="calendar_today" label="Ngày ban hành" value={formatDate(doc['Ngày ban hành'])} />
                <InfoRow icon="event" label="Ngày kết thúc" value={formatDate(doc['Ngày kết thúc'])} />
                <div className="flex items-start gap-2">
                  <Icon name="person" size={15} className="text-on-surface-variant shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-on-surface-variant">Phụ trách</p>
                    {(() => {
                      const list = parseAssignees(doc['Phụ trách'])
                      if (!list.length) return <p className="text-sm text-on-surface">—</p>
                      const u0 = (lookups.users || []).find(u => u['Tên đăng nhập'] === list[0])
                      const dn = u0?.['Tên nhân viên'] || list[0]
                      return (
                        <div className="relative group inline-block mt-0.5">
                          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full cursor-default">
                            <span className="w-4 h-4 rounded-full bg-primary text-on-primary flex items-center justify-center text-[9px] font-bold shrink-0">{dn.charAt(0).toUpperCase()}</span>
                            {dn}
                          </span>
                          {u0?.['Email'] && (
                            <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <div className="bg-on-surface text-surface text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                                <p className="text-surface/70">{u0['Email']}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Icon name="group" size={15} className="text-on-surface-variant shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-on-surface-variant">Người phối hợp</p>
                    {(() => {
                      const list = parseAssignees(doc['Người phối hợp'])
                      if (!list.length) return <p className="text-sm text-on-surface">—</p>
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {list.map((a, i) => {
                            const u = (lookups.users || []).find(u => u['Tên đăng nhập'] === a)
                            const dn = u?.['Tên nhân viên'] || a
                            return (
                              <div key={i} className="relative group inline-block">
                                <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full cursor-default">
                                  <span className="w-4 h-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[9px] font-bold shrink-0">{dn.charAt(0).toUpperCase()}</span>
                                  {dn}
                                </span>
                                {u?.['Email'] && (
                                  <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <div className="bg-on-surface text-surface text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                                      <p className="text-surface/70">{u['Email']}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Business Context */}
            <div className="p-4 border-b border-outline-variant">
              <div className="grid grid-cols-2 gap-3">
                <InfoRow icon="apartment" label="Dự án (Nơi nhận)" value={doc['Dự án (Phòng ban)']} />
                <InfoRow icon="send" label="NCC (Nơi gửi)" value={doc['Nhà cung cấp (Nơi ban hành)']} />
                {doc['Giá trị HĐ'] && (
                  <InfoRow icon="payments" label="Giá trị HĐ" value={formatCurrency(doc['Giá trị HĐ'])} />
                )}
              </div>
            </div>

            {/* Ghi chú */}
            {doc['Ghi chú'] && (
              <div className="p-4 border-b border-outline-variant">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">Ghi chú</p>
                <p className="text-sm text-on-surface leading-relaxed">
                  <span className="whitespace-pre-wrap">{notePreview}</span>
                  {noteOverflow && (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={() => setNoteExpanded(prev => !prev)}
                        className="inline text-sm text-primary hover:underline"
                      >
                        {noteExpanded ? 'ẩn' : 'xem thêm'}
                      </button>
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Người tạo / cập nhật */}
            {(doc['Người tạo'] || doc['Người cập nhật']) && (
              <div className="p-4 border-b border-outline-variant">
                <div className="grid grid-cols-2 gap-3">
                  {doc['Người tạo'] && (() => {
                    const u = (lookups.users || []).find(x => x['Tên đăng nhập'] === doc['Người tạo'])
                    const dn = u?.['Tên nhân viên'] || doc['Người tạo']
                    return (
                      <div className="flex items-start gap-2">
                        <Icon name="person_add" size={15} className="text-on-surface-variant shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-on-surface-variant">Người tạo</p>
                          <div className="relative group inline-block mt-0.5">
                            <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full cursor-default">
                              <span className="w-4 h-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[9px] font-bold shrink-0">{dn.charAt(0).toUpperCase()}</span>
                              {dn}
                            </span>
                            {u?.['Email'] && (
                              <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                <div className="bg-on-surface text-surface text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                                  <p className="text-surface/70">{u['Email']}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  {doc['Người cập nhật'] && (() => {
                    const u = (lookups.users || []).find(x => x['Tên đăng nhập'] === doc['Người cập nhật'])
                    const dn = u?.['Tên nhân viên'] || doc['Người cập nhật']
                    return (
                      <div className="flex items-start gap-2">
                        <Icon name="edit" size={15} className="text-on-surface-variant shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-on-surface-variant">Cập nhật bởi</p>
                          <div className="relative group inline-block mt-0.5">
                            <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full cursor-default">
                              <span className="w-4 h-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[9px] font-bold shrink-0">{dn.charAt(0).toUpperCase()}</span>
                              {dn}
                            </span>
                            {u?.['Email'] && (
                              <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                <div className="bg-on-surface text-surface text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                                  <p className="text-surface/70">{u['Email']}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* Bình luận */}
            <div className="p-4 flex flex-col border-b border-outline-variant">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">Bình luận ({comments.length})</p>
              <div className="flex-1 overflow-y-auto max-h-60 space-y-2 mb-3">
                {commentLoading && (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-on-surface-variant">
                    <Icon name="progress_activity" size={16} className="animate-spin" />
                    <span>Đang tải bình luận…</span>
                  </div>
                )}
                {!commentLoading && comments.length === 0 && <p className="text-xs text-on-surface-variant text-center py-4">Chưa có bình luận</p>}
                {comments.map((c, i) => {
                  const isMine = session && (c.UserID === session.userId || c['Tên người dùng'] === session.username)
                  const commentMeta = isMine ? 'Bạn' : (c['Tên người dùng'] || '—')
                  return (
                    <div key={c.ID || i} className={`flex gap-1.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                      {!isMine && (
                        <span className="w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {(c['Tên người dùng'] || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className={`max-w-[80%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        <div className={`flex items-center gap-1.5 text-[10px] text-on-surface-variant ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span className="font-medium">{commentMeta}</span>
                          <span className="opacity-50">•</span>
                          <span>{formatDateTime(c['Thời gian'])}</span>
                          {c._pending && (
                            <>
                              <span className="opacity-50">•</span>
                              <span>Đang gửi…</span>
                            </>
                          )}
                        </div>
                        <span className={`px-3 py-1.5 rounded-2xl text-xs leading-snug ${isMine ? 'bg-primary text-on-primary rounded-tr-sm' : 'bg-surface-container-low text-on-surface rounded-tl-sm'} ${c._pending ? 'opacity-70' : ''}`}>
                          {c['Nội dung']}
                        </span>
                      </div>
                    </div>
                  )
                })}
                <div ref={commentsEndRef} />
              </div>
              {canComment && (
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  className="flex-1 text-sm bg-surface-container-low rounded-xl px-3 py-2 border-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Nhập bình luận..."
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                />
                <button type="submit" disabled={!commentInput.trim()}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0">
                  <Icon name="send" size={16} />
                </button>
              </form>
              )}
            </div>

            {/* File list */}
            {fileInfos.length > 0 && (
              <div className="p-4">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
                  File đính kèm ({fileInfos.length})
                </p>
                <div className="space-y-1.5">
                  {fileInfos.map((fi, i) => (
                    <button
                      key={fi.fileId || i}
                      onClick={() => setSlideIdx(i)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
                        i === slideIdx ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      <Icon name="attach_file" size={14} className="shrink-0" />
                      <span className="flex-1 text-left truncate">{fi.fileName || `File ${i + 1}`} - {formatFileSize(fi.size) || doc['Kích thước']}</span>
                      {i === slideIdx && <Icon name="visibility" size={14} className="shrink-0 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon name={icon} size={15} className="text-on-surface-variant shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-on-surface-variant">{label}</p>
        <p className="text-sm text-on-surface">{value || '—'}</p>
      </div>
    </div>
  )
}
