import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    manifest: {
      name: 'GR7 — Painel de Implantação',
      short_name: 'GR7 Painel',
      description: 'Painel interno de gestão da implantação de clientes da GR7 Automação',
      theme_color: '#0078d4',
      background_color: '#1e1e1e',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml' },
        { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      ],
    },
  }), cloudflare()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})