import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbxMR6-OHYVLwfBXUhYkBcj7ZInHsRX83Yf1s6aP-_4Jyoo-DT8J_oBRqr_DVl-srxM4/exec'),
        secure: true,
      }
    }
  }
})
