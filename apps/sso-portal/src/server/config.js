// ===== SSO Portal — sheet names & initialization =====

var SHEETS = {
  USERS: '_Người Dùng',
  APPS: '_Ứng Dụng',
  SYS: '_Hệ Thống',
}

var APP_ID = 'sso-portal'
var DEFAULT_PASSWORD = 'Admin@@123'

function ensureInitialized() {
  var ss = getAppSheet()
  _ensureAllTabsExist(ss)

  var usersSheet = ss.getSheetByName(SHEETS.USERS)
  if (!usersSheet || usersSheet.getLastRow() <= 1) {
    _seedAdminUser(ss)
  }
}

function _ensureAllTabsExist(ss) {
  var tabDefs = [
    { name: SHEETS.USERS, headers: ['ID', 'Tên đăng nhập', 'Mật khẩu', 'Email', 'Tên nhân viên', 'Trạng thái', 'MustChangePass', 'Đăng nhập cuối', 'Phòng ban', 'Quyền', 'SSO_Token', 'SSO_Expiry'] },
    { name: SHEETS.APPS,  headers: ['ID', 'Tên App', 'Webapp URL', 'Icon', 'Mô tả', 'Trạng thái'] },
    { name: SHEETS.SYS,   headers: ['Key', 'Value'] },
  ]

  tabDefs.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name)
    if (!sheet) {
      sheet = ss.insertSheet(def.name)
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers])
      sheet.setFrozenRows(1)
      if (def.name === SHEETS.USERS) {
        var pwdIdx = def.headers.indexOf('Mật khẩu')
        if (pwdIdx !== -1) sheet.hideColumns(pwdIdx + 1)
      }
    }
  })
  // Add any missing columns to existing sheets (schema upgrades)
  ensureMissingColumns(ss, tabDefs)
}

function _seedAdminUser(ss) {
  var usersSheet = ss.getSheetByName(SHEETS.USERS)
  var ownerEmail = ''
  try { ownerEmail = ss.getOwner().getEmail() } catch(e) {}
  if (!ownerEmail) {
    try { ownerEmail = Session.getActiveUser().getEmail() } catch(e) {}
  }

  var passwordHash = _hashPassword(ownerEmail, DEFAULT_PASSWORD)
  usersSheet.appendRow([1, ownerEmail, passwordHash, ownerEmail, '', 'Active', 'TRUE', '', '', 'Quản trị', '', ''])
}
