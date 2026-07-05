import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbzMPGoDTaqWekIBsr_U_cFzyjaQvkOJnHKDa-E8iTvPK-DUitgJopOyk6F_uAXha0pr/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})
