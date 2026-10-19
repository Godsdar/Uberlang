import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = import.meta.dirname

export default defineConfig({
  root,
  base: './',
  worker: { format: 'es' },
  server: { proxy: { '/api': 'http://127.0.0.1:8788' } },
  resolve: {
    alias: { '@shared': resolve(root, '../src/shared') }
  },
  plugins: [react(), {
    name: 'local-development-csp',
    apply: 'serve',
    // Vite injects a refresh preamble and a websocket client only in development.
    // Production HTML keeps its restrictive CSP, with same-origin API access.
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/g, '')
    }
  }],
  build: {
    rollupOptions: {
      input: {
        notebook: resolve(root, 'index.html'),
        concept: resolve(root, 'concept/index.html')
      }
    },
    outDir: resolve(root, 'dist'),
    emptyOutDir: true
  }
})
