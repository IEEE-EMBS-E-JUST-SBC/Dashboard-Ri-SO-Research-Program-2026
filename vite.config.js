import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbzQzCZjI9pXZ-JGhGT_kliitlBueajBRg9bW44triRQbNAagc0HZExun4s3sQHl2tz5/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})