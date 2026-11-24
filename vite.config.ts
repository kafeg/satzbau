import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Собранные данные едут отдельными файлами, а не внутри JS: их кэширует service worker,
// и смена данных не переписывает весь бандл (docs/architecture.md). В дев-режиме их отдаёт
// сам Vite из корня проекта, поэтому путь один и тот же в обоих режимах.
// sentences.json грузится отдельно и только на экране слов: он весит столько же,
// сколько весь остальной бандл данных, а нужен одному экрану. В precache он всё равно
// попадает, поэтому офлайн работает.
const DATA = ['nouns', 'verbs', 'adjs', 'themes', 'templates', 'explain', 'meta', 'sentences']

function data(): Plugin {
  return {
    name: 'satzbau-data',
    generateBundle() {
      for (const name of DATA) {
        this.emitFile({
          type: 'asset',
          fileName: `content/build/${name}.json`,
          source: readFileSync(`content/build/${name}.json`),
        })
      }
    },
  }
}

export default defineConfig({
  base: '/satzbau/',
  plugins: [
    react(),
    data(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon-180.png'],
      manifest: {
        name: 'satzbau — немецкая грамматика',
        short_name: 'satzbau',
        description: 'Офлайн-тренажёр падежей, артиклей и окончаний для A1–B1',
        lang: 'ru',
        start_url: '/satzbau/',
        scope: '/satzbau/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F5F4EF',
        theme_color: '#F5F4EF',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,png,svg,woff2}'],
        navigateFallback: '/satzbau/index.html',
      },
    }),
  ],
  build: { target: 'es2022' },
})
