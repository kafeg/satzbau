// По настоящей базе: сначала `npm run data` (tools/build.py).
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import initSqlJs from 'sql.js'
import { beforeAll, expect, test } from 'vitest'
import { around } from '../core/text.ts'
import { LEVELS } from '../core/types.ts'
import { type Data, open } from './db.ts'

let data: Data

beforeAll(async () => {
  const SQL = await initSqlJs()
  data = open(new SQL.Database(gunzipSync(readFileSync('build/satzbau.sqlite.gz'))))
})

test('в базе есть версия и источники', () => {
  expect(data.meta.version).toMatch(/^0\.1\.\d+$/)
  expect(data.meta.attribution).toContain('Tatoeba')
})

test('слова упражнения: курс, род есть, без только-множественного, уровни вложены', () => {
  const [a1, a2, b1] = LEVELS.map((l) => data.genderWords(l))
  expect(a1!.length).toBeGreaterThan(500)
  expect(a1!.length).toBeLessThan(a2!.length)
  expect(a2!.length).toBeLessThan(b1!.length)
  for (const w of b1!) {
    expect(w.gender.length).toBeGreaterThan(0)
    expect(w.gender.every((g) => ['m', 'f', 'n'].includes(g))).toBe(true)
  }
  expect(b1!.find((w) => w.lemma === 'Shorts')).toBeUndefined()
})

test('в каждом примере подсвечивается именно слово', () => {
  const miss: string[] = []
  let n = 0
  for (const w of data.genderWords('B1')) {
    const ex = data.example(w.id)
    if (!ex) continue
    n++
    if (around(ex.de, ex.word, ex.nth)[1] !== ex.word) miss.push(`${w.id}: ${ex.de}`)
  }
  expect(n).toBeGreaterThan(1500)
  expect(miss).toEqual([])
})
