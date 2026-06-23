import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheets-api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sheets-api/, '/macros/s/AKfycbwOjUi7l5j8NnmLCe59_2-Ep52wHU13xgeC4dQxL6xfy-4-r1b10SpyBQXjwYyIZTXm/exec'),
        secure: true,
        followRedirects: true
      }
    }
  }
})