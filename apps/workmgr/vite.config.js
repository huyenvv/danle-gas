import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  root: resolve(__dirname, 'src/client'),
  server: { port: 5175 },
  build: {
    outDir: resolve(__dirname, 'dist/gas'),
    // true: vite chạy ĐẦU chuỗi build (trước build:gas) → dọn dist/gas rồi ghi
    // index.html; build:gas ghi Code.js sau. Tránh artifact cũ đọng lại.
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/client/index.html'),
    },
  },
})
