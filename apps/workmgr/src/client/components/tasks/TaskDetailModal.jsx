import { useState, useEffect } from 'react'
import gasCall from '../../gasClient.js'
import { formatDate, timeAgo } from '../../utils/format.js'

export default function TaskDetailModal({ task, token, users, labels, projects, onClose }) {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    gasCall('api_getComments', token, task.ID, 'Công Việc')
      .then(data => setComments(Array.isArray(data) ? data : []))
      .catch(() => setComments([]))
  }, [task.ID, token])

  const getUserName = (id) => { const u = users.find(u => String(u.ID) === String(id)); return u ? (u['Tên nhân viên']||u['Tên đăng nhập']) : '' }
  const getProjectName = (id) => { const p = projects.find(p => String(p.ID) === String(id)); return p ? p['Tên dự án'] : '' }

  const handleSend = async () => {
    if (!newComment.trim()) return
    setSending(true)
    try {
      await gasCall('api_addComment', token, task.ID, 'Công Việc', newComment)
      setNewComment('')
      const data = await gasCall('api_getComments', token, task.ID, 'Công Việc')
      setComments(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setSending(false)
  }

  const fields = [
    { label: 'Dự án', value: getProjectName(task['Dự án ID']) },
    { label: 'Trạng thái', value: task['Trạng thái'] },
    { label: 'Ưu tiên', value: task['Mức độ ưu tiên'] },
    { label: 'Người thực hiện', value: getUserName(task['Người thực hiện ID']) },
    { label: 'Người giao', value: getUserName(task['Người giao ID']) },
    { label: 'Ngày bắt đầu', value: formatDate(task['Ngày bắt đầu']) },
    { label: 'Ngày hết hạn', value: formatDate(task['Ngày hết hạn']) },
    { label: 'Tiến độ', value: (task['Tiến độ'] || 0) + '%' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-md3-3 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <h2 className="text-lg font-bold text-on-surface">{task['Tiêu đề']}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-5 space-y-5">
          {task['Mô tả'] && <p className="text-sm text-on-surface-variant leading-relaxed">{task['Mô tả']}</p>}
          <div className="grid grid-cols-2 gap-3">
            {fields.map(f => f.value && (
              <div key={f.label} className="bg-surface-container-low rounded-xl px-3 py-2">
                <div className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">{f.label}</div>
                <div className="text-sm text-on-surface font-medium mt-0.5">{f.value}</div>
              </div>
            ))}
          </div>
          {task['Tiến độ'] > 0 && (
            <div className="h-2 bg-surface-variant rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: task['Tiến độ'] + '%' }} />
            </div>
          )}

          {/* Comments */}
          <div className="border-t border-outline-variant pt-4">
            <h3 className="text-sm font-semibold text-on-surface mb-3">Bình Luận ({comments.length})</h3>
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
              {comments.map(c => (
                <div key={c.ID} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary-container flex items-center justify-center text-[10px] font-bold text-on-primary-container shrink-0">
                    {(c['Tên người dùng'] || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-on-surface">{c['Tên người dùng']}</span>
                      <span className="text-[10px] text-on-surface-variant">{timeAgo(c['Thời gian'])}</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-0.5">{c['Nội dung']}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && <p className="text-xs text-on-surface-variant text-center py-3">Chưa có bình luận</p>}
            </div>
            <div className="flex gap-2">
              <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Viết bình luận…" className="flex-1 px-3 py-2 bg-surface-container rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-primary/30" />
              <button onClick={handleSend} disabled={sending || !newComment.trim()} className="px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-primary-700 transition-colors">
                <span className="material-symbols-outlined text-base">send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
