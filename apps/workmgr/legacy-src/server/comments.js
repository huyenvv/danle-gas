// ===== Comment business logic =====
// Depends on: config.js (SHEETS), gas-core (getSheetData, addRow, deleteRow)

/**
 * Get comments for a task or project.
 */
function getComments(token, objectId, objectType) {
  requireAuth(token)
  objectType = objectType || 'Công Việc'
  var comments = getSheetData(SHEETS.BINH_LUAN)
  return comments.filter(function(c) {
    return String(c['Mã đối tượng']) === String(objectId) && c['Loại đối tượng'] === objectType
  }).sort(function(a, b) {
    return new Date(a['Thời gian']) - new Date(b['Thời gian'])
  })
}

/**
 * Add a comment.
 */
function addComment(token, objectId, objectType, content) {
  var session = requireAuth(token)
  if (!content || !String(content).trim()) throw new Error('Nội dung bình luận không được để trống')

  var userName = resolveUserName(session.userId)

  var result = addRow(SHEETS.BINH_LUAN, {
    'Mã đối tượng': objectId,
    'Loại đối tượng': objectType || 'Công Việc',
    'UserID': session.userId,
    'Tên người dùng': userName,
    'Nội dung': content,
    'Thời gian': new Date().toISOString(),
  })

  logActivity(session, 'Bình luận', objectType || 'Công Việc', objectId, content.substring(0, 50))

  return result
}

/**
 * Delete a comment (only author or admin can delete).
 */
function _deleteComment(token, commentId) {
  var session = requireAuth(token)
  var comments = getSheetData(SHEETS.BINH_LUAN)
  var comment = comments.find(function(c) { return String(c['ID']) === String(commentId) })

  if (!comment) throw new Error('Không tìm thấy bình luận')

  // Only author or admin can delete
  var isAdmin = session.role === 'admin' || session.role === 'Quản trị viên' || session.role === 'Giám đốc'
  if (String(comment['UserID']) !== String(session.userId) && !isAdmin) {
    throw new Error('Không có quyền xóa bình luận này')
  }

  return _coreDeleteRow(SHEETS.BINH_LUAN, commentId)
}
