// Слои docs/app.md: core — чистое ядро, store — браузер, ui — экраны.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !e.name.includes('.test.') ? [join(dir, e.name)] : [],
  )
}

const imports = (f: string) => [...readFileSync(f, 'utf8').matchAll(/from '([^']+)'/g)].map((m) => m[1]!)

test('ядро не знает ни экранов, ни браузера', () => {
  const bad = files('src/core').flatMap((f) =>
    imports(f).filter((i) => /\/(store|ui)\//.test(i) || /^(react|sql\.js)/.test(i)).map((i) => `${f}: ${i}`),
  )
  const browser = files('src/core').filter((f) => /\b(window|document|indexedDB|localStorage|navigator)\b/.test(readFileSync(f, 'utf8')))
  expect([...bad, ...browser]).toEqual([])
})

test('хранилище не знает экранов', () => {
  const bad = files('src/store').flatMap((f) => imports(f).filter((i) => /\/ui\/|^react/.test(i)).map((i) => `${f}: ${i}`))
  expect(bad).toEqual([])
})
