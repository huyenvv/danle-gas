/**
 * ============================================
 * SETUP SERVICE - Tạo toàn bộ Sheet
 * ============================================
 */

/** Chạy hàm này để tạo toàn bộ Sheet với dữ liệu mẫu đầy đủ (50 rows/sheet) */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = generateAllSampleData();

  createSheetIfNotExist(ss, 'Cài Đặt', data.settings);
  createSheetIfNotExist(ss, 'Phòng Ban', data.departments.rows);
  createSheetIfNotExist(ss, 'Thành Viên', data.members.rows);
  createSheetIfNotExist(ss, 'Dự Án', data.projects.rows);
  createSheetIfNotExist(ss, 'Công Việc', data.tasks.rows);
  createSheetIfNotExist(ss, 'Bình Luận', data.comments.rows);
  createSheetIfNotExist(ss, 'Hoạt Động', data.activities.rows);
  createSheetIfNotExist(ss, 'Thông Báo', data.notifications.rows);
  createSheetIfNotExist(ss, 'Nhãn', data.labels);

  SpreadsheetApp.getUi().alert('✅ Đã tạo xong toàn bộ Sheet với dữ liệu mẫu!\n\n• 10 Phòng Ban\n• 50 Thành Viên\n• 15 Dự Án\n• 50 Công Việc\n• 50 Bình Luận\n• 50 Hoạt Động\n• 50 Thông Báo\n• 15 Nhãn');
}

/** Tạo sheet nếu chưa tồn tại */
function createSheetIfNotExist(ss, sheetName, data) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    // Nếu đã tồn tại và có dữ liệu rồi thì bỏ qua
    if (sheet.getLastRow() > 0) return;
  }
  
  if (data && data.length > 0) {
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, data[0].length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1a237e');
    headerRange.setFontColor('#ffffff');
    headerRange.setHorizontalAlignment('center');
    
    // Auto resize columns
    for (let i = 1; i <= data[0].length; i++) {
      sheet.autoResizeColumn(i);
    }
    
    // Freeze header row
    sheet.setFrozenRows(1);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

function getTimezone() {
  return getSpreadsheet().getSpreadsheetTimeZone();
}

/** Đọc toàn bộ dữ liệu từ sheet thành mảng JSON */
function sheetToJSON(sheetName) {
  const sheet = getSheet(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const tz = getTimezone();
  const headers = data[0].map(h => String(h).trim().normalize('NFC'));
  
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = { _rowIndex: i + 1 };
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      let value = data[i][j];
      
      if (value instanceof Date) {
        if (!isNaN(value.getTime())) {
          value = Utilities.formatDate(value, tz, 'dd/MM/yyyy HH:mm');
        } else {
          value = '';
        }
      }
      
      if (value !== '' && value !== null && value !== undefined) hasData = true;
      row[headers[j]] = value;
    }
    if (hasData) result.push(row);
  }
  return result;
}

/** Tạo ID có prefix */
function generateId(prefix) {
  const sheet = getSheet(getSheetNameByPrefix(prefix));
  if (!sheet) return prefix.toUpperCase() + '001';
  
  const data = sheet.getDataRange().getValues();
  let maxNum = 0;
  
  for (let i = 1; i < data.length; i++) {
    const idStr = String(data[i][0]);
    const match = idStr.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  
  return prefix.toUpperCase() + String(maxNum + 1).padStart(3, '0');
}

function getSheetNameByPrefix(prefix) {
  const map = {
    'TV': 'Thành Viên',
    'DA': 'Dự Án',
    'CV': 'Công Việc',
    'BL': 'Bình Luận',
    'HD': 'Hoạt Động',
    'PB': 'Phòng Ban',
    'N': 'Nhãn',
    'TB': 'Thông Báo'
  };
  return map[prefix] || '';
}

/** Parse số an toàn */
function safeParseNumber(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).replace(/[^0-9.,-]/g, '');
  if (!str) return 0;
  const cleaned = str.replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Format date an toàn */
function ensureDateString(val) {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return Utilities.formatDate(d, getTimezone(), 'dd/MM/yyyy HH:mm');
  } catch (e) {
    return String(val);
  }
}

/** Lấy settings */
function getSettings() {
  const data = sheetToJSON('Cài Đặt');
  const settings = {};
  data.forEach(row => {
    const key = String(row['Khóa'] || '').trim();
    if (key) settings[key] = row['Giá Trị'];
  });
  return settings;
}

/** Ghi log hoạt động */
function logActivity(type, description, objectType, objectId, userId, userName) {
  try {
    const sheet = getSheet('Hoạt Động');
    if (!sheet) return;
    const id = generateId('HD');
    sheet.appendRow([id, type, description, objectType, objectId, userName, userId, new Date()]);
  } catch (e) {
    console.error('Log activity error:', e);
  }
}
