// client/vite.config.js (or project_root/vite.config.js)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // string shorthand: http://localhost:5173/api -> http://localhost:3000/api
      '/api': {
        target: 'http://localhost:3000', // Assuming your backend runs on port 3000
        changeOrigin: true, // Recommended for most cases
        // secure: false,      // Uncomment if your backend is HTTP and not HTTPS
        // rewrite: (path) => path.replace(/^\/api/, '') // Only if your backend routes DON'T start with /api
      }
    }
  }
})
