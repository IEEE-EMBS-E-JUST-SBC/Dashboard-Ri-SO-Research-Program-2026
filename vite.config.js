import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbw2hrpO7XzS6TO2B2AouxPIdAFLTSJi1R49ByPq47QjzGjowiPBAbXyS0_mRs25xlGU/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})
