// ===== Base configuration helpers =====

function _getProps() {
  return PropertiesService.getScriptProperties()
}

function getConfig(key) {
  return _getProps().getProperty(key)
}

function setConfig(key, value) {
  _getProps().setProperty(key, value)
}

function getAppSheet() {
  return SpreadsheetApp.getActiveSpreadsheet()
}

function getCentralSheet() {
  var centralId = getConfig('CENTRAL_SHEET_ID')
  if (centralId) {
    return SpreadsheetApp.openById(centralId)
  }
  return SpreadsheetApp.getActiveSpreadsheet()
}

function getSheet(sheetName) {
  var isCentral = sheetName.startsWith('_')
  var ss = isCentral ? getCentralSheet() : getAppSheet()
  var sheet = ss.getSheetByName(sheetName)
  if (!sheet) throw new Error('Sheet không tồn tại: ' + sheetName)
  return sheet
}

function _hashPassword(username, password) {
  var raw = username + password
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw)
  return bytes.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2)
  }).join('')
}
