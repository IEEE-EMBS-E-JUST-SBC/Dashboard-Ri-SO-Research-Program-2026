import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbwGNyERLjQN_xDphUDsaem87-nT2hG98RT6boXnesgrabKSkLqRB4VVQZYdlC8FNI8/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})