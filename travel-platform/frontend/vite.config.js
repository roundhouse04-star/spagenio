import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  base: '/travel/',
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['travel.spagenio.com'],
    hmr: {
      clientPort: 443,
      path: '/travel/',
    },
  },
})
