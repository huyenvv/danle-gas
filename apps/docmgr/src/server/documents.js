// ===== Documents module =====

// ── Vietnamese search helper ────────────────────────────────────────────────
function _viNormalize(str) {
  return String(str == null ? '' : str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
}

// ── Email notification helper ───────────────────────────────────────────────

function _getMailConfigFromSSO() {
  var parentId = ssoGetParentSheetId()
  if (!parentId) return null
  try {
    var ss = SpreadsheetApp.openById(parentId)
    var sheet = ss.getSheetByName('_Hệ Thống')
    if (!sheet) return null
    var data = sheet.getDataRange().getValues()
    var config = {}
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        var val = data[i][1]
        // Google Sheets auto-converts TRUE/FALSE to booleans — normalize to strings
        if (typeof val === 'boolean') val = val ? 'TRUE' : 'FALSE'
        config[data[i][0]] = val != null ? String(val) : ''
      }
    }
    return config
  } catch(e) {
    Logger.log('_getMailConfigFromSSO error: ' + e.message)
    return null
  }
}

var _DEFAULT_MAIL_TEMPLATES = {
  trinhDuyet: {
    subject: '{hoảTốc}[Cần duyệt] {tênHồSơ}',
    body: 'Xin chào {vaiTròNgườiNhận}: {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) đã trình duyệt hồ sơ "{tênHồSơ}".\n\nVui lòng đăng nhập hệ thống để xem và phê duyệt tại đây:\n{linkHệThống}'
  },
  giaoViec: {
    subject: '{hoảTốc}[Giao việc] {tênHồSơ}',
    body: 'Xin chào {vaiTròNgườiNhận}: {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) đã giao việc hồ sơ "{tênHồSơ}" cho bạn[[ và trình duyệt qua {vaiTròNgườiKiểmSoát} - {tênNgườiKiểmSoát}]].\n\nNội dung: {nộiDungGiaoViec}\n\nVui lòng đăng nhập hệ thống để xem chi tiết và xử lý tại đây:\n{linkHệThống}'
  },
  phoiHop: {
    subject: '{hoảTốc}[Phối hợp] {tênHồSơ}',
    body: 'Xin chào {tênNgườiNhận},\n\nBạn được {tênNgườiGửi} giao phối hợp xử lý công việc hồ sơ "{tênHồSơ}".\n\nNội dung: {nộiDungPhoiHop}\n\nVui lòng đăng nhập hệ thống để xem chi tiết và phối hợp tại đây:\n{linkHệThống}'
  },
  phatHanh: {
    subject: '{hoảTốc}[SBM – Phát hành] {tênHồSơ}',
    body: 'Kính gửi: {tênNgườiNhận}\n\n{tênNgườiGửi} đã phát hành văn bản "{tênHồSơ}" {linkTàiLiệu}\n\nVui lòng đăng nhập hệ thống để xem và phê duyệt tại đây:\n{linkHệThống}'
  },
  tuChoi: {
    subject: '{hoảTốc}[Từ chối] {tênHồSơ}',
    body: 'Xin chào {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) đã từ chối hồ sơ "{tênHồSơ}".\n\nLý do: {lyDoTuChoi}\n\nVui lòng đăng nhập hệ thống để chỉnh sửa và trình duyệt lại:\n{linkHệThống}'
  },
  tuChoiKetQua: {
    subject: '{hoảTốc}[Từ chối kết quả] {tênHồSơ}',
    body: 'Xin chào {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) đã từ chối kết quả xử lý hồ sơ "{tênHồSơ}".\n\nLý do: {lyDoTuChoi}\n\nVui lòng đăng nhập hệ thống để chỉnh sửa và hoàn thành lại:\n{linkHệThống}'
  },
  ycPhatHanh: {
    subject: '{hoảTốc}[YC Phát hành] {tênHồSơ}',
    body: 'Xin chào {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) yêu cầu phát hành hồ sơ "{tênHồSơ}".\n\nLý do: {lyDoTuChoi}\n\nVui lòng đăng nhập hệ thống để phát hành:\n{linkHệThống}'
  }
}

function _getMailTemplates() {
  var raw = getConfig('MAIL_TEMPLATES')
  if (raw) {
    try { var parsed = JSON.parse(raw); return parsed } catch(e) {}
  }
  return _DEFAULT_MAIL_TEMPLATES
}

function _applyTemplate(tpl, vars) {
  var s = tpl || ''
  // Đoạn điều kiện [[ ... ]]: chỉ giữ khi MỌI {biến} bên trong đều có giá trị; ngược lại bỏ cả đoạn.
  // Template không có [[...]] → không đổi (tương thích ngược).
  s = s.replace(/\[\[([\s\S]*?)\]\]/g, function(_m, inner) {
    var keep = true
    inner.replace(/\{[^{}]+\}/g, function(token) {
      var v = vars[token]
      if (v === undefined || v === null || String(v) === '') keep = false
      return token
    })
    return keep ? inner : ''
  })
  for (var key in vars) {
    s = s.split(key).join(vars[key] || '')
  }
  return s
}

// Add unread record for each user (DA_DOC stores unread, no record = read)
/**
 * Resolve usernames/mixed IDs to numeric UserIDs.
 * _parseAssignees may return usernames ("truongphong") or IDs ("5").
 * DA_DOC and api_getUnreadDocIds use session.userId (numeric), so we must store numeric IDs.
 */
function _resolveUserIds(usernamesOrIds) {
  if (!usernamesOrIds || usernamesOrIds.length === 0) return []
  var roles = getSheetData(SHEETS.APP_ROLES)
  var resolved = []
  usernamesOrIds.forEach(function(val) {
    // Try to find by username first
    var role = roles.find(function(r) {
      return r['AppID'] === APP_ID && (r['Tên đăng nhập'] === val || String(r['UserID']) === String(val))
    })
    if (role) {
      resolved.push(String(role['UserID']))
    } else {
      // Fallback: use as-is (might already be a userId)
      resolved.push(String(val))
    }
  })
  return resolved
}

function _markUnreadForUsers(usernamesOrIds, docId) {
  Logger.log('[_markUnreadForUsers] input=' + JSON.stringify(usernamesOrIds) + ' docId=' + docId)
  if (!usernamesOrIds || usernamesOrIds.length === 0) { Logger.log('[_markUnreadForUsers] EMPTY input, skipping'); return }
  var userIds = _resolveUserIds(usernamesOrIds)
  Logger.log('[_markUnreadForUsers] resolved userIds=' + JSON.stringify(userIds))
  var daDocRows = getSheetData(SHEETS.DA_DOC)
  userIds.forEach(function(uid) {
    var exists = daDocRows.find(function(r) {
      return String(r['UserID']) === String(uid) && String(r['DocID']) === String(docId)
    })
    Logger.log('[_markUnreadForUsers] uid=' + uid + ' exists=' + !!exists)
    if (!exists) {
      addRow(SHEETS.DA_DOC, { 'UserID': uid, 'DocID': docId, 'Thời gian': new Date().toISOString() })
    }
  })
  invalidateSheetCache(SHEETS.DA_DOC)
}

function _getAppLink() {
  var url = getConfig('APP_URL')
  if (url) return url
  try { return ScriptApp.getService().getUrl() } catch(e) {}
  return ''
}

function _buildFileLinks(doc) {
  if (!doc) return ''
  // Dùng _parseFileInfos để hỗ trợ cả JSON array LẪN định dạng cũ (fileId chuỗi đơn),
  // khớp với cách client (parseFileInfos) hiển thị — tránh export rỗng cho hồ sơ cũ.
  var files = _parseFileInfos(doc['Tệp đính kèm'])
  if (!files.length) return ''
  return files.map(function(f) {
    return 'https://drive.google.com/file/d/' + f.fileId + '/view'
  }).join('\n')
}

function _formatDateDMY(val) {
  if (!val) return ''
  var s = String(val)
  // yyyy-mm-dd — đổi trực tiếp, tránh timezone shift
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return m[3] + '/' + m[2] + '/' + m[1]
  try {
    var d = new Date(val)
    if (isNaN(d.getTime())) return s
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear()
  } catch(e) { return s }
}

// toRecipients — danh sách nhận chính (TO)
// ccRecipients — danh sách CC (optional)
function _sendNotificationEmails(toRecipients, doc, mailType, session, ccRecipients) {
  if (!toRecipients || toRecipients.length === 0) return
  ccRecipients = ccRecipients || []
  // Deduplicate by email — each address receives at most one email
  var _dedup = function(list) {
    var seen = {}
    return list.filter(function(r) {
      if (!r.email) return false
      var key = r.email.toLowerCase()
      if (seen[key]) return false
      seen[key] = true
      return true
    })
  }
  toRecipients = _dedup(toRecipients)
  var toEmails = {}
  toRecipients.forEach(function(r) { toEmails[r.email.toLowerCase()] = true })
  ccRecipients = _dedup(ccRecipients).filter(function(r) { return !toEmails[r.email.toLowerCase()] })
  var docName = (typeof doc === 'string') ? doc : (doc['Tên hồ sơ'] || '')
  try {
    var templates = _getMailTemplates()
    var tpl = templates[mailType] || _DEFAULT_MAIL_TEMPLATES[mailType] || { subject: 'Thông báo: ' + docName, body: 'Hồ sơ "' + docName + '" có cập nhật mới.' }
    var appLink = _getAppLink()

    var baseOptions = {}
    var config = _getMailConfigFromSSO()
    if (!config || config['MAIL_ENABLED'] !== 'TRUE') return
    if (config['MAIL_SENDER_NAME']) baseOptions.name = config['MAIL_SENDER_NAME']
    if (config['MAIL_SENDER_EMAIL']) baseOptions.from = config['MAIL_SENDER_EMAIL']

    var toEmails = toRecipients.map(function(r) { return r.email }).join(',')
    var ccEmails = ccRecipients.filter(function(r) { return r.email }).map(function(r) { return r.email }).join(',')

    var fileLinks = (typeof doc === 'object') ? _buildFileLinks(doc) : ''
    var ngayBanHanh = _formatDateDMY(typeof doc === 'object' ? doc['Ngày ban hành'] : '')
    var ngayKetThuc = _formatDateDMY(typeof doc === 'object' ? doc['Ngày kết thúc'] : '')

    // Single recipient name for personalized templates, generic for bulk
    var recipientName = toRecipients.length === 1 ? (toRecipients[0].name || '') : 'Quý Anh/Chị'
    var recipientRole = toRecipients.length === 1 ? (toRecipients[0].role || '') : ''
    var recipientPhongBan = toRecipients.length === 1 ? (toRecipients[0].phongBan || '') : ''

    // Vai trò + phòng ban của người gửi (người tác động cuối lên hệ thống), từ SSO _Phân Bổ
    var senderRole = ''
    var senderPhongBan = ''
    if (session && session.userId) {
      try {
        var _parentId = ssoGetParentSheetId()
        if (_parentId) {
          var _senderInfo = _getDeptInfo(SpreadsheetApp.openById(_parentId), session.userId)
          senderRole = _senderInfo.role || ''
          senderPhongBan = _senderInfo.phongBan || ''
        }
      } catch(e) { Logger.log('sender dept info error: ' + e.message) }
    }
    // Người kiểm soát (013): tên + chức danh thực, để dựng đoạn điều kiện [[...]] trong email giao việc.
    var ksName = '', ksRole = ''
    if (typeof doc === 'object' && doc['Người kiểm soát']) {
      var _ksIds = _parseAssignees(doc['Người kiểm soát'])
      if (_ksIds.length > 0) {
        var _ksRcpt = _getRecipientsByUsernames([_ksIds[0]])
        if (_ksRcpt && _ksRcpt.length > 0) { ksName = _ksRcpt[0].name || ''; ksRole = _ksRcpt[0].role || '' }
      }
    }
    var vars = {
      '{tênHồSơ}': docName,
      '{tênNgườiGửi}': session ? (session.name || session.username || '') : 'Hệ thống',
      '{ngườiGửi}': session ? session.username : 'Hệ thống',
      '{emailNgườiGửi}': session ? (session.email || '') : '',
      '{vaiTròNgườiGửi}': senderRole,
      '{phòngBanNgườiGửi}': senderPhongBan,
      '{tênNgườiNhận}': recipientName,
      '{vaiTròNgườiNhận}': recipientRole,
      '{phòngBanNgườiNhận}': recipientPhongBan,
      '{linkHệThống}': appLink,
      '{linkTàiLiệu}': fileLinks,
      '{ngàyBanHành}': ngayBanHanh,
      '{ngàyKếtThúc}': ngayKetThuc,
      '{ghiChú}': (typeof doc === 'object') ? (doc['Ghi chú'] || '') : '',
      '{lyDoTuChoi}': (typeof doc === 'object') ? (doc['Lý do từ chối'] || '') : '',
      '{nộiDungGiaoViec}': (typeof doc === 'object') ? (doc['Nội dung giao việc'] || '') : '',
      '{nộiDungPhoiHop}': (typeof doc === 'object') ? (doc['Nội dung phối hợp'] || '') : '',
      '{tênNgườiKiểmSoát}': ksName,
      '{vaiTròNgườiKiểmSoát}': ksRole,
      '{hoảTốc}': (typeof doc === 'object' && (doc['Khẩn'] === 'TRUE' || doc['Khẩn'] === true)) ? '[HOẢ TỐC] ' : ''
    }
    var subject = _applyTemplate(tpl.subject, vars)
    var body = _applyTemplate(tpl.body, vars)
    var mailOptions = Object.assign({}, baseOptions)
    if (ccEmails) mailOptions.cc = ccEmails
    Logger.log('_sendNotificationEmails: sending to=' + toEmails + ' cc=' + (ccEmails || ''))
    GmailApp.sendEmail(toEmails, subject, body, mailOptions)
    Logger.log('_sendNotificationEmails: sent OK')
  } catch(e) {
    Logger.log('_sendNotificationEmails ERROR: ' + e.message + '\n' + e.stack)
    throw new Error('Gửi email thất bại: ' + e.message)
  }
}

// Resolve the people who approve documents, from the SSO `_Phân Bổ` (source of truth).
// Primary: Chức vụ='Giám đốc'. Fallback: 'admin' when NO director is assigned — admins can
// also run every director approval action (see transitionDocument isAdmin bypass), which covers
// small orgs where the admin IS the director. We never use the local _Phân Quyền role string:
// a director who owns the spreadsheet is assigned the local role 'admin' (see api_ssoLogin),
// which would otherwise exclude them.
function _getDirectorUserIds() {
  var parentId = ssoGetParentSheetId()
  if (!parentId) return []
  try {
    var ss = SpreadsheetApp.openById(parentId)
    var sheet = ss.getSheetByName('_Phân Bổ')
    if (!sheet) return []
    var rows = rowsToObjects(sheet.getDataRange().getValues())
    var directors = []
    var admins = []
    rows.forEach(function(a) {
      var uid = String(a['UserID'])
      if (!uid) return
      if (a['Chức vụ'] === 'Giám đốc') { if (directors.indexOf(uid) === -1) directors.push(uid) }
      else if (a['Chức vụ'] === 'admin') { if (admins.indexOf(uid) === -1) admins.push(uid) }
    })
    return directors.length > 0 ? directors : admins
  } catch(e) {
    Logger.log('_getDirectorUserIds error: ' + e.message)
    return []
  }
}

function _getRecipientsByUsernames(usernames) {
  if (!usernames || usernames.length === 0) return []
  var parentId = ssoGetParentSheetId()
  if (!parentId) return []
  try {
    var ss = SpreadsheetApp.openById(parentId)
    var sheet = ss.getSheetByName('_Người Dùng')
    if (!sheet) return []
    var users = rowsToObjects(sheet.getDataRange().getValues())
    var result = []
    usernames.forEach(function(uname) {
      var user = users.find(function(u) {
        return u['Tên đăng nhập'] === uname || String(u['ID']) === String(uname)
      })
      if (user && user['Email']) {
        var info = _getDeptInfo(ss, user['ID'])
        result.push({ email: user['Email'], name: user['Tên nhân viên'] || user['Tên đăng nhập'] || uname, role: info.role || '', phongBan: info.phongBan || '' })
      }
    })
    return result
  } catch(e) {
    Logger.log('_getRecipientsByUsernames error: ' + e.message)
    return []
  }
}

function _getRecipientsByIds(userIds) {
  if (!userIds || userIds.length === 0) return []
  var parentId = ssoGetParentSheetId()
  if (!parentId) return []
  try {
    var ss = SpreadsheetApp.openById(parentId)
    var sheet = ss.getSheetByName('_Người Dùng')
    if (!sheet) return []
    var data = rowsToObjects(sheet.getDataRange().getValues())
    var result = []
    userIds.forEach(function(uid) {
      var user = data.find(function(u) { return String(u['ID']) === String(uid) })
      if (user && user['Email']) {
        var info = _getDeptInfo(ss, uid)
        result.push({
          userId: user['ID'],
          email: user['Email'],
          name: user['Tên nhân viên'] || user['Email'],
          role: info.role || '',
          phongBan: info.phongBan || ''
        })
      }
    })
    return result
  } catch(e) {
    Logger.log('_getRecipientsByIds error: ' + e.message)
    return []
  }
}

function _getRecipientsByRole(targetRole) {
  var roles = getSheetData(SHEETS.APP_ROLES)
  var userIds = []
  roles.forEach(function(r) {
    if (r['Quyền'] === targetRole && r['AppID'] === APP_ID) {
      userIds.push(r['Tên đăng nhập'] || String(r['UserID']))
    }
  })
  return _getRecipientsByUsernames(userIds)
}

/**
 * Parse the File ID column: may be JSON array or plain string (legacy).
 * Returns array of { fileId, fileName, mimeType, size }.
 */
function _parseFileInfos(fileIdCol) {
  if (!fileIdCol) return []
  if (typeof fileIdCol === 'string' && fileIdCol.charAt(0) === '[') {
    try { return JSON.parse(fileIdCol) } catch (e) { /* fall through */ }
  }
  // Legacy single-file plain string
  if (typeof fileIdCol === 'string' && fileIdCol) {
    return [{ fileId: fileIdCol, fileName: '', mimeType: '', size: 0 }]
  }
  return []
}

// Số hồ sơ mỗi trang cho danh sách phẳng (phân trang server-side).
var DOC_PAGE_SIZE = 20

// Hạng ưu tiên hiển thị (nhỏ = ưu tiên cao):
//  0 = Chưa hoàn thành; 1 = Hoàn thành + có người phụ trách;
//  2 = Hoàn thành + có phát hành; 3 = Hoàn thành bình thường.
function _docPriorityRank(doc) {
  if (doc['Tình trạng'] !== 'Hoàn thành') return 0
  if (_parseAssignees(doc['Phụ trách']).length > 0) return 1
  var hasPublish = false
  if (doc['Lịch sử phát hành']) {
    try {
      var h = JSON.parse(doc['Lịch sử phát hành'])
      hasPublish = (Object.prototype.toString.call(h) === '[object Array]') && h.length > 0
    } catch (e) { hasPublish = false }
  }
  return hasPublish ? 2 : 3
}

// So sánh theo hạng ưu tiên tăng dần, rồi Ngày cập nhật giảm dần
// (thiếu ngày = thời điểm 0 → xuống cuối nhóm).
function _compareByPriority(a, b) {
  var ra = _docPriorityRank(a), rb = _docPriorityRank(b)
  if (ra !== rb) return ra - rb
  var ta = a['Ngày cập nhật'] ? new Date(a['Ngày cập nhật']).getTime() : 0
  var tb = b['Ngày cập nhật'] ? new Date(b['Ngày cập nhật']).getTime() : 0
  return tb - ta
}

// ── 012: 3 cột tính sẵn (đẩy lọc/sắp/tìm xuống nguồn) ────────────────────────
// Map định danh (username/email HOẶC userId) → userId. Nguồn: _Phân Quyền (docmgr) +
// _Người Dùng (SSO cha, đầy đủ). Memo TRONG-MỘT-EXECUTION (biến module) — GAS mỗi request
// là scope mới nên tự reset giữa request → không staleness; trong 1 request/backfill chỉ đọc 1 lần.
// Chỉ dùng khi GHI (sinh token); đường query KHÔNG cần (đã có session.userId).
var _docUserIdMemo = null
function _resetDocUserIdMemo() { _docUserIdMemo = null }
function _getDocUserIdMap() {
  if (_docUserIdMemo) return _docUserIdMemo
  var map = {}
  getSheetData(SHEETS.APP_ROLES).forEach(function (r) {
    if (r['AppID'] !== APP_ID) return
    var uid = String(r['UserID'])
    map[uid] = uid
    if (r['Tên đăng nhập']) map[String(r['Tên đăng nhập'])] = uid
  })
  try {
    var parentId = ssoGetParentSheetId()
    if (parentId) {
      var sheet = SpreadsheetApp.openById(parentId).getSheetByName('_Người Dùng')
      if (sheet) {
        rowsToObjects(sheet.getDataRange().getValues()).forEach(function (u) {
          var id = String(u['ID'])
          if (!id) return
          map[id] = id
          if (u['Tên đăng nhập']) map[String(u['Tên đăng nhập'])] = id
          if (u['Email']) map[String(u['Email'])] = id
        })
      }
    }
  } catch (e) { Logger.log('_getDocUserIdMap parent error: ' + e.message) }
  _docUserIdMemo = map
  return map
}

// "Token ai được xem" — tập userId được xem, NỘI DUNG phụ thuộc Tình trạng (FR-014a).
// Map mọi định danh (email/username/id) → userId qua _getDocUserIdMap; định danh không
// resolve được giữ THÔ (không mất quyền). Ngăn cách '|' (email chứa '_' nên không dùng '_').
// Truy vấn lọc bằng `contains '|<session.userId>|'` (session đã có userId).
function _docViewToken(doc, userMap) {
  var map = userMap || _getDocUserIdMap()
  var status = _normalizeStatus(doc['Tình trạng'])
  var vals = []
  if (doc['Người tạo']) vals.push(doc['Người tạo'])
  if (status !== 'Nháp') {                                       // Nháp → chỉ người tạo
    vals = vals.concat(_parseAssignees(doc['Phụ trách']))
    vals = vals.concat(_parseAssignees(doc['Người phối hợp']))
    vals = vals.concat(_parseAssignees(doc['Người kiểm soát']))  // 013: NKS được xem hồ sơ
  }
  if (status === 'Hoàn thành') {                                 // Người được xem chỉ khi Hoàn thành
    vals = vals.concat(_parseAssignees(doc['Người được xem']))
  }
  var seen = {}, uniq = []
  vals.forEach(function (v) {
    var raw = String(v == null ? '' : v)
    var id = String(map[raw] != null ? map[raw] : raw).replace(/\|/g, '')
    if (id && !seen[id]) { seen[id] = true; uniq.push(id) }
  })
  return '|' + uniq.join('|') + '|'
}

// "Blob tìm kiếm" — gộp 7 trường đã bỏ dấu (giống viMatch của client/getDocuments) (FR-016b).
function _docSearchBlob(doc) {
  return _viNormalize([
    doc['Tên hồ sơ'], doc['Số hồ sơ'], doc['Dự án (Phòng ban)'],
    doc['Nhà cung cấp (Nơi ban hành)'], doc['Ghi chú'], doc['Phụ trách'], doc['Tên file']
  ].join(' '))
}

// Trả 3 cột tính sẵn từ object hồ sơ ĐẦY ĐỦ (đã chuẩn hóa Tình trạng để khớp getDocuments).
function _docDerivedColumns(doc) {
  var ns = _normalizeStatus(doc['Tình trạng'])
  var nd = ns !== doc['Tình trạng'] ? Object.assign({}, doc, { 'Tình trạng': ns }) : doc
  return {
    'Hạng ưu tiên': _docPriorityRank(nd),
    'Token xem': _docViewToken(nd),
    'Blob tìm kiếm': _docSearchBlob(nd),
  }
}

// Wrapper ghi: luôn gán 3 cột tính sẵn để mọi điểm ghi đồng bộ (FR-005/006/014b).
function _addDocRow(record) {
  return addRow(SHEETS.HO_SO, Object.assign({}, record, _docDerivedColumns(record)))
}
function _updateDocRow(id, updates, existingDoc) {
  var doc = existingDoc
  if (!doc) doc = getSheetData(SHEETS.HO_SO).find(function(d) { return String(d['ID']) === String(id) })
  var merged = Object.assign({}, doc || {}, updates)
  var withDerived = Object.assign({}, updates, _docDerivedColumns(merged))
  return updateRow(SHEETS.HO_SO, id, withDerived)
}

// Backfill (FR-007): nạp 3 cột cho hồ sơ cũ. Idempotent qua cờ ScriptProperties.
function backfillDocDerived() {
  var props = PropertiesService.getScriptProperties()
  // V3: token map về userId (delimiter '|') → chạy lại 1 lần.
  // ⚠️ KHÔNG bump cờ này để "ghi lại toàn bộ" — với 10k+ hồ sơ sẽ timeout doGet vĩnh viễn.
  // Token xem cập nhật theo từng hồ sơ khi hồ sơ được ghi (_updateDocRow). Muốn tính lại toàn bộ
  // (gồm hồ sơ cũ gán NKS) thì chạy thủ công rebuildAllDerived() — batch, an toàn ở quy mô lớn.
  if (props.getProperty('BACKFILL_DOCDERIVED_V3') === '1') return
  getSheetData(SHEETS.HO_SO).forEach(function(d) { _updateDocRow(d['ID'], {}, d) })
  invalidateSheetCache(SHEETS.HO_SO)
  props.setProperty('BACKFILL_DOCDERIVED_V3', '1')
}

// 013: REBUILD toàn bộ 3 cột tính sẵn (Hạng ưu tiên / Token xem / Blob tìm kiếm) cho MỌI hồ sơ.
// An toàn ở 10k+ vì: ĐỌC 1 lần (getDataRange) → tính trong RAM → GHI mỗi cột bằng 1 setValues
// (tổng ~3 lệnh ghi), KHÔNG ghi từng ô. Chạy THỦ CÔNG từ trình soạn thảo Apps Script — KHÔNG
// bao giờ gọi trong doGet. Trả về số hồ sơ đã cập nhật.
function rebuildAllDerived() {
  var sheet = getSheet(SHEETS.HO_SO)
  var data = sheet.getDataRange().getValues()
  if (data.length < 2) return 0
  var headers = data[0]
  var idx = {}
  for (var c = 0; c < headers.length; c++) idx[String(headers[c])] = c
  var n = data.length - 1
  var userMap = _getDocUserIdMap()
  var pri = [], tok = [], blob = []
  for (var i = 1; i < data.length; i++) {
    var obj = {}
    for (var h in idx) obj[h] = data[i][idx[h]]
    var ns = _normalizeStatus(obj['Tình trạng'])
    var nd = ns !== obj['Tình trạng'] ? Object.assign({}, obj, { 'Tình trạng': ns }) : obj
    pri.push([_docPriorityRank(nd)])
    tok.push([_docViewToken(nd, userMap)])
    blob.push([_docSearchBlob(nd)])
  }
  if (idx['Hạng ưu tiên'] != null) sheet.getRange(2, idx['Hạng ưu tiên'] + 1, n, 1).setValues(pri)
  if (idx['Token xem'] != null)    sheet.getRange(2, idx['Token xem'] + 1, n, 1).setValues(tok)
  if (idx['Blob tìm kiếm'] != null) sheet.getRange(2, idx['Blob tìm kiếm'] + 1, n, 1).setValues(blob)
  invalidateSheetCache(SHEETS.HO_SO)
  Logger.log('rebuildAllDerived: đã tính lại ' + n + ' hồ sơ')
  return n
}

// 012: doc list lấy qua truy vấn nguồn (gviz) — chỉ kéo 100 dòng/trang (FR-001/002).
// Server-side: phân trang + danh mục (đệ quy) + tìm kiếm toàn tập + lọc quyền (token).
// Các lọc phụ (tình trạng/dự án/NCC/năm) + "Công việc của tôi" vẫn áp client per-page (FR-015/016a).
function getDocuments(token, filters) {
  var session = requireAuth(token)
  filters = filters || {}
  var ctx = { role: session.role, userId: session.userId, username: session.username }
  return _queryDocPage(ctx, { page: filters.page, danhMucId: filters.danhMucId, keyword: filters.keyword })
}

// Bản đọc-toàn-bộ + lọc/sắp/cắt trong RAM (hành vi 011) — giữ làm THAM CHIẾU NGỮ NGHĨA
// và đường lùi; KHÔNG còn là đường phục vụ chính. Test ngữ nghĩa trỏ vào hàm này.
function _getDocumentsInRam(token, filters) {
  var session = requireAuth(token)
  filters = filters || {}

  Logger.log('[getDocuments] role=' + session.role + ' userId=' + session.userId)

  var docs = getSheetData(SHEETS.HO_SO).map(function(d) {
    // Normalize legacy status values on the fly
    var normalized = _normalizeStatus(d['Tình trạng'])
    return normalized !== d['Tình trạng'] ? Object.assign({}, d, { 'Tình trạng': normalized }) : d
  })

  // Nháp: only visible to creator
  docs = docs.filter(function(d) {
    return d['Tình trạng'] !== 'Nháp' || d['Người tạo'] === session.username
  })

  // Category visibility filter (admin, Quản trị viên, Giám đốc, Văn thư see everything)
  var CAT_EXEMPT_ROLES = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  Logger.log('[getDocuments] catExempt=' + (CAT_EXEMPT_ROLES.indexOf(session.role) !== -1) + ' totalDocs=' + docs.length)
  if (CAT_EXEMPT_ROLES.indexOf(session.role) === -1) {
    var categories = getSheetData(SHEETS.DANH_MUC)
    var groups = getSheetData(SHEETS.NHOM)
    var userIdStr = String(session.userId)
    // Find which groups this user belongs to
    var userGroupIds = []
    groups.forEach(function(g) {
      var members = _parseAssignees(g['Thành viên'])
      if (members.indexOf(userIdStr) !== -1 || members.indexOf(session.username) !== -1) {
        userGroupIds.push(String(g.ID))
      }
    })

    // Lifecycle + document/category view permission (feature 008)
    var _viewCtx = { categories: categories, userGroupIds: userGroupIds, userIdStr: userIdStr, username: session.username }
    docs = docs.filter(function(d) { return _canViewDocument(d, session, _viewCtx) })
  }

  // Status filter
  if (filters.tinhTrang) {
    docs = docs.filter(function(d) { return d['Tình trạng'] === filters.tinhTrang })
  }

  // Category filter — include selected category AND all recursive descendants
  if (filters.danhMucId) {
    var _catSet = _categoryDescendantSet(filters.danhMucId)
    docs = docs.filter(function(d) { return _catSet[String(d['Danh mục'] || '')] })
  }

  // Project filter (multi-value: match if the doc contains the selected project)
  if (filters.duAn) {
    docs = docs.filter(function(d) { return _parseAssignees(d['Dự án (Phòng ban)']).indexOf(String(filters.duAn)) !== -1 })
  }

  // Supplier filter
  if (filters.nhaCungCap) {
    docs = docs.filter(function(d) { return String(d['Nhà cung cấp (Nơi ban hành)']) === String(filters.nhaCungCap) })
  }

  // Person in charge filter
  if (filters.phuTrach) {
    docs = docs.filter(function(d) { return String(d['Phụ trách']) === String(filters.phuTrach) })
  }

  // Year filter
  if (filters.nam) {
    docs = docs.filter(function(d) {
      if (!d['Ngày ban hành']) return false
      return new Date(d['Ngày ban hành']).getFullYear() === Number(filters.nam)
    })
  }

  // Search keyword (Vietnamese diacritics-insensitive)
  if (filters.keyword) {
    var kw = _viNormalize(filters.keyword)
    docs = docs.filter(function(d) {
      return (
        _viNormalize(d['Tên hồ sơ']).indexOf(kw) !== -1 ||
        _viNormalize(d['Số hồ sơ']).indexOf(kw) !== -1 ||
        _viNormalize(d['Dự án (Phòng ban)']).indexOf(kw) !== -1 ||
        _viNormalize(d['Nhà cung cấp (Nơi ban hành)']).indexOf(kw) !== -1 ||
        _viNormalize(d['Ghi chú']).indexOf(kw) !== -1 ||
        _viNormalize(d['Phụ trách']).indexOf(kw) !== -1 ||
        _viNormalize(d['Tên file']).indexOf(kw) !== -1
      )
    })
  }

  // Sort by display priority groups, then newest first within each group
  docs.sort(_compareByPriority)

  // Pagination — fixed page size, 1-based page number
  var page = Math.max(1, parseInt(filters.page, 10) || 1)
  var start = (page - 1) * DOC_PAGE_SIZE
  var pageDocs = docs.slice(start, start + DOC_PAGE_SIZE)
  var hasNext = docs.length > page * DOC_PAGE_SIZE

  return { data: pageDocs, page: page, hasNext: hasNext }
}

function createDocument(token, data, fileInfos, notifyTarget) {
  var session = requireAuth(token)

  // Re-check create permission from sheet (not cached session)
  var adminRoles = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  if (adminRoles.indexOf(session.role) === -1) {
    var roles = getSheetData(SHEETS.APP_ROLES)
    var appRole = roles.find(function(r) { return String(r['UserID']) === String(session.userId) && r['AppID'] === APP_ID })
    var allowed = appRole && (appRole['Được tạo hồ sơ'] === 'TRUE' || appRole['Được tạo hồ sơ'] === true)
    if (!allowed) throw new Error('Bạn không có quyền tạo hồ sơ')
  }

  // Require at minimum: Tên hồ sơ and Danh mục
  if (!data['Tên hồ sơ']) throw new Error('Tên hồ sơ là bắt buộc')
  if (!data['Danh mục']) throw new Error('Danh mục là bắt buộc')

  // Normalize fileInfos: accept legacy single object or array
  if (fileInfos && !Array.isArray(fileInfos)) fileInfos = [fileInfos]
  fileInfos = fileInfos || []

  var uploadedFiles = []
  var catPath = _resolveCategoryPath(data['Danh mục'])

  fileInfos.forEach(function(fi) {
    if (fi && fi.base64Data) {
      var result = uploadFile(fi.base64Data, fi.mimeType, fi.fileName, catPath)
      uploadedFiles.push({ fileId: result.fileId, fileName: result.fileName, mimeType: fi.mimeType, size: fi.size || 0 })
    }
  })

  var fileIdCol = uploadedFiles.length > 0 ? JSON.stringify(uploadedFiles) : ''
  var fileNameCol = uploadedFiles.map(function(f) { return f.fileName }).join(', ')

  var record = {
    'Tên hồ sơ': data['Tên hồ sơ'],
    'Danh mục': data['Danh mục'],
    'Số hồ sơ': data['Số hồ sơ'] || '',
    'Dự án (Phòng ban)': String(data['Dự án (Phòng ban)'] || '').trim(),
    'Nhà cung cấp (Nơi ban hành)': String(data['Nhà cung cấp (Nơi ban hành)'] || '').trim(),
    'Ngày ban hành': data['Ngày ban hành'] || '',
    'Ngày kết thúc': data['Ngày kết thúc'] || '',
    'Giá trị HĐ': data['Giá trị HĐ'] || 0,
    'Tình trạng': data['Tình trạng'] || 'Chờ duyệt',
    'Tệp đính kèm': fileIdCol,
    'Tên file': fileNameCol,
    'Phụ trách': data['Phụ trách'] ? JSON.stringify([String(data['Phụ trách'])]) : '',
    'Người phối hợp': _buildAssignees(data['Người phối hợp'], null),
    'Người được xem': data['Người được xem'] || '',
    'Ghi chú': data['Ghi chú'] || '',
    'Nơi lưu hồ sơ cứng': data['Nơi lưu hồ sơ cứng'] || '',
    'Ngày cập nhật': new Date().toISOString(),
    'Người tạo': session.username,
    'Người cập nhật': session.username,
    'Khẩn': data['Khẩn'] === true || data['Khẩn'] === 'TRUE' ? 'TRUE' : '',
  }

  var added = _addDocRow(record)
  logAudit(session, 'Tạo', 'Hồ sơ', record['Tên hồ sơ'], JSON.stringify({ soHoSo: record['Số hồ sơ'], danhMuc: record['Danh mục'] }))

  // Send email notification if Trình duyệt (notify directors)
  var emailError = null
  if (notifyTarget === 'directors') {
    var dirUserIds = _getDirectorUserIds()
    _markUnreadForUsers(dirUserIds, added['ID'])
    try {
      var dirRecipients = _getRecipientsByIds(dirUserIds)
      _sendNotificationEmails(dirRecipients, added, 'trinhDuyet', session)
    } catch(e) {
      Logger.log('createDocument trinhDuyet email error: ' + e.message)
      emailError = e.message
    }
  }

  // Publish mode: send to specified recipients
  if (notifyTarget === 'publish' && data._publishTo) {
    try {
      publishDocument(token, added['ID'], data._publishTo, data._publishCc || [])
    } catch(e) {
      Logger.log('createDocument publish email error: ' + e.message)
      emailError = e.message
    }
  }

  return { data: added, emailError: emailError }
}

function updateDocument(token, id, data, fileInfos, keepFileIds, notifyTarget, eagerFileInfos) {
  var session = requireAuth(token)

  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(id) })
  if (!doc) throw new Error('Không tìm thấy hồ sơ')

  if (session.role === 'Văn thư' && doc['Người tạo'] !== session.username) {
    throw new Error('Văn thư chỉ được chỉnh sửa hồ sơ do mình tạo')
  }

  // Permission: viewer/dept user can only edit docs they are assigned to
  // Văn thư editing own doc is allowed (checked above)
  var isVanThuOwnDoc = session.role === 'Văn thư' && doc['Người tạo'] === session.username
  if (isVanThuOwnDoc && doc['Tình trạng'] === 'Từ chối') {
    if (notifyTarget === 'publish') throw new Error('Không thể phát hành hồ sơ đang bị từ chối')
    if (data['Tình trạng'] === 'Hoàn thành') throw new Error('Không thể lưu tài liệu khi hồ sơ đang bị từ chối')
  }
  // PT on Từ chối kết quả: block publish + Hoàn thành
  if (doc['Tình trạng'] === 'Từ chối kết quả') {
    if (notifyTarget === 'publish') throw new Error('Không thể phát hành hồ sơ đang bị từ chối kết quả')
    if (data['Tình trạng'] === 'Hoàn thành') throw new Error('Không thể lưu tài liệu khi hồ sơ đang bị từ chối kết quả')
  }
  if (!isVanThuOwnDoc && session.role !== 'Quản trị viên' &&
      session.role !== 'admin' && session.role !== 'Giám đốc') {
    var existingAssignees = _parseAssignees(doc['Phụ trách'])
    var userId = String(session.userId)
    var uname  = session.username
    if (existingAssignees.indexOf(userId) === -1 && existingAssignees.indexOf(uname) === -1) {
      throw new Error('Bạn không có quyền chỉnh sửa hồ sơ này')
    }
  }

  var updates = {}

  var textFields = [
    'Tên hồ sơ', 'Danh mục', 'Số hồ sơ',
    'Dự án (Phòng ban)', 'Nhà cung cấp (Nơi ban hành)', 'Ngày ban hành', 'Ngày kết thúc',
    'Tình trạng', 'Ghi chú', 'Nơi lưu hồ sơ cứng', 'Khẩn',
    'Người được xem'
  ]
  // Phân quyền xem đặt qua màn tạo/sửa (data['Người được xem']) hoặc setDocumentViewers (màn chi tiết).
  textFields.forEach(function(f) {
    if (data[f] !== undefined) updates[f] = typeof data[f] === 'string' ? data[f].trim() : data[f]
  })

  if (data['Giá trị HĐ'] !== undefined) updates['Giá trị HĐ'] = data['Giá trị HĐ']

  // Multi-file handling
  // Normalize inputs
  if (fileInfos && !Array.isArray(fileInfos)) fileInfos = [fileInfos]
  fileInfos = fileInfos || []
  keepFileIds = Array.isArray(keepFileIds) ? keepFileIds : []

  // Parse existing file infos
  var existingInfos = _parseFileInfos(doc['Tệp đính kèm'])

  // Delete files that are NOT in keepFileIds — but only trash per the policy
  // (machine uploads in Nháp; linked Drive files never; else leave orphaned)
  existingInfos.forEach(function(ef) {
    if (ef.fileId && keepFileIds.indexOf(ef.fileId) === -1 && _shouldTrashFile(ef, doc['Tình trạng'])) {
      deleteFile(ef.fileId)
    }
  })

  // Keep only the ones in keepFileIds
  var keptFiles = existingInfos.filter(function(ef) {
    return keepFileIds.indexOf(ef.fileId) !== -1
  })

  // Upload new files
  var catPath = _resolveCategoryPath(updates['Danh mục'] || doc['Danh mục'])
  var newlyUploaded = []
  fileInfos.forEach(function(fi) {
    if (fi && fi.base64Data) {
      var result = uploadFile(fi.base64Data, fi.mimeType, fi.fileName, catPath)
      newlyUploaded.push({ fileId: result.fileId, fileName: result.fileName, mimeType: fi.mimeType, size: fi.size || 0 })
    }
  })

  // Move kept files to new category folder if category changed.
  // Fail-loud: nếu move bất kỳ file nào thất bại → ném lỗi TRƯỚC khi ghi row,
  // không cho đổi danh mục "nửa vời" (doc và vị trí file lệch nhau).
  var oldCatId = String(doc['Danh mục'] || '')
  var newCatId = String(updates['Danh mục'] !== undefined ? updates['Danh mục'] : doc['Danh mục'] || '')
  if (oldCatId !== newCatId && keptFiles.length > 0) {
    var newCatPath = _resolveCategoryPath(newCatId)
    keptFiles.forEach(function(f) {
      moveFile(f.fileId, newCatPath)
    })
  }

  // Merge pre-uploaded eager files (no base64 re-upload needed)
  var eagerFiles = Array.isArray(eagerFileInfos) ? eagerFileInfos : []

  var allFiles = keptFiles.concat(newlyUploaded).concat(eagerFiles)
  updates['Tệp đính kèm'] = allFiles.length > 0 ? JSON.stringify(allFiles) : ''
  updates['Tên file'] = allFiles.map(function(f) { return f.fileName }).join(', ')

  // Update Phụ trách if provided (single person) — only admin/GĐ can change
  if (data['Phụ trách'] !== undefined) {
    var canChangePhuTrach = session.role === 'admin' || session.role === 'Quản trị viên' || session.role === 'Giám đốc'
    if (canChangePhuTrach) {
      updates['Phụ trách'] = data['Phụ trách'] ? JSON.stringify([String(data['Phụ trách'])]) : ''
    }
  }
  // Update Người phối hợp if provided (multiple people)
  if (data['Người phối hợp'] !== undefined) {
    updates['Người phối hợp'] = _buildAssignees(data['Người phối hợp'], null)
  }
  updates['Người cập nhật'] = session.username
  updates['Ngày cập nhật'] = new Date().toISOString()

  var updated = Object.assign({}, doc, updates)
  _updateDocRow(id, updates, doc)

  // Notification based on notifyTarget:
  //   'none'      — Văn thư "Lưu tài liệu" → no notification
  //   'directors' — Văn thư "Trình duyệt" → notify directors only
  //   default     — normal update → notify assignees
  notifyTarget = notifyTarget || 'all'

  var emailError = null
  if (notifyTarget === 'directors') {
    // Clear read status for directors so doc shows as unread
    // Add unread records for directors + send email
    var directorUserIds = _getDirectorUserIds()
    _markUnreadForUsers(directorUserIds, id)
    try {
      var directorRecipients = _getRecipientsByIds(directorUserIds)
      _sendNotificationEmails(directorRecipients, updated, 'trinhDuyet', session)
    } catch(e) {
      Logger.log('updateDocument trinhDuyet email error: ' + e.message)
      emailError = e.message
    }
  }

  logAudit(session, 'Sửa', 'Hồ sơ', doc['Tên hồ sơ'], JSON.stringify({ id: id }))
  return { data: updated, emailError: emailError }
}

// Whether a file should be trashed on Drive when removed from a document.
// Linked Drive files are never trashed; machine-uploaded files only in Nháp.
// Anything else is left orphaned (a separate cleanup tool handles it).
function _shouldTrashFile(fileInfo, docStatus) {
  if (fileInfo && fileInfo.linked) return false
  return docStatus === 'Nháp'
}

function deleteDocument(token, id) {
  var session = requireAuth(token)
  var deleteRoles = ['admin', 'Quản trị viên']
  if (deleteRoles.indexOf(session.role) === -1) throw new Error('Chỉ quản trị viên mới có quyền xóa hồ sơ')

  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(id) })
  if (!doc) throw new Error('Không tìm thấy hồ sơ')

  // Only trash machine-uploaded files of a Nháp document; otherwise leave orphaned
  var fileInfos = _parseFileInfos(doc['Tệp đính kèm'])
  fileInfos.forEach(function(fi) {
    if (fi.fileId && _shouldTrashFile(fi, doc['Tình trạng'])) deleteFile(fi.fileId)
  })

  deleteRow(SHEETS.HO_SO, id)
  logAudit(session, 'Xóa', 'Hồ sơ', doc['Tên hồ sơ'], JSON.stringify({ id: id }))
  return { success: true }
}

function getDocumentStats(token) {
  requireAuth(token)

  var docs = getSheetData(SHEETS.HO_SO)

  var total = docs.length
  var byStatus = {}
  var totalValue = 0

  docs.forEach(function(d) {
    var s = d['Tình trạng'] || 'Không rõ'
    byStatus[s] = (byStatus[s] || 0) + 1
    totalValue += Number(d['Giá trị HĐ']) || 0
  })

  return {
    total: total,
    byStatus: byStatus,
    totalValue: totalValue,
  }
}

// ── private helpers ──────────────────────────────────────────────────────────

// Normalize legacy status values to the 4-status workflow
var VALID_STATUSES = ['Nháp', 'Chờ duyệt', 'Chờ xử lý', 'Đang xử lý', 'Hoàn thành', 'Từ chối', 'YC Phát hành', 'Chờ xác nhận HT', 'Từ chối kết quả']
var STATUS_MIGRATION_MAP = {
  'Có hiệu lực':   'Hoàn thành',
  'Hết hiệu lực':  'Hoàn thành',
  'Đã ký':         'Hoàn thành',
  'Bị hủy':        'Hoàn thành',
  'Hủy':           'Hoàn thành',
  'Chờ ký':        'Chờ duyệt',
  'Pending':       'Chờ duyệt',
}

function _normalizeStatus(status) {
  if (!status) return 'Chờ duyệt'
  if (VALID_STATUSES.indexOf(status) !== -1) return status
  return STATUS_MIGRATION_MAP[status] || 'Chờ duyệt'
}

function _resolveCategoryName(categoryId) {
  if (!categoryId) return 'Khác'
  var cats = getSheetData(SHEETS.DANH_MUC)
  var cat = cats.find(function(c) { return String(c['ID']) === String(categoryId) })
  return cat ? cat['Tên danh mục'] : 'Khác'
}

// Build full folder path from root ancestor down to the selected category
// e.g. category "Hợp đồng xây dựng" (cha = "Hợp đồng") → ['Hợp đồng', 'Hợp đồng xây dựng']
function _resolveCategoryPath(categoryId) {
  if (!categoryId) return ['Khác']
  var cats = getSheetData(SHEETS.DANH_MUC)
  var path = []
  var currentId = String(categoryId)
  var visited = {}
  while (currentId) {
    if (visited[currentId]) break // prevent infinite loop
    visited[currentId] = true
    var cat = null
    for (var i = 0; i < cats.length; i++) {
      if (String(cats[i]['ID']) === currentId) { cat = cats[i]; break }
    }
    if (!cat) break
    path.unshift(cat['Tên danh mục'])
    currentId = cat['Danh mục cha'] ? String(cat['Danh mục cha']) : ''
  }
  return path.length > 0 ? path : ['Khác']
}

// Parse Phụ trách field: JSON array string or legacy plain value → array of strings
function _parseAssignees(phuTrach) {
  if (!phuTrach) return []
  if (typeof phuTrach === 'string' && phuTrach.charAt(0) === '[') {
    try { return JSON.parse(phuTrach).map(String) } catch(e) {}
  }
  return [String(phuTrach)]
}

// 013: hồ sơ này có session là Người kiểm soát không.
// So theo UserID/username TRỰC TIẾP, và RESOLVE qua _getDocUserIdMap (email/Tên đăng nhập/ID → UserID)
// để NHẤT QUÁN với "Token xem" (lọc danh sách). Nếu NKS thấy hồ sơ trong list thì cũng thao tác được.
function _isController(doc, session) {
  if (!doc || !session) return false
  var ids = _parseAssignees(doc['Người kiểm soát'])
  if (!ids.length) return false
  var sid = String(session.userId)
  var map = null
  for (var i = 0; i < ids.length; i++) {
    var raw = String(ids[i])
    if (raw === sid || raw === session.username) return true
    if (!map) map = _getDocUserIdMap()
    if (String(map[raw] != null ? map[raw] : raw) === sid) return true
  }
  return false
}

// Build JSON array string for assignees from input (array, string, or null)
function _buildAssignees(input, defaultUserId) {
  if (Array.isArray(input) && input.length > 0) {
    return JSON.stringify(input.map(String))
  }
  if (input && typeof input === 'string') {
    if (input.charAt(0) === '[') return input // already JSON
    return JSON.stringify([input])
  }
  if (defaultUserId) return JSON.stringify([String(defaultUserId)])
  return ''
}

// ── Document-level view permission (feature 008) ─────────────────────────────
// Empty allowed lists → everyone. Otherwise match by userId/username or group.
function _matchPerm(allowedUserIds, allowedGroupIds, userIdStr, username, userGroupIds) {
  if (allowedUserIds.length === 0 && allowedGroupIds.length === 0) return true
  if (allowedUserIds.indexOf(userIdStr) !== -1 || allowedUserIds.indexOf(username) !== -1) return true
  for (var i = 0; i < userGroupIds.length; i++) {
    if (allowedGroupIds.indexOf(userGroupIds[i]) !== -1) return true
  }
  return false
}

// A user "participates" in a doc if they created it or are assigned (Phụ trách / Người phối hợp).
function _isParticipant(doc, session) {
  if (doc['Người tạo'] === session.username) return true
  var uid = String(session.userId)
  var pt = _parseAssignees(doc['Phụ trách'])
  if (pt.indexOf(uid) !== -1 || pt.indexOf(session.username) !== -1) return true
  var ph = _parseAssignees(doc['Người phối hợp'])
  if (ph.indexOf(uid) !== -1 || ph.indexOf(session.username) !== -1) return true
  var ks = _parseAssignees(doc['Người kiểm soát'])  // 013: NKS cũng là người tham gia
  if (ks.indexOf(uid) !== -1 || ks.indexOf(session.username) !== -1) return true
  return false
}

// Người-được-xem suy ra từ một danh mục: người trực tiếp + khai triển thành viên các nhóm-được-xem.
// Dùng cho snapshot lúc tạo/import-trống và migration backfill (revise 2026-06-19).
function _categoryViewerIds(catId) {
  var cats = getSheetData(SHEETS.DANH_MUC)
  var groupsSheet = getSheetData(SHEETS.NHOM)
  var ids = {}
  var seen = {}
  var cur = String(catId || '')
  // Đi ngược chuỗi "Danh mục cha" → gộp quyền của danh mục con + mọi danh mục tổ tiên.
  while (cur && !seen[cur]) {
    seen[cur] = true
    var cat = cats.find(function(c) { return String(c['ID']) === cur })
    if (!cat) break
    _parseAssignees(cat['Người được xem']).forEach(function(u) { ids[String(u)] = true })
    var groupIds = _parseAssignees(cat['Nhóm được xem'])
    if (groupIds.length) {
      groupsSheet.forEach(function(g) {
        if (groupIds.indexOf(String(g['ID'])) !== -1) {
          _parseAssignees(g['Thành viên']).forEach(function(u) { ids[String(u)] = true })
        }
      })
    }
    cur = String(cat['Danh mục cha'] || '')
  }
  return Object.keys(ids)
}

// Migration backfill (FR-013): snapshot quyền danh mục vào các tài liệu cũ đang rỗng "Người được xem",
// để dữ liệu cũ không bị ẩn khi bỏ fallback danh mục động. Idempotent qua cờ ScriptProperties.
function _backfillDocViewers() {
  var props = PropertiesService.getScriptProperties()
  if (props.getProperty('BACKFILL_DOCVIEWERS_DONE') === '1') return
  getSheetData(SHEETS.HO_SO).forEach(function(d) {
    if (_parseAssignees(d['Người được xem']).length === 0) {
      var ids = _categoryViewerIds(d['Danh mục'])
      if (ids.length) _updateDocRow(d['ID'], { 'Người được xem': JSON.stringify(ids) }, d)
    }
  })
  props.setProperty('BACKFILL_DOCVIEWERS_DONE', '1')
}

// Lifecycle-aware visibility for a NON-full-access user (full-access bypass is in getDocuments).
// ctx: { categories, userGroupIds, userIdStr, username }
function _canViewDocument(doc, session, ctx) {
  // Người tham gia luôn thấy (mọi trạng thái)
  if (_isParticipant(doc, session)) return true
  // Chưa hoàn thành → chỉ người tham gia (đã xử lý ở trên) → ẩn
  if (doc['Tình trạng'] !== 'Hoàn thành') return false
  // Snapshot là nguồn chân lý (revise 2026-06-19): chỉ người trong "Người được xem" thấy,
  // BẤT KỂ danh mục. Rỗng → siết: chỉ người tham gia (đã true ở trên) + vai trò toàn quyền
  // (bypass ở getDocuments). KHÔNG còn fallback kế thừa danh mục động.
  var docUsers = _parseAssignees(doc['Người được xem'])
  return docUsers.indexOf(ctx.userIdStr) !== -1 || docUsers.indexOf(ctx.username) !== -1
}

// Whether a recipient (by userId) can view a category per its viewer fields.
// ── Eager upload ────────────────────────────────────────────────────────────

// Permission check shared by all upload paths (same as createDocument).
function _checkCreatePermission(session) {
  var adminRoles = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  if (adminRoles.indexOf(session.role) === -1) {
    var roles = getSheetData(SHEETS.APP_ROLES)
    var appRole = roles.find(function(r) { return String(r['UserID']) === String(session.userId) && r['AppID'] === APP_ID })
    var allowed = appRole && (appRole['Được tạo hồ sơ'] === 'TRUE' || appRole['Được tạo hồ sơ'] === true)
    if (!allowed) throw new Error('Bạn không có quyền tạo hồ sơ')
  }
}

// Permission check for picking files from the deploy owner's Drive.
// Full-access roles always allowed; others need the "Được chọn từ Drive" flag.
function _checkPickDrivePermission(session) {
  var fullAccess = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  if (fullAccess.indexOf(session.role) !== -1) return
  var roles = getSheetData(SHEETS.APP_ROLES)
  var appRole = roles.find(function(r) { return String(r['UserID']) === String(session.userId) && r['AppID'] === APP_ID })
  var allowed = appRole && (appRole['Được chọn từ Drive'] === 'TRUE' || appRole['Được chọn từ Drive'] === true)
  if (!allowed) throw new Error('Bạn không có quyền chọn file từ Google Drive')
}

// Find a category whose name-path equals `names` (e.g. ['Hợp đồng','Hợp đồng XD']).
function _matchCategoryByPath(names) {
  if (!names || names.length === 0) return null   // file sits directly in ROOT, not a category
  var cats = getSheetData(SHEETS.DANH_MUC)
  for (var i = 0; i < cats.length; i++) {
    var path = _resolveCategoryPath(cats[i]['ID'])
    if (path.length !== names.length) continue
    var same = true
    for (var j = 0; j < path.length; j++) {
      if (String(path[j]) !== String(names[j])) { same = false; break }
    }
    if (same) return cats[i]['ID']
  }
  return null
}

// Resolve which app category a Drive file belongs to, from the folder it lives in.
// Walks the file's parent chain up to ROOT_FOLDER_ID, builds the folder-name path,
// and matches it exactly against a category's name path. Returns the category ID,
// or null if the file is outside the app tree / its folder isn't a known category.
function _resolveCategoryForFile(fileId) {
  var rootId = getConfig('ROOT_FOLDER_ID')
  if (!rootId) throw new Error('Chưa cấu hình thư mục gốc (ROOT_FOLDER_ID) trong Cài đặt')

  var parents = DriveApp.getFileById(fileId).getParents()
  if (!parents.hasNext()) return null

  var names = []
  var cur = parents.next()
  var guard = 0
  while (cur && guard < 50) {
    guard++
    if (cur.getId() === rootId) return _matchCategoryByPath(names)
    names.unshift(cur.getName())
    var up = cur.getParents()
    if (!up.hasNext()) return null   // reached My Drive root without hitting app root → outside tree
    cur = up.next()
  }
  return null
}

// Link existing Drive files (NO copy) to the document. Each file must live under
// the app's category tree; the category is derived from the file's folder. If the
// form already chose a category, every file must match it; otherwise the derived
// category (shared by all files) is returned for the client to fill in.
function linkDriveFiles(token, fileIds, categoryId, draftId, docId) {
  var session = requireAuth(token)
  _checkPickDrivePermission(session)
  if (!fileIds || !fileIds.length) throw new Error('Chưa chọn file nào')

  // Pass 1: resolve + validate every file BEFORE attaching anything
  var resolved = fileIds.map(function(fileId) {
    var file = DriveApp.getFileById(fileId)
    var catId = _resolveCategoryForFile(fileId)
    if (catId === null || catId === undefined) {
      throw new Error('File "' + file.getName() + '" không nằm trong danh mục nào của app. Hãy đặt file vào đúng thư mục danh mục, hoặc tạo danh mục tương ứng trong app trước.')
    }
    return { fileId: fileId, file: file, catId: catId }
  })

  var targetCat = categoryId || resolved[0].catId
  resolved.forEach(function(r) {
    if (String(r.catId) !== String(targetCat)) {
      throw new Error(categoryId
        ? 'File "' + r.file.getName() + '" thuộc danh mục khác với danh mục đã chọn của hồ sơ.'
        : 'Các file được chọn thuộc nhiều danh mục khác nhau. Mỗi hồ sơ chỉ thuộc một danh mục.')
    }
  })

  // Bất biến 1-file-1-hồ-sơ: từ chối file đang thuộc hồ sơ KHÁC. File của chính
  // hồ sơ đang thao tác (docId khi sửa, hoặc draftId khi tạo nháp) thì hợp lệ.
  var currentDoc = docId || ((draftId && draftId !== 'edit') ? draftId : null)
  resolved.forEach(function(r) {
    var owner = _indexFindDoc(r.fileId)
    if (owner !== null && owner !== undefined && String(owner) !== String(currentDoc)) {
      throw new Error('File "' + r.file.getName() + '" đã thuộc hồ sơ khác, không thể liên kết.')
    }
  })

  // Pass 2: ensure sharing, attach (linked, no copy)
  var outDraftId = (draftId === 'edit') ? 'edit' : (draftId || null)
  var lastData
  var results = resolved.map(function(r) {
    r.file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
    var fileInfo = { fileId: r.fileId, fileName: r.file.getName(), mimeType: r.file.getMimeType(), size: r.file.getSize() || 0, linked: true }
    var attach = _attachFileToDraft(session, fileInfo, targetCat, outDraftId)
    if (attach.draftId) outDraftId = attach.draftId
    if (attach.data) lastData = attach.data
    return { fileId: r.fileId, ok: true, fileInfo: fileInfo }
  })

  return {
    categoryId: targetCat,
    draftId: (draftId === 'edit') ? undefined : (outDraftId || undefined),
    results: results,
    data: lastData,
  }
}

// Attach an already-uploaded file to a draft row. Shared by uploadFileEager
// (small files) and finalizeChunkedUpload (large files).
//   draftId === 'edit' → upload only, no row changes
//   draftId truthy      → append to existing Nháp row
//   draftId falsy       → create new Nháp row
function _attachFileToDraft(session, fileInfo, categoryId, draftId) {
  if (draftId === 'edit') {
    return { fileInfo: fileInfo }
  }

  if (draftId) {
    var docs = getSheetData(SHEETS.HO_SO)
    var draft = docs.find(function(d) { return String(d['ID']) === String(draftId) })
    if (!draft) throw new Error('Không tìm thấy hồ sơ nháp')
    if (draft['Tình trạng'] !== 'Nháp') throw new Error('Hồ sơ không ở trạng thái Nháp')

    var existingInfos = _parseFileInfos(draft['Tệp đính kèm'])
    existingInfos.push(fileInfo)
    var changes = {
      'Tệp đính kèm': JSON.stringify(existingInfos),
      'Tên file': existingInfos.map(function(f) { return f.fileName }).join(', '),
      'Ngày cập nhật': new Date().toISOString(),
    }
    _updateDocRow(draftId, changes, draft)
    invalidateSheetCache(SHEETS.HO_SO)
    return { fileInfo: fileInfo, data: Object.assign({}, draft, changes) }
  }

  var record = {
    'Tên hồ sơ': '',
    'Danh mục': categoryId,
    'Tình trạng': 'Nháp',
    'Tệp đính kèm': JSON.stringify([fileInfo]),
    'Tên file': fileInfo.fileName,
    'Người tạo': session.username,
    'Người cập nhật': session.username,
    'Ngày cập nhật': new Date().toISOString(),
  }
  var added = _addDocRow(record)
  invalidateSheetCache(SHEETS.HO_SO)
  return { draftId: added['ID'], fileInfo: fileInfo, data: added }
}

function uploadFileEager(token, base64Data, mimeType, fileName, categoryId, draftId) {
  var session = requireAuth(token)
  _checkCreatePermission(session)
  if (!categoryId) throw new Error('Danh mục là bắt buộc')

  var catPath = _resolveCategoryPath(categoryId)
  var result = uploadFile(base64Data, mimeType, fileName, catPath)
  var fileInfo = { fileId: result.fileId, fileName: result.fileName, mimeType: mimeType, size: result.size || 0 }
  return _attachFileToDraft(session, fileInfo, categoryId, draftId)
}

// Chunked upload — step 1: open a resumable session. The client then uploads
// chunks directly to Drive (bypassing google.script.run's ~50MB limit).
function startResumableUpload(token, mimeType, fileName, fileSize, categoryId) {
  var session = requireAuth(token)
  _checkCreatePermission(session)
  if (!categoryId) throw new Error('Danh mục là bắt buộc')

  var catPath = _resolveCategoryPath(categoryId)
  var folderId = resolveFolderId(catPath)
  var result = initResumableUpload(mimeType, fileName, fileSize, folderId)
  return { uploadUri: result.uploadUri, accessToken: result.accessToken }
}

// Chunked upload — step 2: after the client finishes uploading all chunks,
// the server queries the resumable session for the file id (the client cannot
// read the final cross-origin response), sets sharing, attaches to the draft.
function finalizeChunkedUpload(token, uploadUri, fileName, mimeType, fileSize, categoryId, draftId) {
  var session = requireAuth(token)
  _checkCreatePermission(session)
  if (!categoryId) throw new Error('Danh mục là bắt buộc')

  var fileId = getResumableFileId(uploadUri, fileSize)
  DriveApp.getFileById(fileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  var fileInfo = { fileId: fileId, fileName: fileName, mimeType: mimeType, size: fileSize || 0 }
  return _attachFileToDraft(session, fileInfo, categoryId, draftId)
}

function finalizeDraft(token, draftId, formData, notifyTarget, keepFileIds) {
  var session = requireAuth(token)

  var docs = getSheetData(SHEETS.HO_SO)
  var draft = docs.find(function(d) { return String(d['ID']) === String(draftId) })
  if (!draft) throw new Error('Không tìm thấy hồ sơ nháp')
  if (draft['Tình trạng'] !== 'Nháp') throw new Error('Hồ sơ không ở trạng thái Nháp')
  if (draft['Người tạo'] !== session.username) throw new Error('Chỉ người tạo mới được hoàn tất hồ sơ nháp')

  var targetStatus = formData['Tình trạng'] || 'Chờ duyệt'

  // Tên hồ sơ required only when finalizing (not saving as Nháp)
  if (targetStatus !== 'Nháp' && !formData['Tên hồ sơ']) throw new Error('Tên hồ sơ là bắt buộc')

  var updates = {
    'Tên hồ sơ': formData['Tên hồ sơ'],
    'Số hồ sơ': formData['Số hồ sơ'] || '',
    'Dự án (Phòng ban)': String(formData['Dự án (Phòng ban)'] || '').trim(),
    'Nhà cung cấp (Nơi ban hành)': String(formData['Nhà cung cấp (Nơi ban hành)'] || '').trim(),
    'Ngày ban hành': formData['Ngày ban hành'] || '',
    'Ngày kết thúc': formData['Ngày kết thúc'] || '',
    'Giá trị HĐ': formData['Giá trị HĐ'] || 0,
    'Tình trạng': targetStatus,
    'Ghi chú': formData['Ghi chú'] || '',
    'Nơi lưu hồ sơ cứng': formData['Nơi lưu hồ sơ cứng'] || '',
    'Phụ trách': formData['Phụ trách'] ? JSON.stringify([String(formData['Phụ trách'])]) : '',
    'Người phối hợp': _buildAssignees(formData['Người phối hợp'], null),
    'Khẩn': formData['Khẩn'] === true || formData['Khẩn'] === 'TRUE' ? 'TRUE' : '',
    'Người cập nhật': session.username,
    'Ngày cập nhật': new Date().toISOString(),
  }

  // Always update Danh mục if provided
  if (formData['Danh mục']) updates['Danh mục'] = formData['Danh mục']

  // Xử lý gỡ file: nếu client gửi keepFileIds, trash file bị gỡ (nháp → được trash)
  // và cập nhật cột Tệp đính kèm về phần giữ lại. Không gửi → giữ nguyên (tương thích cũ).
  var existingInfos = _parseFileInfos(draft['Tệp đính kèm'])
  var keptFiles = existingInfos
  if (Array.isArray(keepFileIds)) {
    existingInfos.forEach(function(ef) {
      if (ef.fileId && keepFileIds.indexOf(ef.fileId) === -1 && _shouldTrashFile(ef, draft['Tình trạng'])) {
        deleteFile(ef.fileId)
      }
    })
    keptFiles = existingInfos.filter(function(ef) { return keepFileIds.indexOf(ef.fileId) !== -1 })
    updates['Tệp đính kèm'] = keptFiles.length > 0 ? JSON.stringify(keptFiles) : ''
    updates['Tên file'] = keptFiles.map(function(f) { return f.fileName }).join(', ')
  }

  // Move kept files if category changed
  var oldCatId = String(draft['Danh mục'] || '')
  var newCatId = String(updates['Danh mục'] || oldCatId)
  if (oldCatId !== newCatId && oldCatId !== '') {
    var newCatPath = _resolveCategoryPath(newCatId)
    Logger.log('[finalizeDraft] moving ' + keptFiles.length + ' files from cat ' + oldCatId + ' to ' + newCatId)
    // Fail-loud: move lỗi → ném trước khi ghi row, không hoàn tất nháp "nửa vời".
    keptFiles.forEach(function(f) {
      moveFile(f.fileId, newCatPath)
    })
  }

  _updateDocRow(draftId, updates, draft)
  invalidateSheetCache(SHEETS.HO_SO)

  var updated = Object.assign({}, draft, updates)
  logAudit(session, 'Tạo', 'Hồ sơ', updates['Tên hồ sơ'], JSON.stringify({ draftId: draftId }))

  // Notifications (same logic as createDocument)
  var emailError = null
  if (notifyTarget === 'directors') {
    var dirUserIds = _getDirectorUserIds()
    _markUnreadForUsers(dirUserIds, draftId)
    try {
      var dirRecipients = _getRecipientsByIds(dirUserIds)
      _sendNotificationEmails(dirRecipients, updated, 'trinhDuyet', session)
    } catch(e) {
      Logger.log('finalizeDraft trinhDuyet email error: ' + e.message)
      emailError = e.message
    }
  }
  if (notifyTarget === 'publish' && formData._publishTo) {
    try {
      publishDocument(token, draftId, formData._publishTo, formData._publishCc || [])
    } catch(e) {
      Logger.log('finalizeDraft publish email error: ' + e.message)
      emailError = e.message
    }
  }

  return { data: updated, emailError: emailError }
}

// Tạo hàng Nháp từ form (không tệp) — cho phép "Lưu nháp" trước khi upload.
// Cần ít nhất Tên hồ sơ hoặc Danh mục để tránh hàng rỗng vô nghĩa.
function createDraft(token, formData) {
  var session = requireAuth(token)
  _checkCreatePermission(session)
  if (!formData['Tên hồ sơ'] && !formData['Danh mục']) {
    throw new Error('Cần ít nhất Tên hồ sơ hoặc Danh mục để lưu nháp')
  }

  var record = {
    'Tên hồ sơ': formData['Tên hồ sơ'] || '',
    'Danh mục': formData['Danh mục'] || '',
    'Số hồ sơ': formData['Số hồ sơ'] || '',
    'Dự án (Phòng ban)': String(formData['Dự án (Phòng ban)'] || '').trim(),
    'Nhà cung cấp (Nơi ban hành)': String(formData['Nhà cung cấp (Nơi ban hành)'] || '').trim(),
    'Ngày ban hành': formData['Ngày ban hành'] || '',
    'Ngày kết thúc': formData['Ngày kết thúc'] || '',
    'Giá trị HĐ': formData['Giá trị HĐ'] || 0,
    'Tình trạng': 'Nháp',
    'Ghi chú': formData['Ghi chú'] || '',
    'Nơi lưu hồ sơ cứng': formData['Nơi lưu hồ sơ cứng'] || '',
    'Phụ trách': formData['Phụ trách'] ? JSON.stringify([String(formData['Phụ trách'])]) : '',
    'Người phối hợp': _buildAssignees(formData['Người phối hợp'], null),
    'Khẩn': formData['Khẩn'] === true || formData['Khẩn'] === 'TRUE' ? 'TRUE' : '',
    'Người tạo': session.username,
    'Người cập nhật': session.username,
    'Ngày cập nhật': new Date().toISOString(),
  }
  var added = _addDocRow(record)
  invalidateSheetCache(SHEETS.HO_SO)
  return { data: added }
}

function cancelDraft(token, draftId) {
  var session = requireAuth(token)

  var docs = getSheetData(SHEETS.HO_SO)
  var draft = docs.find(function(d) { return String(d['ID']) === String(draftId) })
  if (!draft) throw new Error('Không tìm thấy hồ sơ nháp')
  if (draft['Tình trạng'] !== 'Nháp') throw new Error('Hồ sơ không ở trạng thái Nháp')
  if (draft['Người tạo'] !== session.username) throw new Error('Chỉ người tạo mới được huỷ hồ sơ nháp')

  // Delete files from Drive — draft is Nháp, so machine uploads trash, links don't
  var fileInfos = _parseFileInfos(draft['Tệp đính kèm'])
  fileInfos.forEach(function(fi) {
    if (fi.fileId && _shouldTrashFile(fi, draft['Tình trạng'])) deleteFile(fi.fileId)
  })

  // Delete the draft row
  deleteRow(SHEETS.HO_SO, draftId)
  invalidateSheetCache(SHEETS.HO_SO)

  logAudit(session, 'Huỷ nháp', 'Hồ sơ', draft['Tên hồ sơ'] || '(nháp)', JSON.stringify({ draftId: draftId }))
  return { success: true }
}

function deleteFiles(token, fileIds) {
  requireAuth(token)
  if (!Array.isArray(fileIds)) return { success: true }
  fileIds.forEach(function(fid) {
    if (fid) deleteFile(fid)
  })
  return { success: true }
}

// ── Workflow transitions ─────────────────────────────────────────────────────

/**
 * Allowed transitions per action:
 *   Văn thư:   trinhDuyet (→ Chờ duyệt), luuTaiLieu (→ Hoàn thành)
 *   Giám đốc:  giaoViec (Chờ duyệt → Chờ xử lý), thuHoi (Chờ xử lý → Chờ duyệt)
 *   Phụ trách: nhanViec (Chờ xử lý → Đang xử lý), hoanThanh (Đang xử lý → Hoàn thành)
 *   Giám đốc:  tuChoi (Chờ duyệt → Từ chối), luuTru (Chờ duyệt → Hoàn thành)
 *   Giám đốc:  xacNhanHT (Chờ xác nhận HT → Hoàn thành), tuChoiKetQua (Chờ xác nhận HT → Từ chối kết quả)
 *   Văn thư:   trinhDuyetLai (Từ chối → Chờ duyệt)
 *   Phụ trách: hoanThanhLai (Từ chối kết quả → Chờ xác nhận HT)
 *   Admin:     all
 */
var WORKFLOW_ACTIONS = {
  trinhDuyet: { from: null, to: 'Chờ duyệt', roles: ['Văn thư'] },
  luuTaiLieu: { from: null, to: 'Hoàn thành', roles: ['Văn thư'] },
  giaoViec:   { from: 'Chờ duyệt', to: 'Chờ xử lý', roles: ['Giám đốc'] },
  thuHoi:     { from: 'Chờ xử lý', to: 'Chờ duyệt', roles: ['Giám đốc'] },
  nhanViec:       { from: 'Chờ xử lý', to: 'Đang xử lý', roles: ['_phuTrach'] },
  hoanThanh:      { from: 'Đang xử lý', to: 'Chờ xác nhận HT', roles: ['_phuTrach'] },
  hoanThanhLai:   { from: 'Từ chối kết quả', to: 'Chờ xác nhận HT', roles: ['_phuTrach'] },
  tuChoi:         { from: 'Chờ duyệt', to: 'Từ chối', roles: ['Giám đốc'] },
  ycPhatHanh:     { from: 'Chờ duyệt', to: 'YC Phát hành', roles: ['Giám đốc'] },
  luuTru:         { from: 'Chờ duyệt', to: 'Hoàn thành', roles: ['Giám đốc'] },
  xacNhanHT:      { from: 'Chờ xác nhận HT', to: 'Hoàn thành', roles: ['Giám đốc', '_kiemSoat'] },
  tuChoiKetQua:   { from: 'Chờ xác nhận HT', to: 'Từ chối kết quả', roles: ['Giám đốc', '_kiemSoat'] },
  trinhDuyetLai:  { from: 'Từ chối', to: 'Chờ duyệt', roles: ['Văn thư'] },
  // 013: Người kiểm soát thêm phối hợp (chỉ-thêm) — KHÔNG đổi trạng thái (sentinel '_keep')
  ksThemPhoiHop:  { from: '_keep', to: '_keep', roles: ['_kiemSoat'] },
}

function transitionDocument(token, id, action, data, updateData) {
  // If updateData provided, save doc edits first (reuse updateDocument)
  if (updateData && updateData.formData) {
    updateDocument(token, id, updateData.formData, updateData.fileInfos || [], updateData.keepFileIds || [], null, updateData.eagerFileInfos || [])
    invalidateSheetCache(SHEETS.HO_SO)
  }

  var session = requireAuth(token)
  var rule = WORKFLOW_ACTIONS[action]
  if (!rule) throw new Error('Hành động không hợp lệ: ' + action)

  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(id) })
  if (!doc) throw new Error('Không tìm thấy hồ sơ')

  // Admin can do anything
  var isAdmin = session.role === 'admin' || session.role === 'Quản trị viên'
  if (!isAdmin) {
    // Check role
    var allowed = false
    for (var i = 0; i < rule.roles.length; i++) {
      if (rule.roles[i] === '_phuTrach') {
        var assignees = _parseAssignees(doc['Phụ trách'])
        if (assignees.indexOf(String(session.userId)) !== -1 || assignees.indexOf(session.username) !== -1) {
          allowed = true
        }
      } else if (rule.roles[i] === '_kiemSoat') {
        if (_isController(doc, session)) allowed = true
      } else if (session.role === rule.roles[i]) {
        allowed = true
      }
    }
    if (!allowed) throw new Error('Bạn không có quyền thực hiện hành động này')

    // Check current status (null = any status; '_keep' = ràng buộc riêng theo action)
    if (rule.from === '_keep') {
      if (action === 'ksThemPhoiHop' && doc['Tình trạng'] !== 'Chờ xử lý' && doc['Tình trạng'] !== 'Đang xử lý') {
        throw new Error('Chỉ thêm người phối hợp khi hồ sơ ở "Chờ xử lý" hoặc "Đang xử lý"')
      }
    } else if (rule.from && doc['Tình trạng'] !== rule.from) {
      throw new Error('Hồ sơ đang ở trạng thái "' + doc['Tình trạng'] + '", không thể ' + action)
    }
  }

  var updates = {
    'Tình trạng': rule.to === '_keep' ? doc['Tình trạng'] : rule.to,
    'Người cập nhật': session.username,
    'Ngày cập nhật': new Date().toISOString(),
  }

  // Giao việc: require Phụ trách; nội dung giao việc (tùy chọn) lưu chung cột 'Lý do từ chối'
  if (action === 'giaoViec') {
    data = data || {}
    if (!data['Phụ trách']) throw new Error('Phải chọn người phụ trách')
    updates['Phụ trách'] = JSON.stringify([String(data['Phụ trách'])])
    var _gvPH = (data['Người phối hợp'] !== undefined) ? _buildAssignees(data['Người phối hợp'], null) : (doc['Người phối hợp'] || '')
    var _gvNoiDung = (data['Nội dung'] || '').trim()
    // Có ≥1 người phối hợp thì nội dung giao việc bắt buộc (chặn ở server)
    if (_parseAssignees(_gvPH).length >= 1 && !_gvNoiDung) throw new Error('Phải nhập nội dung giao việc khi có người phối hợp')
    if (data['Người phối hợp'] !== undefined) {
      updates['Người phối hợp'] = _buildAssignees(data['Người phối hợp'], null)
    }
    updates['Nội dung giao việc'] = _gvNoiDung
    // 013: Người kiểm soát (tuỳ chọn). giaoViec vốn chỉ GĐ/admin thực hiện → chỉ họ ghi được (FR-007).
    // Lưu chuẩn theo UserID (data-model): map định danh picker (Tên đăng nhập/email/id) → UserID.
    if (data['Người kiểm soát'] !== undefined) {
      if (data['Người kiểm soát']) {
        var _ksRaw = String(data['Người kiểm soát'])
        var _ksMap = _getDocUserIdMap()
        updates['Người kiểm soát'] = JSON.stringify([String(_ksMap[_ksRaw] != null ? _ksMap[_ksRaw] : _ksRaw)])
      } else {
        updates['Người kiểm soát'] = ''
      }
    }
  }

  // 013: Người kiểm soát thêm phối hợp (chỉ-thêm, KHÔNG đổi trạng thái, PT bất biến)
  if (action === 'ksThemPhoiHop') {
    data = data || {}
    if (data['Người phối hợp'] === undefined) throw new Error('Thiếu danh sách người phối hợp')
    var _ksNewStr = _buildAssignees(data['Người phối hợp'], null)
    var _ksOld = _parseAssignees(doc['Người phối hợp'])
    var _ksNew = _parseAssignees(_ksNewStr)
    if (!isAdmin) {
      for (var _ksI = 0; _ksI < _ksOld.length; _ksI++) {
        if (_ksNew.indexOf(_ksOld[_ksI]) === -1) throw new Error('Không thể xoá người phối hợp đã có')
      }
    }
    var _ksAdded = _ksNew.filter(function(u) { return _ksOld.indexOf(u) === -1 })
    var _ksNoiDung = (data['Nội dung'] || '').trim()
    if (_ksAdded.length >= 1 && !_ksNoiDung) throw new Error('Phải nhập nội dung gửi tới người phối hợp')
    updates['Người phối hợp'] = _ksNewStr
    if (_ksAdded.length >= 1) updates['Nội dung phối hợp'] = _ksNoiDung
  }

  // Phụ trách (người chủ trì) nhận việc: CHỈ được thêm người phối hợp, không xoá người đã có
  if (action === 'nhanViec' && data && data['Người phối hợp'] !== undefined) {
    var _nvNewStr = _buildAssignees(data['Người phối hợp'], null)
    var _nvOld = _parseAssignees(doc['Người phối hợp'])
    var _nvNew = _parseAssignees(_nvNewStr)
    if (!isAdmin) {
      for (var _nvI = 0; _nvI < _nvOld.length; _nvI++) {
        if (_nvNew.indexOf(_nvOld[_nvI]) === -1) throw new Error('Không thể xoá người phối hợp đã có')
      }
    }
    var _nvAdded = _nvNew.filter(function(u) { return _nvOld.indexOf(u) === -1 })
    var _nvNoiDung = (data['Nội dung'] || '').trim()
    // Có bổ sung người phối hợp mới thì nội dung gửi họ bắt buộc
    if (_nvAdded.length >= 1 && !_nvNoiDung) throw new Error('Phải nhập nội dung gửi tới người phối hợp')
    updates['Người phối hợp'] = _nvNewStr
    if (_nvAdded.length >= 1) updates['Nội dung phối hợp'] = _nvNoiDung
  }

  // tuChoi / tuChoiKetQua / ycPhatHanh: require reason
  if (action === 'tuChoi' || action === 'tuChoiKetQua' || action === 'ycPhatHanh') {
    data = data || {}
    if (!data['lyDoTuChoi']) throw new Error(action === 'ycPhatHanh' ? 'Vui lòng nhập lý do yêu cầu phát hành' : 'Vui lòng nhập lý do từ chối')
    updates['Lý do từ chối'] = data['lyDoTuChoi']
  }

  // trinhDuyetLai / hoanThanh / hoanThanhLai: clear rejection reason
  if (action === 'trinhDuyetLai' || action === 'hoanThanh' || action === 'hoanThanhLai') {
    updates['Lý do từ chối'] = ''
  }

  _updateDocRow(id, updates, doc)
  var updated = Object.assign({}, doc, updates)

  // giaoViec: TO = Phụ trách, CC = Người phối hợp
  var emailError = null
  if (action === 'giaoViec') {
    var phuTrachUsers = _parseAssignees(updates['Phụ trách'])
    var phoiHopUsers  = _parseAssignees(updates['Người phối hợp'] || doc['Người phối hợp'])
    var _excludeSelf = function(uid) { return String(uid) !== String(session.userId) && uid !== session.username }
    // 013: Người kiểm soát MỚI (khác giá trị cũ, không phải người thao tác) → nhận CHUÔNG +
    // EMAIL GIAO VIỆC CHUNG (CC). KHÔNG gửi mail riêng; đoạn [[...]] trong body đã nói về NKS.
    var _ksOldArr = _parseAssignees(doc['Người kiểm soát'])
    var _ksNewArr = _parseAssignees(updates['Người kiểm soát'] !== undefined ? updates['Người kiểm soát'] : doc['Người kiểm soát'])
    var _ksNewId = (_ksNewArr.length > 0 && _ksOldArr.indexOf(_ksNewArr[0]) === -1 && _excludeSelf(_ksNewArr[0])) ? _ksNewArr[0] : null
    phuTrachUsers = phuTrachUsers.filter(_excludeSelf)
    phoiHopUsers  = phoiHopUsers.filter(_excludeSelf)
    var _ccUsers = phoiHopUsers.slice()
    if (_ksNewId && phuTrachUsers.indexOf(_ksNewId) === -1 && _ccUsers.indexOf(_ksNewId) === -1) _ccUsers.push(_ksNewId)
    var _bell = phuTrachUsers.concat(phoiHopUsers)
    if (_ksNewId) _bell.push(_ksNewId)
    _markUnreadForUsers(_bell, id)
    try {
      var toList = _getRecipientsByUsernames(phuTrachUsers)
      var ccList = _getRecipientsByUsernames(_ccUsers)
      _sendNotificationEmails(toList, updated, 'giaoViec', session, ccList)
    } catch(e) { Logger.log('transitionDocument giaoViec email error: ' + e.message); emailError = e.message }
  } else if (action === 'tuChoi') {
    // tuChoi: notify doc creator
    var creator = doc['Người tạo']
    if (creator) {
      _markUnreadForUsers([creator], id)
      try {
        var toRecipients = _getRecipientsByUsernames([creator])
        _sendNotificationEmails(toRecipients, updated, 'tuChoi', session)
      } catch(e) { Logger.log('transitionDocument tuChoi email error: ' + e.message); emailError = e.message }
    }
  } else if (action === 'ycPhatHanh') {
    // ycPhatHanh: notify doc creator
    var ycCreator = doc['Người tạo']
    if (ycCreator) {
      _markUnreadForUsers([ycCreator], id)
      var ycRecipients = _getRecipientsByUsernames([ycCreator])
      _sendNotificationEmails(ycRecipients, updated, 'ycPhatHanh', session)
    }
  } else if (action === 'tuChoiKetQua') {
    // tuChoiKetQua: notify PT (TO) + CC GĐ — để GĐ nắm khi NKS (hoặc GĐ khác) từ chối kết quả.
    // Loại người thao tác khỏi CC (GĐ tự từ chối thì không tự gửi cho mình).
    var assignees = _parseAssignees(doc['Phụ trách'])
    var _tcExSelf = function(u) { return String(u) !== String(session.userId) && u !== session.username }
    var _tcDirCc = _getDirectorUserIds().filter(_tcExSelf)
    if (assignees.length > 0) {
      _markUnreadForUsers(assignees, id)
      try {
        var ptRecipients = _getRecipientsByUsernames(assignees)
        var _tcCc = _tcDirCc.length ? _getRecipientsByIds(_tcDirCc) : []
        _sendNotificationEmails(ptRecipients, updated, 'tuChoiKetQua', session, _tcCc)
      } catch(e) { Logger.log('transitionDocument tuChoiKetQua email error: ' + e.message); emailError = e.message }
    }
  } else if (action === 'hoanThanh' || action === 'hoanThanhLai') {
    // hoanThanh/hoanThanhLai → "Chờ xác nhận HT": báo chuông cho GĐ VÀ Người kiểm soát
    // (013: NKS cũng có quyền xác nhận HT/từ chối kết quả nên phải được báo như GĐ). Không gửi email.
    var dirIds = _getDirectorUserIds()
    var ksIds = _parseAssignees(doc['Người kiểm soát'])
    var htRecipients = dirIds.concat(ksIds).filter(function(u) {
      return String(u) !== String(session.userId) && u !== session.username
    })
    if (htRecipients.length > 0) {
      _markUnreadForUsers(htRecipients, id)
    }
  } else if (action === 'trinhDuyetLai') {
    // trinhDuyetLai: notify all GĐ (reuse trinhDuyet pattern)
    var dirUserIds = _getDirectorUserIds()
    if (dirUserIds.length > 0) {
      _markUnreadForUsers(dirUserIds, id)
      try {
        var dirRecipients = _getRecipientsByIds(dirUserIds)
        _sendNotificationEmails(dirRecipients, updated, 'trinhDuyet', session)
      } catch(e) { Logger.log('transitionDocument trinhDuyetLai email error: ' + e.message); emailError = e.message }
    }
  } else if (action === 'nhanViec' && updates['Người phối hợp']) {
    // nhanViec: đánh dấu unread + gửi email template phối hợp cho người phối hợp MỚI (họ là người nhận chính)
    var oldPhoiHop = _parseAssignees(doc['Người phối hợp'])
    var newPhoiHop = _parseAssignees(updates['Người phối hợp'])
    var _nvExSelf = function(u) { return String(u) !== String(session.userId) && u !== session.username }
    var addedUsers = newPhoiHop.filter(function(u) { return oldPhoiHop.indexOf(u) === -1 }).filter(_nvExSelf)
    if (addedUsers.length > 0) {
      _markUnreadForUsers(addedUsers, id)
      try {
        for (var _nvK = 0; _nvK < addedUsers.length; _nvK++) {
          var _nvRcpt = _getRecipientsByUsernames([addedUsers[_nvK]])
          _sendNotificationEmails(_nvRcpt, updated, 'phoiHop', session)
        }
      } catch(e) { Logger.log('transitionDocument nhanViec phoiHop email error: ' + e.message); emailError = e.message }
    }
  } else if (action === 'ksThemPhoiHop' && updates['Người phối hợp']) {
    // 013: NKS thêm phối hợp → gửi email phối hợp cho người phối hợp MỚI (mirror nhanViec)
    var _ksOldPH = _parseAssignees(doc['Người phối hợp'])
    var _ksNewPH = _parseAssignees(updates['Người phối hợp'])
    var _ksExSelf = function(u) { return String(u) !== String(session.userId) && u !== session.username }
    var _ksAddedPH = _ksNewPH.filter(function(u) { return _ksOldPH.indexOf(u) === -1 }).filter(_ksExSelf)
    if (_ksAddedPH.length > 0) {
      _markUnreadForUsers(_ksAddedPH, id)
      try {
        for (var _ksK = 0; _ksK < _ksAddedPH.length; _ksK++) {
          _sendNotificationEmails(_getRecipientsByUsernames([_ksAddedPH[_ksK]]), updated, 'phoiHop', session)
        }
      } catch(e) { Logger.log('transitionDocument ksThemPhoiHop phoiHop email error: ' + e.message); emailError = e.message }
    }
  }

  logAudit(session, action, 'Hồ sơ', doc['Tên hồ sơ'], JSON.stringify({ id: id, from: doc['Tình trạng'], to: rule.to }))
  // Double-invalidate: updateRow already invalidates, but GAS CacheService
  // remove() has eventual consistency — re-invalidate before returning to
  // ensure the next getSheetData call reads fresh data from the sheet.
  invalidateSheetCache(SHEETS.HO_SO)
  return { data: updated, emailError: emailError }
}

// ── Publish (phát hành) ─────────────────────────────────────────────────────

function publishDocument(token, docId, toUserIds, ccUserIds) {
  var session = requireAuth(token)

  // Check publish permission
  var roles = getSheetData(SHEETS.APP_ROLES)
  var appRole = roles.find(function(r) { return r['AppID'] === APP_ID && String(r['UserID']) === String(session.userId) })
  var role = appRole ? appRole['Quyền'] : ''
  var isAdminOrVanThu = (role === 'admin' || role === 'Quản trị viên' || role === 'Giám đốc' || role === 'Văn thư')
  if (!isAdminOrVanThu && !(appRole && (appRole['Được phát hành'] === 'TRUE' || appRole['Được phát hành'] === true))) {
    throw new Error('Bạn không có quyền phát hành')
  }

  // Load document
  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(docId) })
  if (!doc) throw new Error('Không tìm thấy hồ sơ')

  // Build recipient lists from user IDs (lookup from SSO _Người Dùng)
  var toRecipients = _getRecipientsByIds(toUserIds)
  var ccRecipients = ccUserIds ? _getRecipientsByIds(ccUserIds) : []

  if (toRecipients.length === 0) throw new Error('Vui lòng chọn ít nhất một người nhận')

  // Send email
  _sendNotificationEmails(toRecipients, doc, 'phatHanh', session, ccRecipients)

  // Mark unread for all recipients (bell notification)
  var allUserIds = toUserIds.concat(ccUserIds || [])
  _markUnreadForUsers(allUserIds, docId)

  // Append to publish history
  var history = []
  if (doc['Lịch sử phát hành']) {
    try { history = JSON.parse(doc['Lịch sử phát hành']) } catch(e) {}
  }
  history.push({
    lan: history.length + 1,
    ngay: new Date().toISOString(),
    nguoiGui: session.name || session.username,
    to: toRecipients.map(function(r) { return { id: r.userId, name: r.name, email: r.email } }),
    cc: ccRecipients.map(function(r) { return { id: r.userId, name: r.name, email: r.email } })
  })
  var publishUpdates = { 'Lịch sử phát hành': JSON.stringify(history) }
  // YC Phát hành → Hoàn thành after publish
  if (doc['Tình trạng'] === 'YC Phát hành') {
    publishUpdates['Tình trạng'] = 'Hoàn thành'
    publishUpdates['Lý do từ chối'] = ''
  }
  // FR-005 (revise 2026-06-19): VT/GĐ/admin phát hành → LUÔN thêm mọi người nhận (TO+CC)
  // vào "Người được xem", KỂ CẢ khi danh sách rỗng. Theo mô hình snapshot, rỗng = chưa nhân
  // viên nào thấy (chỉ toàn quyền + người tham gia) nên cộng người nhận không khóa nhầm ai.
  // Người chỉ có cờ "Được phát hành" → chỉ gửi mail.
  if (isAdminOrVanThu) {
    var newViewers = _parseAssignees(doc['Người được xem'])
    var addedViewer = false
    allUserIds.forEach(function(rid) {
      rid = String(rid)
      if (newViewers.indexOf(rid) === -1) { newViewers.push(rid); addedViewer = true }
    })
    if (addedViewer) publishUpdates['Người được xem'] = JSON.stringify(newViewers)
  }
  _updateDocRow(docId, publishUpdates)
  var updated = Object.assign({}, doc, publishUpdates)

  return { success: true, lan: history.length, data: updated }
}

// Đặt phân quyền XEM cho tài liệu — TÁCH khỏi luồng sửa hồ sơ, nên đặt được kể cả khi
// tài liệu đã Hoàn thành (đã khóa sửa). Chỉ vai trò toàn quyền (admin/QTV/GĐ/VT).
function setDocumentViewers(token, docId, nguoiDuocXem) {
  var session = requireAuth(token)
  var FULL_ACCESS = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  if (FULL_ACCESS.indexOf(session.role) === -1) {
    throw new Error('Bạn không có quyền phân quyền xem tài liệu')
  }
  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(docId) })
  if (!doc) throw new Error('Không tìm thấy hồ sơ')
  var oldViewers = _parseAssignees(doc['Người được xem'])
  var newViewers = _parseAssignees(nguoiDuocXem)
  var updates = {
    'Người được xem': nguoiDuocXem || '',
    'Người cập nhật': session.username,
    'Ngày cập nhật': new Date().toISOString(),
  }
  _updateDocRow(docId, updates)
  // Báo (unread) cho những người MỚI được thêm vào danh sách xem — không re-báo người đã có.
  var addedViewers = newViewers.filter(function(v) { return oldViewers.indexOf(v) === -1 })
  if (addedViewers.length) _markUnreadForUsers(addedViewers, docId)
  logAudit(session, 'Phân quyền xem', 'Hồ sơ', doc['Tên hồ sơ'], JSON.stringify({ id: docId }))
  return { data: Object.assign({}, doc, updates) }
}

// ── Comment functions ────────────────────────────────────────────────────────

function getComments(token, docId) {
  requireAuth(token)
  var comments = getSheetData(SHEETS.COMMENTS)
  return {
    data: comments.filter(function(c) { return String(c['DocID']) === String(docId) })
  }
}

function addComment(token, docId, content) {
  var session = requireAuth(token)
  if (!content || !String(content).trim()) throw new Error('Nội dung không được để trống')

  var COMMENT_ROLES = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  if (COMMENT_ROLES.indexOf(session.role) === -1) {
    var allDocs = getSheetData(SHEETS.HO_SO)
    var targetDoc = allDocs.find(function(d) { return String(d['ID']) === String(docId) })
    if (!targetDoc) throw new Error('Không tìm thấy hồ sơ')
    var docAssignees = _parseAssignees(targetDoc['Phụ trách'])
    var docCollaborators = _parseAssignees(targetDoc['Người phối hợp'])
    var uid = String(session.userId)
    if (docAssignees.indexOf(uid) === -1 && docAssignees.indexOf(session.username) === -1 &&
        docCollaborators.indexOf(uid) === -1 && docCollaborators.indexOf(session.username) === -1) {
      throw new Error('Bạn không có quyền bình luận')
    }
  }

  var record = {
    'DocID': docId,
    'UserID': session.userId,
    'Tên người dùng': session.username,
    'Nội dung': String(content).trim(),
    'Thời gian': new Date().toISOString(),
  }
  var added = addRow(SHEETS.COMMENTS, record)

  // Clear DA_DOC for all assignees except commenter (doc becomes unread for others)
  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(docId) })
  if (doc) {
    var assignees = _parseAssignees(doc['Phụ trách'])
    var daDocRows = getSheetData(SHEETS.DA_DOC)
    assignees.forEach(function(uid) {
      if (String(uid) !== String(session.userId) && uid !== session.username) {
        var entries = daDocRows.filter(function(r) {
          return (String(r['UserID']) === String(uid) || r['UserID'] === uid) && String(r['DocID']) === String(docId)
        })
        entries.forEach(function(r) { _coreDeleteRow(SHEETS.DA_DOC, r['ID']) })
      }
    })
  }

  logAudit(session, 'Bình luận', 'Hồ sơ', String(docId), String(content).trim().substring(0, 100))
  return { data: added }
}
