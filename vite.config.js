import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbyjCHmBDxZqntyn6D-Jyujc4x3zhT8kuz0-cqE913CsYn_ZLe4artZKVxQtmdtoUGBb/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})
