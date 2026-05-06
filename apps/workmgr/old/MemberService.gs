/**
 * ============================================
 * MEMBER SERVICE - Quản lý thành viên
 * ============================================
 */

/** Lấy danh sách thành viên */
function getMembers(filters) {
  if (!filters) filters = {};
  try {
    let data = sheetToJSON('Thành Viên');
    
    if (filters.department) {
      data = data.filter(d => d['Phòng Ban'] === filters.department);
    }
    
    if (filters.status) {
      data = data.filter(d => d['Trạng Thái'] === filters.status);
    }
    
    // Sort mới nhất lên đầu
    data.sort((a, b) => {
      const dateA = parseDateStr(a['Ngày Tham Gia']);
      const dateB = parseDateStr(b['Ngày Tham Gia']);
      return dateB - dateA;
    });
    
    // Ẩn mật khẩu khi trả về
    data.forEach(d => {
      d['Mật Khẩu'] = '***';
    });
    
    return JSON.stringify({ success: true, data: data });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}

/** Thêm thành viên mới */
function addMember(member) {
  try {
    const sheet = getSheet('Thành Viên');
    const id = generateId('TV');
    
    // Check trùng username
    const data = sheetToJSON('Thành Viên');
    if (data.some(d => String(d['Tên Đăng Nhập']).trim() === String(member.tenDangNhap).trim())) {
      return JSON.stringify({ success: false, message: 'Tên đăng nhập đã tồn tại' });
    }
    
    // Check trùng email
    if (member.email && data.some(d => String(d['Email']).trim() === String(member.email).trim())) {
      return JSON.stringify({ success: false, message: 'Email đã tồn tại' });
    }
    
    sheet.appendRow([
      id,
      member.hoTen || '',
      member.email || '',
      member.soDienThoai || '',
      member.chucVu || '',
      member.phongBan || '',
      member.vaiTro || 'Thành Viên',
      member.tenDangNhap || '',
      member.matKhau || '123456',
      'Hoạt Động',
      '',
      new Date(),
      member.ghiChu || ''
    ]);
    
    logActivity('Thêm Thành Viên', 'Thêm thành viên: ' + member.hoTen, 'Thành Viên', id, member.nguoiTao || '', member.tenNguoiTao || '');
    
    return JSON.stringify({ success: true, id: id, message: 'Thêm thành viên thành công' });
  } catch (e) {
    return JSON.stringify({ success: false, message: 'Lỗi: ' + e.message });
  }
}

/** Cập nhật thành viên */
function updateMember(member) {
  try {
    const sheet = getSheet('Thành Viên');
    const finder = sheet.createTextFinder(member.maTV).matchEntireCell(true);
    const result = finder.findNext();
    
    if (result && result.getColumn() === 1) {
      const row = result.getRow();
      sheet.getRange(row, 2).setValue(member.hoTen || '');
      sheet.getRange(row, 3).setValue(member.email || '');
      sheet.getRange(row, 4).setValue(member.soDienThoai || '');
      sheet.getRange(row, 5).setValue(member.chucVu || '');
      sheet.getRange(row, 6).setValue(member.phongBan || '');
      sheet.getRange(row, 7).setValue(member.vaiTro || '');
      sheet.getRange(row, 10).setValue(member.trangThai || 'Hoạt Động');
      sheet.getRange(row, 13).setValue(member.ghiChu || '');
      
      // Cập nhật mật khẩu nếu có
      if (member.matKhau && member.matKhau !== '***') {
        sheet.getRange(row, 9).setValue(member.matKhau);
      }
      
      return JSON.stringify({ success: true, message: 'Cập nhật thành viên thành công' });
    }
    return JSON.stringify({ success: false, message: 'Không tìm thấy thành viên' });
  } catch (e) {
    return JSON.stringify({ success: false, message: 'Lỗi: ' + e.message });
  }
}

/** Xóa thành viên */
function deleteMember(id) {
  try {
    const sheet = getSheet('Thành Viên');
    const finder = sheet.createTextFinder(id).matchEntireCell(true);
    const result = finder.findNext();
    
    if (result && result.getColumn() === 1) {
      sheet.deleteRow(result.getRow());
      return JSON.stringify({ success: true, message: 'Xóa thành viên thành công' });
    }
    return JSON.stringify({ success: false, message: 'Không tìm thấy' });
  } catch (e) {
    return JSON.stringify({ success: false, message: 'Lỗi: ' + e.message });
  }
}

/** Lấy danh sách phòng ban */
function getDepartments() {
  try {
    const data = sheetToJSON('Phòng Ban');
    return JSON.stringify({ success: true, data: data });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}

/** Thêm phòng ban */
function addDepartment(dept) {
  try {
    const sheet = getSheet('Phòng Ban');
    const id = generateId('PB');
    
    sheet.appendRow([
      id,
      dept.tenPhongBan || '',
      dept.moTa || '',
      dept.truongPhong || '',
      dept.maTruongPhong || '',
      new Date()
    ]);
    
    return JSON.stringify({ success: true, id: id });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}
