import { useState, useEffect, useMemo } from 'react'
import gasCall from '../../gasClient.js'
import { mutate } from '../../utils/mutate.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { canUpdateTaskProgress } from '../../utils/permissions.js'
import { formatDate, timeAgo } from '../../utils/format.js'

function parseSubtasks(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export default function TaskDetailModal({ task, token, users, labels, departments, onClose }) {
  const { session } = useAuth()
  const { showToast } = useToast()
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(Number(task['Tiến độ']) || 0)
  const [savingProgress, setSavingProgress] = useState(false)
  const [subtasks, setSubtasks] = useState(parseSubtasks(task['Subtasks']))

  const taskDept = useMemo(
    () => departments.find(d => String(d.ID) === String(task['Phòng ban ID'])),
    [departments, task]
  )
  const canEditProgress = canUpdateTaskProgress(session, taskDept, task)

  useEffect(() => { setProgress(Number(task['Tiến độ']) || 0) }, [task.ID, task['Tiến độ']])
  useEffect(() => { setSubtasks(parseSubtasks(task['Subtasks'])) }, [task.ID, task['Subtasks']])

  const toggleSubtask = async (index) => {
    const prev = subtasks
    const updated = subtasks.map((s, i) => i === index ? { ...s, done: !s.done } : s)
    const newProgress = Math.round(updated.filter(s => s.done).length / updated.length * 100)
    setSubtasks(updated)
    setProgress(newProgress)
    try {
      await mutate('api_updateTask', token, task.ID, { 'Subtasks': JSON.stringify(updated), 'Tiến độ': newProgress })
      task['Subtasks'] = JSON.stringify(updated)
      task['Tiến độ'] = newProgress
    } catch (e) {
      setSubtasks(prev)
      setProgress(Number(task['Tiến độ']) || 0)
      showToast(e.message, 'error')
    }
  }

  const saveProgress = async (value) => {
    if (value === Number(task['Tiến độ'] || 0)) return
    setSavingProgress(true)
    try {
      await mutate('api_updateTaskProgress', token, task.ID, task['Phòng ban ID'], value)
      task['Tiến độ'] = value
      showToast('Đã cập nhật tiến độ', 'success')
    } catch (e) {
      setProgress(Number(task['Tiến độ']) || 0)
      showToast(e.message, 'error')
    }
    setSavingProgress(false)
  }

  useEffect(() => {
    gasCall('api_getComments', token, task.ID, 'Công Việc')
      .then(data => setComments(Array.isArray(data) ? data : []))
      .catch(() => setComments([]))
  }, [task.ID, token])

  const getUserName = (id) => { const u = users.find(u => String(u.ID) === String(id)); return u ? (u['Tên nhân viên']||u['Tên đăng nhập']) : '' }
  const getDeptName = (id) => { const d = departments.find(d => String(d.ID) === String(id)); return d ? d['Tên phòng ban'] : '' }

  const handleSend = async () => {
    if (!newComment.trim()) return
    setSending(true)
    try {
      const created = await gasCall('api_addComment', token, task.ID, 'Công Việc', newComment)
      setNewComment('')
      if (created && created.ID) setComments(prev => [...prev, created])
    } catch (e) { console.error(e) }
    setSending(false)
  }

  const fields = [
    { label: 'Phòng/ Ban/ NM', value: getDeptName(task['Phòng ban ID']) },
    { label: 'Trạng thái', value: task['Trạng thái'] },
    { label: 'Ưu tiên', value: task['Mức độ ưu tiên'] },
    { label: 'Người thực hiện', value: getUserName(task['Người thực hiện ID']) },
    { label: 'Người giao', value: getUserName(task['Người giao ID']) },
    { label: 'Ngày bắt đầu', value: formatDate(task['Ngày bắt đầu']) },
    { label: 'Ngày hết hạn', value: formatDate(task['Ngày hết hạn']) },
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
          <div>
            <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1">
              <span className="font-semibold uppercase tracking-wider">Tiến độ</span>
              <span className="font-medium text-on-surface">{progress}%{savingProgress && ' (đang lưu…)'}</span>
            </div>
            {canEditProgress ? (
              <input
                type="range" min={0} max={100} step={5}
                value={progress}
                onChange={e => setProgress(Number(e.target.value))}
                onMouseUp={e => saveProgress(Number(e.target.value))}
                onTouchEnd={e => saveProgress(Number(e.target.value))}
                disabled={savingProgress}
                className="w-full accent-primary"
              />
            ) : (
              <div className="h-2 bg-surface-variant rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: progress + '%' }} />
              </div>
            )}
          </div>

          {task['Người phối hợp'] && (
            <div>
              <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Người phối hợp</h4>
              <div className="flex flex-wrap gap-1.5">
                {String(task['Người phối hợp']).split(',').map(s => s.trim()).filter(Boolean).map(id => (
                  <span key={id} className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface-container text-on-surface">{getUserName(id) || id}</span>
                ))}
              </div>
            </div>
          )}

          {subtasks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                Công việc con ({subtasks.filter(s => s.done).length}/{subtasks.length})
              </h4>
              <div className="space-y-1">
                {subtasks.map((s, i) => (
                  <div key={s.id || i} onClick={() => toggleSubtask(i)}
                    className="flex items-center gap-2 bg-surface-container-low rounded-lg px-3 py-1.5 cursor-pointer hover:bg-surface-container transition-colors">
                    <span className={`material-symbols-outlined text-base ${s.done ? 'text-primary icon-filled' : 'text-on-surface-variant'}`}>
                      {s.done ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                    <span className={`text-sm flex-1 ${s.done ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>{s.title || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {task['Ghi chú'] && (
            <div>
              <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Ghi chú</h4>
              <p className="text-sm text-on-surface-variant whitespace-pre-wrap bg-surface-container-low rounded-xl px-3 py-2">{task['Ghi chú']}</p>
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
              <button onClick={handleSend} disabled={sending || !newComment.trim()} className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-accent-hover transition-colors">
                <span className="material-symbols-outlined text-base">send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
