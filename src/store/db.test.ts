// По настоящей базе: сначала `npm run data` (tools/build.py).
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import initSqlJs from 'sql.js'
import { beforeAll, expect, test } from 'vitest'
import { gender } from '../core/exercises/gender.ts'
import { plural } from '../core/exercises/plural.ts'
import { pool } from '../core/pool.ts'
import { around } from '../core/text.ts'
import { LEVELS } from '../core/types.ts'
import { type Data, open } from './db.ts'

let data: Data

beforeAll(async () => {
  const SQL = await initSqlJs()
  data = open(new SQL.Database(gunzipSync(readFileSync('build/satzbau.sqlite.gz'))))
})

test('в базе есть версия и источники', () => {
  expect(data.meta.version).toMatch(/^0\.2\.\d+$/)
  expect(data.meta.attribution).toContain('Tatoeba')
})

test('пул уровня вложен в следующий; порядок — уровень, потом частотность', () => {
  const [a1, a2, b1] = LEVELS.map((l) => pool(data.nouns, l))
  expect(a1!.length).toBeGreaterThan(500)
  expect(a1!.length).toBeLessThan(a2!.length)
  expect(a2!.length).toBeLessThan(b1!.length)
  expect(b1!.slice(0, a1!.length)).toEqual(a1)
  const ranks = a1!.map((w) => w.freq ?? Infinity)
  expect(ranks).toEqual([...ranks].sort((x, y) => x - y))
})

test('темы: каждое слово курса хотя бы в одной, пул темы — в её порядке', () => {
  expect(data.themes).toHaveLength(31)
  const inThemes = new Set(data.themes.flatMap((t) => t.words))
  expect(data.nouns.filter((w) => !inThemes.has(w.id))).toEqual([])
  const health = data.themes.find((t) => t.id === 'health')!
  const a1 = pool(data.nouns, 'A1', health)
  expect(a1.length).toBeGreaterThan(20)
  const at = a1.map((w) => health.words.indexOf(w.id))
  expect(at).toEqual([...at].sort((x, y) => x - y))
})

test('род: у каждого слова пула род есть, только множественного нет', () => {
  const fit = data.nouns.filter(gender.fits)
  expect(fit.length).toBeGreaterThan(2000)
  expect(fit.every((w) => w.gender.length > 0 && w.gender.every((g) => ['m', 'f', 'n'].includes(g)))).toBe(true)
  expect(fit.find((w) => w.lemma === 'Shorts')).toBeUndefined()
})

test('в каждом примере подсвечивается именно слово', () => {
  const miss: string[] = []
  let n = 0
  for (const w of data.nouns) {
    const ex = data.example(w.id)
    if (!ex) continue
    n++
    if (around(ex.de, ex.word, ex.nth)[1] !== ex.word) miss.push(`${w.id}: ${ex.de}`)
  }
  expect(n).toBeGreaterThan(1500)
  expect(miss).toEqual([])
})

test('множественное: почти все формы в пяти типах; пример — со словом во множественном', () => {
  const fit = data.nouns.filter(plural.fits)
  expect(fit.length).toBeGreaterThan(1900)
  let n = 0
  for (const w of fit) {
    const ex = data.example(w.id, true)
    if (!ex) continue
    n++
    expect(around(ex.de, ex.word, ex.nth)[1]).toBe(ex.word)
  }
  expect(n).toBeGreaterThan(500)
})

test('подсказки рода: у большинства слов, согласованы с родом, у каждой — два источника', () => {
  const fit = data.nouns.filter(gender.fits)
  let n = 0
  for (const w of fit) {
    const h = data.hint(w.id)
    if (!h) continue
    n++
    expect(h.sources.length).toBeGreaterThanOrEqual(2)
    expect(h.share).toBeGreaterThan(0)
    // верная подсказка предсказывает род слова; исключение — другой род; у сложного слова род берётся от части
    if (h.head) expect(h.ok).toBe(true)
    else expect(h.gender === w.gender[0]).toBe(h.ok)
  }
  expect(n).toBeGreaterThan(1300)
  expect(data.hint('n:Zeitung')).toMatchObject({ text: '-ung → die', ok: true })
  expect(data.hint('n:Haltestelle')).toMatchObject({ head: 'Stelle', ok: true })
  expect(data.hint('n:Auge')).toMatchObject({ text: '-e → die', ok: false })
})
