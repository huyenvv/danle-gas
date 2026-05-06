/**
 * ============================================
 * AUTH SERVICE - Xác thực đăng nhập
 * ============================================
 */

function login(username, password) {
  try {
    const inputUser = String(username).trim();
    const inputPass = String(password).trim();
    
    if (!inputUser || !inputPass) {
      return { success: false, message: 'Vui lòng nhập đầy đủ thông tin' };
    }
    
    // 1. Kiểm tra tài khoản admin từ Cài Đặt
    const settings = getSettings();
    if (inputUser === String(settings['admin_username'] || '').trim() &&
        inputPass === String(settings['admin_password'] || '').trim()) {
      return {
        success: true,
        user: {
          id: 'TV001',
          name: settings['Tên công ty'] ? 'Chủ Doanh Nghiệp' : 'Admin',
          username: inputUser,
          email: settings['Email công ty'] || '',
          role: 'Chủ Doanh Nghiệp',
          department: 'Ban Giám Đốc'
        }
      };
    }
    
    // 2. Kiểm tra từ sheet Thành Viên
    const members = sheetToJSON('Thành Viên');
    const member = members.find(m => 
      String(m['Tên Đăng Nhập']).trim() === inputUser &&
      String(m['Mật Khẩu']).trim() === inputPass &&
      String(m['Trạng Thái']).trim() === 'Hoạt Động'
    );
    
    if (member) {
      return {
        success: true,
        user: {
          id: member['Mã TV'],
          name: member['Họ và Tên'],
          username: member['Tên Đăng Nhập'],
          email: member['Email'],
          phone: member['Số Điện Thoại'],
          role: member['Vai Trò'],
          department: member['Phòng Ban'],
          position: member['Chức Vụ'],
          avatar: member['Ảnh Đại Diện'] || ''
        }
      };
    }
    
    return { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng' };
  } catch (e) {
    console.error('Login error:', e);
    return { success: false, message: 'Lỗi hệ thống: ' + e.message };
  }
}

/** Đổi mật khẩu */
function changePassword(userId, oldPass, newPass) {
  try {
    const sheet = getSheet('Thành Viên');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === userId) {
        if (String(data[i][8]).trim() !== String(oldPass).trim()) {
          return { success: false, message: 'Mật khẩu cũ không đúng' };
        }
        sheet.getRange(i + 1, 9).setValue(newPass);
        return { success: true, message: 'Đổi mật khẩu thành công' };
      }
    }
    return { success: false, message: 'Không tìm thấy tài khoản' };
  } catch (e) {
    return { success: false, message: 'Lỗi: ' + e.message };
  }
}
