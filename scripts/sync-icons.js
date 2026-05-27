#!/usr/bin/env node
/**
 * Scan client source for Material Symbols icon names and update the
 * Google Fonts <link> in index.html so the icon_names list stays in sync.
 *
 * Usage:  node scripts/sync-icons.js --app docmgr
 *         node scripts/sync-icons.js              (all apps)
 */
var fs = require('fs')
var path = require('path')

var appsDir = path.resolve(__dirname, '..', 'apps')

var targetApp = null
var args = process.argv.slice(2)
for (var i = 0; i < args.length; i++) {
  if (args[i] === '--app' && args[i + 1]) targetApp = args[i + 1]
}

var apps = targetApp ? [targetApp] : fs.readdirSync(appsDir).filter(function (d) {
  return fs.statSync(path.join(appsDir, d)).isDirectory()
})

var IGNORE = new Set([
  'name', 'icon', 'label', 'value', 'type', 'id', 'ref', 'src',
  'data', 'class', 'style', 'title', 'role', 'href', 'div', 'span',
  'true', 'false', 'null', 'undefined', 'default', 'export', 'import',
  'return', 'function', 'const', 'var', 'let', 'if', 'else',
])

apps.forEach(function (app) {
  var htmlPath = path.join(appsDir, app, 'src', 'client', 'index.html')
  if (!fs.existsSync(htmlPath)) return

  var html = fs.readFileSync(htmlPath, 'utf8')
  if (html.indexOf('Material+Symbols') === -1) return

  var clientDir = path.join(appsDir, app, 'src', 'client')
  var icons = collectIcons(clientDir)
  if (icons.length === 0) return

  var updated = html.replace(
    /icon_names=[^&"]+/,
    'icon_names=' + icons.join(',')
  )

  if (updated !== html) {
    fs.writeFileSync(htmlPath, updated)
    console.log('[sync-icons] ' + app + ': updated ' + icons.length + ' icons')
  } else {
    console.log('[sync-icons] ' + app + ': already in sync (' + icons.length + ' icons)')
  }
})

function collectIcons(dir) {
  var found = new Set()
  walk(dir)
  IGNORE.forEach(function (w) { found.delete(w) })
  return Array.from(found).sort()

  function walk(d) {
    fs.readdirSync(d).forEach(function (name) {
      var full = path.join(d, name)
      if (fs.statSync(full).isDirectory()) return walk(full)
      if (!/\.(jsx?|tsx?)$/.test(name)) return

      var src = fs.readFileSync(full, 'utf8')

      var m

      // Pattern 1a: JSX props — name="foo", icon="foo", icon: 'foo'
      var re1 = /\b(?:name|icon)\s*[:=]\s*["']([a-z][a-z0-9_]*)["']/g
      while ((m = re1.exec(src)) !== null) found.add(m[1])

      // Pattern 1b: Expressions in JSX — name={cond ? 'foo' : 'bar'}, name={obj['foo']}
      var re1b = /\b(?:name|icon)\s*=\s*\{([^}]+)\}/g
      while ((m = re1b.exec(src)) !== null) {
        var inner = m[1]
        var re1c = /['"]([a-z][a-z0-9_]*)['"]/g
        var m2
        while ((m2 = re1c.exec(inner)) !== null) found.add(m2[1])
      }

      // Pattern 2: <span class="material-symbols-outlined ...">content</span>
      //            Content may be on the same or next lines, may contain ternary expressions
      var re2 = /material.symbols.outlined[\s\S]*?>([\s\S]*?)<\//g
      while ((m = re2.exec(src)) !== null) {
        var content = m[1].trim()
        var re2b = /['"]?([a-z][a-z0-9_]*)['"]?/g
        var m3
        while ((m3 = re2b.exec(content)) !== null) {
          if (!IGNORE.has(m3[1])) found.add(m3[1])
        }
      }

      // Pattern 3: Array lines with 3+ quoted icon-like strings (e.g. ICON_OPTIONS)
      var re3 = /['"]([a-z][a-z0-9_]*)['"]/g
      src.split('\n').forEach(function (line) {
        if (!/^\s*['"]/.test(line)) return
        var names = []
        while ((m = re3.exec(line)) !== null) names.push(m[1])
        if (names.length >= 3 && names.every(function (n) { return /^[a-z][a-z0-9_]*$/.test(n) })) {
          names.forEach(function (n) { found.add(n) })
        }
      })
    })
  }
}
