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

export default function DocumentPreview({ doc, lookups, isAdmin, token, session, onClose, onEdit, onDelete }) {
  const confirm = useConfirm()
  const { showToast } = useToast()
  const fileInfos = parseFileInfos(doc['File ID'])
  const [slideIdx, setSlideIdx] = useState(0)
  const [comments, setComments] = useState([])
  const [commentInput, setCommentInput] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)
  const commentsEndRef = useRef(null)

  const currentFile = fileInfos[slideIdx] || null
  const previewUrl = currentFile
    ? `https://drive.google.com/file/d/${encodeURIComponent(currentFile.fileId)}/preview`
    : null
  const downloadUrl = currentFile
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(currentFile.fileId)}`
    : null

  useEffect(() => {
    if (token && doc['ID']) {
      gasCall('api_markAsRead', token, doc['ID']).catch(() => {})
      gasCall('api_getComments', token, doc['ID']).then(r => setComments(r.data || [])).catch(() => {})
    }
  }, [doc['ID']])

  async function handleAddComment(e) {
    e.preventDefault()
    if (!commentInput.trim()) return
    setCommentSaving(true)
    try {
      const r = await gasCall('api_addComment', token, doc['ID'], commentInput.trim())
      setComments(prev => [...prev, r.data])
      setCommentInput('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch(_) {}
    finally { setCommentSaving(false) }
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

  const diff = (Number(doc['Giá trị HĐ']) || 0) - (Number(doc['Giá trị thực hiện']) || 0)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.2)] w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-surface-container-low px-6 py-4 flex items-center gap-4 border-b border-outline-variant shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon name={getCategoryIcon(doc['Danh mục'])} size={22} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-on-surface text-base truncate">{doc['Tên hồ sơ']}</h3>
            <p className="text-xs text-on-surface-variant">{doc['Số hồ sơ'] ? `Số hồ sơ: ${doc['Số hồ sơ']}` : 'Chưa có số hồ sơ'}</p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors shrink-0">
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

            {/* Actions 2x2 */}
            <div className="p-4 grid grid-cols-2 gap-2 border-b border-outline-variant">
              <button onClick={handleDownload} disabled={!currentFile}
                className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-surface-container-low text-on-surface hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40 text-sm font-medium">
                <Icon name="download" size={18} />
                Tải về
              </button>
              <button onClick={handleShare} disabled={!currentFile}
                className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-surface-container-low text-on-surface hover:bg-secondary/10 hover:text-secondary transition-colors disabled:opacity-40 text-sm font-medium">
                <Icon name="share" size={18} />
                Chia sẻ
              </button>
              <button onClick={onEdit}
                className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-surface-container-low text-on-surface hover:bg-primary/10 hover:text-primary transition-colors text-sm font-medium">
                <Icon name="edit" size={18} />
                Chỉnh sửa
              </button>
              {isAdmin ? (
                <button onClick={onDelete}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-error-container text-on-error-container hover:opacity-80 transition-opacity text-sm font-medium">
                  <Icon name="delete" size={18} />
                  Xóa
                </button>
              ) : <div />}
            </div>

            {/* Classification */}
            <div className="p-4 border-b border-outline-variant">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">Phân loại</p>
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
              </div>
            </div>

            {/* Ownership */}
            <div className="p-4 border-b border-outline-variant">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">Thông tin chủ thể</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow icon="corporate_fare" label="Phòng ban" value={doc['Phòng ban']} />
                <InfoRow icon="calendar_today" label="Ngày ban hành" value={formatDate(doc['Ngày ban hành'])} />
                <InfoRow icon="event" label="Ngày kết thúc" value={formatDate(doc['Ngày kết thúc'])} />
                <div className="flex items-start gap-2">
                  <Icon name="group" size={15} className="text-on-surface-variant shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-on-surface-variant">Phụ trách</p>
                    {(() => {
                      const list = parseAssignees(doc['Phụ trách'])
                      if (!list.length) return <p className="text-sm text-on-surface">—</p>
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {list.map((a, i) => (
                            <span key={i} title={String(a)} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                              <span className="w-4 h-4 rounded-full bg-primary text-on-primary flex items-center justify-center text-[9px] font-bold shrink-0">{String(a).charAt(0).toUpperCase()}</span>
                              {a}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Business Context */}
            <div className="p-4 border-b border-outline-variant">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">Bối cảnh kinh doanh</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow icon="account_tree" label="Dự án" value={doc['Dự án']} />
                <InfoRow icon="inventory_2" label="Nhà cung cấp" value={doc['Nhà cung cấp']} />
                {(doc['Giá trị HĐ'] || doc['Giá trị thực hiện']) && (
                  <>
                    <InfoRow icon="payments" label="Giá trị HĐ" value={formatCurrency(doc['Giá trị HĐ'])} />
                    <InfoRow icon="receipt_long" label="Giá trị TH" value={formatCurrency(doc['Giá trị thực hiện'])} />
                    <div className="col-span-2">
                      <InfoRow icon="balance" label="Chênh lệch" value={
                        <span className={diff >= 0 ? 'text-emerald-700 font-semibold' : 'text-error font-semibold'}>{formatCurrency(diff)}</span>
                      } />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mô tả */}
            {doc['Mô tả'] && (
              <div className="p-4 border-b border-outline-variant">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">Ghi chú</p>
                <p className="text-sm text-on-surface leading-relaxed">{doc['Mô tả']}</p>
              </div>
            )}

            {/* Người tạo / cập nhật */}
            {(doc['Người tạo'] || doc['Người cập nhật']) && (
              <div className="p-4 border-b border-outline-variant">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">Lịch sử</p>
                <div className="grid grid-cols-2 gap-3">
                  {doc['Người tạo'] && (
                    <div className="flex items-start gap-2">
                      <Icon name="person_add" size={15} className="text-on-surface-variant shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-on-surface-variant">Người tạo</p>
                        <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full mt-0.5">
                          <span className="w-4 h-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[9px] font-bold shrink-0">{String(doc['Người tạo']).charAt(0).toUpperCase()}</span>
                          {doc['Người tạo']}
                        </span>
                      </div>
                    </div>
                  )}
                  {doc['Người cập nhật'] && (
                    <div className="flex items-start gap-2">
                      <Icon name="edit" size={15} className="text-on-surface-variant shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-on-surface-variant">Cập nhật bởi</p>
                        <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full mt-0.5">
                          <span className="w-4 h-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[9px] font-bold shrink-0">{String(doc['Người cập nhật']).charAt(0).toUpperCase()}</span>
                          {doc['Người cập nhật']}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bình luận */}
            <div className="p-4 flex flex-col border-b border-outline-variant">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">Bình luận ({comments.length})</p>
              <div className="flex-1 overflow-y-auto max-h-60 space-y-2 mb-3">
                {comments.length === 0 && <p className="text-xs text-on-surface-variant text-center py-4">Chưa có bình luận</p>}
                {comments.map((c, i) => {
                  const isMine = session && (c.UserID === session.userId || c['Tên người dùng'] === session.username)
                  return (
                    <div key={c.ID || i} className={`flex gap-1.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                      {!isMine && (
                        <span className="w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {(c['Tên người dùng'] || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className={`max-w-[80%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        {!isMine && <span className="text-[10px] text-on-surface-variant">{c['Tên người dùng']}</span>}
                        <span className={`px-3 py-1.5 rounded-2xl text-xs leading-snug ${isMine ? 'bg-primary text-on-primary rounded-tr-sm' : 'bg-surface-container-low text-on-surface rounded-tl-sm'}`}>
                          {c['Nội dung']}
                        </span>
                        <span className="text-[10px] text-on-surface-variant">{c['Thời gian'] || ''}</span>
                      </div>
                    </div>
                  )
                })}
                <div ref={commentsEndRef} />
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  className="flex-1 text-sm bg-surface-container-low rounded-xl px-3 py-2 border-none focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={commentSaving ? 'Đang gửi...' : 'Nhập bình luận...'}
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  disabled={commentSaving}
                />
                <button type="submit" disabled={commentSaving || !commentInput.trim()}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary text-on-primary hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0">
                  <Icon name="send" size={16} />
                </button>
              </form>
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
                      <span className="flex-1 text-left truncate">{fi.fileName || `File ${i + 1}`}</span>
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
