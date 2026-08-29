import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite app config. The sandbox injects host allowlist entries for the e2b preview domain;
// we keep those and add the React plugin so JSX/Fast Refresh use the automatic runtime.
//
// GitHub Pages hosting adapter: the production project site is served under
// `/neko-sudoku-web/`, so the production build sets Vite `base` accordingly. `base` is read from
// the VITE_BASE env var (set only by `npm run build:pages`) and defaults to `/` — this keeps
// `vite dev`, the ordinary `npm run build`, and the Playwright preview at the root path exactly
// as before, so no existing behaviour or test changes.
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
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
