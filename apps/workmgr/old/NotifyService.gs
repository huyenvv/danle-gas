/**
 * ============================================
 * NOTIFICATION SERVICE - Thông báo
 * ============================================
 */

/** Lấy thông báo của người dùng */
function getNotifications(userId) {
  try {
    let data = sheetToJSON('Thông Báo');
    if (userId) {
      data = data.filter(d => d['Mã Người Nhận'] === userId);
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

/** Thêm thông báo */
function addNotification(notif) {
  try {
    const sheet = getSheet('Thông Báo');
    const id = generateId('TB');
    
    sheet.appendRow([
      id,
      notif.tieuDe || '',
      notif.noiDung || '',
      notif.loai || 'Hệ Thống',
      notif.nguoiNhan || '',
      notif.maNguoiNhan || '',
      'Chưa',
      new Date()
    ]);
    
    return JSON.stringify({ success: true, id: id });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}

/** Đánh dấu đã đọc */
function markNotificationRead(notifId) {
  try {
    const sheet = getSheet('Thông Báo');
    const finder = sheet.createTextFinder(notifId).matchEntireCell(true);
    const result = finder.findNext();
    
    if (result && result.getColumn() === 1) {
      sheet.getRange(result.getRow(), 7).setValue('Đã Đọc');
      return JSON.stringify({ success: true });
    }
    return JSON.stringify({ success: false });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}

/** Đánh dấu tất cả đã đọc */
function markAllNotificationsRead(userId) {
  try {
    const sheet = getSheet('Thông Báo');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][5]).trim() === userId && String(data[i][6]).trim() === 'Chưa') {
        sheet.getRange(i + 1, 7).setValue('Đã Đọc');
      }
    }
    
    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}

/** Lấy nhãn */
function getLabels() {
  try {
    const data = sheetToJSON('Nhãn');
    return JSON.stringify({ success: true, data: data });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}

/** Lấy tất cả dữ liệu cần thiết (batch) */
function getAllData(userId, userRole) {
  try {
    const membersRaw = sheetToJSON('Thành Viên');
    const members = membersRaw.map(m => {
      m['Mật Khẩu'] = '***';
      return m;
    });
    const departments = sheetToJSON('Phòng Ban');
    const labels = sheetToJSON('Nhãn');
    const settings = getSettings();
    
    return JSON.stringify({
      success: true,
      data: {
        members,
        departments,
        labels,
        settings
      }
    });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}

/** Lấy hoạt động gần đây */
function getActivities(limit) {
  try {
    let data = sheetToJSON('Hoạt Động');
    data.sort((a, b) => {
      const dateA = parseDateStr(a['Ngày Tạo']);
      const dateB = parseDateStr(b['Ngày Tạo']);
      return dateB - dateA;
    });
    
    if (limit) data = data.slice(0, limit);
    return JSON.stringify({ success: true, data: data });
  } catch (e) {
    return JSON.stringify({ success: false, message: e.message });
  }
}
