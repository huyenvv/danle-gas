const FIREBASE_BASE_URL = "https://your-project-id.firebaseio.com/deployments";
const FIREBASE_AUTH = "YOUR_DATABASE_SECRET";

function doGet(e) {
  const tmpl = HtmlService.createTemplateFromFile('Index');
  tmpl.urlEmail = e.parameter.email || "";
  tmpl.urlToken = e.parameter.token || "";
  return tmpl.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Lấy ID Sheet từ Firebase dựa trên email người deploy App Con này
function getMasterSsId() {
  const deployerEmail = Session.getEffectiveUser().getEmail();
  const emailKey = deployerEmail.replace(/\./g, '_');
  const url = `${FIREBASE_BASE_URL}/${emailKey}.json?auth=${FIREBASE_AUTH}`;
  
  try {
    const response = UrlFetchApp.fetch(url);
    const config = JSON.parse(response.getContentText());
    if (!config || !config.main_ss_id) throw new Error("Chưa cấu hình SS_ID cho email: " + deployerEmail);
    return config.main_ss_id;
  } catch (e) {
    throw new Error("Lỗi hệ thống cấu hình: " + e.message);
  }
}

function apiGateway(userEmail, userToken, action) {
  // 1. App Con tự tìm SS_ID khớp với người deploy nó
  const ssId = getMasterSsId();
  
  if (!ssId) throw new Error("Hệ thống chưa được khởi tạo từ App Cha (Cache rỗng)!");

  // 2. Mở Sheet và đối chiếu cặp Email + Token
  const sheet = SpreadsheetApp.openById(ssId).getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  const now = new Date().getTime();
  
  let isValid = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toLowerCase() === userEmail.toLowerCase() && 
        data[i][2] === userToken && 
        data[i][3] > now) {
      isValid = true;
      break;
    }
  }

  if (!isValid) throw new Error("Xác thực thất bại hoặc phiên làm việc đã hết hạn!");

  // 3. Xử lý nghiệp vụ sau khi đã xác thực thành công
  if (action === "GET_DATA") {
    return "✅ Xin chào " + userEmail + "! Bạn đã truy cập thành công vào hệ thống.";
  }
  
  return "Hành động hợp lệ.";
}