/**
 * ============================================
 * PROJECT SERVICE - Quản lý dự án
 * ============================================
 */

/** Lấy danh sách dự án */
function getProjects(filters) {
  if (!filters) filters = {};
  try {
    let data = sheetToJSON('Dự Án');
    
    // Filter theo role
    if (filters.role === 'Thành Viên' && filters.userId) {
      data = data.filter(d => {
        const members = String(d['Thành Viên Tham Gia'] || '').split(',').map(s => s.trim());
        return members.includes(filters.userId);
      });
    } else if (filters.role === 'Leader' && filters.userId) {
      data = data.filter(d => {
        const members = String(d['Thành Viên Tham Gia'] || '').split(',').map(s => s.trim());
        return d['Mã Leader'] === filters.userId || members.includes(filters.userId);
      });
    }
    
    // Filter theo trạng thái
    if (filters.status) {
      data = data.filter(d => d['Trạng Thái'] === filters.status);
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

/** Thêm dự án mới */
function addProject(project) {
  try {
    const sheet = getSheet('Dự Án');
    const id = generateId('DA');
    
    sheet.appendRow([
      id,
      project.tenDuAn || '',
      project.moTa || '',
      project.trangThai || 'Lên Kế Hoạch',
      project.mucDoUuTien || 'Trung Bình',
      safeParseNumber(project.nganSach),
      0,
      project.ngayBatDau ? new Date(project.ngayBatDau) : new Date(),
      project.ngayKetThuc ? new Date(project.ngayKetThuc) : '',
      '',
      project.tenLeader || '',
      project.maLeader || '',
      project.thanhVien || '',
      0,
      new Date(),
      project.nguoiTao || '',
      project.ghiChu || ''
    ]);
    
    logActivity('Tạo Dự Án', 'Tạo dự án: ' + project.tenDuAn, 'Dự Án', id, project.nguoiTao, project.tenNguoiTao || '');
    
    return JSON.stringify({ success: true, id: id, message: 'Thêm dự án thành công' });
  } catch (e) {
    return JSON.stringify({ success: false, message: 'Lỗi: ' + e.message });
  }
}

/** Cập nhật dự án */
function updateProject(project) {
  try {
    const sheet = getSheet('Dự Án');
    const finder = sheet.createTextFinder(project.maDuAn).matchEntireCell(true);
    const result = finder.findNext();
    
    if (result && result.getColumn() === 1) {
      const row = result.getRow();
      sheet.getRange(row, 2).setValue(project.tenDuAn || '');
      sheet.getRange(row, 3).setValue(project.moTa || '');
      sheet.getRange(row, 4).setValue(project.trangThai || '');
      sheet.getRange(row, 5).setValue(project.mucDoUuTien || '');
      sheet.getRange(row, 6).setValue(safeParseNumber(project.nganSach));
      sheet.getRange(row, 7).setValue(safeParseNumber(project.chiPhiThucTe));
      sheet.getRange(row, 8).setValue(project.ngayBatDau ? new Date(project.ngayBatDau) : '');
      sheet.getRange(row, 9).setValue(project.ngayKetThuc ? new Date(project.ngayKetThuc) : '');
      sheet.getRange(row, 10).setValue(project.ngayHoanThanh ? new Date(project.ngayHoanThanh) : '');
      sheet.getRange(row, 11).setValue(project.tenLeader || '');
      sheet.getRange(row, 12).setValue(project.maLeader || '');
      sheet.getRange(row, 13).setValue(project.thanhVien || '');
      sheet.getRange(row, 14).setValue(safeParseNumber(project.tienDo));
      sheet.getRange(row, 17).setValue(project.ghiChu || '');
      
      return JSON.stringify({ success: true, message: 'Cập nhật thành công' });
    }
    return JSON.stringify({ success: false, message: 'Không tìm thấy dự án' });
  } catch (e) {
    return JSON.stringify({ success: false, message: 'Lỗi: ' + e.message });
  }
}

/** Xóa dự án */
function deleteProject(id) {
  try {
    const sheet = getSheet('Dự Án');
    const finder = sheet.createTextFinder(id).matchEntireCell(true);
    const result = finder.findNext();
    
    if (result && result.getColumn() === 1) {
      sheet.deleteRow(result.getRow());
      return JSON.stringify({ success: true, message: 'Xóa thành công' });
    }
    return JSON.stringify({ success: false, message: 'Không tìm thấy' });
  } catch (e) {
    return JSON.stringify({ success: false, message: 'Lỗi: ' + e.message });
  }
}

/** Parse date string dd/MM/yyyy HH:mm */
function parseDateStr(str) {
  if (!str) return new Date(0);
  if (str instanceof Date) return str;
  const s = String(str).trim();
  if (s.includes('/')) {
    const parts = s.split(/[/\s:]/);
    if (parts.length >= 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const h = parts[3] ? parseInt(parts[3], 10) : 0;
      const min = parts[4] ? parseInt(parts[4], 10) : 0;
      return new Date(y, m, d, h, min);
    }
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(0) : d;
}
