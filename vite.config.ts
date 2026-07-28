
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // بسیار مهم برای اندروید: مسیردهی نسبی
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    watch: {
      ignored: ['**/android/**'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})

