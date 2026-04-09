// ===== License Server — Local Dev Server =====
//
// Mocks GAS APIs and runs an HTTP server at localhost:3001
// Dùng require() để VS Code debugger đặt breakpoint được trong main.js
//
// Usage: npm run dev:license  (hoặc F5 với config "License Server")

var http = require('http')
var url  = require('url')
var querystring = require('querystring')
var crypto = require('crypto')

var PORT = 3001

// ── In-memory Sheet data ─────────────────────────────────────────────────────

var MOCK_SECRET_SALT = 'dev_salt_for_testing_123'

// Hash password for mock admin: sha256("admin123" + MOCK_SECRET_SALT)
function mockHash(password) {
  return crypto.createHash('sha256').update(password + MOCK_SECRET_SALT, 'utf8').digest('hex')
}

var sheetDB = {
  'Whitelist': {
    headers: ['Email', 'App', 'Ver', 'Ngày thêm', 'Thêm bởi', 'Ghi chú'],
    rows: [
      ['admin@example.com', '*', '*', '01/01/2025 00:00', 'system', 'Default'],
      ['user@example.com', 'docmgr', '*', '15/01/2025 10:30', 'admin@example.com', 'Test user']
    ]
  },
  'Audit Logs': {
    headers: ['Thời gian', 'Email', 'Hành động', 'Chi tiết', 'IP/User'],
    rows: [
      ['01/01/2025 00:00:00', 'system', 'Khởi tạo', 'Dev server started', '']
    ]
  },
  'Admins': {
    headers: ['Email', 'Password Hash', 'Role', 'Ngày thêm'],
    rows: [
      ['admin@example.com', '', 'owner', '01/01/2025 00:00'],
      ['staff@example.com', mockHash('admin123'), 'admin', '01/01/2025 00:00']
    ]
  }
}

// ── In-memory UserProperties (per-user session) ─────────────────────────────

var userPropsStore = {}

// ── GAS Mocks ────────────────────────────────────────────────────────────────

var MOCK_EMAIL = 'admin@example.com'
var MOCK_SCRIPT_URL = 'http://localhost:' + PORT

function createMockSheet(tabName) {
  if (!sheetDB[tabName]) {
    sheetDB[tabName] = { headers: [], rows: [] }
  }
  var tab = sheetDB[tabName]

  return {
    getLastRow: function() { return tab.rows.length + 1 },
    getRange: function(row, col, numRows, numCols) {
      return {
        getValues: function() {
          var result = []
          for (var r = row - 2; r < row - 2 + numRows && r < tab.rows.length; r++) {
            if (r < 0) continue
            var rowData = []
            for (var c = col - 1; c < col - 1 + (numCols || 1); c++) {
              rowData.push(tab.rows[r] && tab.rows[r][c] !== undefined ? tab.rows[r][c] : '')
            }
            result.push(rowData)
          }
          return result
        },
        setFontWeight: function() { return this }
      }
    },
    appendRow: function(data) { tab.rows.push(data) },
    deleteRow: function(rowNum) { tab.rows.splice(rowNum - 2, 1) },
    setFrozenRows: function() {}
  }
}

function createMockSpreadsheet() {
  return {
    getSheetByName: function(name) {
      if (sheetDB[name]) return createMockSheet(name)
      return null
    },
    insertSheet: function(name) {
      sheetDB[name] = { headers: [], rows: [] }
      return createMockSheet(name)
    }
  }
}

global.SpreadsheetApp = {
  getActiveSpreadsheet: function() { return createMockSpreadsheet() },
  openById: function() { return createMockSpreadsheet() }
}

global.Session = {
  getActiveUser: function() {
    return { getEmail: function() { return MOCK_EMAIL } }
  }
}

global.PropertiesService = {
  getScriptProperties: function() {
    return {
      getProperty: function(key) {
        var props = {
          SECRET_SALT: MOCK_SECRET_SALT
        }
        return props[key] || null
      }
    }
  },
  getUserProperties: function() {
    return {
      getProperty: function(key) { return userPropsStore[key] || null },
      setProperty: function(key, val) { userPropsStore[key] = val },
      deleteProperty: function(key) { delete userPropsStore[key] }
    }
  }
}

global.Utilities = {
  formatDate: function(date, tz, format) {
    var d = new Date(date)
    var pad = function(n) { return n < 10 ? '0' + n : '' + n }
    if (format.indexOf('HH:mm:ss') >= 0) {
      return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear()
        + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
    }
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear()
      + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  },
  computeDigest: function(algo, input, charset) {
    var crypto = require('crypto')
    var hash = crypto.createHash('sha256').update(input, 'utf8').digest()
    var result = []
    for (var i = 0; i < hash.length; i++) {
      var b = hash[i]
      result.push(b > 127 ? b - 256 : b)
    }
    return result
  },
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' }
}

global.HtmlService = {
  createHtmlOutput: function(html) {
    return {
      _html: html,
      _title: '',
      getContent: function() { return this._html },
      setTitle: function(t) { this._title = t; return this }
    }
  }
}

global.ScriptApp = {
  getService: function() {
    return { getUrl: function() { return MOCK_SCRIPT_URL } }
  }
}

// ── Load main.js via require() — breakpoints work! ──────────────────────────

var main = require('./main.js')
global.doGet = main.doGet
global.doPost = main.doPost

// ── HTTP Server ──────────────────────────────────────────────────────────────

var server = http.createServer(function(req, res) {
  var parsed = url.parse(req.url, true)

  if (parsed.pathname === '/favicon.ico') {
    res.writeHead(204)
    res.end()
    return
  }

  try {
    if (req.method === 'POST') {
      var body = ''
      req.on('data', function(chunk) { body += chunk.toString() })
      req.on('end', function() {
        try {
          var params = querystring.parse(body)
          var result = doPost({ parameter: params })
          sendResponse(res, result)
        } catch (err) {
          sendError(res, err)
        }
      })
    } else {
      var result = doGet({ parameter: parsed.query || {} })
      sendResponse(res, result)
    }
  } catch (err) {
    sendError(res, err)
  }
})

function sendResponse(res, result) {
  if (result && typeof result.getContent === 'function') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(result.getContent())
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(String(result))
  }
}

function sendError(res, err) {
  console.error(err)
  res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end('<h1>Error</h1><pre>' + String(err.stack || err.message).replace(/</g, '&lt;') + '</pre>')
}

server.listen(PORT, function() {
  console.log('')
  console.log('  🔑 License Server (dev) running at:')
  console.log('  ➜  http://localhost:' + PORT)
  console.log('  ➜  Mock owner: ' + MOCK_EMAIL + ' (auto-login)')
  console.log('  ➜  Mock admin: staff@example.com / admin123')
  console.log('')
  console.log('  💡 Đặt breakpoint trong main.js rồi nhấn F5!')
  console.log('')
})
