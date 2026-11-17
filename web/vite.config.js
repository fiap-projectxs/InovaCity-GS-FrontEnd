import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' permite publicar em qualquer subpasta (ex.: GitHub Pages) com HashRouter.
export default defineConfig({
  base: './',
  plugins: [react()],
})
