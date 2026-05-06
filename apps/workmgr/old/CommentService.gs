/**
 * ============================================
 * COMMENT SERVICE - Quản lý bình luận
 * ============================================
 */

/** Lấy bình luận của công việc */
function getComments(taskId) {
  try {
    let data = sheetToJSON('Bình Luận');
    if (taskId) {
      data = data.filter(d => d['Mã Công Việc'] === taskId);
    }
    
    // Sort cũ nhất lên trước (theo thứ tự thời gian)
    data.sort((a, b) => {
      const dateA = parseDateStr(a['Ngày Tạo']);
      const dateB = parseDateStr(b['Ngày Tạo']);
      return dateA - dateB;
    });
    
    return JSON.stringify({ success: true, data: data });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}

/** Thêm bình luận */
function addComment(comment) {
  try {
    const sheet = getSheet('Bình Luận');
    const id = generateId('BL');
    
    sheet.appendRow([
      id,
      comment.maCongViec || '',
      comment.noiDung || '',
      comment.nguoiBinhLuan || '',
      comment.maNguoiBinhLuan || '',
      new Date(),
      'Không'
    ]);
    
    // Tạo thông báo cho chủ task
    if (comment.maChuTask && comment.maChuTask !== comment.maNguoiBinhLuan) {
      addNotification({
        tieuDe: 'Bình luận mới trong công việc',
        noiDung: comment.nguoiBinhLuan + ' đã bình luận trong ' + comment.maCongViec,
        loai: 'Bình Luận',
        nguoiNhan: comment.tenChuTask || '',
        maNguoiNhan: comment.maChuTask
      });
    }
    
    return JSON.stringify({ success: true, id: id, message: 'Thêm bình luận thành công' });
  } catch (e) {
    return JSON.stringify({ success: false, message: 'Lỗi: ' + e.message });
  }
}

/** Sửa bình luận */
function updateComment(commentId, newContent) {
  try {
    const sheet = getSheet('Bình Luận');
    const finder = sheet.createTextFinder(commentId).matchEntireCell(true);
    const result = finder.findNext();
    
    if (result && result.getColumn() === 1) {
      const row = result.getRow();
      sheet.getRange(row, 3).setValue(newContent);
      sheet.getRange(row, 7).setValue('Có');
      return JSON.stringify({ success: true });
    }
    return JSON.stringify({ success: false, message: 'Không tìm thấy bình luận' });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}

/** Xóa bình luận */
function deleteComment(commentId) {
  try {
    const sheet = getSheet('Bình Luận');
    const finder = sheet.createTextFinder(commentId).matchEntireCell(true);
    const result = finder.findNext();
    
    if (result && result.getColumn() === 1) {
      sheet.deleteRow(result.getRow());
      return JSON.stringify({ success: true });
    }
    return JSON.stringify({ success: false, message: 'Không tìm thấy' });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}
