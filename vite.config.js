import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/cdband-manager/',
  server: {
    host: '0.0.0.0',
  },
})
