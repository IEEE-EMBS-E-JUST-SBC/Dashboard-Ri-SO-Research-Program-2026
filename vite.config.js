import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbzymrLV99QPZ4GJIQBHmCd5uYZb_kxym2TEsId-LdpxF6lmHUFKgEz_9OPdBSNPX45y/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})
