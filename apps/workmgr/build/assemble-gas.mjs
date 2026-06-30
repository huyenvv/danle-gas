// assemble-gas.mjs — copies client index.html + appsscript.json into dist/gas/
// Run after build:client and build:gas have completed.
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const files = [
  {
    src: resolve(root, 'dist/gas/index.html'),   // vite outDir is dist/gas
    dest: resolve(root, 'dist/gas/index.html'),  // already there; copy is a no-op but validates presence
    label: 'index.html (client singlefile)',
  },
  {
    src: resolve(root, 'appsscript.json'),
    dest: resolve(root, 'dist/gas/appsscript.json'),
    label: 'appsscript.json',
  },
]

for (const { src, dest, label } of files) {
  if (!existsSync(src)) {
    console.error(`assemble-gas: MISSING ${src}`)
    process.exit(1)
  }
  copyFileSync(src, dest)
  console.log(`assemble-gas: copied ${label} → dist/gas/`)
}

console.log('assemble-gas: done — dist/gas/ ready for clasp push')
