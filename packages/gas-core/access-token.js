// ===== Access token — short-lived (30 min), cache + sheet =====

var ACCESS_TOKEN_TTL = 1800 // 30 min

function mintAccessToken(sessionData, usersSheetName) {
  if (!sessionData) throw new Error('mintAccessToken: sessionData required')
  var token = generateUuid()
  cachePut('at_' + token, sessionData, ACCESS_TOKEN_TTL)
  if (usersSheetName && sessionData.userId) {
    updateRow(usersSheetName, sessionData.userId, {
      'AccessToken': token,
      'AccessTokenExpiry': new Date().getTime() + ACCESS_TOKEN_TTL * 1000,
    })
  }
  return token
}

function validateAccessToken(token) {
  if (!token) return null
  var session = cacheGet('at_' + token)
  if (!session) return null
  cachePut('at_' + token, session, ACCESS_TOKEN_TTL)
  return session
}

function validateAccessTokenCrossScript(parentSheetId, token) {
  if (!token || !parentSheetId) return null
  var ss = SpreadsheetApp.openById(parentSheetId)
  var sheet = ss.getSheetByName('_Người Dùng')
  if (!sheet) return null
  var data = sheet.getDataRange().getValues()
  var headers = data[0]
  var col = {
    id: headers.indexOf('ID'),
    username: headers.indexOf('Tên đăng nhập'),
    email: headers.indexOf('Email'),
    name: headers.indexOf('Tên nhân viên'),
    status: headers.indexOf('Trạng thái'),
    dept: headers.indexOf('Phòng ban'),
    at: headers.indexOf('AccessToken'),
    exp: headers.indexOf('AccessTokenExpiry'),
  }
  if (col.at === -1) return null
  for (var i = 1; i < data.length; i++) {
    if (data[i][col.at] === token) {
      if (Number(data[i][col.exp]) < new Date().getTime()) return null
      if (data[i][col.status] === 'Locked') return null
      return {
        userId: data[i][col.id],
        username: data[i][col.username],
        email: data[i][col.email],
        name: data[i][col.name] || data[i][col.username] || '',
        department: data[i][col.dept] || '',
      }
    }
  }
  return null
}

function revokeAccessToken(token) {
  if (token) cacheRemove('at_' + token)
}
