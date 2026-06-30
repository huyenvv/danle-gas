const fs = require('fs');
const path = require('path');

// ── Parse --app argument ─────────────────────────────────────────────────────
const appIdx = process.argv.indexOf('--app');
const appName = appIdx !== -1 ? process.argv[appIdx + 1] : null;
if (!appName) {
  console.error('Usage: node scripts/bundle-server.js --app <name>');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'apps', appName);
const gasCoreDir = path.join(rootDir, 'packages', 'gas-core');
const serverDir = path.join(appDir, 'src', 'server');
const outDir = path.join(appDir, 'dist', 'gas');
const outFile = path.join(outDir, 'Code.js');

// ── gas-core files (load order matters — dependencies first) ─────────────────
const GAS_CORE_FILES = [
  'config-base.js',
  'cache.js',
  'utils.js',
  'sheets-crud.js',
  'auth-core.js',
  'access-token.js',
  'refresh-token.js',
  'session-epoch.js',
  'sso.js',
  'drive-io.js',
  'license.js',
];

// ── Chế độ self-contained: bỏ gas-core, nạp theo apps/<app>/server-files.js ────
let appPkg = {};
try { appPkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')); } catch (e) {}
const selfContained = !!(appPkg.gasBundle && appPkg.gasBundle.selfContained);

let orderedAppFiles;
if (selfContained) {
  orderedAppFiles = require(path.join(appDir, 'server-files.js')); // relative tới serverDir
} else {
  orderedAppFiles = fs.readdirSync(serverDir)
    .filter(f => f.endsWith('.js') && !f.startsWith('_'))
    .sort((a, b) => {
      const order = ['config.js', 'sheets.js', 'auth.js'];
      const ai = order.indexOf(a), bi = order.indexOf(b);
      if (a === 'main.js') return 1;
      if (b === 'main.js') return -1;
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ── Concatenate: gas-core first (non-self-contained), then app files ─────────
const parts = [];
if (!selfContained) {
  GAS_CORE_FILES.forEach(f => {
    const filePath = path.join(gasCoreDir, f);
    if (fs.existsSync(filePath)) {
      parts.push(`// ---- gas-core/${f} ----\n${fs.readFileSync(filePath, 'utf8')}`);
    }
  });
}
orderedAppFiles.forEach(f => {
  const content = fs.readFileSync(path.join(serverDir, f), 'utf8');
  parts.push(`// ---- ${f} ----\n${content}`);
});

let bundle = parts.join('\n\n');

// ── Inject encoded env vars ──────────────────────────────────────────────────

function encode(value) {
  return Buffer.from(value, 'utf8').toString('base64').split('').reverse().join('');
}

const dotenvPath = path.join(appDir, '.env');
if (fs.existsSync(dotenvPath)) {
  fs.readFileSync(dotenvPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

const replacements = {
  '__ENCODED_LICENSE_URL__': encode(process.env.LICENSE_SERVER_URL || ''),
  '__ENCODED_SECRET_SALT__': encode(process.env.SECRET_SALT || ''),
  '__APP_ID__': process.env.APP_ID || '',
  '__APP_VERSION__': process.env.APP_VERSION || '',
};

Object.entries(replacements).forEach(([placeholder, value]) => {
  bundle = bundle.split(placeholder).join(value);
});

fs.writeFileSync(outFile, bundle, 'utf8');
const gasCoreCount = selfContained ? 0 : GAS_CORE_FILES.length;
const totalFiles = gasCoreCount + orderedAppFiles.length;
console.log(`  ✓ Bundled ${totalFiles} files (${gasCoreCount} gas-core + ${orderedAppFiles.length} app) → apps/${appName}/dist/gas/Code.js`);

// ── Copy appsscript.json to dist/gas if it exists ────────────────────────────
const manifestSrc = path.join(appDir, 'appsscript.json');
const manifestDest = path.join(outDir, 'appsscript.json');
if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDest);
  console.log(`  ✓ appsscript.json → apps/${appName}/dist/gas/appsscript.json`);
}
