
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
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})

