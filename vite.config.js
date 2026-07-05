import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbwKY3kjsqGRCu-IU_v2ekXzIGo5HZMjFnPNcfp6piWj1Z6cA0wp3DpIJoNixD19PO4g/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})
