import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbxyehcR2xPmc-toChugjvqENnK23j_g4v_Af3RqqYjGl4cGeXhgNmduBJTZbtTVbuNi/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})
