import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbz6GarbBBKkawvGe3k3FlFQbCUCRP_v4niPa7Ci86ECT8BoGLxzHA0kw4jsY8QiPAi0/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})
