const fs = require('fs');
const path = require('path');

// Usage: node scripts/convert-gs.js --app <name>
const appIdx = process.argv.indexOf('--app');
const appName = appIdx !== -1 ? process.argv[appIdx + 1] : null;
if (!appName) {
  console.error('Usage: node scripts/convert-gs.js --app <name>');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'apps', appName);
const outDir = path.join(appDir, 'dist');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Copy appsscript.json as-is
const manifest = path.join(appDir, 'appsscript.json');
if (fs.existsSync(manifest)) {
  fs.copyFileSync(manifest, path.join(outDir, 'appsscript.json'));
  console.log('  ✓ appsscript.json');
}

// Convert .js → .gs (only top-level .js files in the app dir, skip dev.js)
const files = fs.readdirSync(appDir).filter(f => f.endsWith('.js') && f !== 'dev.js');
for (const file of files) {
  const content = fs.readFileSync(path.join(appDir, file), 'utf8');
  const gsName = file.replace(/\.js$/, '.gs');
  fs.writeFileSync(path.join(outDir, gsName), content, 'utf8');
  console.log(`  ✓ ${file} → ${gsName}`);
}

console.log(`\n📁 Output: apps/${appName}/dist/`);
