import { useEffect, useState, useRef } from 'react'
import gasCall from '../../gasClient.js'
import { formatCurrency, formatDate, formatDateTime, statusColor, statusTooltip } from '../../utils/format.js'
import { formatMulti } from '../../utils/multiValue.js'
import Icon from '../common/Icon.jsx'
import { useConfirm } from '../../context/ConfirmContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { parsePhuTrach, isPhuTrach as checkPhuTrach, getAvailableActions } from '../../lib/workflowPermissions.js'
import WorkflowButtons from './WorkflowButtons.jsx'
import PublishDialog from './PublishDialog.jsx'
import UserPickerDropdown from '../common/UserPickerDropdown.jsx'
import ViewerPickerModal from '../common/ViewerPickerModal.jsx'
import PublishHistory from './PublishHistory.jsx'

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

function formatFileSize(size) {
  var value = Number(size || 0)
  if (!value) return '—'
  if (value < 1024) return value + ' B'
  if (value < 1024 * 1024) return (value / 1024).toFixed(1).replace(/\.0$/, '') + ' KB'
  if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(1).replace(/\.0$/, '') + ' MB'
  return (value / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, '') + ' GB'
}


export default function DocumentPreview({ doc: initialDoc, lookups, isAdmin, canDelete, token, session, onClose, onEdit, onDelete, onDocUpdated }) {
  const confirm = useConfirm()
  const { showToast } = useToast()
  const NOTE_PREVIEW_LIMIT = 200
  const [doc, setDoc] = useState(initialDoc)
  const fileInfos = parseFileInfos(doc['Tệp đính kèm'])
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
  const [tuChoiForm, setTuChoiForm] = useState(null) // null | { lyDo: '' }
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [showPublishHistory, setShowPublishHistory] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // Phân quyền xem (008) — đặt được kể cả khi tài liệu đã Hoàn thành (khóa sửa).
  const canManageViewers = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư'].includes(session?.role)
  const [showViewerModal, setShowViewerModal] = useState(false)
  const [savingViewers, setSavingViewers] = useState(false)

  // Options chọn "Người được xem": TOÀN BỘ user SSO active, BỎ những người mặc định đã xem
  // (Admin/Quản trị viên + Giám đốc/Văn thư — họ luôn xem được nên không cần chọn).
  const _defaultViewerIds = new Set()
  ;(lookups.assignments || []).forEach(a => {
    if (['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư'].includes(a['Chức vụ'])) _defaultViewerIds.add(String(a['UserID']))
  })
  const eligibleViewerUsers = (lookups.ssoUsers || lookups.users || [])
    .filter(u => !_defaultViewerIds.has(String(u.ID)) && u['Quyền'] !== 'Quản trị')

  // Người-xem của danh mục (cho chế độ "Theo danh mục" trong popup) — giống DocumentModal:
  // gộp quyền của danh mục + kế thừa ngược lên các danh mục CHA.
  function categoryViewerIds(catId) {
    const cats = lookups.danhMuc || []
    const eligibleSet = new Set(eligibleViewerUsers.map(u => String(u.ID)))
    const ids = new Set()
    const seen = new Set()
    let cur = String(catId || '')
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      const cat = cats.find(c => String(c.ID) === cur)
      if (!cat) break
      parsePhuTrach(cat['Người được xem']).forEach(id => ids.add(String(id)))
      parsePhuTrach(cat['Nhóm được xem']).forEach(gid => {
        const g = (lookups.nhom || []).find(x => String(x.ID) === String(gid))
        if (g) parsePhuTrach(g['Thành viên']).forEach(id => ids.add(String(id)))
      })
      cur = String(cat['Danh mục cha'] || '')
    }
    return [...ids].filter(id => eligibleSet.has(id))
  }

  // Lưu phân quyền từ popup (api_setDocumentViewers — đặt được kể cả khi tài liệu đã khóa sửa).
  async function handleConfirmViewers(ids) {
    setSavingViewers(true)
    try {
      const res = await gasCall('api_setDocumentViewers', token, doc['ID'],
        ids.length ? JSON.stringify(ids) : '')
      setDoc(res.data)
      if (onDocUpdated) onDocUpdated(res.data)
      setShowViewerModal(false)
      showToast('Đã cập nhật phân quyền xem', 'success')
    } catch (e) {
      showToast('Lỗi phân quyền: ' + e.message, 'error')
    } finally {
      setSavingViewers(false)
    }
  }

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
  const isPhuTrach = checkPhuTrach(doc, session)
  const isPhoiHop = checkPhuTrach({ 'Phụ trách': doc['Người phối hợp'] }, session)
  const COMMENT_ROLES = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  const canComment = COMMENT_ROLES.includes(role) || isPhuTrach || isPhoiHop
  const isFullAdmin = role === 'admin' || role === 'Quản trị viên'
  const isVanThuOwnerRejected = role === 'Văn thư' && status === 'Từ chối' && doc['Người tạo'] === session?.username
  const isPhuTrachRejectedResult = isPhuTrach && status === 'Từ chối kết quả'
  const isYCPhatHanhStatus = status === 'YC Phát hành'
  const canEditDoc = isYCPhatHanhStatus
    ? isFullAdmin
    : role === 'Giám đốc'
      ? status === 'Chờ duyệt'
      : isFullAdmin || isVanThuOwnerRejected

  async function handleTransition(action, data) {
    if (transitioning) return
    const actionLabel = { giaoViec: 'Giao việc', thuHoi: 'Thu hồi', nhanViec: 'Nhận việc', hoanThanh: 'Hoàn thành', hoanThanhLai: 'Hoàn thành', tuChoi: 'Từ chối', tuChoiKetQua: 'Từ chối kết quả', xacNhanHT: 'Xác nhận HT', luuTru: 'Lưu trữ', trinhDuyetLai: 'Trình duyệt lại', ycPhatHanh: 'YC Phát hành' }[action] || action
    if (!await confirm(`Xác nhận: ${actionLabel}?`)) return
    setTransitionLabel(actionLabel)
    setTransitioning(true)
    try {
      const res = await gasCall('api_transitionDocument', token, doc.ID, action, data)
      setDoc(prev => ({ ...prev, ...res.data }))
      showToast(res.emailError ? 'Đã chuyển trạng thái (gửi email thất bại)' : 'Đã chuyển trạng thái', res.emailError ? 'warning' : 'success')
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
      // Phụ trách nhận việc: chỉ được THÊM người phối hợp (không bỏ người do GĐ thêm)
      const existing = parsePhuTrach(doc['Người phối hợp'])
      setGiaoViecForm({ phoiHop: existing, phoiHopLocked: existing, noiDung: '', mode: 'nhanViec' })
    } else {
      // Giám đốc/Admin giao việc
      setGiaoViecForm({ phuTrach: '', phoiHop: parsePhuTrach(doc['Người phối hợp']), noiDung: '', mode: 'giaoViec' })
    }
  }

  async function submitGiaoViec() {
    if (giaoViecForm.mode === 'nhanViec') {
      // Nhận việc + bổ sung phối hợp; nếu có người mới thì nội dung bắt buộc
      const locked = giaoViecForm.phoiHopLocked || []
      const added = (giaoViecForm.phoiHop || []).filter(u => !locked.includes(u))
      if (added.length >= 1 && !(giaoViecForm.noiDung || '').trim()) {
        showToast('Phải nhập nội dung gửi tới người phối hợp', 'error'); return
      }
      await handleTransition('nhanViec', {
        'Người phối hợp': giaoViecForm.phoiHop,
        'Nội dung': (giaoViecForm.noiDung || '').trim(),
      })
      return
    }
    if (!giaoViecForm.phuTrach) { showToast('Phải chọn người phụ trách', 'error'); return }
    if ((giaoViecForm.phoiHop || []).length >= 1 && !(giaoViecForm.noiDung || '').trim()) {
      showToast('Phải nhập nội dung giao việc khi có người phối hợp', 'error'); return
    }
    await handleTransition('giaoViec', {
      'Phụ trách': giaoViecForm.phuTrach,
      'Người phối hợp': giaoViecForm.phoiHop,
      'Nội dung': (giaoViecForm.noiDung || '').trim(),
    })
  }

  async function submitTuChoi() {
    const isYCPH = tuChoiForm?.action === 'ycPhatHanh'
    if (!tuChoiForm?.lyDo?.trim()) { showToast(isYCPH ? 'Vui lòng nhập lý do yêu cầu phát hành' : 'Vui lòng nhập lý do từ chối', 'error'); return }
    await handleTransition(tuChoiForm.action || 'tuChoi', { lyDoTuChoi: tuChoiForm.lyDo.trim() })
    setTuChoiForm(null)
  }

  const availableActions = getAvailableActions(doc, session)
  const primaryGiaoViecAction = role === 'Giám đốc' && status === 'Chờ duyệt'
    ? availableActions.find(a => a.key === 'giaoViec')
    : null
  const primaryYCPhatHanhAction = availableActions.find(a => a.key === 'ycPhatHanh') || null
  const workflowActions = primaryGiaoViecAction
    ? availableActions.filter(a => a.key !== primaryGiaoViecAction.key)
    : availableActions
  const isAdminRole = role === 'admin' || role === 'Quản trị viên'
  const isVanThuRole = role === 'Văn thư'
  const canPublish = isAdminRole || isVanThuRole || session?.canPublish
  const isHoanThanh = status === 'Hoàn thành'
  const isTuChoi = status === 'Từ chối'
  const isTuChoiKetQua = status === 'Từ chối kết quả'
  const isCreator = doc['Người tạo'] === session?.username
  const isRejectedStatus = isTuChoi || isTuChoiKetQua
  const isDraft = status === 'Nháp'
  const showPublishBtn = canPublish && (isAdminRole ? (isHoanThanh || isYCPhatHanhStatus || isDraft) : (isHoanThanh || (isDraft && isCreator) || (isYCPhatHanhStatus && isCreator)))
  const publishHistory = (() => {
    const raw = doc['Lịch sử phát hành']
    if (!raw) return []
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch (_) { return [] }
  })()

  async function handlePublishFromDialog(toIds, ccIds) {
    setPublishing(true)
    try {
      const res = await gasCall('api_publishDocument', token, doc.ID, toIds, ccIds)
      showToast('Đã phát hành thành công', 'success')
      setShowPublishDialog(false)
      if (res.data) {
        setDoc(prev => ({ ...prev, ...res.data }))
        if (onDocUpdated) onDocUpdated(res.data)
      }
    } catch (err) {
      showToast(err.message || 'Lỗi phát hành', 'error')
    } finally {
      setPublishing(false)
    }
  }

  const hasSidebarActions = canEditDoc || !!primaryGiaoViecAction || !!primaryYCPhatHanhAction || canDelete || workflowActions.length > 0 || !!giaoViecForm || showPublishBtn
  const noteText = String(doc['Ghi chú'] || '')
  const noteOverflow = noteText.length > NOTE_PREVIEW_LIMIT
  const notePreview = noteOverflow && !noteExpanded
    ? noteText.slice(0, NOTE_PREVIEW_LIMIT).trimEnd() + '...'
    : noteText

  return (
    <>
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
        <div className={`px-6 py-4 flex items-center gap-4 border-b shrink-0 ${(doc['Khẩn'] === 'TRUE' || doc['Khẩn'] === true) && doc['Tình trạng'] !== 'Hoàn thành' ? 'bg-red-50 border-red-200' : 'bg-surface-container-low border-outline-variant'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${(doc['Khẩn'] === 'TRUE' || doc['Khẩn'] === true) && doc['Tình trạng'] !== 'Hoàn thành' ? 'bg-red-100' : 'bg-primary/10'}`}>
            <Icon name={getCategoryIcon(doc['Danh mục'])} size={22} className={(doc['Khẩn'] === 'TRUE' || doc['Khẩn'] === true) && doc['Tình trạng'] !== 'Hoàn thành' ? 'text-red-500' : 'text-primary'} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-base truncate ${(doc['Khẩn'] === 'TRUE' || doc['Khẩn'] === true) && doc['Tình trạng'] !== 'Hoàn thành' ? 'text-red-700' : 'text-on-surface'}`}>
              {doc['Tên hồ sơ']}
              {(doc['Khẩn'] === 'TRUE' || doc['Khẩn'] === true) && doc['Tình trạng'] !== 'Hoàn thành' && <Icon name="rocket_launch" size={18} className="text-red-500 ml-2 inline-block align-middle" />}
            </h3>
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
                {canDelete && (
                <button onClick={onDelete} disabled={transitioning}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-error-container text-on-error-container hover:opacity-80 transition-opacity text-sm font-medium disabled:opacity-40">
                  <Icon name="delete" size={18} />
                  Xóa
                </button>
                )}
                {primaryGiaoViecAction && (
                <button onClick={openGiaoViec} disabled={transitioning}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-hover transition-colors text-sm font-medium disabled:opacity-50 shadow-md3-1">
                  <Icon name={primaryGiaoViecAction.icon} size={18} />
                  {primaryGiaoViecAction.label}
                </button>
                )}
                {primaryYCPhatHanhAction && (
                <button onClick={() => setTuChoiForm({ lyDo: '', action: 'ycPhatHanh' })} disabled={transitioning}
                  className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-amber-500 text-white hover:bg-amber-600 transition-colors text-sm font-medium disabled:opacity-50 shadow-md3-1">
                  <Icon name="publish" size={18} />
                  YC Phát hành
                </button>
                )}
                {showPublishBtn && (
                <button onClick={() => setShowPublishDialog(true)} disabled={transitioning || publishing}
                  className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-amber-600 text-white hover:bg-amber-700 transition-colors text-sm font-medium disabled:opacity-50 shadow-md3-1">
                  <Icon name="send" size={18} />
                  Phát hành
                </button>
                )}
                {isVanThuOwnerRejected && (
                <button onClick={() => handleTransition('trinhDuyetLai')} disabled={transitioning}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-hover transition-colors text-sm font-medium disabled:opacity-50 shadow-md3-1">
                  <Icon name="send" size={18} />
                  Trình duyệt lại
                </button>
                )}
                {isPhuTrachRejectedResult && (
                <button onClick={() => handleTransition('hoanThanhLai')} disabled={transitioning}
                  className="col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 shadow-md3-1">
                  <Icon name="task_alt" size={18} />
                  Hoàn thành
                </button>
                )}
              </div>

              {/* Workflow action buttons */}
              <WorkflowButtons
                doc={doc}
                session={session}
                disabled={transitioning}
                filter={a => {
                  if (primaryGiaoViecAction && a.key === primaryGiaoViecAction.key) return false
                  if (primaryYCPhatHanhAction && a.key === 'ycPhatHanh') return false
                  if (isVanThuOwnerRejected && a.key === 'trinhDuyetLai') return false
                  if (isPhuTrachRejectedResult && a.key === 'hoanThanhLai') return false
                  return true
                }}
                onAction={(key) => (key === 'giaoViec' || (key === 'nhanViec' && isPhuTrach))
                  ? openGiaoViec(key)
                  : (key === 'tuChoi' || key === 'tuChoiKetQua' || key === 'ycPhatHanh')
                    ? setTuChoiForm({ lyDo: '', action: key })
                    : handleTransition(key)}
              />


              {/* Giao việc inline form */}
              {giaoViecForm && (() => {
                const isNhanViec = giaoViecForm.mode === 'nhanViec'
                const accent = isNhanViec ? 'blue-600' : 'primary'
                const lockedPH = giaoViecForm.phoiHopLocked || []
                const hasAddedPH = (giaoViecForm.phoiHop || []).some(u => !lockedPH.includes(u))
                // Hiện ô nhập nội dung: luôn ở giao việc; ở nhận việc chỉ khi có bổ sung người phối hợp mới
                const showNoiDung = !isNhanViec || hasAddedPH
                return (
                <div className={`${isNhanViec ? 'bg-blue-50 border-blue-200' : 'bg-primary/5 border-primary/20'} border rounded-2xl p-4 space-y-3 mt-2`}>
                  <p className={`text-xs font-semibold ${isNhanViec ? 'text-blue-600' : 'text-primary'} uppercase tracking-wide`}>
                    {isNhanViec ? 'Nhận việc — chọn người phối hợp' : 'Giao việc'}
                  </p>
                  {!isNhanViec && (
                  <div>
                    <label className="text-xs text-on-surface-variant mb-1 block">Người phụ trách *</label>
                    <UserPickerDropdown
                      users={lookups.ssoUsers || lookups.users || []}
                      phongBan={lookups.phongBan || []}
                      assignments={lookups.assignments || []}
                      value={giaoViecForm.phuTrach}
                      onChange={v => setGiaoViecForm(f => ({ ...f, phuTrach: v }))}
                    />
                  </div>
                  )}
                  <div>
                    <label className="text-xs text-on-surface-variant mb-1 block">Người phối hợp</label>
                    <UserPickerDropdown
                      users={lookups.ssoUsers || lookups.users || []}
                      phongBan={lookups.phongBan || []}
                      assignments={lookups.assignments || []}
                      value={giaoViecForm.phoiHop}
                      onChange={v => setGiaoViecForm(f => {
                        // Nhận việc: không cho bỏ người phối hợp đã có (luôn giữ phoiHopLocked)
                        const next = (f.mode === 'nhanViec' && f.phoiHopLocked)
                          ? Array.from(new Set([...f.phoiHopLocked, ...v]))
                          : v
                        return { ...f, phoiHop: next }
                      })}
                      placeholder="+ Thêm..."
                      exclude={giaoViecForm.phuTrach ? [giaoViecForm.phuTrach] : []}
                      excludeGroups={isNhanViec ? ['Ban Giám Đốc', 'Văn thư & Quản trị'] : undefined}
                      multiple
                    />
                  </div>
                  {showNoiDung && (
                  <div>
                    <label className="text-xs text-on-surface-variant mb-1 block">
                      {isNhanViec ? 'Nội dung gửi người phối hợp *' : 'Nội dung giao việc'}
                    </label>
                    <textarea
                      value={giaoViecForm.noiDung || ''}
                      onChange={e => setGiaoViecForm(f => ({ ...f, noiDung: e.target.value }))}
                      placeholder={isNhanViec ? 'Nhập nội dung gửi tới người phối hợp công việc…' : 'Nhập nội dung giao việc… (bắt buộc nếu có người phối hợp)'}
                      rows={3}
                      className="w-full bg-white rounded-xl px-3 py-2 text-sm border border-primary/20 focus:border-primary/40 focus:outline-none resize-none"
                    />
                  </div>
                  )}
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

              {/* Từ chối / YC Phát hành reason dialog */}
              {tuChoiForm && (() => {
                const isYCPH = tuChoiForm.action === 'ycPhatHanh'
                return (
                <div className={`${isYCPH ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'} border rounded-2xl p-4 space-y-3 mt-2`}>
                  <p className={`text-xs font-semibold ${isYCPH ? 'text-amber-700' : 'text-red-600'} uppercase tracking-wide`}>{isYCPH ? 'Yêu cầu phát hành' : 'Từ chối hồ sơ'}</p>
                  <textarea
                    value={tuChoiForm.lyDo}
                    onChange={e => setTuChoiForm(prev => ({ ...prev, lyDo: e.target.value }))}
                    placeholder={isYCPH ? 'Nhập lý do yêu cầu phát hành…' : 'Nhập lý do từ chối…'}
                    rows={3}
                    className={`w-full bg-white rounded-xl px-3 py-2 text-sm border ${isYCPH ? 'border-amber-200 focus:border-amber-400' : 'border-red-200 focus:border-red-400'} focus:outline-none resize-none`}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setTuChoiForm(null)}
                      className="px-3 py-1.5 text-xs border border-outline-variant rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">Hủy</button>
                    <button onClick={submitTuChoi} disabled={transitioning}
                      className={`px-4 py-1.5 text-xs ${isYCPH ? 'bg-amber-600' : 'bg-red-600'} text-white rounded-full disabled:opacity-50 hover:opacity-90 transition-opacity shadow-md3-1`}>
                      {transitioning ? 'Đang xử lý…' : isYCPH ? 'Xác nhận yêu cầu' : 'Xác nhận từ chối'}
                    </button>
                  </div>
                </div>
                )
              })()}
            </div>
            )}

            {/* Rejection / YC Phát hành reason banner */}
            {doc['Lý do từ chối'] && (status === 'Từ chối' || status === 'Từ chối kết quả' || status === 'YC Phát hành') && (
              <div className={`mx-4 mt-3 p-3 ${status === 'YC Phát hành' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'} border rounded-xl`}>
                <div className="flex items-start gap-2">
                  <Icon name={status === 'YC Phát hành' ? 'publish' : 'info'} size={16} className={`${status === 'YC Phát hành' ? 'text-amber-600' : 'text-red-600'} mt-0.5 shrink-0`} />
                  <div>
                    <p className={`text-xs font-semibold ${status === 'YC Phát hành' ? 'text-amber-700' : 'text-red-700'} mb-1`}>{status === 'YC Phát hành' ? 'Lý do yêu cầu phát hành' : 'Lý do từ chối'}</p>
                    <p className={`text-sm ${status === 'YC Phát hành' ? 'text-amber-800' : 'text-red-800'} whitespace-pre-wrap`}>{doc['Lý do từ chối']}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Nội dung giao việc banner — cột riêng, hiện bất cứ khi nào có nội dung */}
            {doc['Nội dung giao việc'] && (
              <div className="mx-4 mt-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-start gap-2">
                  <Icon name="assignment_ind" size={16} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-primary mb-1">Nội dung giao việc</p>
                    <p className="text-sm text-on-surface whitespace-pre-wrap">{doc['Nội dung giao việc']}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Nội dung phối hợp banner — do người chủ trì nhập lúc nhận việc, tách riêng */}
            {doc['Nội dung phối hợp'] && (
              <div className="mx-4 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <Icon name="groups" size={16} className="text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-600 mb-1">Nội dung phối hợp</p>
                    <p className="text-sm text-on-surface whitespace-pre-wrap">{doc['Nội dung phối hợp']}</p>
                  </div>
                </div>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(doc['Tình trạng'])}`}
                      title={statusTooltip(doc['Tình trạng'])}>
                      {doc['Tình trạng'] || '—'}
                    </span>
                    {publishHistory.length > 0 ? (
                      <button type="button" onClick={() => setShowPublishHistory(true)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
                        <Icon name="history" size={14} />
                        Đã phát hành {publishHistory.length} lần
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-on-surface-variant/60 bg-surface-container">
                        <Icon name="history" size={14} />
                        Chưa phát hành
                      </span>
                    )}
                  </div>
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
                      const list = parsePhuTrach(doc['Phụ trách'])
                      if (!list.length) return <p className="text-sm text-on-surface">—</p>
                      const u0 = (lookups.ssoUsers || lookups.users || []).find(u => u['Tên đăng nhập'] === list[0])
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
                      const list = parsePhuTrach(doc['Người phối hợp'])
                      if (!list.length) return <p className="text-sm text-on-surface">—</p>
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {list.map((a, i) => {
                            const u = (lookups.ssoUsers || lookups.users || []).find(u => u['Tên đăng nhập'] === a)
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
                <InfoRow icon="apartment" label="Dự án (Nơi nhận)" value={formatMulti(doc['Dự án (Phòng ban)'])} />
                <InfoRow icon="send" label="NCC (Nơi gửi)" value={doc['Nhà cung cấp (Nơi ban hành)']} />
                {doc['Giá trị HĐ'] && (
                  <InfoRow icon="payments" label="Giá trị HĐ" value={formatCurrency(doc['Giá trị HĐ'])} />
                )}
              </div>
            </div>

            {/* Phân quyền xem (008) — đặt được kể cả khi tài liệu đã Hoàn thành */}
            {(canManageViewers || doc['Người được xem']) && (
              <div className="p-4 border-b border-outline-variant">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Phân quyền xem</p>
                  {canManageViewers && (
                    <button data-testid="edit-viewers-btn" onClick={() => setShowViewerModal(true)} className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Icon name="edit" size={14} /> Sửa
                    </button>
                  )}
                </div>
                {doc['Người được xem'] ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {parsePhuTrach(doc['Người được xem']).map((id, i) => {
                      const u = (lookups.ssoUsers || lookups.users || []).find(x => String(x.ID) === String(id) || x['Tên đăng nhập'] === id)
                      const dn = u?.['Tên nhân viên'] || u?.['Tên đăng nhập'] || id
                      return (
                        <div key={i} className="relative group inline-block">
                          <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full cursor-default">
                            <span className="w-4 h-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[9px] font-bold shrink-0">{String(dn).charAt(0).toUpperCase()}</span>
                            {dn}
                          </span>
                          {u?.['Email'] && (
                            <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <div className="bg-on-surface text-surface text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg"><p className="text-surface/70">{u['Email']}</p></div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">Trống — chỉ người tham gia + vai trò toàn quyền xem</p>
                )}
              </div>
            )}
            {showViewerModal && (
              <ViewerPickerModal
                users={eligibleViewerUsers}
                phongBan={lookups.phongBan}
                assignments={lookups.assignments}
                value={parsePhuTrach(doc['Người được xem'])}
                categoryViewerIds={categoryViewerIds(doc['Danh mục'])}
                catName={(lookups.danhMuc || []).find(c => String(c.ID) === String(doc['Danh mục']))?.['Tên danh mục'] || ''}
                saving={savingViewers}
                onConfirm={handleConfirmViewers}
                onClose={() => setShowViewerModal(false)}
              />
            )}

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

      {showPublishDialog && (
        <PublishDialog
          users={lookups.ssoUsers || lookups.users || []}
          phongBan={lookups.phongBan || []}
          assignments={lookups.assignments || []}
          onPublish={handlePublishFromDialog}
          onClose={() => setShowPublishDialog(false)}
          loading={publishing}
        />
      )}

      {showPublishHistory && (
        <PublishHistory
          history={publishHistory}
          users={lookups.ssoUsers || lookups.users || []}
          onClose={() => setShowPublishHistory(false)}
        />
      )}
    </>
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
