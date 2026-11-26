import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// база собирается tools/build.py; в деве её отдаёт сам Vite из корня, путь в обоих режимах один
const DB = 'build/satzbau.sqlite.gz'
const VERSION = `0.1.${execSync('git rev-list --count HEAD').toString().trim()}`

function db(): Plugin {
  return {
    name: 'satzbau-db',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: DB, source: readFileSync(DB) })
    },
  }
}

export default defineConfig({
  base: '/satzbau/',
  define: { __VERSION__: JSON.stringify(VERSION), __DB__: JSON.stringify(DB) },
  plugins: [
    react(),
    db(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon-180.png', 'favicon.svg', 'favicon-32.png'],
      manifest: {
        name: 'satzbau — немецкая грамматика',
        short_name: 'satzbau',
        description: 'Офлайн-тренажёр немецкой грамматики для A1–B1',
        lang: 'ru',
        start_url: '/satzbau/',
        scope: '/satzbau/',
        display: 'standalone',
        background_color: '#F5F4EF',
        theme_color: '#F5F4EF',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,wasm,gz}'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        navigateFallback: '/satzbau/index.html',
      },
    }),
  ],
  build: { target: 'es2022' },
})
