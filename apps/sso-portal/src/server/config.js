// ===== SSO Portal — sheet names & initialization =====

var SHEETS = {
  USERS: '_Người Dùng',
  APPS: '_Ứng Dụng',
  SYS: '_Hệ Thống',
  HANDOFFS: '_Handoffs',
  PHONG_BAN: '_Phòng Ban',
}

var APP_ID = 'sso-portal'
var DEFAULT_PASSWORD = 'Admin@@123'

var _initDone = false
function ensureInitialized() {
  if (_initDone) return
  var props = PropertiesService.getScriptProperties()
  if (props.getProperty('SCHEMA_V') === '5') { _initDone = true; return }
  var ss = getAppSheet()
  _ensureAllTabsExist(ss)

  var usersSheet = ss.getSheetByName(SHEETS.USERS)
  if (!usersSheet || usersSheet.getLastRow() <= 1) {
    _seedAdminUser(ss)
  } else {
    _ensureOwnerUser(ss)
  }
  props.setProperty('SCHEMA_V', '5')
  _initDone = true
}

function _ensureAllTabsExist(ss) {
  var tabDefs = [
    { name: SHEETS.USERS, headers: ['ID', 'Tên đăng nhập', 'Mật khẩu', 'Email', 'Tên nhân viên', 'Trạng thái', 'MustChangePass', 'Đăng nhập cuối', 'Phòng ban', 'Chức vụ', 'Quyền', 'SSO_Token', 'SSO_Expiry', 'RefreshTokens', 'LastLogoutAt', 'LogoutEpochs', 'AccessToken', 'AccessTokenExpiry'] },
    { name: SHEETS.APPS,  headers: ['ID', 'Tên App', 'Webapp URL', 'Icon', 'Mô tả', 'Trạng thái'] },
    { name: SHEETS.SYS,   headers: ['Key', 'Value'] },
    { name: SHEETS.HANDOFFS, headers: ['ID', 'Token', 'UserID', 'AppID', 'CreatedAt', 'ExpiresAt', 'Consumed'] },
    { name: SHEETS.PHONG_BAN, headers: ['ID', 'Tên phòng ban', 'Trưởng', 'Phó'] },
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
  var owner = _getOwnerBootstrapInfo(ss)
  if (!owner.email) return

  var passwordHash = _hashPassword(owner.email, DEFAULT_PASSWORD)
  usersSheet.appendRow([1, owner.email, passwordHash, owner.email, '', 'Active', 'TRUE', '', '', '', 'Quản trị', '', ''])
  invalidateSheetCache(SHEETS.USERS)
}

function _getOwnerBootstrapInfo(ss) {
  var ownerEmail = ''
  try { ownerEmail = ss.getOwner().getEmail() } catch(e) {}
  if (!ownerEmail) {
    try { ownerEmail = Session.getActiveUser().getEmail() } catch(e) {}
  }

  return { email: ownerEmail }
}

function _ensureOwnerUser(ss) {
  var owner = _getOwnerBootstrapInfo(ss)
  if (!owner.email) return

  invalidateSheetCache(SHEETS.USERS)
  var users = getSheetData(SHEETS.USERS)
  var ownerLower = owner.email.toLowerCase()
  var exists = users.some(function(user) {
    return (user['Email'] && user['Email'].toLowerCase() === ownerLower) ||
           (user['Tên đăng nhập'] && user['Tên đăng nhập'].toLowerCase() === ownerLower)
  })

  if (exists) return

  var nextId = users.reduce(function(maxId, user) {
    var userId = Number(user['ID']) || 0
    return userId > maxId ? userId : maxId
  }, 0) + 1
  var passwordHash = _hashPassword(owner.email, DEFAULT_PASSWORD)

  ss.getSheetByName(SHEETS.USERS).appendRow([
    nextId,
    owner.email,
    passwordHash,
    owner.email,
    '',
    'Active',
    'TRUE',
    '',
    '',
    '',
    'Quản trị',
    '',
    ''
  ])
  invalidateSheetCache(SHEETS.USERS)
}
