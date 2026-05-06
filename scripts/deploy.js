#!/usr/bin/env node
/**
 * Build + push + deploy to GAS.
 * Usage: node scripts/deploy.js --app <name>
 *
 * Reads DEPLOYMENT_ID from apps/<name>/.env to update existing deployment.
 * If not set, creates a new deployment and prints the ID to add to .env.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const appIdx = process.argv.indexOf('--app')
const appName = appIdx !== -1 ? process.argv[appIdx + 1] : null
if (!appName) {
  console.error('Usage: node scripts/deploy.js --app <name>')
  process.exit(1)
}

const rootDir = path.resolve(__dirname, '..')
const appDir  = path.join(rootDir, 'apps', appName)
const clasp   = path.join(rootDir, 'node_modules', '.bin', 'clasp')

if (!fs.existsSync(appDir)) {
  console.error(`App not found: apps/${appName}`)
  process.exit(1)
}

// Read .env
function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {}
  return fs.readFileSync(filePath, 'utf8').split('\n').reduce((acc, line) => {
    const m = line.match(/^([A-Z_]+)=(.+)$/)
    if (m) acc[m[1]] = m[2].trim()
    return acc
  }, {})
}

const env = readEnv(path.join(appDir, '.env'))
const deploymentId = env['DEPLOYMENT_ID'] || ''

function run(cmd, cwd) {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { cwd: cwd || rootDir, stdio: 'inherit' })
}

console.log(`\n── Deploy: ${appName} ──────────────────────`)

// 1. Build
run(`npm run build -w apps/${appName}`)

// 2. Push
run(`"${clasp}" push --force`, appDir)

// 3. Deploy
if (deploymentId) {
  run(`"${clasp}" deploy --deploymentId ${deploymentId}`, appDir)
  console.log(`\n✓ Updated deployment: ${deploymentId}`)
} else {
  console.log('\n⚠  DEPLOYMENT_ID not set in .env — creating new deployment...')
  run(`"${clasp}" deploy`, appDir)
  console.log(`\n→ Copy the deployment ID above and add to apps/${appName}/.env:`)
  console.log(`  DEPLOYMENT_ID=<id>`)
}

console.log(`\n✓ Done: apps/${appName}\n`)
