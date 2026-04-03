import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycby3mdfve15pEoJt5PF4yFW_7FsJO_r6VOx-khcyRHUoBTmSq3yq1DKEww58TEZD15bG/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})