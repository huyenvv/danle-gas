// ===== SSO Portal — sheet names & initialization =====

var SHEETS = {
  USERS: '_Người Dùng',
  APPS: '_Ứng Dụng',
  SYS: '_Hệ Thống',
  HANDOFFS: '_Handoffs',
  PHONG_BAN: '_Phòng Ban',
  PHAN_BO: '_Phân Bổ',
  NHAT_KY: '_Nhật Ký',
}

var POSITIONS = [
  { code: 'Giám đốc', rank: 90, scope: 'company', max: 1 },
  { code: 'Phó GĐ', rank: 80, scope: 'company', max: -1 },
  { code: 'Văn thư', rank: 70, scope: 'company', max: -1 },
  { code: 'Trưởng phòng', rank: 60, scope: 'dept', max: 1 },
  { code: 'Phó phòng', rank: 50, scope: 'dept', max: -1 },
  { code: 'Người phụ trách', rank: 40, scope: 'dept', max: -1 },
  { code: 'Nhân viên', rank: 10, scope: 'dept', max: -1 },
  { code: 'admin', rank: 100, scope: 'company', max: -1 },
]

function _getPositionRank(chucVu) {
  var pos = POSITIONS.find(function(p) { return p.code === chucVu })
  return pos ? pos.rank : 0
}

var APP_ID = 'sso-portal'
var DEFAULT_PASSWORD = 'Admin@@123'

var _initDone = false
function ensureInitialized() {
  if (_initDone) return
  var props = PropertiesService.getScriptProperties()
  if (props.getProperty('SCHEMA_V') === '10') { _initDone = true; return }
  var ss = getAppSheet()
  _ensureAllTabsExist(ss)

  var usersSheet = ss.getSheetByName(SHEETS.USERS)
  if (!usersSheet || usersSheet.getLastRow() <= 1) {
    _seedAdminUser(ss)
  } else {
    _ensureOwnerUser(ss)
  }
  props.setProperty('SCHEMA_V', '10')
  _initDone = true
}

function _ensureAllTabsExist(ss) {
  var tabDefs = [
    { name: SHEETS.USERS, headers: ['ID', 'Tên đăng nhập', 'Mật khẩu', 'Email', 'Tên nhân viên', 'Trạng thái', 'MustChangePass', 'Đăng nhập cuối', 'FailedLogins', 'SSO_Token', 'SSO_Expiry', 'RefreshTokens', 'LastLogoutAt', 'LogoutEpochs', 'AccessToken', 'AccessTokenExpiry'] },
    { name: SHEETS.APPS,  headers: ['ID', 'Tên App', 'Webapp URL', 'Icon', 'Mô tả', 'Trạng thái', 'Quyền xem'] },
    { name: SHEETS.SYS,   headers: ['Key', 'Value'] },
    { name: SHEETS.HANDOFFS, headers: ['ID', 'Token', 'UserID', 'AppID', 'CreatedAt', 'ExpiresAt', 'Consumed'] },
    { name: SHEETS.PHONG_BAN, headers: ['ID', 'Tên phòng ban', 'Mô tả', 'Đơn vị thuộc sự quản lý'] },
    { name: SHEETS.PHAN_BO, headers: ['ID', 'UserID', 'Chức vụ', 'PhongBanID'] },
    { name: SHEETS.NHAT_KY, headers: ['ID', 'Thời gian', 'Người dùng', 'Email', 'Hành động', 'Loại', 'Đối tượng', 'Chi tiết'] },
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
  usersSheet.appendRow([1, owner.email, passwordHash, owner.email, '', 'Active', 'TRUE', ''])
  invalidateSheetCache(SHEETS.USERS)
  addRow(SHEETS.PHAN_BO, { 'UserID': '1', 'Chức vụ': 'admin', 'PhongBanID': '' })
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
    ''
  ])
  invalidateSheetCache(SHEETS.USERS)
  addRow(SHEETS.PHAN_BO, { 'UserID': String(nextId), 'Chức vụ': 'admin', 'PhongBanID': '' })
}
