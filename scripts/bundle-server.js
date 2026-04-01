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
const outFile = path.join(outDir, 'main.js');

// ── gas-core files (load order matters — dependencies first) ─────────────────
const GAS_CORE_FILES = [
  'config-base.js',
  'cache.js',
  'utils.js',
  'sheets-crud.js',
  'auth-core.js',
  'drive-io.js',
  'license.js',
];

// ── App-specific server files (load order matters) ───────────────────────────
// Auto-detect: all .js files in src/server/ except __tests__
const appFiles = fs.readdirSync(serverDir)
  .filter(f => f.endsWith('.js') && !f.startsWith('_'))
  .sort((a, b) => {
    // config first, then sheets, auth, other modules, main last
    const order = ['config.js', 'sheets.js', 'auth.js'];
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (a === 'main.js') return 1;
    if (b === 'main.js') return -1;
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ── Concatenate: gas-core first, then app files ──────────────────────────────
const parts = [];

GAS_CORE_FILES.forEach(f => {
  const filePath = path.join(gasCoreDir, f);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    parts.push(`// ---- gas-core/${f} ----\n${content}`);
  }
});

appFiles.forEach(f => {
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
const totalFiles = GAS_CORE_FILES.length + appFiles.length;
console.log(`  ✓ Bundled ${totalFiles} files (${GAS_CORE_FILES.length} gas-core + ${appFiles.length} app) → apps/${appName}/dist/gas/main.js`);
