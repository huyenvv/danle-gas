/**
 * ============================================
 * TASK SERVICE - Quản lý công việc
 * ============================================
 */

/** Lấy danh sách công việc */
function getTasks(filters) {
  if (!filters) filters = {};
  try {
    let data = sheetToJSON('Công Việc');
    
    // Filter theo role
    if (filters.role === 'Thành Viên' && filters.userId) {
      data = data.filter(d => d['Mã Người Thực Hiện'] === filters.userId);
    } else if (filters.role === 'Leader' && filters.userId) {
      // Leader thấy task trong dự án mình quản lý
      const projects = JSON.parse(getProjects({ role: 'Leader', userId: filters.userId }));
      if (projects.success) {
        const projectIds = projects.data.map(p => p['Mã DA']);
        data = data.filter(d => projectIds.includes(d['Mã Dự Án']));
      }
    }
    
    // Filter theo dự án
    if (filters.projectId) {
      data = data.filter(d => d['Mã Dự Án'] === filters.projectId);
    }
    
    // Filter theo trạng thái
    if (filters.status) {
      data = data.filter(d => d['Trạng Thái'] === filters.status);
    }
    
    // Filter theo khoảng thời gian (cho Kanban)
    if (filters.dateFrom && filters.dateTo) {
      const from = new Date(filters.dateFrom);
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59);
      
      data = data.filter(d => {
        const taskStart = parseDateStr(d['Ngày Bắt Đầu']);
        const taskEnd = parseDateStr(d['Ngày Hết Hạn']);
        // Overlap check
        return taskStart <= to && taskEnd >= from;
      });
    }
    
    // Filter theo người thực hiện
    if (filters.assigneeId) {
      data = data.filter(d => d['Mã Người Thực Hiện'] === filters.assigneeId);
    }
    
    // Sort mới nhất lên đầu
    data.sort((a, b) => {
      const dateA = parseDateStr(a['Ngày Tạo']);
      const dateB = parseDateStr(b['Ngày Tạo']);
      return dateB - dateA;
    });
    
    return JSON.stringify({ success: true, data: data });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}

/** Thêm công việc mới */
function addTask(task) {
  try {
    const sheet = getSheet('Công Việc');
    const id = generateId('CV');
    
    sheet.appendRow([
      id,
      task.tieuDe || '',
      task.moTa || '',
      task.maDuAn || '',
      task.tenDuAn || '',
      task.nguoiThucHien || '',
      task.maNguoiThucHien || '',
      task.nguoiGiao || '',
      task.maNguoiGiao || '',
      task.trangThai || 'Cần Làm',
      task.mucDoUuTien || 'Trung Bình',
      task.ngayBatDau ? new Date(task.ngayBatDau) : new Date(),
      task.ngayHetHan ? new Date(task.ngayHetHan) : '',
      '',
      safeParseNumber(task.chiPhiUocTinh),
      0,
      task.nhan || '',
      0,
      new Date(),
      task.ghiChu || ''
    ]);
    
    // Tạo thông báo cho người được giao
    if (task.maNguoiThucHien) {
      addNotification({
        tieuDe: 'Bạn được giao công việc mới',
        noiDung: 'Công việc: ' + task.tieuDe,
        loai: 'Giao Việc',
        nguoiNhan: task.nguoiThucHien,
        maNguoiNhan: task.maNguoiThucHien
      });
    }
    
    logActivity('Tạo Công Việc', 'Tạo công việc: ' + task.tieuDe, 'Công Việc', id, task.maNguoiGiao, task.nguoiGiao);
    
    return JSON.stringify({ success: true, id: id, message: 'Tạo công việc thành công' });
  } catch (e) {
    return JSON.stringify({ success: false, message: 'Lỗi: ' + e.message });
  }
}

/** Cập nhật công việc */
function updateTask(task) {
  try {
    const sheet = getSheet('Công Việc');
    const finder = sheet.createTextFinder(task.maCongViec).matchEntireCell(true);
    const result = finder.findNext();
    
    if (result && result.getColumn() === 1) {
      const row = result.getRow();
      sheet.getRange(row, 2).setValue(task.tieuDe || '');
      sheet.getRange(row, 3).setValue(task.moTa || '');
      sheet.getRange(row, 4).setValue(task.maDuAn || '');
      sheet.getRange(row, 5).setValue(task.tenDuAn || '');
      sheet.getRange(row, 6).setValue(task.nguoiThucHien || '');
      sheet.getRange(row, 7).setValue(task.maNguoiThucHien || '');
      sheet.getRange(row, 10).setValue(task.trangThai || '');
      sheet.getRange(row, 11).setValue(task.mucDoUuTien || '');
      sheet.getRange(row, 12).setValue(task.ngayBatDau ? new Date(task.ngayBatDau) : '');
      sheet.getRange(row, 13).setValue(task.ngayHetHan ? new Date(task.ngayHetHan) : '');
      
      // Nếu hoàn thành thì ghi ngày hoàn thành
      if (task.trangThai === 'Hoàn Thành' && !task.ngayHoanThanh) {
        sheet.getRange(row, 14).setValue(new Date());
      } else if (task.ngayHoanThanh) {
        sheet.getRange(row, 14).setValue(new Date(task.ngayHoanThanh));
      }
      
      sheet.getRange(row, 15).setValue(safeParseNumber(task.chiPhiUocTinh));
      sheet.getRange(row, 16).setValue(safeParseNumber(task.chiPhiThucTe));
      sheet.getRange(row, 17).setValue(task.nhan || '');
      sheet.getRange(row, 18).setValue(safeParseNumber(task.tienDo));
      sheet.getRange(row, 20).setValue(task.ghiChu || '');
      
      return JSON.stringify({ success: true, message: 'Cập nhật thành công' });
    }
    return JSON.stringify({ success: false, message: 'Không tìm thấy công việc' });
  } catch (e) {
    return JSON.stringify({ success: false, message: 'Lỗi: ' + e.message });
  }
}

/** Cập nhật trạng thái task (dùng cho Kanban drag) */
function updateTaskStatus(taskId, newStatus, userId, userName) {
  try {
    const sheet = getSheet('Công Việc');
    const finder = sheet.createTextFinder(taskId).matchEntireCell(true);
    const result = finder.findNext();
    
    if (result && result.getColumn() === 1) {
      const row = result.getRow();
      sheet.getRange(row, 10).setValue(newStatus);
      
      if (newStatus === 'Hoàn Thành') {
        sheet.getRange(row, 14).setValue(new Date());
        sheet.getRange(row, 18).setValue(100);
      }
      
      logActivity('Cập Nhật Trạng Thái', 'Chuyển ' + taskId + ' sang ' + newStatus, 'Công Việc', taskId, userId, userName);
      
      return JSON.stringify({ success: true });
    }
    return JSON.stringify({ success: false, message: 'Không tìm thấy' });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}

/** Xóa công việc */
function deleteTask(id) {
  try {
    const sheet = getSheet('Công Việc');
    const finder = sheet.createTextFinder(id).matchEntireCell(true);
    const result = finder.findNext();
    
    if (result && result.getColumn() === 1) {
      sheet.deleteRow(result.getRow());
      
      // Xóa bình luận liên quan
      try {
        const commentSheet = getSheet('Bình Luận');
        if (commentSheet) {
          const commentData = commentSheet.getDataRange().getValues();
          for (let i = commentData.length - 1; i >= 1; i--) {
            if (String(commentData[i][1]) === id) {
              commentSheet.deleteRow(i + 1);
            }
          }
        }
      } catch (ce) {}
      
      return JSON.stringify({ success: true, message: 'Xóa thành công' });
    }
    return JSON.stringify({ success: false, message: 'Không tìm thấy' });
  } catch (e) {
    return JSON.stringify({ success: false, message: 'Lỗi: ' + e.message });
  }
}
