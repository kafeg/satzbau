import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// база собирается tools/build.py; в деве её отдаёт сам Vite из корня, путь в обоих режимах один
const DB = 'build/satzbau.sqlite.gz'
// 0.2.N: N — коммитов после тега v0.2 (docs/data-model.md, «Версия»)
const [TAG, N] = execSync('git describe --tags --match "v[0-9]*.[0-9]*" --long').toString().trim().split('-')
const VERSION = `${TAG!.slice(1)}.${N}`

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
      // обновление — по кнопке на главной: сама перезагрузка оборвала бы урок
      registerType: 'prompt',
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
