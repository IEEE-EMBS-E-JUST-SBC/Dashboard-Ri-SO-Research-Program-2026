import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbzDc-Jp9Sni0DeCunhPFTBWvhcxsrrORfoA-dQGzKqDOeETe4DWYoNaOSecLd0IeXJU/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})
