import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  server: {
    // Remove global CORS headers - we'll handle this per-component
    proxy: {
      // No proxy needed, just removing conflicting headers
    }
  }
})
