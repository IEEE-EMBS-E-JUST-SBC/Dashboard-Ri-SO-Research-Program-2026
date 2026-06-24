import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbwL6HZw8nzo9j-WG0aryOvmo6DExuQR9Ejeo6nPY2PKAHaQiMP4xVOsyAwpgReMjzw2/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})
