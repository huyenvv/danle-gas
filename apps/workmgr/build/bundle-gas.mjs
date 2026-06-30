import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const outfile = resolve(root, 'dist/gas/Code.js')

// GAS only exposes TOP-LEVEL `function` declarations to `google.script.run`
// (and resolves doGet from them). esbuild wraps the bundle in an IIFE, so we
// expose the module under a global name and append a real top-level wrapper
// function for each entrypoint. A `globalThis.x = x` inside the IIFE is NOT
// surfaced to google.script.run — this wrapper layer is what makes it work.
const GLOBAL = '__WM'
const ENTRYPOINTS = ['doGet', 'api_getLabels', 'api_addLabel', 'api_updateLabel', 'api_deleteLabel']

await build({
  entryPoints: [resolve(root, 'src/transport/gas-entry.ts')],
  bundle: true,
  format: 'iife',
  globalName: GLOBAL,
  target: 'es2019',
  minify: true,
  outfile,
  legalComments: 'none',
})

const wrappers = ENTRYPOINTS
  .map((n) => `function ${n}() { return ${GLOBAL}.${n}.apply(this, arguments); }`)
  .join('\n')
writeFileSync(outfile, readFileSync(outfile, 'utf8') + '\n' + wrappers + '\n')
console.log('GAS bundle: dist/gas/Code.js (+ ' + ENTRYPOINTS.length + ' top-level wrappers)')
