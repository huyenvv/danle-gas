const FIREBASE_BASE_URL = "https://your-project-id.firebaseio.com/deployments";
const FIREBASE_AUTH = "YOUR_DATABASE_SECRET";

function doGet() {
  const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const deployerEmail = Session.getEffectiveUser().getEmail(); // Email người deploy
  
  // Cập nhật cấu hình theo email người deploy
  updateConfigToFirebase(deployerEmail, ssId);
  
  autoInitSystem(); 
  return HtmlService.createTemplateFromFile('Index').evaluate()
      .setTitle("Portal - " + deployerEmail)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function updateConfigToFirebase(email, id) {
  // Biến user.name@gmail.com thành user_name@gmail_com
  const emailKey = email.replace(/\./g, '_');
  const url = `${FIREBASE_BASE_URL}/${emailKey}.json?auth=${FIREBASE_AUTH}`;
  
  const options = {
    "method": "patch",
    "contentType": "application/json",
    "payload": JSON.stringify({ "main_ss_id": id })
  };
  UrlFetchApp.fetch(url, options);
}

// Các hàm login, getApps... giữ nguyên
function autoInitSystem(ss) {
  // Tạo Tab Users
  let sheetUsers = ss.getSheetByName("Users");
  if (!sheetUsers) {
    sheetUsers = ss.insertSheet("Users");
    sheetUsers.appendRow(["Email", "Password", "Token", "Expiry"]);
    sheetUsers.getRange("A1:D1").setFontWeight("bold").setBackground("#d9ead3");
  }
  // Tạo Tab Apps
  let sheetApps = ss.getSheetByName("Apps");
  if (!sheetApps) {
    sheetApps = ss.insertSheet("Apps");
    sheetApps.appendRow(["AppName", "AppUrl"]);
    sheetApps.getRange("A1:B1").setFontWeight("bold").setBackground("#cfe2f3");
  }
  // Tạo tài khoản admin mặc định (Email của bạn)
  const adminEmail = Session.getEffectiveUser().getEmail();
  if (sheetUsers.getLastRow() < 2) {
    sheetUsers.appendRow([adminEmail, "123456", "", ""]);
  }
}

function login(email, pass) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toLowerCase() === email.toLowerCase() && data[i][1].toString() === pass.toString()) {
      const token = Utilities.getUuid();
      const expiry = new Date().getTime() + (24 * 3600 * 1000); // Token sống 24h
      sheet.getRange(i + 1, 3, 1, 2).setValues([[token, expiry]]);
      
      return { success: true, token: token, email: email };
    }
  }
  return { success: false, message: "Sai tài khoản hoặc mật khẩu!" };
}

function getApps() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Apps").getDataRange().getValues().slice(1);
}

function addApp(name, url) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Apps").appendRow([name, url]);
  return getApps();
}