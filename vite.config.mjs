import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite app config. The sandbox injects host allowlist entries for the e2b preview domain;
// we keep those and add the React plugin so JSX/Fast Refresh use the automatic runtime.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app'],
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app'],
  },
})
