#!/usr/bin/env node
/**
 * Obfuscate dist/gas/Code.js using javascript-obfuscator.
 * Usage: node scripts/obfuscate.js --app <name>
 */
const JavaScriptObfuscator = require('javascript-obfuscator')
const fs    = require('fs')
const path  = require('path')

const appIdx = process.argv.indexOf('--app')
const appName = appIdx !== -1 ? process.argv[appIdx + 1] : null
if (!appName) {
  console.error('Usage: node scripts/obfuscate.js --app <name>')
  process.exit(1)
}

const rootDir = path.resolve(__dirname, '..')
const appDir  = path.join(rootDir, 'apps', appName)
const cfgPath = path.join(appDir, 'obfuscator.config.js')
const cfg     = fs.existsSync(cfgPath) ? require(cfgPath) : {}

const SRC  = path.join(appDir, 'dist', 'gas', 'Code.js')
const DEST = SRC

if (!fs.existsSync(SRC)) {
  console.error(`apps/${appName}/dist/gas/Code.js not found. Run build:server first.`)
  process.exit(1)
}

const code = fs.readFileSync(SRC, 'utf8')
const result = JavaScriptObfuscator.obfuscate(code, cfg)
fs.writeFileSync(DEST, result.getObfuscatedCode(), 'utf8')

const origSize = Buffer.byteLength(code, 'utf8')
const newSize  = Buffer.byteLength(result.getObfuscatedCode(), 'utf8')
console.log(`Obfuscated: ${(origSize / 1024).toFixed(1)} KB → ${(newSize / 1024).toFixed(1)} KB`)
