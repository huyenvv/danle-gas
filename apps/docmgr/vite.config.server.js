import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serverDir = resolve(__dirname, 'src/server')

// Collect all server JS files except __tests__
const serverFiles = readdirSync(serverDir)
  .filter(f => f.endsWith('.js') && !f.startsWith('_'))
  .map(f => resolve(serverDir, f))

export default defineConfig({
  build: {
    lib: {
      entry: serverFiles,
      formats: ['iife'],
      name: 'GASBundle',
      fileName: () => 'main.js',
    },
    outDir: 'dist/gas',
    emptyOutDir: false,
    rollupOptions: {
      // GAS globals — do not bundle
      external: [],
      output: {
        // Preserve top-level function names for GAS
        generatedCode: { arrowFunctions: false },
      },
    },
    minify: false, // obfuscator handles this
  },
})
